/**
 * Detect and handle 13F amendments.
 *
 * Amendment types:
 * - RESTATEMENT: Replace all existing holdings for this fund+quarter
 * - NEW HOLDINGS: Merge new rows into existing holdings (additive)
 * - Original (not amendment): Insert holdings as-is
 */

import { and, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { holdings } from '../db/schema.js';
import type * as schema from '../db/schema.js';
import type { CoverPageData } from './xml-parser.js';
import type { NormalizedHolding } from './normalizer.js';

export interface AmendmentResult {
  action: 'insert' | 'replace' | 'merge';
  holdingsToStore: NormalizedHolding[];
}

/**
 * Determine how to handle a filing based on its amendment status.
 *
 * - Not an amendment: return "insert" with holdings as-is
 * - RESTATEMENT: delete existing holdings for fund+quarter, return "replace"
 * - NEW HOLDINGS: return "merge" (pipeline uses onConflictDoNothing)
 *
 * Note: Uses synchronous better-sqlite3 operations (no async/await).
 */
export function handleAmendment(
  db: BetterSQLite3Database<typeof schema>,
  coverPage: CoverPageData,
  newHoldings: NormalizedHolding[],
  fundCik: string,
  reportQuarter: string,
): AmendmentResult {
  if (!coverPage.isAmendment) {
    return { action: 'insert', holdingsToStore: newHoldings };
  }

  if (coverPage.amendmentType === 'RESTATEMENT') {
    // Delete all existing holdings for this fund+quarter
    const deleted = db
      .delete(holdings)
      .where(
        and(
          eq(holdings.fundCik, fundCik),
          eq(holdings.reportQuarter, reportQuarter),
        ),
      )
      .run();

    console.log(
      `[Amendment] RESTATEMENT for ${fundCik} ${reportQuarter}: deleted ${deleted.changes} existing rows, inserting ${newHoldings.length} replacement rows`,
    );

    return { action: 'replace', holdingsToStore: newHoldings };
  }

  if (coverPage.amendmentType === 'NEW HOLDINGS') {
    console.log(
      `[Amendment] NEW HOLDINGS for ${fundCik} ${reportQuarter}: merging ${newHoldings.length} new rows`,
    );

    return { action: 'merge', holdingsToStore: newHoldings };
  }

  // Unknown amendment type -- treat as insert with warning
  console.warn(
    `[Amendment] Unknown amendment type "${coverPage.amendmentType}" for ${fundCik} ${reportQuarter}, treating as insert`,
  );

  return { action: 'insert', holdingsToStore: newHoldings };
}
