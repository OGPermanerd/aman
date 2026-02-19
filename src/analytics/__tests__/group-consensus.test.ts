import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedGroupConsensus, AAPL_CUSIP, NVDA_CUSIP, MSFT_CUSIP, TSLA_CUSIP, type TestDb } from './test-helpers';
import { computeGroupConsensus } from '../group-consensus';

describe('computeGroupConsensus', () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
    seedGroupConsensus(testDb.db);
  });

  // Tiger Cubs Q4 2025:
  //   AAPL: 3 funds (A=$1.5M, B=$800K, C=$500K) -> fundCount=3
  //   NVDA: 2 funds (A=$3M, B=$1.2M) -> fundCount=2, totalValue=$4.2M
  //   MSFT: 2 funds (A=$2M, C=$1M) -> fundCount=2, totalValue=$3M
  //   TSLA: 1 fund (C=$800K) -> fundCount=1
  //   totalFundsInGroup=4 (A,B,C,D), fundsWithData=3 (D has no holdings)

  it('ranks positions by fund count descending', () => {
    const result = computeGroupConsensus(testDb.db, 'Tiger Cubs', '2025Q4');

    // AAPL should be first (3 funds)
    expect(result[0].cusip).toBe(AAPL_CUSIP);
    expect(result[0].fundCount).toBe(3);

    // NVDA and MSFT tied at 2 funds -- NVDA first (higher total value tiebreaker)
    const nvda = result.find((r) => r.cusip === NVDA_CUSIP);
    const msft = result.find((r) => r.cusip === MSFT_CUSIP);
    expect(nvda!.fundCount).toBe(2);
    expect(msft!.fundCount).toBe(2);

    // TSLA last with 1 fund
    expect(result[result.length - 1].cusip).toBe(TSLA_CUSIP);
    expect(result[result.length - 1].fundCount).toBe(1);
  });

  it('reports correct fund count and ratio', () => {
    const result = computeGroupConsensus(testDb.db, 'Tiger Cubs', '2025Q4');

    const aapl = result.find((r) => r.cusip === AAPL_CUSIP)!;
    expect(aapl.fundCount).toBe(3);
    expect(aapl.fundsWithData).toBe(3);
    // ratio = fundCount / fundsWithData
    expect(aapl.ratio).toBeCloseTo(3 / 3, 4);

    const nvda = result.find((r) => r.cusip === NVDA_CUSIP)!;
    expect(nvda.fundCount).toBe(2);
    expect(nvda.ratio).toBeCloseTo(2 / 3, 3);
  });

  it('lists holder CIKs', () => {
    const result = computeGroupConsensus(testDb.db, 'Tiger Cubs', '2025Q4');
    const aapl = result.find((r) => r.cusip === AAPL_CUSIP)!;
    expect(aapl.holders).toContain('FUND_A');
    expect(aapl.holders).toContain('FUND_B');
    expect(aapl.holders).toContain('FUND_C');
    expect(aapl.holders).toHaveLength(3);
  });

  it('reports totalFundsInGroup as total configured active funds', () => {
    const result = computeGroupConsensus(testDb.db, 'Tiger Cubs', '2025Q4');
    // 4 active Tiger Cubs funds: A, B, C, D
    expect(result[0].totalFundsInGroup).toBe(4);
  });

  it('reports fundsWithData as funds that have holdings for the quarter', () => {
    const result = computeGroupConsensus(testDb.db, 'Tiger Cubs', '2025Q4');
    // Fund D is Tiger Cubs but has no holdings in Q4 -> fundsWithData=3
    expect(result[0].fundsWithData).toBe(3);
  });

  it('excludes options from consensus', () => {
    const result = computeGroupConsensus(testDb.db, 'Tiger Cubs', '2025Q4');
    // AAPL Call option for Fund A should NOT create a separate consensus entry
    // There should be exactly 4 unique positions: AAPL, NVDA, MSFT, TSLA
    expect(result).toHaveLength(4);

    // AAPL fundCount should be based on equity positions only
    const aapl = result.find((r) => r.cusip === AAPL_CUSIP)!;
    expect(aapl.fundCount).toBe(3); // Not inflated by options
  });

  it('aggregates total value across holding funds', () => {
    const result = computeGroupConsensus(testDb.db, 'Tiger Cubs', '2025Q4');
    const aapl = result.find((r) => r.cusip === AAPL_CUSIP)!;
    // AAPL: Fund A ($1.5M) + Fund B ($800K) + Fund C ($500K) = $2.8M
    expect(aapl.totalValue).toBe(1500000 + 800000 + 500000);
  });

  it('returns empty for strategy group with no holdings data', () => {
    const result = computeGroupConsensus(testDb.db, 'Nonexistent Group', '2025Q4');
    expect(result).toEqual([]);
  });

  it('resolves tickers from securities table', () => {
    const result = computeGroupConsensus(testDb.db, 'Tiger Cubs', '2025Q4');
    const aapl = result.find((r) => r.cusip === AAPL_CUSIP)!;
    expect(aapl.ticker).toBe('AAPL');

    const tsla = result.find((r) => r.cusip === TSLA_CUSIP)!;
    expect(tsla.ticker).toBe('TSLA');
  });
});
