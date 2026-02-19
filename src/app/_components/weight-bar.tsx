import { formatPercent } from '@/lib/formatters'

interface WeightBarProps {
  weight: number
}

export function WeightBar({ weight }: WeightBarProps) {
  // Scale weight for visual display (max bar at 30% portfolio weight)
  const barWidth = Math.min(weight / 0.3, 1) * 100

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500"
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-14 text-right tabular-nums">
        {formatPercent(weight)}
      </span>
    </div>
  )
}
