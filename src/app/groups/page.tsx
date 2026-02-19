import Link from 'next/link'
import { getGroupOverview, getGlobalQuarters, getDataCompleteness } from '@/lib/data'
import { previousQuarter } from '@/analytics/quarter-utils'
import { getAllGroups } from '@/lib/slugs'
import { QuarterDisplay } from '@/app/_components/quarter-display'
import { AddFundModal } from '@/app/_components/add-fund-modal'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { formatCurrency, formatNumber, formatPercent, formatQuarterLabel } from '@/lib/formatters'

interface GroupsPageProps {
  searchParams: Promise<{ quarter?: string; hideEmpty?: string }>
}

function DeltaBadge({ current, prior }: { current: number; prior: number }) {
  if (prior === 0) return null
  const pct = (current - prior) / prior
  const isPositive = pct >= 0
  return (
    <span className={`text-xs font-medium tabular-nums ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
      {isPositive ? '+' : ''}{formatPercent(pct, 1)}
    </span>
  )
}

export default async function GroupsPage({ searchParams }: GroupsPageProps) {
  const { quarter: qParam, hideEmpty: hideEmptyParam } = await searchParams
  const quarters = getGlobalQuarters()
  const quarter = qParam ?? quarters[0] ?? ''
  const hideEmpty = hideEmptyParam !== 'false'

  if (!quarter) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No data available. Run the ingestion pipeline first.</p>
      </div>
    )
  }

  const completeness = getDataCompleteness()

  // Get prior quarter for comparison
  let prevQ: string | null = null
  try {
    prevQ = previousQuarter(quarter)
  } catch {
    // No prior quarter available
  }

  // When hideEmpty, only include funds with data in BOTH quarters
  const groups = getGroupOverview(quarter, hideEmpty && prevQ ? prevQ : undefined)

  let priorGroups: typeof groups = []
  if (prevQ) {
    priorGroups = getGroupOverview(prevQ, hideEmpty ? quarter : undefined)
  }
  const priorMap = new Map(priorGroups.map((g) => [g.slug, g]))

  const tickerCoverageRatio = completeness.uniqueCusips > 0
    ? completeness.cusipsResolved / completeness.uniqueCusips
    : 0
  const cusipsProcessed = completeness.cusipsResolved + completeness.cusipsUnmapped
  const processedRatio = completeness.uniqueCusips > 0
    ? cusipsProcessed / completeness.uniqueCusips
    : 0

  // Derive funds reporting from filtered groups (respects hideEmpty)
  const fundsReporting = groups.reduce((sum, g) => sum + g.fundsWithData, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Strategy Groups</h1>
          <p className="text-muted-foreground">Browse hedge fund portfolios by investment strategy</p>
        </div>
        <QuarterDisplay quarter={quarter} />
      </div>

      {/* Data completeness stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs font-medium text-muted-foreground">Funds Reporting</p>
            <p className="text-2xl font-bold tabular-nums">{fundsReporting} <span className="text-sm font-normal text-muted-foreground">/ {completeness.totalFunds}</span></p>
            <p className="text-xs text-muted-foreground">
              {hideEmpty && prevQ ? 'in both quarters' : `for ${formatQuarterLabel(quarter)}`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs font-medium text-muted-foreground">Holdings</p>
            <p className="text-2xl font-bold tabular-nums">{formatNumber(completeness.totalHoldings)}</p>
            <p className="text-xs text-muted-foreground">across all quarters</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs font-medium text-muted-foreground">Ticker Coverage</p>
            <p className={`text-2xl font-bold tabular-nums ${tickerCoverageRatio >= 0.9 ? 'text-green-600' : tickerCoverageRatio >= 0.7 ? 'text-yellow-600' : 'text-red-600'}`}>
              {formatPercent(tickerCoverageRatio, 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatNumber(completeness.cusipsResolved)} resolved
              {completeness.cusipsUnmapped > 0 && ` · ${formatNumber(completeness.cusipsUnmapped)} no match`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs font-medium text-muted-foreground">Quarters</p>
            <p className="text-2xl font-bold tabular-nums">{completeness.quarterCoverage.length}</p>
            <p className="text-xs text-muted-foreground">
              <Link href="/status" className="hover:underline">View details &rarr;</Link>
            </p>
          </CardContent>
        </Card>
      </div>

      {completeness.cusipsPending > 0 && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-2.5 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
          Ticker resolution in progress. {formatNumber(completeness.cusipsPending)} CUSIPs pending.
          Run <code className="rounded bg-yellow-100 px-1 py-0.5 text-xs dark:bg-yellow-900">pnpm ingest --all</code> to complete.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.filter((g) => !hideEmpty || g.fundsWithData > 0).map((group) => {
          const prior = priorMap.get(group.slug)
          return (
            <Link
              key={group.slug}
              href={`/groups/${group.slug}?quarter=${quarter}`}
              className="block transition-shadow hover:shadow-md rounded-xl"
            >
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-lg">{group.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {group.fundsWithData} of {group.fundCount} funds reporting
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {group.fundsWithData > 0 ? (
                    <>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Aggregate Value</p>
                        <div className="flex items-baseline gap-2">
                          <p className="text-2xl font-bold tabular-nums">{formatCurrency(group.aggregateValue)}</p>
                          {prior && prior.aggregateValue > 0 && (
                            <DeltaBadge current={group.aggregateValue} prior={prior.aggregateValue} />
                          )}
                        </div>
                        {prior && prior.aggregateValue > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Prior: {formatCurrency(prior.aggregateValue)}
                          </p>
                        )}
                      </div>
                      {group.topHoldings.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Top Consensus Holdings</p>
                          <ul className="space-y-0.5">
                            {group.topHoldings.map((h) => (
                              <li key={h.cusip} className="text-sm">
                                <span className="font-medium">{h.ticker ?? h.nameOfIssuer}</span>
                                <span className="text-muted-foreground">
                                  {' '}({h.fundCount} of {group.fundsWithData} funds)
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No data for this quarter</p>
                  )}
                </CardContent>
                <CardFooter>
                  <span className="text-sm text-muted-foreground">View funds &rarr;</span>
                </CardFooter>
              </Card>
            </Link>
          )
        })}
        <AddFundModal existingGroups={getAllGroups()} />
      </div>
    </div>
  )
}
