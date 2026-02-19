'use client'

import { useQueryState, parseAsString, parseAsBoolean } from 'nuqs'
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
  const [hideEmpty, setHideEmpty] = useQueryState(
    'hideEmpty',
    parseAsBoolean.withDefault(true).withOptions({ shallow: false }),
  )

  if (quarters.length === 0) {
    return <span className="text-sm text-muted-foreground">No data available</span>
  }

  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={hideEmpty}
          onChange={(e) => setHideEmpty(e.target.checked || null)}
          className="h-3.5 w-3.5 rounded border-input accent-primary cursor-pointer"
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap">Hide empty</span>
      </label>
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
    </div>
  )
}
