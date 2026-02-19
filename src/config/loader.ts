import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq, notInArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { z } from 'zod/v4';
import { funds } from '../db/schema';
import type * as schema from '../db/schema';

// ---------------------------------------------------------------------------
// Zod schema for fund config validation
// ---------------------------------------------------------------------------
const FundEntrySchema = z.object({
  cik: z.string(),
  name: z.string(),
  strategyGroup: z.enum([
    'Tiger Cubs',
    'Activist',
    'Macro',
    'Quant',
    'Multi-Strategy',
  ]),
});

const FundConfigSchema = z.object({
  funds: z.array(FundEntrySchema),
});

export type FundEntry = z.infer<typeof FundEntrySchema>;
export type FundConfig = z.infer<typeof FundConfigSchema>;

// ---------------------------------------------------------------------------
// Load and validate fund config from JSON
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const FUNDS_JSON_PATH = join(__dirname, 'funds.json');

/**
 * Read and parse src/config/funds.json, returning a validated array of fund entries.
 * Throws if the JSON is malformed or doesn't match the schema.
 */
export function loadFundConfig(): FundConfig {
  const raw = readFileSync(FUNDS_JSON_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  return FundConfigSchema.parse(parsed);
}

// ---------------------------------------------------------------------------
// Sync fund config into database
// ---------------------------------------------------------------------------

/**
 * Load fund config from JSON and upsert all entries into the funds database table.
 * Funds in JSON are marked active. Funds in DB but not in JSON are marked inactive.
 */
export async function syncFundsToDb(
  db: BetterSQLite3Database<typeof schema>,
): Promise<{ upserted: number; deactivated: number }> {
  const config = loadFundConfig();
  const ciks: string[] = [];

  // Upsert all entries from config
  for (const entry of config.funds) {
    await db
      .insert(funds)
      .values({
        cik: entry.cik,
        name: entry.name,
        strategyGroup: entry.strategyGroup,
        active: true,
      })
      .onConflictDoUpdate({
        target: funds.cik,
        set: {
          name: entry.name,
          strategyGroup: entry.strategyGroup,
          active: true,
        },
      });
    ciks.push(entry.cik);
  }

  // Mark funds not in config as inactive
  let deactivated = 0;
  if (ciks.length > 0) {
    const result = await db
      .update(funds)
      .set({ active: false })
      .where(notInArray(funds.cik, ciks));
    deactivated = result.changes;
  }

  return { upserted: config.funds.length, deactivated };
}
