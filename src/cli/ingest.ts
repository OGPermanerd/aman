#!/usr/bin/env node

/**
 * CLI entry point for ingesting 13F filings.
 *
 * Usage:
 *   pnpm ingest --fund 1336528         # Ingest a single fund by CIK
 *   pnpm ingest --all                  # Ingest all active funds from config
 *   pnpm ingest --all --quarters 4     # Fetch 4 quarters for all funds
 *   pnpm ingest --schedule             # Start daily filing checker
 *   pnpm ingest --help                 # Print usage
 *
 * Options:
 *   --fund CIK            Ingest a single fund by CIK
 *   --all                 Ingest all active funds from config
 *   --quarters N          Number of quarters to fetch (default: 2)
 *   --resolve-cusips      Resolve CUSIPs after ingestion (default: true)
 *   --no-resolve-cusips   Skip CUSIP resolution
 *   --classify-sectors    Classify sectors after ingestion (default: true)
 *   --no-classify-sectors Skip sector classification
 *   --schedule            Start scheduled filing checker instead of one-time ingest
 *   --help                Print this usage information
 */

import { eq } from 'drizzle-orm';

import { getDb } from '../db/connection';
import { funds } from '../db/schema';
import { syncFundsToDb } from '../config/loader';
import { ingestFund } from '../ingestion/pipeline';
import { resolveNewCusips } from '../security/cusip-resolver';
import { classifySectorsFromHoldings } from '../security/sector-classifier';
import { startScheduler } from './check-filings';

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  fund?: string;
  all: boolean;
  quarters: number;
  resolveCusips: boolean;
  classifySectors: boolean;
  schedule: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    all: false,
    quarters: 2,
    resolveCusips: true,
    classifySectors: true,
    schedule: false,
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--fund':
        args.fund = argv[++i];
        break;
      case '--all':
        args.all = true;
        break;
      case '--quarters':
        args.quarters = parseInt(argv[++i], 10) || 2;
        break;
      case '--resolve-cusips':
        args.resolveCusips = true;
        break;
      case '--no-resolve-cusips':
        args.resolveCusips = false;
        break;
      case '--classify-sectors':
        args.classifySectors = true;
        break;
      case '--no-classify-sectors':
        args.classifySectors = false;
        break;
      case '--schedule':
        args.schedule = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        console.warn(`Unknown argument: ${argv[i]}`);
    }
  }

  return args;
}

function printUsage(): void {
  console.log(`
HedgeLens 13F Filing Ingestion CLI

Usage:
  pnpm ingest --fund <CIK>     Ingest a single fund by CIK
  pnpm ingest --all             Ingest all active funds from config
  pnpm ingest --schedule        Start daily filing checker

Options:
  --fund <CIK>            Ingest a single fund by CIK number
  --all                   Ingest all active funds from config
  --quarters <N>          Number of quarters to fetch (default: 2)
  --resolve-cusips        Resolve CUSIPs after ingestion (default: true)
  --no-resolve-cusips     Skip CUSIP resolution
  --classify-sectors      Classify sectors after ingestion (default: true)
  --no-classify-sectors   Skip sector classification
  --schedule              Start scheduled filing checker (daily during filing windows)
  --help, -h              Print this usage information

Examples:
  pnpm ingest --fund 1336528              # Ingest Pershing Square, 2 quarters
  pnpm ingest --fund 1336528 --quarters 4 # Ingest Pershing Square, 4 quarters
  pnpm ingest --all --quarters 1          # Ingest all funds, latest quarter only
  pnpm ingest --all --no-resolve-cusips   # Ingest without CUSIP resolution
  `);
}

// ---------------------------------------------------------------------------
// Schema push helper
// ---------------------------------------------------------------------------

async function ensureSchema(): Promise<void> {
  // Import drizzle-kit push programmatically is not straightforward.
  // The schema is already pushed via `pnpm db:push` during setup.
  // For safety, we just verify tables exist by running a simple query.
  try {
    const { db } = getDb();
    db.select().from(funds).limit(1).all();
  } catch {
    console.error(
      'Database tables not found. Run `pnpm db:push` first to create the schema.',
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (args.schedule) {
    console.log('[CLI] Starting scheduled filing checker...');
    startScheduler();
    // Keep process running
    return;
  }

  if (!args.fund && !args.all) {
    printUsage();
    process.exit(1);
  }

  const startTime = Date.now();
  console.log('[CLI] HedgeLens 13F Filing Ingestion');
  console.log('='.repeat(50));

  // 1. Initialize database
  await ensureSchema();
  const { db } = getDb();

  // 2. Sync fund config to DB
  console.log('[CLI] Syncing fund configuration...');
  const syncResult = await syncFundsToDb(db);
  console.log(
    `[CLI] Fund config synced: ${syncResult.upserted} funds, ${syncResult.deactivated} deactivated`,
  );

  // 3. Determine which funds to ingest
  let ciksToIngest: string[] = [];

  if (args.fund) {
    // Single fund mode
    const fundCik = args.fund.replace(/^0+/, '');
    const existing = db
      .select()
      .from(funds)
      .where(eq(funds.cik, fundCik))
      .limit(1)
      .all();

    if (existing.length === 0) {
      console.warn(
        `[CLI] Warning: CIK ${fundCik} not in fund config. Will attempt ingestion anyway.`,
      );
    }
    ciksToIngest = [fundCik];
  } else if (args.all) {
    // All active funds
    const activeFunds = db
      .select()
      .from(funds)
      .where(eq(funds.active, true))
      .all();

    ciksToIngest = activeFunds.map((f) => f.cik);
    console.log(`[CLI] Found ${ciksToIngest.length} active funds to ingest`);
  }

  // 4. Ingest each fund
  let totalHoldings = 0;
  let totalErrors: string[] = [];
  let fundsProcessed = 0;

  for (const cik of ciksToIngest) {
    try {
      const result = await ingestFund(db, cik, { quarters: args.quarters });
      totalHoldings += result.totalHoldings;
      totalErrors = totalErrors.concat(result.errors);
      fundsProcessed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[CLI] Failed to ingest fund CIK ${cik}: ${message}`);
      totalErrors.push(`CIK ${cik}: ${message}`);
    }
  }

  // 5. Resolve CUSIPs
  let resolveResult = { resolved: 0, unmapped: 0, total: 0, errors: [] as string[] };
  if (args.resolveCusips) {
    console.log('\n[CLI] Resolving CUSIPs...');
    resolveResult = await resolveNewCusips(db);
  }

  // 6. Classify sectors
  let classifyResult = { classified: 0, skipped: 0 };
  if (args.classifySectors) {
    console.log('\n[CLI] Classifying sectors...');
    classifyResult = await classifySectorsFromHoldings(db);
  }

  // 7. Print summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(50));
  console.log('[CLI] Ingestion Summary');
  console.log('='.repeat(50));
  console.log(`  Funds processed:    ${fundsProcessed}`);
  console.log(`  Total holdings:     ${totalHoldings}`);
  console.log(`  CUSIPs resolved:    ${resolveResult.resolved}/${resolveResult.total}`);
  console.log(`  CUSIPs unmapped:    ${resolveResult.unmapped}`);
  console.log(`  Sectors classified: ${classifyResult.classified}`);
  console.log(`  Sectors skipped:    ${classifyResult.skipped}`);
  console.log(`  Errors:             ${totalErrors.length}`);
  console.log(`  Duration:           ${elapsed}s`);

  if (totalErrors.length > 0) {
    console.log('\nErrors:');
    for (const err of totalErrors) {
      console.log(`  - ${err}`);
    }
  }

  // Exit with appropriate code
  process.exit(totalErrors.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('[CLI] Fatal error:', error);
  process.exit(1);
});
