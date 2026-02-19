'use client'

import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ChangeBadge } from '@/app/_components/change-badge'
import { WeightBar } from '@/app/_components/weight-bar'
import { formatCurrency, formatShares, formatPercent } from '@/lib/formatters'
import type { PositionChangeType } from '@/analytics/types'

export interface HoldingRow {
  cusip: string
  ticker: string | null
  nameOfIssuer: string
  value: number
  shares: number
  weight: number
  changeType: PositionChangeType | null
  valueDelta: number
  sharesDelta: number
  weightDelta: number
  convictionLevel: 'high' | 'medium' | 'low' | null
}

interface HoldingsTableProps {
  holdings: HoldingRow[]
  quarter: string
}

function DeltaText({ value, format }: { value: number; format: 'currency' | 'shares' | 'percent' }) {
  if (value === 0) return null

  const isPositive = value > 0
  const color = isPositive ? 'text-emerald-600' : 'text-red-600'
  const sign = isPositive ? '+' : ''

  let formatted: string
  if (format === 'currency') {
    formatted = `${sign}${formatCurrency(value)}`
  } else if (format === 'shares') {
    formatted = `${sign}${formatShares(value)}`
  } else {
    formatted = `${sign}${formatPercent(value)}`
  }

  return <span className={`text-xs ${color}`}>{formatted}</span>
}

function ConvictionBadge({ level }: { level: 'high' | 'medium' | 'low' | null }) {
  if (!level) return <span className="text-muted-foreground text-xs">--</span>

  const config = {
    high: { label: 'High', className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200' },
    medium: { label: 'Med', className: 'bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200' },
    low: { label: 'Low', className: '' },
  }

  const c = config[level]

  return (
    <Badge variant={level === 'low' ? 'secondary' : 'outline'} className={c.className}>
      {c.label}
    </Badge>
  )
}

function SortIcon({ isSorted }: { isSorted: false | 'asc' | 'desc' }) {
  if (isSorted === 'asc') return <ArrowUp className="ml-1 h-3.5 w-3.5 inline" />
  if (isSorted === 'desc') return <ArrowDown className="ml-1 h-3.5 w-3.5 inline" />
  return <ArrowUpDown className="ml-1 h-3.5 w-3.5 inline opacity-50" />
}

const columns: ColumnDef<HoldingRow>[] = [
  {
    accessorKey: 'nameOfIssuer',
    header: 'Name',
    cell: ({ row }) => {
      const ticker = row.original.ticker
      const name = row.original.nameOfIssuer

      return (
        <div className="min-w-[160px]">
          {ticker ? (
            <>
              <span className="font-semibold">{ticker}</span>
              <span className="text-muted-foreground text-xs ml-1.5">{name}</span>
            </>
          ) : (
            <span className="font-medium">{name}</span>
          )}
        </div>
      )
    },
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.ticker ?? rowA.original.nameOfIssuer
      const b = rowB.original.ticker ?? rowB.original.nameOfIssuer
      return a.localeCompare(b)
    },
  },
  {
    accessorKey: 'changeType',
    header: 'Change',
    cell: ({ row }) => <ChangeBadge changeType={row.original.changeType} />,
    sortingFn: (rowA, rowB) => {
      const order: Record<string, number> = { new: 0, exited: 1, increased: 2, decreased: 3, unchanged: 4 }
      const a = rowA.original.changeType ? order[rowA.original.changeType] ?? 5 : 5
      const b = rowB.original.changeType ? order[rowB.original.changeType] ?? 5 : 5
      return a - b
    },
  },
  {
    accessorKey: 'value',
    header: 'Value',
    cell: ({ row }) => (
      <div className="text-right min-w-[100px]">
        <div className="tabular-nums">{formatCurrency(row.original.value)}</div>
        <DeltaText value={row.original.valueDelta} format="currency" />
      </div>
    ),
  },
  {
    accessorKey: 'shares',
    header: 'Shares',
    cell: ({ row }) => (
      <div className="text-right min-w-[80px]">
        <div className="tabular-nums">{formatShares(row.original.shares)}</div>
        <DeltaText value={row.original.sharesDelta} format="shares" />
      </div>
    ),
  },
  {
    accessorKey: 'weight',
    header: 'Weight',
    cell: ({ row }) => (
      <div className="min-w-[140px]">
        <WeightBar weight={row.original.weight} />
        <DeltaText value={row.original.weightDelta} format="percent" />
      </div>
    ),
  },
  {
    accessorKey: 'convictionLevel',
    header: 'Conviction',
    cell: ({ row }) => <ConvictionBadge level={row.original.convictionLevel} />,
    sortingFn: (rowA, rowB) => {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 }
      const a = rowA.original.convictionLevel ? order[rowA.original.convictionLevel] ?? 3 : 3
      const b = rowB.original.convictionLevel ? order[rowB.original.convictionLevel] ?? 3 : 3
      return a - b
    },
  },
]

export function HoldingsTable({ holdings, quarter }: HoldingsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'weight', desc: true },
  ])

  const table = useReactTable({
    data: holdings,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (holdings.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="text-muted-foreground">No holdings data for this quarter</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              const canSort = header.column.getCanSort()
              const sorted = header.column.getIsSorted()

              return (
                <TableHead
                  key={header.id}
                  className={canSort ? 'cursor-pointer select-none' : ''}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {canSort && <SortIcon isSorted={sorted} />}
                </TableHead>
              )
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
