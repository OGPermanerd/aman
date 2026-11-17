import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getGroupDetail, getGroupSectorBreakdown, getGlobalQuarters, getGroupQoQFlowData, getGroupActivity } from '@/lib/data'
import { slugToGroup } from '@/lib/slugs'
import { previousQuarter } from '@/analytics/quarter-utils'
import { QuarterDisplay } from '@/app/_components/quarter-display'
import { SectorComparisonChart } from '@/app/_components/sector-comparison-chart'
import { QoQSankey } from '@/app/charts/qoq-sankey'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatCurrency, formatNumber, formatPercent, formatQuarterLabel } from '@/lib/formatters'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface GroupDetailPageProps {
  params: Promise<{ group: string }>
  searchParams: Promise<{ quarter?: string; hideEmpty?: string }>
}

export default async function GroupDetailPage({ params, searchParams }: GroupDetailPageProps) {
  const { group: slug } = await params
  const { quarter: qParam, hideEmpty: hideEmptyParam } = await searchParams

  const strategyGroup = slugToGroup(slug)
  if (!strategyGroup) notFound()

  const quarters = getGlobalQuarters()
  const quarter = qParam ?? quarters[0] ?? ''
  const hideEmpty = hideEmptyParam !== 'false'

  if (!quarter) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No data available.</p>
      </div>
    )
  }

  const detail = getGroupDetail(strategyGroup, quarter)

  // Get prior quarter data for comparison
  let prevQ: string | null = null
  let priorDetail: typeof detail | null = null
  try {
    prevQ = previousQuarter(quarter)
    priorDetail = getGroupDetail(strategyGroup, prevQ)
  } catch {
    // No prior quarter
  }
  const priorFundMap = new Map(
    priorDetail?.funds.map((f) => [f.cik, f]) ?? [],
  )

  // Sort: funds with data first (by portfolio value desc), then funds without data (alphabetically)
  const allFunds = [...detail.funds].sort((a, b) => {
    if (a.hasData && !b.hasData) return -1
    if (!a.hasData && b.hasData) return 1
    if (a.hasData && b.hasData) return b.portfolioValue - a.portfolioValue
    return a.name.localeCompare(b.name)
  })

  // Always show all funds in the table so late/non-filers are visible
  const displayFunds = allFunds

  // CIK filter for charts: matched set = funds with data in BOTH quarters (for comparable QoQ charts)
  const matchedCiks = hideEmpty
    ? allFunds
        .filter((f) => f.hasData && (priorFundMap.get(f.cik)?.hasData ?? false))
        .map((f) => f.cik)
    : undefined

  const groupActivity = getGroupActivity(strategyGroup, quarter)
  const groupSectorData = getGroupSectorBreakdown(strategyGroup, quarter, matchedCiks)
  const priorSectorData = prevQ
    ? getGroupSectorBreakdown(strategyGroup, prevQ, matchedCiks)
    : []
  const groupFlow = getGroupQoQFlowData(strategyGroup, quarter, matchedCiks)

  // Compute aggregates from the displayed (possibly filtered) funds
  const fundsWithData = displayFunds.filter((f) => f.hasData).length
  const aggregateValue = displayFunds.reduce((sum, f) => sum + f.portfolioValue, 0)
  const priorAggregateValue = priorDetail
    ? displayFunds.reduce((sum, f) => sum + (priorFundMap.get(f.cik)?.portfolioValue ?? 0), 0)
    : 0
  const aggDelta = priorAggregateValue > 0 ? (aggregateValue - priorAggregateValue) / priorAggregateValue : 0

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href={`/groups?quarter=${quarter}`} className="hover:underline">
            Groups
          </Link>
          <span>/</span>
          <span>{detail.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">{detail.name}</h1>
          <QuarterDisplay quarter={quarter} />
        </div>
      </div>

      <div className="flex flex-wrap gap-6 text-sm">
        <div>
          <span className="text-muted-foreground">Total Funds: </span>
          <span className="font-semibold">{detail.funds.length}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Reporting: </span>
          <span className="font-semibold">{fundsWithData}</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-muted-foreground">Aggregate Value: </span>
          <span className="font-semibold">{formatCurrency(aggregateValue)}</span>
          {priorAggregateValue > 0 && (
            <>
              <span className={`text-xs font-medium tabular-nums ${aggDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {aggDelta >= 0 ? '+' : ''}{formatPercent(aggDelta, 1)}
              </span>
              <span className="text-xs text-muted-foreground">
                (prior: {formatCurrency(priorAggregateValue)})
              </span>
            </>
          )}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Fund Name</TableHead>
            <TableHead className="text-right">Portfolio Value</TableHead>
            <TableHead className="text-right">QoQ %</TableHead>
            <TableHead className="text-right">Holdings</TableHead>
            <TableHead className="text-center">New</TableHead>
            <TableHead className="text-center">Exit</TableHead>
            <TableHead className="text-center">Add</TableHead>
            <TableHead className="text-center">Trim</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayFunds.map((fund) => {
            const prior = priorFundMap.get(fund.cik)
            const priorValue = prior?.portfolioValue ?? 0
            const valueDelta = priorValue > 0 ? (fund.portfolioValue - priorValue) / priorValue : 0
            return (
              <TableRow key={fund.cik}>
                <TableCell>
                  {fund.hasData ? (
                    <Link
                      href={`/groups/${slug}/funds/${fund.cik}?quarter=${quarter}`}
                      className="font-medium hover:underline"
                    >
                      {fund.name}
                    </Link>
                  ) : (
                    <span className="font-medium text-muted-foreground">{fund.name}</span>
                  )}
                </TableCell>
                {fund.hasData ? (
                  <>
                    <TableCell className="text-right">
                      <div className="tabular-nums">{formatCurrency(fund.portfolioValue)}</div>
                      {priorValue > 0 && (
                        <div className="text-xs text-muted-foreground tabular-nums">{formatCurrency(priorValue)}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {priorValue > 0 ? (
                        <span className={`text-sm font-medium tabular-nums ${valueDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {valueDelta >= 0 ? '+' : ''}{formatPercent(valueDelta, 1)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(fund.holdingCount)}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      <span className={fund.qoqSummary.new > 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>{fund.qoqSummary.new}</span>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      <span className={fund.qoqSummary.exited > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>{fund.qoqSummary.exited}</span>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      <span className={fund.qoqSummary.increased > 0 ? 'text-blue-600 font-medium' : 'text-muted-foreground'}>{fund.qoqSummary.increased}</span>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      <span className={fund.qoqSummary.decreased > 0 ? 'text-orange-600 font-medium' : 'text-muted-foreground'}>{fund.qoqSummary.decreased}</span>
                    </TableCell>
                  </>
                ) : (
                  <TableCell colSpan={7} className="text-center text-muted-foreground italic">
                    No data for this quarter
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {/* Biggest Adds & Trims */}
      {(groupActivity.topAdds.length > 0 || groupActivity.topTrims.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Biggest Adds</CardTitle>
              <p className="text-sm text-muted-foreground">Weighted by fund size</p>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Security</TableHead>
                    <TableHead className="text-right">Net Added</TableHead>
                    <TableHead className="text-right">Funds</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupActivity.topAdds.map((entry) => (
                    <TableRow key={entry.cusip}>
                      <TableCell>
                        <Link href={`/positions/${entry.cusip}?quarter=${quarter}`} className="hover:underline font-medium">
                          {entry.ticker ?? entry.nameOfIssuer}
                        </Link>
                        {entry.ticker && (
                          <p className="text-xs text-muted-foreground">{entry.nameOfIssuer}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-green-600 font-medium">
                        +{formatCurrency(entry.netValueDelta)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {entry.fundCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Biggest Trims & Exits</CardTitle>
              <p className="text-sm text-muted-foreground">Weighted by fund size</p>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Security</TableHead>
                    <TableHead className="text-right">Net Reduced</TableHead>
                    <TableHead className="text-right">Funds</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupActivity.topTrims.map((entry) => (
                    <TableRow key={entry.cusip}>
                      <TableCell>
                        <Link href={`/positions/${entry.cusip}?quarter=${quarter}`} className="hover:underline font-medium">
                          {entry.ticker ?? entry.nameOfIssuer}
                        </Link>
                        {entry.ticker && (
                          <p className="text-xs text-muted-foreground">{entry.nameOfIssuer}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-red-600 font-medium">
                        {formatCurrency(entry.netValueDelta)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {entry.fundCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Group Capital Flow Sankey */}
      {groupFlow && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Capital Flow</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <QoQSankey flow={{
              previousTotal: groupFlow.previousTotal,
              currentTotal: groupFlow.currentTotal,
              newValue: groupFlow.newValue,
              exitedValue: groupFlow.exitedValue,
              increasedFrom: groupFlow.increasedFrom,
              increasedTo: groupFlow.increasedTo,
              decreasedFrom: groupFlow.decreasedFrom,
              decreasedTo: groupFlow.decreasedTo,
              unchangedValue: groupFlow.unchangedValue,
            }} />
          </CardContent>
        </Card>
      )}

      {/* Sector Allocation Comparison */}
      <SectorComparisonChart
        current={groupSectorData}
        prior={priorSectorData}
        currentLabel={formatQuarterLabel(quarter)}
        priorLabel={prevQ ? formatQuarterLabel(prevQ) : 'Prior'}
        title="Sector Allocation"
      />
    </div>
  )
}
