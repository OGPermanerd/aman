import { readFileSync } from 'node:fs'
import { join } from 'node:path'

interface ConfigFundEntry {
  cik: string
  name: string
  strategyGroup: string
}

function readFundsConfig(): ConfigFundEntry[] {
  const raw = readFileSync(join(process.cwd(), 'src/config/funds.json'), 'utf-8')
  return JSON.parse(raw).funds
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/**
 * Returns all distinct strategy groups from funds config.
 */
export function getAllGroups(): string[] {
  const funds = readFundsConfig()
  const groups = [...new Set(funds.map((f) => f.strategyGroup))]
  groups.sort()
  return groups
}

/**
 * Returns funds belonging to a strategy group (from config).
 * Deduplicates by CIK within the same group.
 */
export function getFundsInGroup(group: string): { cik: string; name: string }[] {
  const funds = readFundsConfig()
  const entries = funds.filter((f) => f.strategyGroup === group)
  const seen = new Set<string>()
  return entries.filter((e) => {
    if (seen.has(e.cik)) return false
    seen.add(e.cik)
    return true
  })
}

export function slugToGroup(slug: string): string | undefined {
  const groups = getAllGroups()
  return groups.find((g) => slugify(g) === slug)
}

export function groupToSlug(group: string): string | undefined {
  return slugify(group)
}

export function getAllSlugs(): string[] {
  return getAllGroups().map(slugify)
}
