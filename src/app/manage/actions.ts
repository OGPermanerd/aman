'use server'

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db/connection'
import { funds } from '@/db/schema'
import { ingestFund } from '@/ingestion/pipeline'

const FUNDS_JSON_PATH = join(process.cwd(), 'src/config/funds.json')

interface FundEntry {
  cik: string
  name: string
  strategyGroup: string
}

function readFundsJson(): { funds: FundEntry[] } {
  const raw = readFileSync(FUNDS_JSON_PATH, 'utf-8')
  return JSON.parse(raw)
}

function writeFundsJson(config: { funds: FundEntry[] }) {
  writeFileSync(FUNDS_JSON_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}

export async function addFund(formData: FormData): Promise<{ error?: string }> {
  const cik = (formData.get('cik') as string)?.trim()
  const name = (formData.get('name') as string)?.trim()
  const strategyGroup = (formData.get('strategyGroup') as string)?.trim()

  if (!cik || !name || !strategyGroup) {
    return { error: 'All fields are required.' }
  }

  if (!/^\d+$/.test(cik)) {
    return { error: 'CIK must be a number (e.g. 1336528).' }
  }

  // Check for duplicate (same CIK + same group)
  const config = readFundsJson()
  if (config.funds.some((f) => f.cik === cik && f.strategyGroup === strategyGroup)) {
    return { error: `Fund with CIK ${cik} already exists in ${strategyGroup}.` }
  }

  // Add to JSON
  config.funds.push({ cik, name, strategyGroup })
  writeFundsJson(config)

  // Upsert into DB
  db.insert(funds)
    .values({ cik, name, strategyGroup, active: true })
    .onConflictDoUpdate({
      target: funds.cik,
      set: { name, strategyGroup, active: true },
    })
    .run()

  revalidatePath('/manage')
  revalidatePath('/groups')
  return {}
}

export async function removeFund(cik: string, strategyGroup?: string): Promise<{ error?: string }> {
  if (!cik) return { error: 'CIK is required.' }

  // Remove from JSON (specific group if provided, otherwise all entries)
  const config = readFundsJson()
  if (strategyGroup) {
    config.funds = config.funds.filter((f) => !(f.cik === cik && f.strategyGroup === strategyGroup))
  } else {
    config.funds = config.funds.filter((f) => f.cik !== cik)
  }
  writeFundsJson(config)

  // If no more entries for this CIK, mark inactive in DB (keep data)
  const hasRemainingEntries = config.funds.some((f) => f.cik === cik)
  if (!hasRemainingEntries) {
    db.update(funds)
      .set({ active: false })
      .where(eq(funds.cik, cik))
      .run()
  }

  revalidatePath('/manage')
  revalidatePath('/groups')
  return {}
}

export async function ingestNewFund(cik: string): Promise<{ error?: string; result?: { quartersProcessed: number; totalHoldings: number } }> {
  if (!cik || !/^\d+$/.test(cik)) {
    return { error: 'Invalid CIK.' }
  }

  try {
    const result = await ingestFund(db, cik)

    revalidatePath('/manage')
    revalidatePath('/groups')

    return {
      result: {
        quartersProcessed: result.quartersProcessed,
        totalHoldings: result.totalHoldings,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { error: `Ingestion failed: ${message}` }
  }
}
