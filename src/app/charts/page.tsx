import { getQoQFlowData, getGlobalQuarters } from '@/lib/data'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatQuarterLabel, formatPercent, formatNumber } from '@/lib/formatters'
import { QoQSankey } from './qoq-sankey'

interface ChartsPageProps {
  searchParams: Promise<{ quarter?: string }>
}

export default async function ChartsPage({ searchParams }: ChartsPageProps) {
  const { quarter: qParam } = await searchParams
  const quarters = getGlobalQuarters()
  const quarter = qParam ?? quarters[0] ?? ''

  if (!quarter) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No data available. Run the ingestion pipeline first.</p>
      </div>
    )
  }

  const flow = getQoQFlowData(quarter)

  if (!flow) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No quarter-over-quarter data available for {formatQuarterLabel(quarter)}.</p>
      </div>
    )
  }

  const netChange = flow.currentTotal - flow.previousTotal
  const netChangePct = flow.previousTotal > 0 ? netChange / flow.previousTotal : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Portfolio Flows</h1>
        <p className="text-muted-foreground">
          Quarter-over-quarter capital movement: {formatQuarterLabel(flow.previousQuarter)} &rarr; {formatQuarterLabel(flow.currentQuarter)}
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs font-medium text-muted-foreground">Prior Quarter</p>
            <p className="text-xl font-bold tabular-nums">{formatCurrency(flow.previousTotal)}</p>
            <p className="text-xs text-muted-foreground">{formatQuarterLabel(flow.previousQuarter)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs font-medium text-muted-foreground">Current Quarter</p>
            <p className="text-xl font-bold tabular-nums">{formatCurrency(flow.currentTotal)}</p>
            <p className="text-xs text-muted-foreground">{formatQuarterLabel(flow.currentQuarter)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs font-medium text-muted-foreground">Net Change</p>
            <p className={`text-xl font-bold tabular-nums ${netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {netChange >= 0 ? '+' : ''}{formatCurrency(netChange)}
            </p>
            <p className={`text-xs ${netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {netChange >= 0 ? '+' : ''}{formatPercent(netChangePct, 1)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs font-medium text-green-600">New Positions</p>
            <p className="text-xl font-bold tabular-nums text-green-600">+{formatCurrency(flow.newValue)}</p>
            <p className="text-xs text-muted-foreground">capital deployed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs font-medium text-red-600">Exited</p>
            <p className="text-xl font-bold tabular-nums text-red-600">-{formatCurrency(flow.exitedValue)}</p>
            <p className="text-xs text-muted-foreground">capital withdrawn</p>
          </CardContent>
        </Card>
      </div>

      {/* Sankey chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Capital Flow</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <QoQSankey flow={{
            previousTotal: flow.previousTotal,
            currentTotal: flow.currentTotal,
            newValue: flow.newValue,
            exitedValue: flow.exitedValue,
            increasedFrom: flow.increasedFrom,
            increasedTo: flow.increasedTo,
            decreasedFrom: flow.decreasedFrom,
            decreasedTo: flow.decreasedTo,
            unchangedValue: flow.unchangedValue,
          }} />
        </CardContent>
      </Card>

      {/* Flow breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Flow Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <FlowRow
              label="Unchanged"
              color="bg-gray-400"
              priorValue={flow.unchangedValue}
              currentValue={flow.unchangedValue}
              description="Positions held with same share count"
            />
            <FlowRow
              label="Increased"
              color="bg-blue-500"
              priorValue={flow.increasedFrom}
              currentValue={flow.increasedTo}
              description="Positions where shares were added"
            />
            <FlowRow
              label="Decreased"
              color="bg-orange-500"
              priorValue={flow.decreasedFrom}
              currentValue={flow.decreasedTo}
              description="Positions where shares were trimmed"
            />
            <FlowRow
              label="New"
              color="bg-green-500"
              priorValue={0}
              currentValue={flow.newValue}
              description="Brand new positions this quarter"
            />
            <FlowRow
              label="Exited"
              color="bg-red-500"
              priorValue={flow.exitedValue}
              currentValue={0}
              description="Positions fully sold"
            />
          </div>
        </CardContent>
      </Card>

      {/* Per-group breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">By Strategy Group</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {flow.groupFlows.map((g) => {
              const groupNet = g.currentTotal - g.previousTotal
              const groupPct = g.previousTotal > 0 ? groupNet / g.previousTotal : 0
              return (
                <div key={g.group} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{g.group}</p>
                      <Badge
                        variant={groupNet >= 0 ? 'outline' : 'destructive'}
                        className={groupNet >= 0 ? 'border-green-500 text-green-700 dark:text-green-400 text-xs' : 'text-xs'}
                      >
                        {groupNet >= 0 ? '+' : ''}{formatPercent(groupPct, 1)}
                      </Badge>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                      <span>Prior: {formatCurrency(g.previousTotal)}</span>
                      <span>Current: {formatCurrency(g.currentTotal)}</span>
                      {g.newValue > 0 && <span className="text-green-600">+{formatCurrency(g.newValue)} new</span>}
                      {g.exitedValue > 0 && <span className="text-red-600">-{formatCurrency(g.exitedValue)} exited</span>}
                    </div>
                  </div>
                  <p className={`text-lg font-bold tabular-nums ${groupNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {groupNet >= 0 ? '+' : ''}{formatCurrency(groupNet)}
                  </p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FlowRow({
  label,
  color,
  priorValue,
  currentValue,
  description,
}: {
  label: string
  color: string
  priorValue: number
  currentValue: number
  description: string
}) {
  const delta = currentValue - priorValue
  return (
    <div className="flex items-center gap-4">
      <div className={`h-3 w-3 rounded-full shrink-0 ${color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="font-medium text-sm">{label}</p>
          <div className="flex items-center gap-4 text-sm tabular-nums">
            <span className="text-muted-foreground w-24 text-right">{formatCurrency(priorValue)}</span>
            <span className="text-muted-foreground">&rarr;</span>
            <span className="w-24 text-right">{formatCurrency(currentValue)}</span>
            {delta !== 0 && (
              <span className={`w-24 text-right ${delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {delta > 0 ? '+' : ''}{formatCurrency(delta)}
              </span>
            )}
            {delta === 0 && <span className="w-24" />}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
