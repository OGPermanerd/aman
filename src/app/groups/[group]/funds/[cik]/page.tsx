import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getFundDetail, getSectorBreakdown, getGlobalQuarters } from '@/lib/data'
import { slugToGroup, groupToSlug } from '@/lib/slugs'
import { QuarterDisplay } from '@/app/_components/quarter-display'
import { StatCard } from '@/app/_components/stat-card'
import { ChangeBadge } from '@/app/_components/change-badge'
import { HoldingsTable, type HoldingRow } from '@/app/_components/holdings-table'
import { SectorChart } from '@/app/_components/sector-chart'
import { formatCurrency, formatNumber } from '@/lib/formatters'

interface FundDetailPageProps {
  params: Promise<{ group: string; cik: string }>
  searchParams: Promise<{ quarter?: string }>
}

export default async function FundDetailPage({ params, searchParams }: FundDetailPageProps) {
  const { group: slug, cik } = await params
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

  const detail = getFundDetail(cik, quarter)
  if (!detail) notFound()

  const sectorData = getSectorBreakdown(cik, quarter)

  // Prepare serializable holdings data for client component
  const holdingRows: HoldingRow[] = detail.positions.map((pos) => ({
    cusip: pos.cusip,
    ticker: pos.ticker,
    nameOfIssuer: pos.nameOfIssuer,
    value: pos.value,
    shares: pos.shares,
    weight: pos.weight,
    changeType: pos.changeType,
    valueDelta: pos.valueDelta,
    sharesDelta: pos.sharesDelta,
    weightDelta: pos.weightDelta,
    convictionLevel: pos.convictionLevel,
  }))

  const totalValue = detail.positions.reduce((sum, p) => sum + p.value, 0)
  const holdingCount = detail.positions.filter((p) => p.value > 0).length

  const { qoqSummary } = detail
  const changeParts: Array<{ count: number; label: string; type: string }> = [
    { count: qoqSummary.new, label: 'new', type: 'new' },
    { count: qoqSummary.exited, label: 'exited', type: 'exited' },
    { count: qoqSummary.increased, label: 'increased', type: 'increased' },
    { count: qoqSummary.decreased, label: 'decreased', type: 'decreased' },
    { count: qoqSummary.unchanged, label: 'unchanged', type: 'unchanged' },
  ]

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/groups?quarter=${quarter}`} className="hover:underline">
          Groups
        </Link>
        <span>/</span>
        <Link href={`/groups/${slug}?quarter=${quarter}`} className="hover:underline">
          {strategyGroup}
        </Link>
        <span>/</span>
        <span className="text-foreground">{detail.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{detail.name}</h1>
        <QuarterDisplay quarter={quarter} />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Value" value={formatCurrency(totalValue)} />
        <StatCard label="Holdings" value={formatNumber(holdingCount)} />
        <StatCard
          label="New Positions"
          value={formatNumber(qoqSummary.new)}
          subtitle={qoqSummary.new > 0 ? 'added this quarter' : undefined}
        />
        <StatCard
          label="Exited Positions"
          value={formatNumber(qoqSummary.exited)}
          subtitle={qoqSummary.exited > 0 ? 'removed this quarter' : undefined}
        />
      </div>

      {/* QoQ Change Summary */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium text-muted-foreground">QoQ Changes:</span>
        {changeParts.map((part) => (
          <span key={part.type} className="inline-flex items-center gap-1">
            <span className="tabular-nums">{part.count}</span>
            <span className="text-muted-foreground">{part.label}</span>
          </span>
        ))}
      </div>

      {/* Holdings Table */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Holdings</h2>
        <HoldingsTable holdings={holdingRows} quarter={quarter} />
      </div>

      {/* Sector Allocation */}
      <SectorChart data={sectorData} title="Sector Allocation" />
    </div>
  )
}
