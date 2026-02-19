import Link from 'next/link'
import { getDataCompleteness } from '@/lib/data'
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
import { formatNumber, formatPercent, formatQuarterLabel } from '@/lib/formatters'

export default function StatusPage() {
  const data = getDataCompleteness()

  const tickerCoverageRatio = data.uniqueCusips > 0
    ? data.cusipsResolved / data.uniqueCusips
    : 0

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Link href="/groups" className="text-sm text-muted-foreground hover:underline">&larr; Back to groups</Link>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Data Completeness</h1>
        <p className="text-muted-foreground">Overview of ingestion coverage and ticker resolution status</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs font-medium text-muted-foreground">Total Funds</p>
            <p className="text-2xl font-bold tabular-nums">{data.totalFunds}</p>
            <p className="text-xs text-muted-foreground">{data.fundsWithData} with holdings data</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs font-medium text-muted-foreground">Total Holdings</p>
            <p className="text-2xl font-bold tabular-nums">{formatNumber(data.totalHoldings)}</p>
            <p className="text-xs text-muted-foreground">across {data.quarterCoverage.length} quarters</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs font-medium text-muted-foreground">Unique CUSIPs</p>
            <p className="text-2xl font-bold tabular-nums">{formatNumber(data.uniqueCusips)}</p>
            <p className="text-xs text-muted-foreground">distinct securities</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs font-medium text-muted-foreground">Ticker Coverage</p>
            <p className={`text-2xl font-bold tabular-nums ${tickerCoverageRatio >= 0.9 ? 'text-green-600' : tickerCoverageRatio >= 0.7 ? 'text-yellow-600' : 'text-red-600'}`}>
              {formatPercent(tickerCoverageRatio, 1)}
            </p>
            <p className="text-xs text-muted-foreground">{formatNumber(data.cusipsResolved)} resolved</p>
          </CardContent>
        </Card>
      </div>

      {/* CUSIP Resolution breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">CUSIP Resolution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-3 flex-1 rounded-full bg-muted overflow-hidden flex">
                {data.uniqueCusips > 0 && (
                  <>
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${(data.cusipsResolved / data.uniqueCusips) * 100}%` }}
                    />
                    <div
                      className="h-full bg-yellow-500"
                      style={{ width: `${(data.cusipsUnmapped / data.uniqueCusips) * 100}%` }}
                    />
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <div>
                  <p className="font-medium">{formatNumber(data.cusipsResolved)} Resolved</p>
                  <p className="text-xs text-muted-foreground">Ticker mapped successfully</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <div>
                  <p className="font-medium">{formatNumber(data.cusipsUnmapped)} Unmapped</p>
                  <p className="text-xs text-muted-foreground">Looked up, no match found</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-muted" />
                <div>
                  <p className="font-medium">{formatNumber(data.cusipsPending)} Pending</p>
                  <p className="text-xs text-muted-foreground">Not yet looked up</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quarter Coverage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quarter Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quarter</TableHead>
                <TableHead className="text-right">Holdings</TableHead>
                <TableHead className="text-right">Funds</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.quarterCoverage.map((q) => (
                <TableRow key={q.quarter}>
                  <TableCell className="font-medium">{formatQuarterLabel(q.quarter)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(q.holdingCount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{q.fundCount} / {data.totalFunds}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Fund Coverage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fund Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fund</TableHead>
                <TableHead>Strategy Group</TableHead>
                <TableHead className="text-right">Quarters</TableHead>
                <TableHead>Latest Quarter</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.fundCoverage.map((fund) => (
                <TableRow key={fund.cik}>
                  <TableCell className="font-medium max-w-[250px] truncate" title={fund.name}>
                    {fund.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{fund.strategyGroup}</TableCell>
                  <TableCell className="text-right tabular-nums">{fund.quarters}</TableCell>
                  <TableCell>
                    {fund.latestQuarter ? formatQuarterLabel(fund.latestQuarter) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {fund.quarters === 0 ? (
                      <Badge variant="destructive">No data</Badge>
                    ) : fund.quarters < data.quarterCoverage.length ? (
                      <Badge variant="secondary">Partial</Badge>
                    ) : (
                      <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400">Complete</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
