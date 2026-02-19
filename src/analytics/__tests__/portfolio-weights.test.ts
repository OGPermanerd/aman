import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedTwoQuarters, type TestDb } from './test-helpers.js';
import { computePortfolioWeights } from '../portfolio-weights.js';

describe('computePortfolioWeights', () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
    seedTwoQuarters(testDb.db);
  });

  // Fund A Q4 2025 equity: AAPL $1.5M, MSFT $2M, NVDA $3M, total=$6.5M
  it('computes correct weights for a fund-quarter', () => {
    const weights = computePortfolioWeights(testDb.db, 'FUND_A', '2025Q4');
    expect(weights).toHaveLength(3); // equity only, no options

    const nvda = weights.find((w) => w.nameOfIssuer === 'NVIDIA CORP');
    const msft = weights.find((w) => w.nameOfIssuer === 'MICROSOFT CORP');
    const aapl = weights.find((w) => w.nameOfIssuer === 'APPLE INC');

    expect(nvda!.weight).toBeCloseTo(3000000 / 6500000, 4);
    expect(msft!.weight).toBeCloseTo(2000000 / 6500000, 4);
    expect(aapl!.weight).toBeCloseTo(1500000 / 6500000, 4);
  });

  it('weights sum to approximately 1.0', () => {
    const weights = computePortfolioWeights(testDb.db, 'FUND_A', '2025Q4');
    const sum = weights.reduce((acc, w) => acc + w.weight, 0);
    expect(sum).toBeCloseTo(1.0, 4);
  });

  it('ranks holdings by weight descending', () => {
    const weights = computePortfolioWeights(testDb.db, 'FUND_A', '2025Q4');
    expect(weights[0].nameOfIssuer).toBe('NVIDIA CORP');
    expect(weights[0].rank).toBe(1);
    expect(weights[1].nameOfIssuer).toBe('MICROSOFT CORP');
    expect(weights[1].rank).toBe(2);
    expect(weights[2].nameOfIssuer).toBe('APPLE INC');
    expect(weights[2].rank).toBe(3);
  });

  it('excludes options from weight calculation', () => {
    // Seeded data has AAPL Call option in Q4. Should NOT appear.
    const weights = computePortfolioWeights(testDb.db, 'FUND_A', '2025Q4');
    expect(weights).toHaveLength(3); // not 4
    const hasOption = weights.some((w) => w.shares === 10); // option has 10 shares
    expect(hasOption).toBe(false);
  });

  it('returns empty array for fund with no holdings in quarter', () => {
    const weights = computePortfolioWeights(testDb.db, 'FUND_A', '2020Q1');
    expect(weights).toEqual([]);
  });

  it('resolves ticker from securities table', () => {
    const weights = computePortfolioWeights(testDb.db, 'FUND_A', '2025Q4');
    const nvda = weights.find((w) => w.nameOfIssuer === 'NVIDIA CORP');
    expect(nvda!.ticker).toBe('NVDA');

    // All CUSIPs have securities entries, so all should have non-null tickers
    for (const w of weights) {
      expect(w.ticker).not.toBeNull();
    }
  });
});
