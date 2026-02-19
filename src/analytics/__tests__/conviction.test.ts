import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedConvictionData, seedTwoQuarters, AAPL_CUSIP, MSFT_CUSIP, GOOG_CUSIP, NVDA_CUSIP, type TestDb } from './test-helpers.js';
import { computeConvictionScores } from '../conviction.js';

describe('computeConvictionScores', () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
    seedConvictionData(testDb.db);
  });

  // Fund E Q4 2025 portfolio total: $2.5M + $450K + $140K + $5M = $8.09M
  //   AAPL: weight=30.9%, 3 consecutive additions (Q1->Q2, Q2->Q3, Q3->Q4) -> HIGH
  //   NVDA: weight=61.8%, 0 consecutive (new in Q4) -> MEDIUM
  //   MSFT: weight=5.6%, 0 consecutive (decreased Q2->Q3, unchanged Q3->Q4) -> MEDIUM
  //   GOOG: weight=1.7%, 0 consecutive (unchanged Q3->Q4) -> LOW

  it('flags high-weight positions (weight > 5%)', () => {
    const scores = computeConvictionScores(testDb.db, 'FUND_E', '2025Q4');

    const aapl = scores.find((s) => s.cusip === AAPL_CUSIP)!;
    expect(aapl.isHighWeight).toBe(true);
    expect(aapl.weight).toBeCloseTo(2500000 / 8090000, 3);

    const nvda = scores.find((s) => s.cusip === NVDA_CUSIP)!;
    expect(nvda.isHighWeight).toBe(true);
    expect(nvda.weight).toBeCloseTo(5000000 / 8090000, 3);

    const msft = scores.find((s) => s.cusip === MSFT_CUSIP)!;
    expect(msft.isHighWeight).toBe(true);
    expect(msft.weight).toBeCloseTo(450000 / 8090000, 3);

    const goog = scores.find((s) => s.cusip === GOOG_CUSIP)!;
    expect(goog.isHighWeight).toBe(false);
    expect(goog.weight).toBeCloseTo(140000 / 8090000, 3);
  });

  it('counts consecutive quarter additions correctly', () => {
    const scores = computeConvictionScores(testDb.db, 'FUND_E', '2025Q4');

    const aapl = scores.find((s) => s.cusip === AAPL_CUSIP)!;
    // AAPL: shares increased Q1->Q2 (100->150), Q2->Q3 (150->200), Q3->Q4 (200->250)
    expect(aapl.consecutiveAdditions).toBe(3);

    const nvda = scores.find((s) => s.cusip === NVDA_CUSIP)!;
    // NVDA: new in Q4, no prior quarter to compare
    expect(nvda.consecutiveAdditions).toBe(0);

    const msft = scores.find((s) => s.cusip === MSFT_CUSIP)!;
    // MSFT: Q1->Q2 unchanged (200->200), Q2->Q3 decreased (200->180), Q3->Q4 unchanged (180->180)
    expect(msft.consecutiveAdditions).toBe(0);

    const goog = scores.find((s) => s.cusip === GOOG_CUSIP)!;
    // GOOG: Q2->Q3 increased (50->70) but Q3->Q4 unchanged (70->70) -> streak broken at current quarter
    expect(goog.consecutiveAdditions).toBe(0);
  });

  it('assigns conviction level "high" when both signals present', () => {
    const scores = computeConvictionScores(testDb.db, 'FUND_E', '2025Q4');
    const aapl = scores.find((s) => s.cusip === AAPL_CUSIP)!;
    // weight > 5% AND consecutiveAdditions >= 2
    expect(aapl.convictionLevel).toBe('high');
  });

  it('assigns conviction level "medium" when one signal present', () => {
    const scores = computeConvictionScores(testDb.db, 'FUND_E', '2025Q4');

    const nvda = scores.find((s) => s.cusip === NVDA_CUSIP)!;
    // weight > 5% but 0 consecutive additions
    expect(nvda.convictionLevel).toBe('medium');

    const msft = scores.find((s) => s.cusip === MSFT_CUSIP)!;
    // weight > 5% but 0 consecutive additions
    expect(msft.convictionLevel).toBe('medium');
  });

  it('assigns conviction level "low" when neither signal', () => {
    const scores = computeConvictionScores(testDb.db, 'FUND_E', '2025Q4');
    const goog = scores.find((s) => s.cusip === GOOG_CUSIP)!;
    // weight < 5% AND 0 consecutive additions
    expect(goog.convictionLevel).toBe('low');
  });

  it('handles fund with single quarter of data', () => {
    // Use seedTwoQuarters data -- Fund B only has Q4
    const singleQDb = createTestDb();
    seedTwoQuarters(singleQDb.db);

    const scores = computeConvictionScores(singleQDb.db, 'FUND_B', '2025Q4');
    // Fund B has 2 equity positions in Q4 (AAPL, NVDA)
    expect(scores).toHaveLength(2);

    // No prior quarter -> all consecutiveAdditions = 0
    for (const score of scores) {
      expect(score.consecutiveAdditions).toBe(0);
    }

    // Fund B Q4: AAPL $800K, NVDA $1.2M, total=$2M
    // NVDA weight = 1.2M/2M = 0.6 -> high weight
    const nvda = scores.find((s) => s.cusip === NVDA_CUSIP)!;
    expect(nvda.isHighWeight).toBe(true);
  });

  it('handles fund with no data', () => {
    const scores = computeConvictionScores(testDb.db, 'NONEXISTENT', '2025Q4');
    expect(scores).toEqual([]);
  });

  it('excludes options from conviction scoring', () => {
    // Fund E has an AAPL Call option in Q4 -- should not appear in results
    const scores = computeConvictionScores(testDb.db, 'FUND_E', '2025Q4');
    // Should have exactly 4 equity positions: AAPL, NVDA, MSFT, GOOG
    expect(scores).toHaveLength(4);

    // Verify no options-based entries (all should have non-zero equity weights)
    for (const score of scores) {
      expect(score.weight).toBeGreaterThan(0);
    }
  });
});
