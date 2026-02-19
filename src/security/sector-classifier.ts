/**
 * Classify securities by sector using SIC codes from SEC data.
 *
 * Two approaches:
 * 1. classifySectors: Uses issuerCik from securities table -> SEC submissions API -> SIC code
 * 2. classifySectorsFromHoldings: Uses ticker -> SEC company_tickers.json -> CIK -> SIC code
 */

import { and, isNull, isNotNull, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { securities } from '../db/schema.js';
import type * as schema from '../db/schema.js';
import { edgarClient } from '../ingestion/edgar-client.js';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ClassifyResult {
  classified: number;
  skipped: number;
}

// ---------------------------------------------------------------------------
// SIC code to sector mapping
// ---------------------------------------------------------------------------

/**
 * Static mapping from 2-digit SIC division to broad sector name.
 * Source: SEC SIC code list (https://www.sec.gov/search-filings/standard-industrial-classification-sic-code-list)
 */
const SIC_TO_SECTOR: Record<string, string> = {
  // Agriculture, Forestry, Fishing (01-09)
  '01': 'Agriculture', '02': 'Agriculture', '07': 'Agriculture', '08': 'Agriculture', '09': 'Agriculture',
  // Mining (10-14)
  '10': 'Energy & Mining', '12': 'Energy & Mining', '13': 'Energy & Mining', '14': 'Energy & Mining',
  // Construction (15-17)
  '15': 'Industrials', '16': 'Industrials', '17': 'Industrials',
  // Manufacturing (20-39)
  '20': 'Consumer Staples', '21': 'Consumer Staples',
  '22': 'Consumer Discretionary', '23': 'Consumer Discretionary', '24': 'Industrials', '25': 'Industrials',
  '26': 'Materials', '27': 'Communication Services', '28': 'Healthcare',
  '29': 'Energy & Mining', '30': 'Materials', '31': 'Consumer Discretionary',
  '32': 'Materials', '33': 'Materials', '34': 'Industrials', '35': 'Industrials',
  '36': 'Technology', '37': 'Industrials', '38': 'Technology', '39': 'Consumer Discretionary',
  // Transportation & Utilities (40-49)
  '40': 'Industrials', '41': 'Industrials', '42': 'Industrials', '43': 'Communication Services',
  '44': 'Industrials', '45': 'Industrials', '46': 'Industrials', '47': 'Industrials',
  '48': 'Communication Services', '49': 'Utilities',
  // Wholesale Trade (50-51)
  '50': 'Consumer Discretionary', '51': 'Consumer Discretionary',
  // Retail Trade (52-59)
  '52': 'Consumer Discretionary', '53': 'Consumer Discretionary', '54': 'Consumer Staples',
  '55': 'Consumer Discretionary', '56': 'Consumer Discretionary', '57': 'Consumer Discretionary',
  '58': 'Consumer Discretionary', '59': 'Consumer Discretionary',
  // Finance, Insurance, Real Estate (60-67)
  '60': 'Financials', '61': 'Financials', '62': 'Financials', '63': 'Financials',
  '64': 'Financials', '65': 'Real Estate', '67': 'Financials',
  // Services (70-89)
  '70': 'Consumer Discretionary', '72': 'Consumer Discretionary', '73': 'Technology',
  '75': 'Industrials', '76': 'Industrials', '78': 'Communication Services',
  '79': 'Consumer Discretionary', '80': 'Healthcare', '81': 'Industrials',
  '82': 'Consumer Discretionary', '83': 'Consumer Discretionary', '84': 'Consumer Discretionary',
  '86': 'Consumer Discretionary', '87': 'Technology', '89': 'Industrials',
  // Public Administration (91-99)
  '91': 'Government', '92': 'Government', '93': 'Government', '94': 'Government',
  '95': 'Government', '96': 'Government', '97': 'Government', '99': 'Other',
};

/**
 * Map a SIC code to a broad sector name.
 * Uses the first 2 digits (division level) for the lookup.
 */
export function sicToSector(sicCode: string): string {
  const division = sicCode.substring(0, 2);
  return SIC_TO_SECTOR[division] || 'Other';
}

// ---------------------------------------------------------------------------
// classifySectors (using issuerCik)
// ---------------------------------------------------------------------------

/**
 * Classify securities using their issuerCik to look up SIC codes from
 * the SEC submissions API.
 *
 * For each security where sector IS NULL and issuerCik IS NOT NULL:
 * 1. Fetch SIC from SEC submissions API
 * 2. Map SIC to sector
 * 3. Update securities table
 */
export async function classifySectors(
  db: BetterSQLite3Database<typeof schema>,
): Promise<ClassifyResult> {
  const result: ClassifyResult = { classified: 0, skipped: 0 };

  // Find securities needing classification
  const unclassified = db
    .select()
    .from(securities)
    .where(and(isNull(securities.sector), isNotNull(securities.issuerCik)))
    .all();

  if (unclassified.length === 0) {
    console.log('[Sector Classifier] No securities with issuerCik to classify.');
    return result;
  }

  console.log(
    `[Sector Classifier] Classifying ${unclassified.length} securities by issuerCik...`,
  );

  // Deduplicate by issuerCik to avoid redundant API calls
  const cikToSic = new Map<string, { sic: string; sicDescription: string }>();

  for (const sec of unclassified) {
    const cik = sec.issuerCik!;

    if (!cikToSic.has(cik)) {
      try {
        const submissions = await edgarClient.getSubmissions(cik);
        const sicCode = String(submissions.sic || '');
        const sicDesc = String(submissions.sicDescription || '');

        if (sicCode) {
          cikToSic.set(cik, { sic: sicCode, sicDescription: sicDesc });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[Sector Classifier] Failed to fetch SIC for CIK ${cik}: ${message}`,
        );
        result.skipped++;
        continue;
      }
    }

    const sicInfo = cikToSic.get(cik);
    if (sicInfo) {
      const sector = sicToSector(sicInfo.sic);
      db.update(securities)
        .set({
          sic: sicInfo.sic,
          sicDescription: sicInfo.sicDescription,
          sector,
        })
        .where(eq(securities.cusip, sec.cusip))
        .run();
      result.classified++;
    } else {
      result.skipped++;
    }
  }

  console.log(
    `[Sector Classifier] Done: ${result.classified} classified, ${result.skipped} skipped`,
  );

  return result;
}

// ---------------------------------------------------------------------------
// classifySectorsFromHoldings (using ticker -> company_tickers.json)
// ---------------------------------------------------------------------------

/**
 * Classify securities using their ticker to look up CIK from SEC company_tickers.json,
 * then fetch SIC code from SEC submissions API.
 *
 * For securities that have a ticker but no sector:
 * 1. Fetch company_tickers.json to build ticker -> CIK lookup
 * 2. For each security, find its CIK via ticker
 * 3. Fetch SIC from submissions API
 * 4. Update securities table
 */
export async function classifySectorsFromHoldings(
  db: BetterSQLite3Database<typeof schema>,
): Promise<ClassifyResult> {
  const result: ClassifyResult = { classified: 0, skipped: 0 };

  // Find securities needing classification (have ticker but no sector)
  const unclassified = db
    .select()
    .from(securities)
    .where(and(isNull(securities.sector), isNotNull(securities.ticker)))
    .all();

  if (unclassified.length === 0) {
    console.log('[Sector Classifier] No securities with tickers to classify.');
    return result;
  }

  console.log(
    `[Sector Classifier] Classifying ${unclassified.length} securities via ticker lookup...`,
  );

  // Fetch SEC company_tickers.json for ticker -> CIK mapping
  let tickerToCik: Map<string, string>;
  try {
    const response = await edgarClient.fetch(
      'https://www.sec.gov/files/company_tickers.json',
    );
    const data = (await response.json()) as Record<
      string,
      { cik_str: number; ticker: string; title: string }
    >;

    tickerToCik = new Map<string, string>();
    for (const entry of Object.values(data)) {
      tickerToCik.set(
        entry.ticker.toUpperCase(),
        String(entry.cik_str),
      );
    }

    console.log(
      `[Sector Classifier] Loaded ${tickerToCik.size} ticker->CIK mappings from SEC`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[Sector Classifier] Failed to fetch company_tickers.json: ${message}`,
    );
    return result;
  }

  // Cache SIC lookups by CIK
  const cikToSic = new Map<string, { sic: string; sicDescription: string }>();

  for (const sec of unclassified) {
    const ticker = sec.ticker!.toUpperCase();
    const cik = tickerToCik.get(ticker);

    if (!cik) {
      result.skipped++;
      continue;
    }

    // Update issuerCik if not already set
    if (!sec.issuerCik) {
      db.update(securities)
        .set({ issuerCik: cik })
        .where(eq(securities.cusip, sec.cusip))
        .run();
    }

    if (!cikToSic.has(cik)) {
      try {
        const submissions = await edgarClient.getSubmissions(cik);
        const sicCode = String(submissions.sic || '');
        const sicDesc = String(submissions.sicDescription || '');

        if (sicCode) {
          cikToSic.set(cik, { sic: sicCode, sicDescription: sicDesc });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[Sector Classifier] Failed to fetch SIC for CIK ${cik} (ticker ${ticker}): ${message}`,
        );
        result.skipped++;
        continue;
      }
    }

    const sicInfo = cikToSic.get(cik);
    if (sicInfo) {
      const sector = sicToSector(sicInfo.sic);
      db.update(securities)
        .set({
          sic: sicInfo.sic,
          sicDescription: sicInfo.sicDescription,
          sector,
          issuerCik: cik,
        })
        .where(eq(securities.cusip, sec.cusip))
        .run();
      result.classified++;
    } else {
      result.skipped++;
    }
  }

  console.log(
    `[Sector Classifier] Done: ${result.classified} classified, ${result.skipped} skipped`,
  );

  return result;
}
