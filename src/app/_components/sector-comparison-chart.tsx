'use client'

import { Bar, BarChart, XAxis, YAxis, Legend } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCurrency, formatPercent } from '@/lib/formatters'

export interface SectorData {
  sector: string
  value: number
  weight: number
}

interface SectorComparisonChartProps {
  current: SectorData[]
  prior: SectorData[]
  currentLabel: string
  priorLabel: string
  title?: string
}

const CURRENT_COLOR = '#6366f1'   // indigo
const PRIOR_COLOR = '#d4d4d8'     // gray

const chartConfig = {
  current: { label: 'Current', color: CURRENT_COLOR },
  prior: { label: 'Prior', color: PRIOR_COLOR },
} satisfies ChartConfig

interface ComparisonTooltipPayload {
  dataKey: string
  value: number
  payload: {
    sector: string
    current: number
    prior: number
    currentValue: number
    priorValue: number
    delta: number
  }
}

function ComparisonTooltip({
  active,
  payload,
  currentLabel,
  priorLabel,
}: {
  active?: boolean
  payload?: ComparisonTooltipPayload[]
  currentLabel: string
  priorLabel: string
}) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  const delta = data.current - data.prior

  return (
    <div className="border-border/50 bg-background rounded-lg border px-3 py-2 text-xs shadow-xl min-w-[160px]">
      <p className="font-medium mb-1.5">{data.sector}</p>
      <div className="grid gap-1 text-muted-foreground">
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CURRENT_COLOR }} />
            {currentLabel}
          </span>
          <span className="tabular-nums font-medium text-foreground">{data.current.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PRIOR_COLOR }} />
            {priorLabel}
          </span>
          <span className="tabular-nums">{data.prior.toFixed(1)}%</span>
        </div>
        <div className="border-t pt-1 mt-0.5 flex justify-between gap-4">
          <span>Change</span>
          <span className={`tabular-nums font-medium ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}pp
          </span>
        </div>
      </div>
    </div>
  )
}

export function SectorComparisonChart({
  current,
  prior,
  currentLabel,
  priorLabel,
  title,
}: SectorComparisonChartProps) {
  if (current.length === 0 && prior.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="text-muted-foreground">No sector data available</p>
      </div>
    )
  }

  // Merge sectors from both periods
  const sectorSet = new Set<string>()
  const currentMap = new Map(current.map((d) => [d.sector, d]))
  const priorMap = new Map(prior.map((d) => [d.sector, d]))
  for (const d of current) sectorSet.add(d.sector)
  for (const d of prior) sectorSet.add(d.sector)

  // Build combined data sorted by current weight descending
  const chartData = Array.from(sectorSet)
    .map((sector) => {
      const c = currentMap.get(sector)
      const p = priorMap.get(sector)
      return {
        sector: sector.length > 22 ? sector.slice(0, 20) + '...' : sector,
        fullSector: sector,
        current: Math.round((c?.weight ?? 0) * 10000) / 100,
        prior: Math.round((p?.weight ?? 0) * 10000) / 100,
        currentValue: c?.value ?? 0,
        priorValue: p?.value ?? 0,
        delta: ((c?.weight ?? 0) - (p?.weight ?? 0)) * 100,
      }
    })
    .sort((a, b) => b.current - a.current)

  const barHeight = 36
  const chartHeight = Math.max(240, chartData.length * barHeight + 60)

  return (
    <div>
      {title && <h2 className="text-lg font-semibold mb-3">{title}</h2>}
      <ChartContainer config={chartConfig} className="w-full" style={{ height: chartHeight, aspectRatio: 'unset' }}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 20, bottom: 0, left: 10 }}
          barGap={2}
          barCategoryGap="20%"
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
            content={<ComparisonTooltip currentLabel={currentLabel} priorLabel={priorLabel} />}
          />
          <Legend
            formatter={(value: string) => (
              <span className="text-xs">{value === 'current' ? currentLabel : priorLabel}</span>
            )}
          />
          <Bar dataKey="prior" fill={PRIOR_COLOR} radius={[0, 3, 3, 0]} maxBarSize={14} name="prior" />
          <Bar dataKey="current" fill={CURRENT_COLOR} radius={[0, 3, 3, 0]} maxBarSize={14} name="current" />
        </BarChart>
      </ChartContainer>
      {/* Delta summary */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {chartData
          .filter((d) => Math.abs(d.delta) >= 0.5)
          .slice(0, 8)
          .map((d) => (
            <span key={d.fullSector} className="inline-flex items-center gap-1">
              <span className="text-muted-foreground">{d.fullSector}:</span>
              <span className={`font-medium tabular-nums ${d.delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {d.delta >= 0 ? '+' : ''}{d.delta.toFixed(1)}pp
              </span>
            </span>
          ))}
      </div>
    </div>
  )
}
