// ---------------------------------------------------------------------------
// Shared type definitions for all analytics results
// ---------------------------------------------------------------------------

/** A single position's weight in a fund's portfolio for a given quarter */
export interface PortfolioWeight {
  cusip: string;
  ticker: string | null;
  nameOfIssuer: string;
  value: number;
  shares: number;
  weight: number; // 0-1, fraction of total portfolio value
  rank: number; // 1-based, ordered by weight descending
}

/** Classification of how a position changed between quarters */
export type PositionChangeType =
  | 'new'
  | 'exited'
  | 'increased'
  | 'decreased'
  | 'unchanged';

/** A single position's diff between two quarters */
export interface PositionDiff {
  cusip: string;
  ticker: string | null;
  nameOfIssuer: string;
  changeType: PositionChangeType;
  currentValue: number | null;
  previousValue: number | null;
  currentShares: number | null;
  previousShares: number | null;
  currentWeight: number | null;
  previousWeight: number | null;
  valueDelta: number;
  sharesDelta: number;
  weightDelta: number;
}

/** Full quarter-over-quarter diff result for a fund */
export interface QoQDiffResult {
  fundCik: string;
  currentQuarter: string;
  previousQuarter: string;
  diffs: PositionDiff[];
  summary: {
    new: number;
    exited: number;
    increased: number;
    decreased: number;
    unchanged: number;
  };
}

/** A position held across multiple funds in a strategy group */
export interface ConsensusPosition {
  cusip: string;
  ticker: string | null;
  nameOfIssuer: string;
  fundCount: number;
  totalFundsInGroup: number;
  fundsWithData: number;
  ratio: number;
  totalValue: number;
  holders: string[]; // CIKs of funds holding this position
}

/** Conviction scoring for a fund's position */
export interface ConvictionScore {
  cusip: string;
  ticker: string | null;
  nameOfIssuer: string;
  weight: number;
  isHighWeight: boolean; // weight > 0.05
  consecutiveAdditions: number;
  convictionLevel: 'high' | 'medium' | 'low';
}
