'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChangeBadge } from '@/app/_components/change-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatShares } from '@/lib/formatters'
import type { PositionChangeType } from '@/analytics/types'

export interface ActivityItem {
  fundCik: string
  fundName: string
  strategyGroup: string
  cusip: string
  ticker: string | null
  nameOfIssuer: string
  value: number
  valueDelta: number
  sharesDelta: number
  changeType: PositionChangeType
}

interface ActivityTabsProps {
  items: ActivityItem[]
  quarter: string
  counts: { new: number; exited: number; increased: number; decreased: number }
}

type Tab = 'all' | 'new' | 'exited' | 'increased' | 'decreased'

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'exited', label: 'Exits' },
  { id: 'increased', label: 'Adds' },
  { id: 'decreased', label: 'Trims' },
]

export function ActivityTabs({ items, quarter, counts }: ActivityTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('all')

  const tabCounts: Record<Tab, number> = {
    all: items.length,
    new: counts.new,
    exited: counts.exited,
    increased: counts.increased,
    decreased: counts.decreased,
  }

  const filtered =
    activeTab === 'all' ? items : items.filter((i) => i.changeType === activeTab)

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {tab.label}
            {tabCounts[tab.id] > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                {tabCounts[tab.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No activity for this filter.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Fund</TableHead>
              <TableHead className="w-[80px]">Ticker</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="text-right">Δ Value</TableHead>
              <TableHead className="text-right w-[100px]">Δ Shares</TableHead>
              <TableHead className="text-center w-[80px]">Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item, idx) => (
              <TableRow key={`${item.fundCik}-${item.cusip}-${idx}`}>
                <TableCell className="font-medium text-sm">{item.fundName}</TableCell>
                <TableCell className="font-mono text-sm">
                  {item.ticker ? (
                    <Link
                      href={`/positions/${item.cusip}?quarter=${quarter}`}
                      className="hover:underline font-semibold"
                    >
                      {item.ticker}
                    </Link>
                  ) : (
                    <Link
                      href={`/positions/${item.cusip}?quarter=${quarter}`}
                      className="hover:underline text-muted-foreground"
                    >
                      —
                    </Link>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {item.nameOfIssuer}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {item.value > 0 ? formatCurrency(item.value) : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  <span
                    className={
                      item.valueDelta > 0
                        ? 'text-green-600'
                        : item.valueDelta < 0
                          ? 'text-red-600'
                          : 'text-muted-foreground'
                    }
                  >
                    {item.valueDelta > 0 ? '+' : ''}
                    {formatCurrency(item.valueDelta)}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {item.changeType === 'new' || item.changeType === 'exited' ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span
                      className={
                        item.sharesDelta > 0
                          ? 'text-green-600'
                          : item.sharesDelta < 0
                            ? 'text-red-600'
                            : 'text-muted-foreground'
                      }
                    >
                      {item.sharesDelta > 0 ? '+' : ''}
                      {formatShares(item.sharesDelta)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <ChangeBadge changeType={item.changeType} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
