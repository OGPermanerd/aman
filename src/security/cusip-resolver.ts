/**
 * Multi-layer CUSIP-to-ticker resolution via OpenFIGI API with local caching.
 *
 * Resolution strategy:
 * 1. Check local securities table (cache hit)
 * 2. Batch-query OpenFIGI API for misses
 * 3. Flag unresolvable CUSIPs as unmapped (never drop)
 *
 * Rate limits: Without API key: 10 jobs/req, 25 req/min (2500ms between).
 *              With API key: 100 jobs/req, 25 req/6sec (250ms between).
 */

import { eq, and, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { securities, holdings } from '../db/schema.js';
import type * as schema from '../db/schema.js';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ResolveResult {
  resolved: number;
  unmapped: number;
  total: number;
  errors: string[];
}

export interface SecurityInfo {
  cusip: string;
  ticker: string | null;
  name: string | null;
  securityType: string | null;
  unmapped: boolean;
}

// ---------------------------------------------------------------------------
// OpenFIGI API types
// ---------------------------------------------------------------------------

interface OpenFIGIRequest {
  idType: 'ID_CUSIP';
  idValue: string;
}

interface OpenFIGIDataItem {
  figi: string;
  ticker: string;
  name: string;
  securityType: string;
  marketSector: string;
  exchCode: string;
}

interface OpenFIGIResponseItem {
  data?: OpenFIGIDataItem[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPENFIGI_URL = 'https://api.openfigi.com/v3/mapping';

function getBatchConfig(): { batchSize: number; delayMs: number } {
  const hasKey = !!process.env.OPENFIGI_API_KEY;
  return {
    batchSize: hasKey ? 100 : 10,
    delayMs: hasKey ? 250 : 2500,
  };
}

// ---------------------------------------------------------------------------
// OpenFIGI batch request
// ---------------------------------------------------------------------------

async function queryOpenFIGI(
  cusips: string[],
): Promise<OpenFIGIResponseItem[]> {
  const body: OpenFIGIRequest[] = cusips.map((cusip) => ({
    idType: 'ID_CUSIP',
    idValue: cusip,
  }));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const apiKey = process.env.OPENFIGI_API_KEY;
  if (apiKey) {
    headers['X-OPENFIGI-APIKEY'] = apiKey;
  }

  const response = await globalThis.fetch(OPENFIGI_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`OpenFIGI API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<OpenFIGIResponseItem[]>;
}

// ---------------------------------------------------------------------------
// resolveNewCusips
// ---------------------------------------------------------------------------

/**
 * Find all CUSIPs in the holdings table that are NOT yet resolved in the
 * securities table (or are marked unmapped=true), resolve them via OpenFIGI,
 * and update the securities table.
 */
export async function resolveNewCusips(
  db: BetterSQLite3Database<typeof schema>,
): Promise<ResolveResult> {
  const result: ResolveResult = {
    resolved: 0,
    unmapped: 0,
    total: 0,
    errors: [],
  };

  // Find CUSIPs that need resolution:
  // In holdings but not in securities, OR in securities with unmapped=true
  const unresolvedRows = db
    .select({ cusip: holdings.cusip })
    .from(holdings)
    .where(
      sql`${holdings.cusip} NOT IN (SELECT ${securities.cusip} FROM ${securities} WHERE ${securities.unmapped} = 0)`,
    )
    .groupBy(holdings.cusip)
    .all();

  const cusipsToResolve = unresolvedRows.map((r) => r.cusip);
  result.total = cusipsToResolve.length;

  if (cusipsToResolve.length === 0) {
    console.log('[CUSIP Resolver] No new CUSIPs to resolve.');
    return result;
  }

  console.log(
    `[CUSIP Resolver] Resolving ${cusipsToResolve.length} CUSIPs via OpenFIGI...`,
  );

  const config = getBatchConfig();

  // Process in batches
  for (let i = 0; i < cusipsToResolve.length; i += config.batchSize) {
    const batch = cusipsToResolve.slice(i, i + config.batchSize);

    try {
      const responses = await queryOpenFIGI(batch);

      for (let j = 0; j < batch.length; j++) {
        const cusip = batch[j];
        const response = responses[j];

        if (response?.data && response.data.length > 0) {
          const match = response.data[0];
          db.insert(securities)
            .values({
              cusip,
              ticker: match.ticker || null,
              name: match.name || null,
              securityType: match.securityType || null,
              mappingSource: 'openfigi',
              unmapped: false,
              mappedAt: new Date().toISOString(),
            })
            .onConflictDoUpdate({
              target: securities.cusip,
              set: {
                ticker: match.ticker || null,
                name: match.name || null,
                securityType: match.securityType || null,
                mappingSource: 'openfigi',
                unmapped: false,
                mappedAt: new Date().toISOString(),
              },
            })
            .run();
          result.resolved++;
        } else {
          // Unresolved -- flag as unmapped, do NOT drop
          db.insert(securities)
            .values({
              cusip,
              unmapped: true,
              mappingSource: null,
            })
            .onConflictDoUpdate({
              target: securities.cusip,
              set: {
                unmapped: true,
              },
            })
            .run();
          result.unmapped++;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[CUSIP Resolver] Error resolving batch starting at index ${i}: ${message}`,
      );
      result.errors.push(message);

      // Flag the entire batch as unmapped on API error
      for (const cusip of batch) {
        db.insert(securities)
          .values({
            cusip,
            unmapped: true,
            mappingSource: null,
          })
          .onConflictDoNothing()
          .run();
        result.unmapped++;
      }
    }

    // Rate limit: wait between batches (skip after last batch)
    if (i + config.batchSize < cusipsToResolve.length) {
      await new Promise((r) => setTimeout(r, config.delayMs));
    }
  }

  console.log(
    `[CUSIP Resolver] Done: ${result.resolved} resolved, ${result.unmapped} unmapped, ${result.errors.length} errors`,
  );

  return result;
}

// ---------------------------------------------------------------------------
// resolveCusips (specific list)
// ---------------------------------------------------------------------------

/**
 * Resolve a specific list of CUSIPs. Checks local securities table first
 * (cache hit), then resolves misses via OpenFIGI.
 */
export async function resolveCusips(
  db: BetterSQLite3Database<typeof schema>,
  cusips: string[],
): Promise<Map<string, SecurityInfo>> {
  const results = new Map<string, SecurityInfo>();
  const missedCusips: string[] = [];

  // Check local cache first
  for (const cusip of cusips) {
    const existing = db
      .select()
      .from(securities)
      .where(and(eq(securities.cusip, cusip), eq(securities.unmapped, false)))
      .limit(1)
      .all();

    if (existing.length > 0) {
      const sec = existing[0];
      results.set(cusip, {
        cusip: sec.cusip,
        ticker: sec.ticker,
        name: sec.name,
        securityType: sec.securityType,
        unmapped: sec.unmapped ?? true,
      });
    } else {
      missedCusips.push(cusip);
    }
  }

  if (missedCusips.length === 0) {
    return results;
  }

  // Resolve misses via OpenFIGI
  const config = getBatchConfig();

  for (let i = 0; i < missedCusips.length; i += config.batchSize) {
    const batch = missedCusips.slice(i, i + config.batchSize);

    try {
      const responses = await queryOpenFIGI(batch);

      for (let j = 0; j < batch.length; j++) {
        const cusip = batch[j];
        const response = responses[j];

        if (response?.data && response.data.length > 0) {
          const match = response.data[0];
          const info: SecurityInfo = {
            cusip,
            ticker: match.ticker || null,
            name: match.name || null,
            securityType: match.securityType || null,
            unmapped: false,
          };

          // Cache in DB
          db.insert(securities)
            .values({
              cusip,
              ticker: info.ticker,
              name: info.name,
              securityType: info.securityType,
              mappingSource: 'openfigi',
              unmapped: false,
              mappedAt: new Date().toISOString(),
            })
            .onConflictDoUpdate({
              target: securities.cusip,
              set: {
                ticker: info.ticker,
                name: info.name,
                securityType: info.securityType,
                mappingSource: 'openfigi',
                unmapped: false,
                mappedAt: new Date().toISOString(),
              },
            })
            .run();

          results.set(cusip, info);
        } else {
          results.set(cusip, {
            cusip,
            ticker: null,
            name: null,
            securityType: null,
            unmapped: true,
          });

          db.insert(securities)
            .values({ cusip, unmapped: true, mappingSource: null })
            .onConflictDoUpdate({
              target: securities.cusip,
              set: { unmapped: true },
            })
            .run();
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[CUSIP Resolver] Batch error: ${message}`);

      for (const cusip of batch) {
        results.set(cusip, {
          cusip,
          ticker: null,
          name: null,
          securityType: null,
          unmapped: true,
        });
      }
    }

    if (i + config.batchSize < missedCusips.length) {
      await new Promise((r) => setTimeout(r, config.delayMs));
    }
  }

  return results;
}
