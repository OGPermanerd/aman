import Link from 'next/link'
import { getGroupOverview, getGlobalQuarters } from '@/lib/data'
import { QuarterDisplay } from '@/app/_components/quarter-display'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { formatCurrency } from '@/lib/formatters'

interface GroupsPageProps {
  searchParams: Promise<{ quarter?: string }>
}

export default async function GroupsPage({ searchParams }: GroupsPageProps) {
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

  const groups = getGroupOverview(quarter)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Strategy Groups</h1>
          <p className="text-muted-foreground">Browse hedge fund portfolios by investment strategy</p>
        </div>
        <QuarterDisplay quarter={quarter} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
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
                      <p className="text-2xl font-bold tabular-nums">{formatCurrency(group.aggregateValue)}</p>
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
        ))}
      </div>
    </div>
  )
}
