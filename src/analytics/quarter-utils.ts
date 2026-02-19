import { desc } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { holdings } from '../db/schema';
import type * as schema from '../db/schema';

/**
 * Compute the previous quarter string.
 * "2025Q4" -> "2025Q3", "2025Q1" -> "2024Q4"
 * Throws on invalid format.
 */
export function previousQuarter(quarter: string): string {
  const match = quarter.match(/^(\d{4})Q([1-4])$/);
  if (!match) {
    throw new Error(`Invalid quarter format: "${quarter}". Expected format: "2025Q4"`);
  }

  let year = parseInt(match[1], 10);
  let q = parseInt(match[2], 10);

  if (q === 1) {
    year -= 1;
    q = 4;
  } else {
    q -= 1;
  }

  return `${year}Q${q}`;
}

/**
 * Get all available quarters for a fund, ordered descending (most recent first).
 * Synchronous (better-sqlite3 is sync).
 */
export function getAvailableQuarters(
  db: BetterSQLite3Database<typeof schema>,
  fundCik: string,
): string[] {
  const rows = db
    .selectDistinct({ reportQuarter: holdings.reportQuarter })
    .from(holdings)
    .where(eq(holdings.fundCik, fundCik))
    .orderBy(desc(holdings.reportQuarter))
    .all();

  return rows.map((r) => r.reportQuarter);
}
