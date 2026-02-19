/**
 * Value format detection and holdings normalization.
 *
 * Pre-2023 EDGAR filings report values in thousands of dollars.
 * Post-2023 (accepted on or after 2023-01-03) report exact dollars.
 * This module normalizes all values to exact dollars.
 */

import type { RawHolding } from './xml-parser';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** EDGAR Release 22.4.1 cutover date: values switch from thousands to exact. */
export const VALUE_FORMAT_CUTOVER = new Date('2023-01-03T00:00:00Z');

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface NormalizedHolding {
  fundCik: string;
  reportQuarter: string;
  cusip: string;
  nameOfIssuer: string;
  titleOfClass: string;
  value: number; // normalized to exact dollars
  shares: number;
  shareType: string; // "SH" or "PRN"
  putCall: string; // "Put", "Call", or "" for equity
  investmentDiscretion: string;
  filingAccession: string;
}

// ---------------------------------------------------------------------------
// Value format detection
// ---------------------------------------------------------------------------

/**
 * Determine whether a filing uses the thousands or exact value format
 * based on its acceptanceDateTime.
 */
export function detectValueFormat(
  acceptanceDateTime: string,
): 'thousands' | 'exact' {
  const accepted = new Date(acceptanceDateTime);
  return accepted < VALUE_FORMAT_CUTOVER ? 'thousands' : 'exact';
}

/**
 * Normalize a raw value to exact dollars based on the format era.
 */
export function normalizeValue(
  rawValue: number,
  format: 'thousands' | 'exact',
): number {
  return format === 'thousands' ? rawValue * 1000 : rawValue;
}

// ---------------------------------------------------------------------------
// Holdings normalization
// ---------------------------------------------------------------------------

export interface NormalizeContext {
  fundCik: string;
  reportQuarter: string;
  accessionNumber: string;
  valueFormat: 'thousands' | 'exact';
}

/**
 * Normalize an array of raw parsed holdings into the format ready for DB insertion.
 *
 * - Applies value normalization (thousands -> exact dollars)
 * - Maps putCall: undefined -> "" (empty string for equity, avoids NULL in PK)
 * - Extracts shares and shareType from shrsOrPrnAmt
 * - Validates CUSIP is 9 characters (warning only, does not drop)
 */
export function normalizeHoldings(
  rawHoldings: RawHolding[],
  context: NormalizeContext,
): NormalizedHolding[] {
  return rawHoldings.map((raw) => {
    const cusip = String(raw.cusip).trim();
    if (cusip.length < 6 || cusip.length > 9) {
      console.warn(
        `[Normalizer] CUSIP "${cusip}" for ${raw.nameOfIssuer} has unexpected length (${cusip.length})`,
      );
    }

    return {
      fundCik: context.fundCik,
      reportQuarter: context.reportQuarter,
      cusip,
      nameOfIssuer: String(raw.nameOfIssuer),
      titleOfClass: String(raw.titleOfClass),
      value: normalizeValue(Number(raw.value), context.valueFormat),
      shares: Number(raw.shrsOrPrnAmt?.sshPrnamt ?? 0),
      shareType: String(raw.shrsOrPrnAmt?.sshPrnamtType ?? 'SH'),
      putCall: raw.putCall ? String(raw.putCall) : '',
      investmentDiscretion: String(raw.investmentDiscretion),
      filingAccession: context.accessionNumber,
    };
  });
}
