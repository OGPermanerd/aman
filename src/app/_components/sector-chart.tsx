'use client'

import { Bar, BarChart, XAxis, YAxis, Cell } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCurrency, formatPercent } from '@/lib/formatters'

export interface SectorData {
  sector: string
  value: number
  weight: number // 0-1
}

interface SectorChartProps {
  data: SectorData[]
  title?: string
}

const SECTOR_COLORS: Record<string, string> = {
  'Technology': 'var(--chart-1)',
  'Healthcare': 'var(--chart-2)',
  'Financials': 'var(--chart-3)',
  'Consumer Discretionary': 'var(--chart-4)',
  'Communication Services': 'var(--chart-5)',
  'Industrials': 'oklch(0.55 0.12 240)',
  'Consumer Staples': 'oklch(0.60 0.12 160)',
  'Energy & Mining': 'oklch(0.60 0.15 60)',
  'Materials': 'oklch(0.65 0.12 80)',
  'Utilities': 'oklch(0.55 0.08 200)',
  'Real Estate': 'oklch(0.55 0.12 300)',
  'Other': 'oklch(0.60 0 0)',
  'Unknown': 'oklch(0.70 0 0)',
  'Unclassified': 'oklch(0.75 0 0)',
}

const DEFAULT_COLOR = 'oklch(0.55 0.08 220)'

function getSectorColor(sector: string): string {
  return SECTOR_COLORS[sector] ?? DEFAULT_COLOR
}

const chartConfig = {
  weight: { label: 'Allocation' },
} satisfies ChartConfig

interface TooltipPayloadItem {
  payload: {
    sector: string
    value: number
    weight: number
    displayWeight: number
  }
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
}) {
  if (!active || !payload?.length) return null

  const data = payload[0].payload

  return (
    <div className="border-border/50 bg-background rounded-lg border px-3 py-2 text-xs shadow-xl">
      <p className="font-medium mb-1">{data.sector}</p>
      <div className="grid gap-0.5 text-muted-foreground">
        <p>Value: {formatCurrency(data.value)}</p>
        <p>Weight: {formatPercent(data.weight)}</p>
      </div>
    </div>
  )
}

export function SectorChart({ data, title }: SectorChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="text-muted-foreground">No sector data available</p>
      </div>
    )
  }

  // Transform data for display: weight as percentage for X-axis
  const chartData = data.map((d) => ({
    sector: d.sector.length > 22 ? d.sector.slice(0, 20) + '...' : d.sector,
    fullSector: d.sector,
    displayWeight: Math.round(d.weight * 10000) / 100, // percentage for display
    value: d.value,
    weight: d.weight,
  }))

  // Calculate dynamic height based on number of sectors
  const barHeight = 32
  const chartHeight = Math.max(200, chartData.length * barHeight + 40)

  return (
    <div>
      {title && <h2 className="text-lg font-semibold mb-3">{title}</h2>}
      <ChartContainer config={chartConfig} className="w-full" style={{ height: chartHeight, aspectRatio: 'unset' }}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 20, bottom: 0, left: 10 }}
        >
          <XAxis
            type="number"
            tickFormatter={(v: number) => `${v}%`}
            fontSize={12}
          />
          <YAxis
            type="category"
            dataKey="sector"
            width={140}
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <ChartTooltip
            cursor={{ fill: 'var(--color-muted)', opacity: 0.3 }}
            content={<CustomTooltip />}
          />
          <Bar dataKey="displayWeight" radius={[0, 4, 4, 0]} maxBarSize={24}>
            {chartData.map((entry) => (
              <Cell
                key={entry.fullSector}
                fill={getSectorColor(entry.fullSector)}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <p className="text-xs text-muted-foreground mt-2">
        {data.length} sector{data.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
