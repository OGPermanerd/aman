import { db } from '@/db/connection'
import { funds } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/**
 * Returns all distinct strategy groups from active funds in the database.
 */
export function getAllGroups(): string[] {
  const rows = db
    .selectDistinct({ strategyGroup: funds.strategyGroup })
    .from(funds)
    .where(eq(funds.active, true))
    .orderBy(funds.strategyGroup)
    .all()
  return rows.map((r) => r.strategyGroup)
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
