import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest, NextResponse } from 'next/server'

const CACHE_PATH = join(process.cwd(), 'data/company_tickers.json')
const SEC_URL = 'https://www.sec.gov/files/company_tickers.json'

interface SecCompany {
  cik_str: number
  ticker: string
  title: string
}

interface CompanyEntry {
  cik: string
  name: string
  ticker: string
}

let memoryCache: CompanyEntry[] | null = null

async function getCompanyList(): Promise<CompanyEntry[]> {
  if (memoryCache) return memoryCache

  // Try disk cache first
  if (existsSync(CACHE_PATH)) {
    try {
      const raw = readFileSync(CACHE_PATH, 'utf-8')
      memoryCache = JSON.parse(raw)
      return memoryCache!
    } catch {
      // Corrupted cache, re-fetch
    }
  }

  // Fetch from SEC
  const res = await fetch(SEC_URL, {
    headers: { 'User-Agent': 'HedgeLens/1.0 (personal research tool)' },
  })

  if (!res.ok) {
    throw new Error(`SEC API returned ${res.status}`)
  }

  const data: Record<string, SecCompany> = await res.json()
  const entries: CompanyEntry[] = Object.values(data).map((c) => ({
    cik: String(c.cik_str),
    name: c.title,
    ticker: c.ticker,
  }))

  // Cache to disk
  writeFileSync(CACHE_PATH, JSON.stringify(entries), 'utf-8')
  memoryCache = entries
  return entries
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim().toLowerCase()

  if (!q || q.length < 2) {
    return NextResponse.json([])
  }

  try {
    const companies = await getCompanyList()

    const matches = companies
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.ticker.toLowerCase().includes(q) ||
          c.cik.includes(q),
      )
      .slice(0, 20)

    return NextResponse.json(matches)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
