/**
 * Discover 13F-HR and 13F-HR/A filings from the SEC EDGAR submissions API.
 * Groups filings by reporting quarter and handles pagination for large filers.
 */

import { edgarClient } from './edgar-client.js';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface FilingMetadata {
  accessionNumber: string;
  form: string; // "13F-HR" or "13F-HR/A"
  filingDate: string; // "2026-02-17"
  reportDate: string; // "2025-12-31"
  acceptanceDateTime: string; // "2026-02-17T21:08:09.000Z"
  primaryDocument: string;
}

export interface QuarterFilings {
  reportDate: string; // "2025-12-31"
  reportQuarter: string; // "2025Q4"
  filings: FilingMetadata[]; // sorted by acceptanceDateTime ascending
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a report date (e.g. "2025-12-31") to quarter format (e.g. "2025Q4").
 * Quarter boundaries: Q1=03-31, Q2=06-30, Q3=09-30, Q4=12-31
 */
export function reportDateToQuarter(reportDate: string): string {
  const [year, month] = reportDate.split('-').map(Number);
  let quarter: number;
  if (month <= 3) quarter = 1;
  else if (month <= 6) quarter = 2;
  else if (month <= 9) quarter = 3;
  else quarter = 4;
  return `${year}Q${quarter}`;
}

/**
 * Extract an array of FilingMetadata from the parallel-array structure
 * returned by the EDGAR submissions API.
 */
function extractFilings(recent: any): FilingMetadata[] {
  const results: FilingMetadata[] = [];
  const count = recent.accessionNumber?.length ?? 0;
  for (let i = 0; i < count; i++) {
    results.push({
      accessionNumber: recent.accessionNumber[i],
      form: recent.form[i],
      filingDate: recent.filingDate[i],
      reportDate: recent.reportDate[i],
      acceptanceDateTime: recent.acceptanceDateTime[i],
      primaryDocument: recent.primaryDocument[i],
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main discovery function
// ---------------------------------------------------------------------------

/**
 * Discover 13F-HR and 13F-HR/A filings for a CIK.
 *
 * Returns the latest N quarters (default 2) of filings, grouped by reporting
 * quarter. Within each quarter, filings are sorted by acceptanceDateTime
 * ascending (originals before amendments).
 */
export async function discoverFilings(
  cik: string,
  options?: { quarters?: number },
): Promise<QuarterFilings[]> {
  const maxQuarters = options?.quarters ?? 2;

  // 1. Fetch submissions
  const submissions = await edgarClient.getSubmissions(cik);

  // 2. Collect all filings from recent + paginated files
  let allFilings = extractFilings(submissions.filings.recent);

  // Handle pagination: filers with 1000+ filings have additional JSON files
  if (submissions.filings.files && submissions.filings.files.length > 0) {
    for (const file of submissions.filings.files) {
      const additionalData = await edgarClient.fetch(
        `https://data.sec.gov/submissions/${file.name}`,
      );
      const additional = await additionalData.json() as any;
      allFilings = allFilings.concat(extractFilings(additional));
    }
  }

  // 3. Filter for 13F-HR and 13F-HR/A forms
  const thirteenF = allFilings.filter(
    (f) => f.form === '13F-HR' || f.form === '13F-HR/A',
  );

  // 4. Group by reportDate
  const groups = new Map<string, FilingMetadata[]>();
  for (const filing of thirteenF) {
    const existing = groups.get(filing.reportDate) ?? [];
    existing.push(filing);
    groups.set(filing.reportDate, existing);
  }

  // 5. Within each group, sort by acceptanceDateTime ascending (originals before amendments)
  for (const filings of groups.values()) {
    filings.sort(
      (a, b) =>
        new Date(a.acceptanceDateTime).getTime() -
        new Date(b.acceptanceDateTime).getTime(),
    );
  }

  // 6. Convert to QuarterFilings array, sorted by reportDate descending
  const quarterFilings: QuarterFilings[] = [];
  for (const [reportDate, filings] of groups.entries()) {
    quarterFilings.push({
      reportDate,
      reportQuarter: reportDateToQuarter(reportDate),
      filings,
    });
  }
  quarterFilings.sort(
    (a, b) => b.reportDate.localeCompare(a.reportDate),
  );

  // 7. Return latest N quarters
  return quarterFilings.slice(0, maxQuarters);
}
