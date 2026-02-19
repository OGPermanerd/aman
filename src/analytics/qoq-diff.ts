import { eq, and } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { holdings, securities } from '../db/schema';
import type * as schema from '../db/schema';
import type { PositionChangeType, PositionDiff, QoQDiffResult } from './types';

interface HoldingRow {
  cusip: string;
  nameOfIssuer: string;
  value: number;
  shares: number;
  ticker: string | null;
}

/**
 * Fetch equity holdings (putCall = '') for a fund-quarter, joined with securities for ticker.
 */
function getEquityHoldings(
  db: BetterSQLite3Database<typeof schema>,
  fundCik: string,
  quarter: string,
): HoldingRow[] {
  return db
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
    .all();
}

/**
 * Compute quarter-over-quarter position diff for a fund.
 *
 * - Classifies each position by CUSIP as new, exited, increased, decreased, or unchanged
 * - Classification is based on SHARES (not value, which fluctuates with market price)
 * - Excludes options (putCall != '')
 * - Computes value, shares, and weight deltas
 */
export function computeQoQDiff(
  db: BetterSQLite3Database<typeof schema>,
  fundCik: string,
  currentQuarter: string,
  previousQuarter: string,
): QoQDiffResult {
  const currentRows = getEquityHoldings(db, fundCik, currentQuarter);
  const previousRows = getEquityHoldings(db, fundCik, previousQuarter);

  // Build CUSIP maps
  const currentMap = new Map<string, HoldingRow>();
  for (const row of currentRows) {
    currentMap.set(row.cusip, row);
  }

  const previousMap = new Map<string, HoldingRow>();
  for (const row of previousRows) {
    previousMap.set(row.cusip, row);
  }

  // Compute total values for weight calculation
  const currentTotal = currentRows.reduce((sum, r) => sum + r.value, 0);
  const previousTotal = previousRows.reduce((sum, r) => sum + r.value, 0);

  // Union all CUSIPs
  const allCusips = new Set<string>([...currentMap.keys(), ...previousMap.keys()]);

  // Build diffs
  const diffs: PositionDiff[] = [];
  const summary = { new: 0, exited: 0, increased: 0, decreased: 0, unchanged: 0 };

  for (const cusip of allCusips) {
    const current = currentMap.get(cusip) ?? null;
    const previous = previousMap.get(cusip) ?? null;

    const currentShares = current?.shares ?? null;
    const previousShares = previous?.shares ?? null;
    const currentValue = current?.value ?? null;
    const previousValue = previous?.value ?? null;
    const currentWeight = current && currentTotal > 0 ? current.value / currentTotal : null;
    const previousWeight = previous && previousTotal > 0 ? previous.value / previousTotal : null;

    // Classify change based on shares
    let changeType: PositionChangeType;
    if (previousShares === null) {
      changeType = 'new';
    } else if (currentShares === null) {
      changeType = 'exited';
    } else if (currentShares > previousShares) {
      changeType = 'increased';
    } else if (currentShares < previousShares) {
      changeType = 'decreased';
    } else {
      changeType = 'unchanged';
    }

    summary[changeType]++;

    // Use the most recent name/ticker, falling back to previous
    const nameOfIssuer = current?.nameOfIssuer ?? previous!.nameOfIssuer;
    const ticker = current?.ticker ?? previous?.ticker ?? null;

    diffs.push({
      cusip,
      ticker,
      nameOfIssuer,
      changeType,
      currentValue,
      previousValue,
      currentShares,
      previousShares,
      currentWeight,
      previousWeight,
      valueDelta: (currentValue ?? 0) - (previousValue ?? 0),
      sharesDelta: (currentShares ?? 0) - (previousShares ?? 0),
      weightDelta: (currentWeight ?? 0) - (previousWeight ?? 0),
    });
  }

  return {
    fundCik,
    currentQuarter,
    previousQuarter,
    diffs,
    summary,
  };
}
