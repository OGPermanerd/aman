import { Badge } from '@/components/ui/badge'
import type { PositionChangeType } from '@/analytics/types'

interface ChangeBadgeProps {
  changeType: PositionChangeType | null
}

const BADGE_CONFIG: Record<
  PositionChangeType,
  { label: string; className: string; variant: 'default' | 'destructive' | 'outline' | 'secondary' }
> = {
  new: {
    label: 'NEW',
    className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200',
    variant: 'outline',
  },
  exited: {
    label: 'EXIT',
    className: '',
    variant: 'destructive',
  },
  increased: {
    label: 'ADD',
    className: 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200',
    variant: 'outline',
  },
  decreased: {
    label: 'TRIM',
    className: 'bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200',
    variant: 'outline',
  },
  unchanged: {
    label: '---',
    className: '',
    variant: 'secondary',
  },
}

export function ChangeBadge({ changeType }: ChangeBadgeProps) {
  if (!changeType) return null

  const config = BADGE_CONFIG[changeType]

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}
