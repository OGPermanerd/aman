import { formatQuarterLabel, formatQuarterDate } from '@/lib/formatters'

interface QuarterDisplayProps {
  quarter: string
}

export function QuarterDisplay({ quarter }: QuarterDisplayProps) {
  return (
    <div>
      <p className="text-2xl font-bold tracking-tight">{formatQuarterLabel(quarter)}</p>
      <p className="text-sm text-muted-foreground">as of {formatQuarterDate(quarter)}</p>
    </div>
  )
}
