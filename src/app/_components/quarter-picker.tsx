'use client'

import { useState, useEffect } from 'react'
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
  const [mounted, setMounted] = useState(false)
  const [quarter, setQuarter] = useQueryState(
    'quarter',
    parseAsString.withDefault(quarters[0] ?? '').withOptions({ shallow: false }),
  )
  const [hideEmpty, setHideEmpty] = useQueryState(
    'hideEmpty',
    parseAsBoolean.withDefault(true).withOptions({ shallow: false }),
  )

  useEffect(() => setMounted(true), [])

  if (quarters.length === 0) {
    return <span className="text-sm text-muted-foreground">No data available</span>
  }

  return (
    <div className="flex items-center gap-2" suppressHydrationWarning>
      <label className="flex items-center gap-1.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={mounted ? hideEmpty : true}
          onChange={(e) => setHideEmpty(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-input accent-primary cursor-pointer"
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap">Hide empty</span>
      </label>
      {mounted ? (
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
      ) : (
        <div className="w-[140px] h-9 rounded-md border px-3 flex items-center" suppressHydrationWarning>
          <span className="text-sm">{formatQuarterLabel(quarters[0])}</span>
        </div>
      )}
    </div>
  )
}
