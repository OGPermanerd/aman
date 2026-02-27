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
 * Verify the date-detected value format against the actual raw holdings data.
 *
 * Some filers (e.g. Baupost) are non-compliant and still report values in
 * thousands even after the 2023 cutover. We detect this by checking the median
 * implied price per share across equity holdings: if it's below $1.00, the
 * values must be in thousands (no real equity position averages less than $1/share).
 */
export function verifyValueFormat(
  rawHoldings: RawHolding[],
  detected: 'thousands' | 'exact',
): 'thousands' | 'exact' {
  if (detected === 'thousands') return 'thousands';

  const equityHoldings = rawHoldings.filter(
    (h) =>
      String(h.shrsOrPrnAmt?.sshPrnamtType) === 'SH' &&
      !h.putCall &&
      Number(h.shrsOrPrnAmt?.sshPrnamt) > 0,
  );

  if (equityHoldings.length === 0) return detected;

  const impliedPrices = equityHoldings
    .map((h) => Number(h.value) / Number(h.shrsOrPrnAmt.sshPrnamt))
    .sort((a, b) => a - b);

  const median = impliedPrices[Math.floor(impliedPrices.length / 2)];

  if (median < 1.0) {
    console.warn(
      `[Normalizer] Detected non-compliant "thousands" format (median implied price $${median.toFixed(4)}/share). Overriding to thousands.`,
    );
    return 'thousands';
  }

  return 'exact';
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
 * - Deduplicates by (cusip, putCall) — some filings list the same security
 *   multiple times across sub-advisors; we aggregate shares and value.
 */
export function normalizeHoldings(
  rawHoldings: RawHolding[],
  context: NormalizeContext,
): NormalizedHolding[] {
  const rows = rawHoldings.map((raw) => {
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

  // Deduplicate by (cusip, putCall) — aggregate shares and value
  const deduped = new Map<string, NormalizedHolding>();
  for (const row of rows) {
    const key = `${row.cusip}|${row.putCall}`;
    const existing = deduped.get(key);
    if (existing) {
      existing.value += row.value;
      existing.shares += row.shares;
    } else {
      deduped.set(key, { ...row });
    }
  }

  return Array.from(deduped.values());
}
