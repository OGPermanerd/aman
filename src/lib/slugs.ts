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

const GROUP_ORDER: string[] = [
  'GOATs',
  'Tiger Cubs',
  'Others',
  'Value',
  'Activist',
  'Real Estate',
]

/**
 * Returns all distinct strategy groups from funds config, sorted by the
 * canonical display order defined in GROUP_ORDER. Unknown groups are
 * appended alphabetically at the end.
 */
export function getAllGroups(): string[] {
  const funds = readFundsConfig()
  const groups = [...new Set(funds.map((f) => f.strategyGroup))]
  return groups.sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a)
    const bi = GROUP_ORDER.indexOf(b)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.localeCompare(b)
  })
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
