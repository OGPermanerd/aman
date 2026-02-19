import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getGroupDetail, getGroupSectorBreakdown, getGlobalQuarters } from '@/lib/data'
import { slugToGroup } from '@/lib/slugs'
import { QuarterDisplay } from '@/app/_components/quarter-display'
import { ChangeBadge } from '@/app/_components/change-badge'
import { SectorChart } from '@/app/_components/sector-chart'
import { formatCurrency, formatNumber } from '@/lib/formatters'
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
  searchParams: Promise<{ quarter?: string }>
}

export default async function GroupDetailPage({ params, searchParams }: GroupDetailPageProps) {
  const { group: slug } = await params
  const { quarter: qParam } = await searchParams

  const strategyGroup = slugToGroup(slug)
  if (!strategyGroup) notFound()

  const quarters = getGlobalQuarters()
  const quarter = qParam ?? quarters[0] ?? ''

  if (!quarter) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No data available.</p>
      </div>
    )
  }

  const detail = getGroupDetail(strategyGroup, quarter)
  const groupSectorData = getGroupSectorBreakdown(strategyGroup, quarter)

  // Sort: funds with data first (by portfolio value desc), then funds without data (alphabetically)
  const sortedFunds = [...detail.funds].sort((a, b) => {
    if (a.hasData && !b.hasData) return -1
    if (!a.hasData && b.hasData) return 1
    if (a.hasData && b.hasData) return b.portfolioValue - a.portfolioValue
    return a.name.localeCompare(b.name)
  })

  const fundsWithData = detail.funds.filter((f) => f.hasData).length
  const aggregateValue = detail.funds.reduce((sum, f) => sum + f.portfolioValue, 0)

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

      <div className="flex gap-6 text-sm">
        <div>
          <span className="text-muted-foreground">Total Funds: </span>
          <span className="font-semibold">{detail.funds.length}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Reporting: </span>
          <span className="font-semibold">{fundsWithData}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Aggregate Value: </span>
          <span className="font-semibold">{formatCurrency(aggregateValue)}</span>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Fund Name</TableHead>
            <TableHead className="text-right">Portfolio Value</TableHead>
            <TableHead className="text-right">Holdings</TableHead>
            <TableHead className="text-center">New</TableHead>
            <TableHead className="text-center">Exit</TableHead>
            <TableHead className="text-center">Add</TableHead>
            <TableHead className="text-center">Trim</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedFunds.map((fund) => (
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
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(fund.portfolioValue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(fund.holdingCount)}
                  </TableCell>
                  <TableCell className="text-center">
                    {fund.qoqSummary.new > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="tabular-nums">{fund.qoqSummary.new}</span>
                        <ChangeBadge changeType="new" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {fund.qoqSummary.exited > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="tabular-nums">{fund.qoqSummary.exited}</span>
                        <ChangeBadge changeType="exited" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {fund.qoqSummary.increased > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="tabular-nums">{fund.qoqSummary.increased}</span>
                        <ChangeBadge changeType="increased" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {fund.qoqSummary.decreased > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="tabular-nums">{fund.qoqSummary.decreased}</span>
                        <ChangeBadge changeType="decreased" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                </>
              ) : (
                <TableCell colSpan={6} className="text-center text-muted-foreground italic">
                  No data for this quarter
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Group Sector Allocation */}
      <SectorChart data={groupSectorData} title="Group Sector Allocation" />
    </div>
  )
}
