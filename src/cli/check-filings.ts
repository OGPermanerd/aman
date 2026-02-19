/**
 * Scheduled daily filing checker using node-cron.
 *
 * Runs daily at 6:00 AM during filing window months (Feb, May, Aug, Nov)
 * when 13F filings are due. Ingests latest quarter for all active funds,
 * resolves new CUSIPs, and logs results.
 *
 * Usage:
 *   import { startScheduler } from './check-filings.js';
 *   startScheduler(); // Starts cron job
 *
 *   Or via CLI:
 *   pnpm ingest --schedule
 */

import { schedule, type ScheduledTask } from 'node-cron';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/connection.js';
import { funds } from '../db/schema.js';
import { syncFundsToDb } from '../config/loader.js';
import { ingestFund } from '../ingestion/pipeline.js';
import { resolveNewCusips } from '../security/cusip-resolver.js';

// ---------------------------------------------------------------------------
// Filing window detection
// ---------------------------------------------------------------------------

/** Filing window months: Feb(2), May(5), Aug(8), Nov(11) -- when 13F filings are due */
const FILING_WINDOW_MONTHS = [2, 5, 8, 11];

/**
 * Returns true if the current month is a 13F filing window.
 * Filing windows are February, May, August, and November.
 */
export function isFilingWindow(date?: Date): boolean {
  const month = (date ?? new Date()).getMonth() + 1; // getMonth() is 0-indexed
  return FILING_WINDOW_MONTHS.includes(month);
}

// ---------------------------------------------------------------------------
// Checker logic
// ---------------------------------------------------------------------------

/**
 * Run a single filing check cycle:
 * 1. Sync fund config
 * 2. Ingest latest quarter for all active funds
 * 3. Resolve new CUSIPs
 */
async function runFilingCheck(): Promise<void> {
  console.log(`\n[Scheduler] Filing check started at ${new Date().toISOString()}`);

  if (!isFilingWindow()) {
    console.log('[Scheduler] Not in a filing window month. Skipping.');
    return;
  }

  const { db } = getDb();

  // Sync fund config
  await syncFundsToDb(db);

  // Get all active funds
  const activeFunds = db
    .select()
    .from(funds)
    .where(eq(funds.active, true))
    .all();

  console.log(`[Scheduler] Checking ${activeFunds.length} active funds...`);

  let totalNewFilings = 0;
  let totalHoldings = 0;
  let errors: string[] = [];

  for (const fund of activeFunds) {
    try {
      const result = await ingestFund(db, fund.cik, { quarters: 1 });
      totalNewFilings += result.newFilings;
      totalHoldings += result.totalHoldings;
      errors = errors.concat(result.errors);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Scheduler] Error ingesting ${fund.name} (${fund.cik}): ${message}`);
      errors.push(`${fund.cik}: ${message}`);
    }
  }

  // Resolve any new CUSIPs
  if (totalNewFilings > 0) {
    console.log('[Scheduler] Resolving new CUSIPs...');
    const resolveResult = await resolveNewCusips(db);
    console.log(
      `[Scheduler] Resolved ${resolveResult.resolved} new CUSIPs, ${resolveResult.unmapped} unmapped`,
    );
  }

  console.log(
    `[Scheduler] Check complete: ${totalNewFilings} new filings, ${totalHoldings} holdings, ${errors.length} errors`,
  );
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

/** The active cron task, exported for cleanup/testing */
export let scheduledTask: ScheduledTask | null = null;

/**
 * Start the scheduled filing checker.
 * Runs daily at 6:00 AM during filing window months (Feb, May, Aug, Nov).
 * Cron: 0 6 * 2,5,8,11 * (6 AM on any day of Feb, May, Aug, Nov)
 */
export function startScheduler(): ScheduledTask {
  console.log('[Scheduler] Starting filing checker...');
  console.log('[Scheduler] Schedule: Daily at 6:00 AM during Feb, May, Aug, Nov');
  console.log(`[Scheduler] Currently ${isFilingWindow() ? 'IN' : 'NOT in'} a filing window`);

  scheduledTask = schedule('0 6 * 2,5,8,11 *', () => {
    runFilingCheck().catch((error) => {
      console.error('[Scheduler] Unhandled error during filing check:', error);
    });
  });

  return scheduledTask;
}

/**
 * Stop the scheduled filing checker.
 */
export function stopScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[Scheduler] Filing checker stopped.');
  }
}
