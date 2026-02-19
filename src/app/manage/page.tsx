import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getAllGroups } from '@/lib/slugs'
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
import { AddFundForm } from './add-fund-form'
import { RemoveFundButton } from './remove-fund-button'

interface FundEntry {
  cik: string
  name: string
  strategyGroup: string
}

function readFundsConfig(): FundEntry[] {
  const raw = readFileSync(join(process.cwd(), 'src/config/funds.json'), 'utf-8')
  return JSON.parse(raw).funds
}

export default function ManagePage() {
  const groups = getAllGroups()
  const allFunds = readFundsConfig()

  // Group funds by strategy (from config, supporting multi-group)
  const fundsByGroup = new Map<string, FundEntry[]>()
  for (const group of groups) {
    fundsByGroup.set(group, [])
  }
  for (const fund of allFunds) {
    const list = fundsByGroup.get(fund.strategyGroup) ?? []
    list.push(fund)
    fundsByGroup.set(fund.strategyGroup, list)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manage Funds</h1>
        <p className="text-muted-foreground">Add or remove funds from your tracking universe</p>
      </div>

      {/* Add Fund Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Fund</CardTitle>
        </CardHeader>
        <CardContent>
          <AddFundForm groups={[...groups]} />
          <p className="text-xs text-muted-foreground mt-3">
            After adding, run <code className="rounded bg-muted px-1 py-0.5">pnpm ingest --all</code> to fetch filings from SEC EDGAR.
          </p>
        </CardContent>
      </Card>

      {/* Fund listing by group */}
      {groups.map((group) => {
        const groupFunds = fundsByGroup.get(group) ?? []
        return (
          <Card key={group}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{group}</CardTitle>
                <Badge variant="secondary">{groupFunds.length} funds</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {groupFunds.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No funds in this group.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fund Name</TableHead>
                      <TableHead>CIK</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupFunds.map((fund) => (
                      <TableRow key={`${fund.cik}-${fund.strategyGroup}`}>
                        <TableCell className="font-medium">{fund.name}</TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">{fund.cik}</TableCell>
                        <TableCell className="text-right">
                          <RemoveFundButton cik={fund.cik} name={fund.name} strategyGroup={fund.strategyGroup} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
