import { eq, and, desc } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { holdings, securities } from '../db/schema';
import type * as schema from '../db/schema';
import type { PortfolioWeight } from './types';

/**
 * Compute portfolio weights for a fund in a specific quarter.
 *
 * - Excludes options (putCall != '')
 * - Joins with securities for ticker resolution
 * - Weights = value / totalValue, ranked by weight descending
 * - Returns empty array if no equity holdings found
 */
export function computePortfolioWeights(
  db: BetterSQLite3Database<typeof schema>,
  fundCik: string,
  quarter: string,
): PortfolioWeight[] {
  // Query equity holdings (putCall = '') with left join to securities for ticker
  const rows = db
    .select({
      cusip: holdings.cusip,
      nameOfIssuer: holdings.nameOfIssuer,
      value: holdings.value,
      shares: holdings.shares,
      ticker: securities.ticker,
    })
    .from(holdings)
    .leftJoin(securities, eq(holdings.cusip, securities.cusip))
    .where(
      and(
        eq(holdings.fundCik, fundCik),
        eq(holdings.reportQuarter, quarter),
        eq(holdings.putCall, ''),
      ),
    )
    .orderBy(desc(holdings.value))
    .all();

  if (rows.length === 0) {
    return [];
  }

  // Compute total value via reduce (not Drizzle sum() which returns string)
  const totalValue = rows.reduce((sum, r) => sum + r.value, 0);

  // Map to PortfolioWeight[] with weight and rank
  return rows.map((row, index) => ({
    cusip: row.cusip,
    ticker: row.ticker,
    nameOfIssuer: row.nameOfIssuer,
    value: row.value,
    shares: row.shares,
    weight: totalValue === 0 ? 0 : row.value / totalValue,
    rank: index + 1,
  }));
}
