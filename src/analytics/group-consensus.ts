import { eq, and } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { funds, holdings, securities } from '../db/schema';
import type * as schema from '../db/schema';
import type { ConsensusPosition } from './types';

/**
 * Compute group consensus for a strategy group in a given quarter.
 *
 * - Finds all active funds in the strategy group
 * - Queries equity holdings (putCall = '') for those funds in the quarter
 * - Groups by CUSIP to count how many funds hold each position
 * - Returns positions ranked by fund count descending, with total value tiebreaker
 * - Reports both totalFundsInGroup (all active) and fundsWithData (with holdings)
 */
export function computeGroupConsensus(
  db: BetterSQLite3Database<typeof schema>,
  strategyGroup: string,
  quarter: string,
  overrideCiks?: string[],
): ConsensusPosition[] {
  // Step 1: Get all active funds in the strategy group
  let fundCiks: string[];
  let totalFundsInGroup: number;

  if (overrideCiks) {
    fundCiks = overrideCiks;
    totalFundsInGroup = overrideCiks.length;
  } else {
    const groupFunds = db
      .select({ cik: funds.cik })
      .from(funds)
      .where(and(eq(funds.strategyGroup, strategyGroup), eq(funds.active, true)))
      .all();

    if (groupFunds.length === 0) {
      return [];
    }

    totalFundsInGroup = groupFunds.length;
    fundCiks = groupFunds.map((f) => f.cik);
  }

  if (fundCiks.length === 0) {
    return [];
  }

  // Step 2: Query equity holdings for all group funds in the quarter
  // We query one fund at a time since Drizzle's inArray may not be available
  // for all adapters; this is simpler and still performant for small fund counts.
  const allRows: Array<{
    fundCik: string;
    cusip: string;
    nameOfIssuer: string;
    value: number;
    ticker: string | null;
  }> = [];

  for (const cik of fundCiks) {
    const rows = db
      .select({
        fundCik: holdings.fundCik,
        cusip: holdings.cusip,
        nameOfIssuer: holdings.nameOfIssuer,
        value: holdings.value,
        ticker: securities.ticker,
      })
      .from(holdings)
      .leftJoin(securities, eq(holdings.cusip, securities.cusip))
      .where(
        and(
          eq(holdings.fundCik, cik),
          eq(holdings.reportQuarter, quarter),
          eq(holdings.putCall, ''),
        ),
      )
      .all();

    allRows.push(...rows);
  }

  if (allRows.length === 0) {
    return [];
  }

  // Step 3: Group by CUSIP using a Map
  const cusipMap = new Map<
    string,
    {
      fundCiks: Set<string>;
      totalValue: number;
      nameOfIssuer: string;
      ticker: string | null;
    }
  >();

  for (const row of allRows) {
    const existing = cusipMap.get(row.cusip);
    if (existing) {
      existing.fundCiks.add(row.fundCik);
      existing.totalValue += row.value;
      // Prefer non-null ticker
      if (row.ticker && !existing.ticker) {
        existing.ticker = row.ticker;
      }
    } else {
      cusipMap.set(row.cusip, {
        fundCiks: new Set([row.fundCik]),
        totalValue: row.value,
        nameOfIssuer: row.nameOfIssuer,
        ticker: row.ticker,
      });
    }
  }

  // Step 4: Determine fundsWithData (distinct CIKs with any holdings)
  const fundsWithDataSet = new Set<string>();
  for (const row of allRows) {
    fundsWithDataSet.add(row.fundCik);
  }
  const fundsWithData = fundsWithDataSet.size;

  // Step 5: Build ConsensusPosition[] from the Map
  const positions: ConsensusPosition[] = [];
  for (const [cusip, data] of cusipMap) {
    const fundCount = data.fundCiks.size;
    positions.push({
      cusip,
      ticker: data.ticker,
      nameOfIssuer: data.nameOfIssuer,
      fundCount,
      totalFundsInGroup,
      fundsWithData,
      ratio: fundsWithData > 0 ? fundCount / fundsWithData : 0,
      totalValue: data.totalValue,
      holders: Array.from(data.fundCiks),
    });
  }

  // Step 6: Sort by fundCount desc, then by totalValue desc (tiebreaker)
  positions.sort((a, b) => {
    if (b.fundCount !== a.fundCount) {
      return b.fundCount - a.fundCount;
    }
    return b.totalValue - a.totalValue;
  });

  return positions;
}
