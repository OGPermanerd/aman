import Link from 'next/link'
import { getRealEstateData, getGlobalQuarters } from '@/lib/data'
import { QuarterDisplay } from '@/app/_components/quarter-display'
import { StatCard } from '@/app/_components/stat-card'
import { ChangeBadge } from '@/app/_components/change-badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatPercent, formatQuarterLabel } from '@/lib/formatters'
import { ActivityTabs } from './activity-tabs'

interface RealEstatePageProps {
  searchParams: Promise<{ quarter?: string }>
}

// Human-readable label for a 4-digit SIC code
function sicLabel(sic: string | null): string {
  if (!sic) return 'Unknown'
  const labels: Record<string, string> = {
    '6798': 'REIT',
    '6500': 'Real Estate',
    '6510': 'RE Operator',
    '6512': 'RE Operator',
    '6519': 'Lessor',
    '6531': 'RE Services',
    '6552': 'Developer',
  }
  return labels[sic] ?? sic
}

export default async function RealEstatePage({ searchParams }: RealEstatePageProps) {
  const { quarter: qParam } = await searchParams

  const quarters = getGlobalQuarters()
  const quarter = qParam ?? quarters[0] ?? ''

  if (!quarter) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No data available.</p>
      </div>
    )
  }

  const data = getRealEstateData(quarter)

  const valueDelta = data.totalValue - data.prevTotalValue
  const valueDeltaPct = data.prevTotalValue > 0 ? valueDelta / data.prevTotalValue : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Real Estate Holdings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cross-fund real estate exposure
            {data.prevQuarter && (
              <> · vs {formatQuarterLabel(data.prevQuarter)}</>
            )}
          </p>
        </div>
        <QuarterDisplay quarter={quarter} />
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Total RE AUM"
          value={formatCurrency(data.totalValue)}
          subtitle={
            valueDeltaPct !== null
              ? `${valueDelta >= 0 ? '+' : ''}${formatPercent(valueDeltaPct, 1)} vs prior quarter`
              : undefined
          }
        />
        <StatCard
          label="Funds with Exposure"
          value={String(data.fundsWithExposure)}
          subtitle="holding ≥1 real estate position"
        />
        <StatCard
          label="Companies"
          value={String(data.securities.length)}
          subtitle="unique real estate securities"
        />
        <StatCard
          label="Quarter Activity"
          value={String(
            data.activityCounts.new +
              data.activityCounts.exited +
              data.activityCounts.increased +
              data.activityCounts.decreased,
          )}
          subtitle={`${data.activityCounts.new} new · ${data.activityCounts.exited} exits`}
        />
      </div>

      {/* Activity feed */}
      {data.activityItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Quarter Activity
              {data.prevQuarter && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  vs {formatQuarterLabel(data.prevQuarter)}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ActivityTabs
              items={data.activityItems}
              quarter={quarter}
              counts={data.activityCounts}
            />
          </CardContent>
        </Card>
      )}

      {/* All holdings table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            All Holdings
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {data.securities.length} companies · sorted by total value
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.securities.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground text-sm">
                No real estate holdings found for {quarter}.
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                CUSIP resolution may be incomplete — run the ingest to populate security data.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Ticker</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead className="text-right w-[60px]">Funds</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead className="text-right">QoQ Δ</TableHead>
                  <TableHead className="text-right w-[80px]">QoQ %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.securities.map((sec) => {
                  const pct =
                    sec.prevTotalValue > 0
                      ? sec.totalValueDelta / sec.prevTotalValue
                      : null
                  const isNew = sec.prevTotalValue === 0 && sec.totalValue > 0
                  const isExited = sec.totalValue === 0 && sec.prevTotalValue > 0

                  return (
                    <TableRow key={sec.cusip} className={isExited ? 'opacity-50' : ''}>
                      <TableCell className="font-mono font-semibold text-sm">
                        {sec.ticker ? (
                          <Link
                            href={`/positions/${sec.cusip}?quarter=${quarter}`}
                            className="hover:underline"
                          >
                            {sec.ticker}
                          </Link>
                        ) : (
                          <Link
                            href={`/positions/${sec.cusip}?quarter=${quarter}`}
                            className="hover:underline text-muted-foreground text-xs"
                          >
                            {sec.cusip}
                          </Link>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{sec.nameOfIssuer}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-normal">
                          {sicLabel(sec.sic)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {sec.fundCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        {sec.totalValue > 0 ? formatCurrency(sec.totalValue) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {isNew ? (
                          <span className="text-emerald-600 font-medium text-xs">NEW</span>
                        ) : isExited ? (
                          <span className="text-red-600 font-medium text-xs">EXITED</span>
                        ) : sec.totalValueDelta !== 0 ? (
                          <span
                            className={
                              sec.totalValueDelta > 0 ? 'text-green-600' : 'text-red-600'
                            }
                          >
                            {sec.totalValueDelta > 0 ? '+' : ''}
                            {formatCurrency(sec.totalValueDelta)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {pct !== null && !isNew && !isExited ? (
                          <span
                            className={pct >= 0 ? 'text-green-600' : 'text-red-600'}
                          >
                            {pct >= 0 ? '+' : ''}
                            {formatPercent(pct, 1)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
