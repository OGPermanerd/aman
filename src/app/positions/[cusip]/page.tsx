import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPositionDetail, getGlobalQuarters } from '@/lib/data'
import { groupToSlug } from '@/lib/slugs'
import { QuarterDisplay } from '@/app/_components/quarter-display'
import { StatCard } from '@/app/_components/stat-card'
import { ChangeBadge } from '@/app/_components/change-badge'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatShares, formatPercent, formatNumber } from '@/lib/formatters'

interface PositionDetailPageProps {
  params: Promise<{ cusip: string }>
  searchParams: Promise<{ quarter?: string }>
}

export default async function PositionDetailPage({ params, searchParams }: PositionDetailPageProps) {
  const { cusip } = await params
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

  const detail = getPositionDetail(cusip, quarter)
  if (!detail) notFound()

  const totalValueAcrossFunds = detail.holders.reduce((sum, h) => sum + h.value, 0)

  // Count distinct strategy groups among holders
  const distinctGroups = new Set(detail.holders.map((h) => h.strategyGroup))

  // Total number of strategy groups (for "X of Y" display)
  const allGroups = new Set<string>()
  // We use the slugs module to get all groups
  const { getAllGroups } = await import('@/lib/slugs')
  for (const g of getAllGroups()) {
    allGroups.add(g)
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/groups?quarter=${quarter}`} className="hover:underline">
          Groups
        </Link>
        <span>/</span>
        <span className="text-foreground">Position Detail</span>
      </div>

      {/* Security Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            {detail.ticker ? (
              <>
                <h1 className="text-3xl font-bold tracking-tight">{detail.ticker}</h1>
                <span className="text-lg text-muted-foreground">{detail.name ?? detail.cusip}</span>
              </>
            ) : (
              <h1 className="text-3xl font-bold tracking-tight">{detail.name ?? detail.cusip}</h1>
            )}
            {detail.sector && (
              <Badge variant="secondary" className="text-xs">
                {detail.sector}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">CUSIP: {detail.cusip}</p>
        </div>
        <QuarterDisplay quarter={quarter} />
      </div>

      {/* Ownership Summary Stat Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard
          label="Held by"
          value={`${detail.totalFundCount} fund${detail.totalFundCount !== 1 ? 's' : ''}`}
          subtitle="across tracked funds"
        />
        <StatCard
          label="Total Value"
          value={formatCurrency(totalValueAcrossFunds)}
          subtitle="combined across all holders"
        />
        <StatCard
          label="Strategy Groups"
          value={`${distinctGroups.size} of ${allGroups.size}`}
          subtitle="groups hold this position"
        />
      </div>

      {/* Fund Holders Table */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Fund Holders</h2>
        {detail.holders.length === 0 ? (
          <div className="rounded-lg border p-8 text-center">
            <p className="text-muted-foreground">No funds hold this position in {quarter}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px]">Fund Name</TableHead>
                <TableHead>Strategy Group</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Shares</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead className="text-center">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.holders.map((holder) => {
                const groupSlug = groupToSlug(holder.strategyGroup)
                return (
                  <TableRow key={holder.fundCik}>
                    <TableCell>
                      <Link
                        href={`/groups/${groupSlug}/funds/${holder.fundCik}?quarter=${quarter}`}
                        className="font-medium hover:underline"
                      >
                        {holder.fundName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">
                        {holder.strategyGroup}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(holder.value)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatShares(holder.shares)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(holder.weight)}
                    </TableCell>
                    <TableCell className="text-center">
                      <ChangeBadge changeType={holder.changeType} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
