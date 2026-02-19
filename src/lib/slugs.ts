const GROUPS = ['Tiger Cubs', 'Activist', 'Macro', 'Quant', 'Multi-Strategy'] as const
type StrategyGroup = typeof GROUPS[number]

const SLUG_MAP: Record<string, StrategyGroup> = {
  'tiger-cubs': 'Tiger Cubs',
  'activist': 'Activist',
  'macro': 'Macro',
  'quant': 'Quant',
  'multi-strategy': 'Multi-Strategy',
}

const NAME_TO_SLUG: Record<StrategyGroup, string> = Object.fromEntries(
  Object.entries(SLUG_MAP).map(([slug, name]) => [name, slug])
) as Record<StrategyGroup, string>

export function slugToGroup(slug: string): StrategyGroup | undefined {
  return SLUG_MAP[slug]
}

export function groupToSlug(group: string): string | undefined {
  return NAME_TO_SLUG[group as StrategyGroup]
}

export function getAllGroups(): StrategyGroup[] {
  return [...GROUPS]
}

export function getAllSlugs(): string[] {
  return Object.keys(SLUG_MAP)
}
