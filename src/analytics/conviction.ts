import { eq, and } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { holdings } from '../db/schema.js';
import type * as schema from '../db/schema.js';
import type { ConvictionScore } from './types.js';
import { getAvailableQuarters, previousQuarter } from './quarter-utils.js';
import { computePortfolioWeights } from './portfolio-weights.js';

/**
 * Get the share count for a specific position in a specific quarter.
 * Returns null if the position was not held (equity only).
 */
function getShareCount(
  db: BetterSQLite3Database<typeof schema>,
  fundCik: string,
  cusip: string,
  quarter: string,
): number | null {
  const rows = db
    .select({ shares: holdings.shares })
    .from(holdings)
    .where(
      and(
        eq(holdings.fundCik, fundCik),
        eq(holdings.reportQuarter, quarter),
        eq(holdings.cusip, cusip),
        eq(holdings.putCall, ''),
      ),
    )
    .all();

  if (rows.length === 0) {
    return null;
  }

  return rows[0].shares;
}

/**
 * Count consecutive quarter additions for a position, working backwards from currentQuarter.
 *
 * An "addition" is when shares increased from the previous quarter.
 * The count starts from the most recent transition into currentQuarter
 * and walks backwards through consecutive quarters of increase.
 *
 * Returns 0 if: no prior quarter data, shares didn't increase, or position is new.
 */
function computeConsecutiveAdditions(
  db: BetterSQLite3Database<typeof schema>,
  fundCik: string,
  cusip: string,
  currentQuarter: string,
): number {
  // Get available quarters for this fund, sorted descending
  const quarters = getAvailableQuarters(db, fundCik);

  // Find the index of the current quarter
  const currentIdx = quarters.indexOf(currentQuarter);
  if (currentIdx === -1 || currentIdx >= quarters.length - 1) {
    // Current quarter not found or it's the earliest quarter -- no prior data
    return 0;
  }

  let count = 0;
  let checkQuarter = currentQuarter;

  // Walk backwards through quarters checking for share increases
  for (let i = currentIdx; i < quarters.length - 1; i++) {
    const priorQuarter = quarters[i + 1];

    // Verify quarters are actually consecutive (no gaps)
    try {
      const expectedPrior = previousQuarter(checkQuarter);
      if (priorQuarter !== expectedPrior) {
        // Gap in data -- stop counting
        break;
      }
    } catch {
      break;
    }

    const currentShares = getShareCount(db, fundCik, cusip, checkQuarter);
    const priorShares = getShareCount(db, fundCik, cusip, priorQuarter);

    if (currentShares === null || priorShares === null) {
      // Position didn't exist in one of the quarters
      break;
    }

    if (currentShares > priorShares) {
      count++;
      checkQuarter = priorQuarter;
    } else {
      // Shares didn't increase -- streak broken
      break;
    }
  }

  return count;
}

/**
 * Compute conviction scores for all equity positions of a fund in a given quarter.
 *
 * - Uses portfolio weights to determine high-weight positions (>5%)
 * - Tracks consecutive quarter additions by comparing share counts across quarters
 * - Assigns conviction levels:
 *   - 'high': both high weight AND consecutiveAdditions >= 2
 *   - 'medium': either high weight OR consecutiveAdditions >= 2
 *   - 'low': neither condition met
 * - Excludes options (handled by computePortfolioWeights)
 */
export function computeConvictionScores(
  db: BetterSQLite3Database<typeof schema>,
  fundCik: string,
  quarter: string,
): ConvictionScore[] {
  // Get current portfolio weights (already excludes options)
  const weights = computePortfolioWeights(db, fundCik, quarter);

  if (weights.length === 0) {
    return [];
  }

  // Build conviction scores for each position
  return weights.map((pw) => {
    const isHighWeight = pw.weight > 0.05;
    const consecutiveAdditions = computeConsecutiveAdditions(
      db,
      fundCik,
      pw.cusip,
      quarter,
    );

    let convictionLevel: 'high' | 'medium' | 'low';
    if (isHighWeight && consecutiveAdditions >= 2) {
      convictionLevel = 'high';
    } else if (isHighWeight || consecutiveAdditions >= 2) {
      convictionLevel = 'medium';
    } else {
      convictionLevel = 'low';
    }

    return {
      cusip: pw.cusip,
      ticker: pw.ticker,
      nameOfIssuer: pw.nameOfIssuer,
      weight: pw.weight,
      isHighWeight,
      consecutiveAdditions,
      convictionLevel,
    };
  });
}
