import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedTwoQuarters, type TestDb, AAPL_CUSIP, MSFT_CUSIP, GOOG_CUSIP, NVDA_CUSIP } from './test-helpers.js';
import { computeQoQDiff } from '../qoq-diff.js';

describe('computeQoQDiff', () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
    seedTwoQuarters(testDb.db);
  });

  // Fund A: Q3 -> AAPL 100sh, MSFT 200sh, GOOG 50sh
  //         Q4 -> AAPL 150sh, MSFT 200sh, NVDA 300sh (GOOG exited, AAPL Call option excluded)

  it('identifies new positions (NVDA in Q4, not in Q3)', () => {
    const result = computeQoQDiff(testDb.db, 'FUND_A', '2025Q4', '2025Q3');
    const nvda = result.diffs.find((d) => d.cusip === NVDA_CUSIP);
    expect(nvda).toBeDefined();
    expect(nvda!.changeType).toBe('new');
    expect(nvda!.previousShares).toBeNull();
    expect(nvda!.currentShares).toBe(300);
  });

  it('identifies exited positions (GOOG in Q3, not in Q4)', () => {
    const result = computeQoQDiff(testDb.db, 'FUND_A', '2025Q4', '2025Q3');
    const goog = result.diffs.find((d) => d.cusip === GOOG_CUSIP);
    expect(goog).toBeDefined();
    expect(goog!.changeType).toBe('exited');
    expect(goog!.currentShares).toBeNull();
    expect(goog!.previousShares).toBe(50);
  });

  it('identifies increased positions (AAPL shares went 100->150)', () => {
    const result = computeQoQDiff(testDb.db, 'FUND_A', '2025Q4', '2025Q3');
    const aapl = result.diffs.find((d) => d.cusip === AAPL_CUSIP);
    expect(aapl).toBeDefined();
    expect(aapl!.changeType).toBe('increased');
    expect(aapl!.previousShares).toBe(100);
    expect(aapl!.currentShares).toBe(150);
    expect(aapl!.sharesDelta).toBe(50);
  });

  it('identifies unchanged positions (MSFT shares stayed at 200)', () => {
    const result = computeQoQDiff(testDb.db, 'FUND_A', '2025Q4', '2025Q3');
    const msft = result.diffs.find((d) => d.cusip === MSFT_CUSIP);
    expect(msft).toBeDefined();
    expect(msft!.changeType).toBe('unchanged');
    expect(msft!.sharesDelta).toBe(0);
  });

  it('matches positions by CUSIP, not issuer name', () => {
    const result = computeQoQDiff(testDb.db, 'FUND_A', '2025Q4', '2025Q3');
    // Union of CUSIPs from both quarters: AAPL, MSFT, GOOG, NVDA = 4
    expect(result.diffs).toHaveLength(4);
    // Each position identified by cusip field
    for (const d of result.diffs) {
      expect(d.cusip).toBeTruthy();
    }
  });

  it('computes correct summary counts', () => {
    const result = computeQoQDiff(testDb.db, 'FUND_A', '2025Q4', '2025Q3');
    expect(result.summary.new).toBe(1); // NVDA
    expect(result.summary.exited).toBe(1); // GOOG
    expect(result.summary.increased).toBe(1); // AAPL
    expect(result.summary.unchanged).toBe(1); // MSFT
    expect(result.summary.decreased).toBe(0);
  });

  it('excludes options from diff', () => {
    const result = computeQoQDiff(testDb.db, 'FUND_A', '2025Q4', '2025Q3');
    // The AAPL Call option in Q4 should not appear as a separate position
    // Total diffs should be 4 (4 equity CUSIPs across both quarters)
    expect(result.diffs).toHaveLength(4);
  });

  it('handles single quarter (no previous data)', () => {
    // Fund B has no Q3 data -- only Q4
    const result = computeQoQDiff(testDb.db, 'FUND_B', '2025Q4', '2025Q3');
    // All positions should be 'new'
    for (const d of result.diffs) {
      expect(d.changeType).toBe('new');
    }
    expect(result.summary.new).toBe(2); // AAPL, NVDA
  });

  it('handles empty fund', () => {
    const result = computeQoQDiff(testDb.db, 'NONEXISTENT', '2025Q4', '2025Q3');
    expect(result.diffs).toEqual([]);
    expect(result.summary.new).toBe(0);
    expect(result.summary.exited).toBe(0);
    expect(result.summary.increased).toBe(0);
    expect(result.summary.decreased).toBe(0);
    expect(result.summary.unchanged).toBe(0);
  });

  it('computes weight deltas', () => {
    const result = computeQoQDiff(testDb.db, 'FUND_A', '2025Q4', '2025Q3');
    const aapl = result.diffs.find((d) => d.cusip === AAPL_CUSIP);
    expect(aapl).toBeDefined();

    // Q4 total equity: 1500000 + 2000000 + 3000000 = 6500000
    // Q3 total equity: 1000000 + 2000000 + 500000  = 3500000
    const expectedCurrentWeight = 1500000 / 6500000;
    const expectedPreviousWeight = 1000000 / 3500000;
    const expectedWeightDelta = expectedCurrentWeight - expectedPreviousWeight;

    expect(aapl!.currentWeight).toBeCloseTo(expectedCurrentWeight, 4);
    expect(aapl!.previousWeight).toBeCloseTo(expectedPreviousWeight, 4);
    expect(aapl!.weightDelta).toBeCloseTo(expectedWeightDelta, 4);
  });
});
