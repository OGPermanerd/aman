'use client'

import { useQueryState, parseAsString } from 'nuqs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatQuarterLabel } from '@/lib/formatters'

interface QuarterPickerProps {
  quarters: string[]
}

export function QuarterPicker({ quarters }: QuarterPickerProps) {
  const [quarter, setQuarter] = useQueryState(
    'quarter',
    parseAsString.withDefault(quarters[0] ?? '').withOptions({ shallow: false }),
  )

  if (quarters.length === 0) {
    return <span className="text-sm text-muted-foreground">No data available</span>
  }

  return (
    <Select value={quarter} onValueChange={setQuarter}>
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder="Select quarter" />
      </SelectTrigger>
      <SelectContent>
        {quarters.map((q) => (
          <SelectItem key={q} value={q}>
            {formatQuarterLabel(q)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
