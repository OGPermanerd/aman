/**
 * End-to-end ingestion orchestration.
 *
 * Fetches 13F filings from EDGAR, parses XML, normalizes values,
 * processes amendments, and stores quarterly holdings snapshots in SQLite.
 */

import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { filings, holdings } from '../db/schema';
import type * as schema from '../db/schema';
import { edgarClient } from './edgar-client';
import { discoverFilings } from './filing-discovery';
import {
  parseInfoTable,
  parseCoverPage,
  findInfoTableFilename,
} from './xml-parser';
import {
  detectValueFormat,
  normalizeHoldings,
  type NormalizedHolding,
} from './normalizer';
import { handleAmendment } from './amendment-handler';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface IngestResult {
  cik: string;
  fundName: string;
  quartersProcessed: number;
  totalHoldings: number;
  newFilings: number;
  skippedFilings: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Bulk insert helpers
// ---------------------------------------------------------------------------

/**
 * Insert holdings in batches, using the appropriate conflict strategy.
 *
 * Note: better-sqlite3 operations are synchronous under the hood.
 * Drizzle wraps them in promises but they resolve immediately.
 */
function insertHoldings(
  db: BetterSQLite3Database<typeof schema>,
  holdingsToStore: NormalizedHolding[],
  action: 'insert' | 'replace' | 'merge',
): number {
  if (holdingsToStore.length === 0) return 0;

  // Insert in batches of 500 to avoid SQLite variable limits
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < holdingsToStore.length; i += BATCH_SIZE) {
    const batch = holdingsToStore.slice(i, i + BATCH_SIZE);
    const values = batch.map((h) => ({
      fundCik: h.fundCik,
      reportQuarter: h.reportQuarter,
      cusip: h.cusip,
      nameOfIssuer: h.nameOfIssuer,
      titleOfClass: h.titleOfClass,
      value: h.value,
      shares: h.shares,
      shareType: h.shareType,
      putCall: h.putCall,
      investmentDiscretion: h.investmentDiscretion,
      filingAccession: h.filingAccession,
    }));

    // onConflictDoNothing for all cases: merge needs it for additive amendments,
    // insert/replace may hit duplicates from multi-manager filings or re-runs
    db.insert(holdings).values(values).onConflictDoNothing().run();

    inserted += batch.length;
  }

  return inserted;
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

/**
 * Ingest 13F filings for a single fund.
 *
 * 1. Discover filings from EDGAR submissions API
 * 2. For each quarter (oldest first), process each filing (oldest first):
 *    - Skip if already ingested (idempotent)
 *    - Fetch filing index, find info table filename
 *    - Fetch and parse cover page + info table XMLs
 *    - Normalize values (pre/post-2023)
 *    - Handle amendments (restatement replaces, new holdings merges)
 *    - Store filing metadata + holdings in a transaction
 */
export async function ingestFund(
  db: BetterSQLite3Database<typeof schema>,
  cik: string,
  options?: { quarters?: number },
): Promise<IngestResult> {
  const rawCik = cik.replace(/^0+/, '');
  console.log(`\n[Pipeline] Starting ingestion for CIK ${rawCik}...`);

  const result: IngestResult = {
    cik: rawCik,
    fundName: '',
    quartersProcessed: 0,
    totalHoldings: 0,
    newFilings: 0,
    skippedFilings: 0,
    errors: [],
  };

  // 1. Discover filings
  const quarterFilings = await discoverFilings(rawCik, {
    quarters: options?.quarters,
  });
  console.log(
    `[Pipeline] Found ${quarterFilings.length} quarter(s) of filings`,
  );

  // Process in chronological order (oldest first)
  const chronological = [...quarterFilings].reverse();

  for (const quarter of chronological) {
    console.log(
      `\n[Pipeline] Processing ${quarter.reportQuarter} (${quarter.reportDate}) - ${quarter.filings.length} filing(s)`,
    );
    result.quartersProcessed++;

    for (const filing of quarter.filings) {
      try {
        // Check if already ingested (idempotent)
        const existing = db
          .select()
          .from(filings)
          .where(eq(filings.accessionNumber, filing.accessionNumber))
          .limit(1)
          .all();

        if (existing.length > 0) {
          console.log(
            `[Pipeline] Skipping already-ingested filing ${filing.accessionNumber}`,
          );
          result.skippedFilings++;
          continue;
        }

        console.log(
          `[Pipeline] Processing ${filing.form} filing ${filing.accessionNumber} (filed ${filing.filingDate})`,
        );

        // Fetch filing index to find document filenames
        const indexJson = await edgarClient.getFilingIndex(
          rawCik,
          filing.accessionNumber,
        );
        const infoTableFilename = findInfoTableFilename(indexJson);

        // Fetch cover page (primary_doc.xml) and info table XML
        // Find the primary_doc filename from the index
        const items: any[] = indexJson.directory?.item ?? [];
        const primaryDocItem = items.find((item: any) =>
          String(item.name).toLowerCase().includes('primary_doc'),
        );
        const primaryDocFilename = primaryDocItem?.name ?? 'primary_doc.xml';

        const [coverXml, infoXml] = await Promise.all([
          edgarClient.getDocument(rawCik, filing.accessionNumber, primaryDocFilename),
          edgarClient.getDocument(rawCik, filing.accessionNumber, infoTableFilename),
        ]);

        // Parse cover page and info table
        const coverPage = parseCoverPage(coverXml);
        const rawHoldings = parseInfoTable(infoXml);

        if (!result.fundName && coverPage.filingManagerName) {
          result.fundName = coverPage.filingManagerName;
        }

        console.log(
          `[Pipeline] Parsed ${rawHoldings.length} holdings from info table`,
        );

        // Detect value format and normalize
        const valueFormat = detectValueFormat(filing.acceptanceDateTime);
        const normalized = normalizeHoldings(rawHoldings, {
          fundCik: rawCik,
          reportQuarter: quarter.reportQuarter,
          accessionNumber: filing.accessionNumber,
          valueFormat,
        });

        // Handle amendments
        const amendmentResult = handleAmendment(
          db,
          coverPage,
          normalized,
          rawCik,
          quarter.reportQuarter,
        );

        if (coverPage.isAmendment) {
          console.log(
            `[Pipeline] Amendment detected: ${coverPage.amendmentType} (action: ${amendmentResult.action})`,
          );
        }

        // Store filing metadata + holdings in a synchronous transaction
        // better-sqlite3 transactions are synchronous
        db.transaction((tx) => {
          // Insert filing metadata
          tx.insert(filings).values({
            fundCik: rawCik,
            accessionNumber: filing.accessionNumber,
            form: filing.form,
            filingDate: filing.filingDate,
            reportDate: filing.reportDate,
            acceptanceDateTime: filing.acceptanceDateTime,
            isAmendment: coverPage.isAmendment,
            amendmentType: coverPage.amendmentType ?? null,
            tableEntryTotal: coverPage.tableEntryTotal,
            tableValueTotal: coverPage.tableValueTotal,
            valueFormat,
            ingestedAt: new Date().toISOString(),
          }).run();
        });

        // Insert holdings (outside transaction since amendment handler may have already deleted)
        const storedCount = insertHoldings(
          db,
          amendmentResult.holdingsToStore,
          amendmentResult.action,
        );

        result.totalHoldings += storedCount;
        result.newFilings++;

        console.log(
          `[Pipeline] Stored ${storedCount} holdings for ${quarter.reportQuarter} (format: ${valueFormat})`,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        console.error(
          `[Pipeline] Error processing filing ${filing.accessionNumber}: ${message}`,
        );
        result.errors.push(
          `${filing.accessionNumber}: ${message}`,
        );
      }
    }
  }

  console.log(
    `\n[Pipeline] Complete: ${result.newFilings} new filings, ${result.skippedFilings} skipped, ${result.totalHoldings} total holdings stored`,
  );

  return result;
}
