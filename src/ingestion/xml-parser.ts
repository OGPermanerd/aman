/**
 * Parse 13F XML documents: information table (holdings) and cover page (amendment metadata).
 * Uses fast-xml-parser with namespace stripping and single-element array safety.
 */

import { XMLParser } from 'fast-xml-parser';

// ---------------------------------------------------------------------------
// Parser configuration
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  removeNSPrefix: true, // Strips ns1:, n1:, etc.
  isArray: (_name, jpath) => {
    // Force infoTable to always be an array (Pitfall 6: single-element ambiguity)
    return jpath === 'informationTable.infoTable';
  },
  ignoreAttributes: true,
  parseTagValue: true,
  trimValues: true,
});

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface RawHolding {
  nameOfIssuer: string;
  titleOfClass: string;
  cusip: string;
  value: number;
  shrsOrPrnAmt: {
    sshPrnamt: number;
    sshPrnamtType: string; // "SH" | "PRN"
  };
  putCall?: 'Put' | 'Call';
  investmentDiscretion: string;
  votingAuthority?: {
    Sole: number;
    Shared: number;
    None: number;
  };
}

export interface CoverPageData {
  reportCalendarOrQuarter: string;
  isAmendment: boolean;
  amendmentNo: number | undefined;
  amendmentType: 'RESTATEMENT' | 'NEW HOLDINGS' | undefined;
  confDeniedExpired: boolean | undefined;
  filingManagerName: string;
  tableEntryTotal: number;
  tableValueTotal: number;
}

// ---------------------------------------------------------------------------
// Parse info table XML
// ---------------------------------------------------------------------------

/**
 * Parse 13F information table XML and return an array of raw holdings.
 * Handles both `informationTable.infoTable` paths and namespace variations.
 */
export function parseInfoTable(xml: string): RawHolding[] {
  const parsed = parser.parse(xml);

  // The root element may be informationTable or ns1:informationTable (stripped)
  const entries = parsed.informationTable?.infoTable;
  if (!entries) return [];

  // Always an array due to isArray config
  return entries as RawHolding[];
}

// ---------------------------------------------------------------------------
// Parse cover page XML
// ---------------------------------------------------------------------------

/**
 * Parse 13F cover page (primary_doc.xml) and extract amendment metadata.
 * Handles isAmendment being boolean or string "true"/"false".
 */
export function parseCoverPage(xml: string): CoverPageData {
  const parsed = parser.parse(xml);
  const formData = parsed.edgarSubmission?.formData;
  if (!formData) {
    throw new Error('[XML] Could not find edgarSubmission.formData in cover page XML');
  }

  const cover = formData.coverPage;
  const summary = formData.summaryPage;

  // isAmendment can be boolean true/false or string "true"/"false"
  const isAmendment =
    cover.isAmendment === true ||
    cover.isAmendment === 'true' ||
    cover.isAmendment === 'Y';

  return {
    reportCalendarOrQuarter: String(cover.reportCalendarOrQuarter),
    isAmendment,
    amendmentNo: isAmendment ? cover.amendmentNo : undefined,
    amendmentType: isAmendment ? cover.amendmentInfo?.amendmentType : undefined,
    confDeniedExpired: isAmendment
      ? cover.amendmentInfo?.confDeniedExpired === true ||
        cover.amendmentInfo?.confDeniedExpired === 'true'
      : undefined,
    filingManagerName: cover.filingManager?.name ?? '',
    tableEntryTotal: Number(summary?.tableEntryTotal ?? 0),
    tableValueTotal: Number(summary?.tableValueTotal ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Find info table filename from filing index
// ---------------------------------------------------------------------------

/**
 * Given a filing index.json response, find the info table filename.
 * Logic: find XML files that are not primary_doc.xml (cover page).
 */
export function findInfoTableFilename(indexJson: any): string {
  const items: any[] = indexJson.directory?.item ?? [];

  const xmlFiles = items.filter((item: any) => {
    const name = String(item.name).toLowerCase();
    return name.endsWith('.xml') && !name.includes('primary_doc');
  });

  if (xmlFiles.length === 0) {
    throw new Error(
      '[XML] No info table XML found in filing index. Files: ' +
        items.map((i: any) => i.name).join(', '),
    );
  }

  // Return the first non-primary_doc XML file
  return xmlFiles[0].name;
}
