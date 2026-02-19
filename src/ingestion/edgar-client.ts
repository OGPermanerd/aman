/**
 * Rate-limited HTTP client for SEC EDGAR.
 *
 * Enforces the 10 requests/second limit (100ms minimum between requests)
 * and sends a proper User-Agent header as required by SEC.
 */

const EDGAR_BASE = 'https://data.sec.gov';
const ARCHIVES_BASE = 'https://www.sec.gov/Archives/edgar/data';
const MIN_INTERVAL_MS = 100; // 10 req/s = 100ms between requests
const USER_AGENT = 'HedgeLens hedgelens@example.com';
const RETRY_BACKOFF_MS = 2000;

export class EdgarClient {
  private lastRequestTime = 0;

  /**
   * Fetch a URL from EDGAR with rate limiting, proper headers, and retry on 429.
   */
  async fetch(url: string): Promise<Response> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < MIN_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
    }
    this.lastRequestTime = Date.now();

    const response = await globalThis.fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    });

    // Retry once on 429 (rate limited)
    if (response.status === 429) {
      console.warn(`[EDGAR] Rate limited on ${url}, retrying in ${RETRY_BACKOFF_MS}ms...`);
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
      this.lastRequestTime = Date.now();

      const retry = await globalThis.fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
      });

      if (!retry.ok) {
        throw new Error(
          `[EDGAR] ${retry.status} after retry: ${url}`,
        );
      }
      return retry;
    }

    if (!response.ok) {
      throw new Error(`[EDGAR] ${response.status}: ${url}`);
    }
    return response;
  }

  /**
   * Fetch submissions for a CIK (all filings metadata).
   * CIK is zero-padded to 10 digits for the submissions API.
   */
  async getSubmissions(cik: string): Promise<any> {
    const paddedCik = cik.replace(/^0+/, '').padStart(10, '0');
    const url = `${EDGAR_BASE}/submissions/CIK${paddedCik}.json`;
    const response = await this.fetch(url);
    return response.json();
  }

  /**
   * Fetch the filing index (directory listing) for a specific filing.
   * Uses raw CIK (no leading zeros) for archive URLs.
   */
  async getFilingIndex(cik: string, accessionNumber: string): Promise<any> {
    const rawCik = cik.replace(/^0+/, '');
    const noDashes = accessionNumber.replace(/-/g, '');
    const url = `${ARCHIVES_BASE}/${rawCik}/${noDashes}/index.json`;
    const response = await this.fetch(url);
    return response.json();
  }

  /**
   * Fetch a specific document from a filing.
   * Returns raw text content.
   */
  async getDocument(cik: string, accessionNumber: string, filename: string): Promise<string> {
    const rawCik = cik.replace(/^0+/, '');
    const noDashes = accessionNumber.replace(/-/g, '');
    const url = `${ARCHIVES_BASE}/${rawCik}/${noDashes}/${filename}`;
    const response = await this.fetch(url);
    return response.text();
  }
}

/** Singleton instance for shared use across the application. */
export const edgarClient = new EdgarClient();
