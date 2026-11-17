import 'server-only'
import { db } from '@/db/connection'
import { funds, holdings, securities } from '@/db/schema'
import { eq, and, desc, sql, countDistinct, count, inArray, notInArray, isNull, or } from 'drizzle-orm'
import { computePortfolioWeights } from '@/analytics/portfolio-weights'
import { computeQoQDiff } from '@/analytics/qoq-diff'
import { computeGroupConsensus } from '@/analytics/group-consensus'
import { computeConvictionScores } from '@/analytics/conviction'
import { previousQuarter } from '@/analytics/quarter-utils'
import { groupToSlug, getAllGroups, getFundsInGroup } from '@/lib/slugs'
import type { PositionChangeType } from '@/analytics/types'

// ---------------------------------------------------------------------------
// getGlobalQuarters - for root layout quarter picker
// ---------------------------------------------------------------------------

/**
 * Returns all distinct report quarters from holdings, ordered descending.
 */
export function getGlobalQuarters(): string[] {
  const rows = db
    .selectDistinct({ reportQuarter: holdings.reportQuarter })
    .from(holdings)
    .orderBy(desc(holdings.reportQuarter))
    .all()
  return rows.map((r) => r.reportQuarter)
}

/** Returns CIKs of active funds that have holdings in BOTH quarters (equity only). */
export function getFundsWithBothQuarters(q1: string, q2: string): string[] {
  const activeFunds = db
    .select({ cik: funds.cik })
    .from(funds)
    .where(eq(funds.active, true))
    .all()

  return activeFunds
    .filter((f) => {
      const has1 = db.select({ c: sql<number>`COUNT(*)` }).from(holdings)
        .where(and(eq(holdings.fundCik, f.cik), eq(holdings.reportQuarter, q1), eq(holdings.putCall, '')))
        .get()
      const has2 = db.select({ c: sql<number>`COUNT(*)` }).from(holdings)
        .where(and(eq(holdings.fundCik, f.cik), eq(holdings.reportQuarter, q2), eq(holdings.putCall, '')))
        .get()
      return (has1?.c ?? 0) > 0 && (has2?.c ?? 0) > 0
    })
    .map((f) => f.cik)
}

// ---------------------------------------------------------------------------
// getGroupOverview - DASH-01 landing page
// ---------------------------------------------------------------------------

export interface GroupOverviewItem {
  name: string
  slug: string
  fundCount: number
  fundsWithData: number
  aggregateValue: number
  topHoldings: Array<{
    cusip: string
    ticker: string | null
    nameOfIssuer: string
    fundCount: number
    ratio: number
  }>
}

/**
 * For each strategy group: fund count, funds with data, aggregate value, top 5 consensus.
 */
export function getGroupOverview(quarter: string, comparisonQuarter?: string): GroupOverviewItem[] {
  const groups = getAllGroups()
  const result: GroupOverviewItem[] = []

  // When comparisonQuarter is set, only include funds with data in BOTH quarters
  const requireBothQuarters = !!comparisonQuarter

  for (const group of groups) {
    // Get all funds in this group from config
    const groupFunds = getFundsInGroup(group)

    const fundCount = groupFunds.length
    if (fundCount === 0) {
      result.push({
        name: group,
        slug: groupToSlug(group) ?? '',
        fundCount: 0,
        fundsWithData: 0,
        aggregateValue: 0,
        topHoldings: [],
      })
      continue
    }

    const fundCiks = groupFunds.map((f) => f.cik)

    // Calculate aggregate portfolio value with a single query per fund
    // (equity only, putCall='')
    let aggregateValue = 0
    const fundsWithDataSet = new Set<string>()

    for (const cik of fundCiks) {
      const rows = db
        .select({ total: sql<number>`SUM(${holdings.value})` })
        .from(holdings)
        .where(
          and(
            eq(holdings.fundCik, cik),
            eq(holdings.reportQuarter, quarter),
            eq(holdings.putCall, ''),
          ),
        )
        .all()

      const total = rows[0]?.total ?? 0
      if (total > 0) {
        // If requireBothQuarters, check that the fund also has data in comparisonQuarter
        if (requireBothQuarters) {
          const priorRows = db
            .select({ total: sql<number>`SUM(${holdings.value})` })
            .from(holdings)
            .where(
              and(
                eq(holdings.fundCik, cik),
                eq(holdings.reportQuarter, comparisonQuarter),
                eq(holdings.putCall, ''),
              ),
            )
            .all()
          const priorTotal = priorRows[0]?.total ?? 0
          if (priorTotal <= 0) continue // skip fund — no data in comparison quarter
        }
        aggregateValue += total
        fundsWithDataSet.add(cik)
      }
    }

    // Get top 5 consensus holdings
    const groupCiks = groupFunds.map((f) => f.cik)
    const consensus = computeGroupConsensus(db, group, quarter, groupCiks)
    const topHoldings = consensus.slice(0, 5).map((c) => ({
      cusip: c.cusip,
      ticker: c.ticker,
      nameOfIssuer: c.nameOfIssuer,
      fundCount: c.fundCount,
      ratio: c.ratio,
    }))

    result.push({
      name: group,
      slug: groupToSlug(group) ?? '',
      fundCount,
      fundsWithData: fundsWithDataSet.size,
      aggregateValue,
      topHoldings,
    })
  }

  return result
}

// ---------------------------------------------------------------------------
// getGroupDetail - DASH-02
// ---------------------------------------------------------------------------

export interface GroupDetailFund {
  cik: string
  name: string
  hasData: boolean
  portfolioValue: number
  holdingCount: number
  qoqSummary: {
    new: number
    exited: number
    increased: number
    decreased: number
    unchanged: number
  }
}

export interface GroupDetail {
  name: string
  slug: string
  funds: GroupDetailFund[]
}

/**
 * Detail view for a strategy group. Returns list of funds with portfolio info and QoQ summary.
 */
export function getGroupDetail(strategyGroup: string, quarter: string): GroupDetail {
  const slug = groupToSlug(strategyGroup) ?? ''

  const groupFunds = getFundsInGroup(strategyGroup)
    .sort((a, b) => a.name.localeCompare(b.name))

  const prevQ = previousQuarter(quarter)
  const fundDetails: GroupDetailFund[] = []

  for (const fund of groupFunds) {
    // Get equity holdings for this quarter
    const equityHoldings = db
      .select({ value: holdings.value })
      .from(holdings)
      .where(
        and(
          eq(holdings.fundCik, fund.cik),
          eq(holdings.reportQuarter, quarter),
          eq(holdings.putCall, ''),
        ),
      )
      .all()

    const hasData = equityHoldings.length > 0
    const portfolioValue = equityHoldings.reduce((sum, h) => sum + h.value, 0)
    const holdingCount = equityHoldings.length

    let qoqSummary = { new: 0, exited: 0, increased: 0, decreased: 0, unchanged: 0 }
    if (hasData) {
      const diff = computeQoQDiff(db, fund.cik, quarter, prevQ)
      qoqSummary = diff.summary
    }

    fundDetails.push({
      cik: fund.cik,
      name: fund.name,
      hasData,
      portfolioValue,
      holdingCount,
      qoqSummary,
    })
  }

  return {
    name: strategyGroup,
    slug,
    funds: fundDetails,
  }
}

// ---------------------------------------------------------------------------
// getFundDetail - DASH-03
// ---------------------------------------------------------------------------

export interface FundPosition {
  cusip: string
  ticker: string | null
  nameOfIssuer: string
  value: number
  shares: number
  weight: number
  rank: number
  changeType: PositionChangeType | null
  valueDelta: number
  sharesDelta: number
  weightDelta: number
  convictionLevel: 'high' | 'medium' | 'low' | null
  consecutiveAdditions: number
  isHighWeight: boolean
}

export interface FundDetail {
  name: string
  cik: string
  strategyGroup: string
  positions: FundPosition[]
  qoqSummary: {
    new: number
    exited: number
    increased: number
    decreased: number
    unchanged: number
  }
}

/**
 * Full fund detail: merged portfolio weights, QoQ diffs, and conviction scores.
 */
export function getFundDetail(cik: string, quarter: string): FundDetail | null {
  const fund = db
    .select({ cik: funds.cik, name: funds.name, strategyGroup: funds.strategyGroup })
    .from(funds)
    .where(eq(funds.cik, cik))
    .all()

  if (fund.length === 0) return null

  const { name, strategyGroup } = fund[0]
  const prevQ = previousQuarter(quarter)

  // Get portfolio weights
  const weights = computePortfolioWeights(db, cik, quarter)

  // Get QoQ diffs
  const diff = computeQoQDiff(db, cik, quarter, prevQ)
  const diffMap = new Map(diff.diffs.map((d) => [d.cusip, d]))

  // Get conviction scores
  const convictions = computeConvictionScores(db, cik, quarter)
  const convictionMap = new Map(convictions.map((c) => [c.cusip, c]))

  // Merge into unified positions
  const positions: FundPosition[] = weights.map((pw) => {
    const d = diffMap.get(pw.cusip)
    const c = convictionMap.get(pw.cusip)

    return {
      cusip: pw.cusip,
      ticker: pw.ticker,
      nameOfIssuer: pw.nameOfIssuer,
      value: pw.value,
      shares: pw.shares,
      weight: pw.weight,
      rank: pw.rank,
      changeType: d?.changeType ?? null,
      valueDelta: d?.valueDelta ?? 0,
      sharesDelta: d?.sharesDelta ?? 0,
      weightDelta: d?.weightDelta ?? 0,
      convictionLevel: c?.convictionLevel ?? null,
      consecutiveAdditions: c?.consecutiveAdditions ?? 0,
      isHighWeight: c?.isHighWeight ?? false,
    }
  })

  // Add exited positions (in diff but not in current weights)
  for (const d of diff.diffs) {
    if (d.changeType === 'exited') {
      positions.push({
        cusip: d.cusip,
        ticker: d.ticker,
        nameOfIssuer: d.nameOfIssuer,
        value: 0,
        shares: 0,
        weight: 0,
        rank: 0,
        changeType: 'exited',
        valueDelta: d.valueDelta,
        sharesDelta: d.sharesDelta,
        weightDelta: d.weightDelta,
        convictionLevel: null,
        consecutiveAdditions: 0,
        isHighWeight: false,
      })
    }
  }

  return {
    name,
    cik,
    strategyGroup,
    positions,
    qoqSummary: diff.summary,
  }
}

// ---------------------------------------------------------------------------
// getPositionDetail - DASH-04
// ---------------------------------------------------------------------------

export interface PositionHolder {
  fundName: string
  fundCik: string
  strategyGroup: string
  value: number
  shares: number
  weight: number
  changeType: PositionChangeType | null
}

export interface PositionDetail {
  cusip: string
  ticker: string | null
  name: string | null
  sector: string | null
  holders: PositionHolder[]
  totalFundCount: number
}

/**
 * Cross-fund view of a single CUSIP: who holds it and how much.
 */
export function getPositionDetail(cusip: string, quarter: string): PositionDetail | null {
  // Get security info
  const sec = db
    .select({
      cusip: securities.cusip,
      ticker: securities.ticker,
      name: securities.name,
      sector: securities.sector,
    })
    .from(securities)
    .where(eq(securities.cusip, cusip))
    .all()

  const secInfo = sec[0] ?? { cusip, ticker: null, name: null, sector: null }

  // Get all holdings for this CUSIP in the quarter
  const holdingRows = db
    .select({
      fundCik: holdings.fundCik,
      value: holdings.value,
      shares: holdings.shares,
      nameOfIssuer: holdings.nameOfIssuer,
    })
    .from(holdings)
    .where(
      and(
        eq(holdings.cusip, cusip),
        eq(holdings.reportQuarter, quarter),
        eq(holdings.putCall, ''),
      ),
    )
    .all()

  if (holdingRows.length === 0) return null

  const prevQ = previousQuarter(quarter)

  const holders: PositionHolder[] = []

  for (const row of holdingRows) {
    // Get fund info
    const fundInfo = db
      .select({ name: funds.name, strategyGroup: funds.strategyGroup })
      .from(funds)
      .where(eq(funds.cik, row.fundCik))
      .all()

    if (fundInfo.length === 0) continue

    // Get fund total value for weight calculation
    const totalRows = db
      .select({ total: sql<number>`SUM(${holdings.value})` })
      .from(holdings)
      .where(
        and(
          eq(holdings.fundCik, row.fundCik),
          eq(holdings.reportQuarter, quarter),
          eq(holdings.putCall, ''),
        ),
      )
      .all()

    const fundTotal = totalRows[0]?.total ?? 0
    const weight = fundTotal > 0 ? row.value / fundTotal : 0

    // Get change type from QoQ diff
    let changeType: PositionChangeType | null = null
    try {
      const diff = computeQoQDiff(db, row.fundCik, quarter, prevQ)
      const positionDiff = diff.diffs.find((d) => d.cusip === cusip)
      changeType = positionDiff?.changeType ?? null
    } catch {
      // If previousQuarter fails (e.g., first quarter), skip
    }

    holders.push({
      fundName: fundInfo[0].name,
      fundCik: row.fundCik,
      strategyGroup: fundInfo[0].strategyGroup,
      value: row.value,
      shares: row.shares,
      weight,
      changeType,
    })
  }

  // Sort by value descending
  holders.sort((a, b) => b.value - a.value)

  return {
    cusip: secInfo.cusip,
    ticker: secInfo.ticker,
    name: secInfo.name,
    sector: secInfo.sector,
    holders,
    totalFundCount: holders.length,
  }
}

// ---------------------------------------------------------------------------
// getSectorBreakdown - DASH-05 (fund level)
// ---------------------------------------------------------------------------

export interface SectorBreakdownItem {
  sector: string
  value: number
  weight: number
}

/**
 * Sector breakdown for a single fund in a quarter.
 */
export function getSectorBreakdown(fundCik: string, quarter: string): SectorBreakdownItem[] {
  const rows = db
    .select({
      sector: securities.sector,
      value: holdings.value,
    })
    .from(holdings)
    .leftJoin(securities, eq(holdings.cusip, securities.cusip))
    .where(
      and(
        eq(holdings.fundCik, fundCik),
        eq(holdings.reportQuarter, quarter),
        eq(holdings.putCall, ''),
      ),
    )
    .all()

  // Aggregate by sector
  const sectorMap = new Map<string, number>()
  let totalValue = 0

  for (const row of rows) {
    const sector = row.sector ?? 'Unknown'
    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + row.value)
    totalValue += row.value
  }

  // Build result sorted by weight descending
  const result: SectorBreakdownItem[] = []
  for (const [sector, value] of sectorMap) {
    result.push({
      sector,
      value,
      weight: totalValue > 0 ? value / totalValue : 0,
    })
  }

  result.sort((a, b) => b.weight - a.weight)
  return result
}

// ---------------------------------------------------------------------------
// getGroupSectorBreakdown - DASH-05 (group level)
// ---------------------------------------------------------------------------

/**
 * Sector breakdown aggregated across all funds in a strategy group.
 */
export function getGroupSectorBreakdown(strategyGroup: string, quarter: string, includeCiks?: string[]): SectorBreakdownItem[] {
  let groupFundEntries = getFundsInGroup(strategyGroup)

  if (includeCiks) {
    const allowed = new Set(includeCiks)
    groupFundEntries = groupFundEntries.filter((f) => allowed.has(f.cik))
  }

  const groupFunds = groupFundEntries.map((f) => ({ cik: f.cik }))

  if (groupFunds.length === 0) return []

  const sectorMap = new Map<string, number>()
  let totalValue = 0

  for (const fund of groupFunds) {
    const rows = db
      .select({
        sector: securities.sector,
        value: holdings.value,
      })
      .from(holdings)
      .leftJoin(securities, eq(holdings.cusip, securities.cusip))
      .where(
        and(
          eq(holdings.fundCik, fund.cik),
          eq(holdings.reportQuarter, quarter),
          eq(holdings.putCall, ''),
        ),
      )
      .all()

    for (const row of rows) {
      const sector = row.sector ?? 'Unknown'
      sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + row.value)
      totalValue += row.value
    }
  }

  const result: SectorBreakdownItem[] = []
  for (const [sector, value] of sectorMap) {
    result.push({
      sector,
      value,
      weight: totalValue > 0 ? value / totalValue : 0,
    })
  }

  result.sort((a, b) => b.weight - a.weight)
  return result
}

// ---------------------------------------------------------------------------
// getDataCompleteness - Data quality / completeness tracker
// ---------------------------------------------------------------------------

export interface DataCompleteness {
  totalFunds: number
  fundsWithData: number
  totalHoldings: number
  uniqueCusips: number
  cusipsResolved: number
  cusipsPending: number
  cusipsUnmapped: number
  quarterCoverage: Array<{
    quarter: string
    holdingCount: number
    fundCount: number
  }>
  fundCoverage: Array<{
    cik: string
    name: string
    strategyGroup: string
    quarters: number
    latestQuarter: string | null
  }>
}

/**
 * Aggregated data completeness stats across funds, holdings, and securities.
 */
export function getDataCompleteness(): DataCompleteness {
  // Total active funds
  const totalFundsRow = db
    .select({ cnt: count() })
    .from(funds)
    .where(eq(funds.active, true))
    .all()
  const totalFunds = totalFundsRow[0]?.cnt ?? 0

  // Funds with at least 1 holding
  const fundsWithDataRow = db
    .select({ cnt: countDistinct(holdings.fundCik) })
    .from(holdings)
    .all()
  const fundsWithData = fundsWithDataRow[0]?.cnt ?? 0

  // Total holdings
  const totalHoldingsRow = db
    .select({ cnt: count() })
    .from(holdings)
    .all()
  const totalHoldings = totalHoldingsRow[0]?.cnt ?? 0

  // Unique CUSIPs in holdings
  const uniqueCusipsRow = db
    .select({ cnt: countDistinct(holdings.cusip) })
    .from(holdings)
    .all()
  const uniqueCusips = uniqueCusipsRow[0]?.cnt ?? 0

  // CUSIPs resolved (in securities table with unmapped=false)
  const resolvedRow = db
    .select({ cnt: count() })
    .from(securities)
    .where(eq(securities.unmapped, false))
    .all()
  const cusipsResolved = resolvedRow[0]?.cnt ?? 0

  // CUSIPs explicitly unmapped (in securities table with unmapped=true)
  const unmappedRow = db
    .select({ cnt: count() })
    .from(securities)
    .where(eq(securities.unmapped, true))
    .all()
  const cusipsUnmapped = unmappedRow[0]?.cnt ?? 0

  // CUSIPs in holdings but not in securities table at all
  const pendingRow = db.all<{ cnt: number }>(sql`
    SELECT COUNT(DISTINCT h.cusip) as cnt
    FROM holdings h
    LEFT JOIN securities s ON h.cusip = s.cusip
    WHERE s.cusip IS NULL
  `)
  const cusipsPending = pendingRow[0]?.cnt ?? 0

  // Per-quarter coverage
  const quarterCoverage = db
    .select({
      quarter: holdings.reportQuarter,
      holdingCount: count(),
      fundCount: countDistinct(holdings.fundCik),
    })
    .from(holdings)
    .groupBy(holdings.reportQuarter)
    .orderBy(desc(holdings.reportQuarter))
    .all()

  // Per-fund coverage
  const fundCoverage = db
    .select({
      cik: funds.cik,
      name: funds.name,
      strategyGroup: funds.strategyGroup,
    })
    .from(funds)
    .where(eq(funds.active, true))
    .orderBy(funds.strategyGroup, funds.name)
    .all()
    .map((f) => {
      const quarterRows = db
        .selectDistinct({ q: holdings.reportQuarter })
        .from(holdings)
        .where(eq(holdings.fundCik, f.cik))
        .orderBy(desc(holdings.reportQuarter))
        .all()

      return {
        cik: f.cik,
        name: f.name,
        strategyGroup: f.strategyGroup,
        quarters: quarterRows.length,
        latestQuarter: quarterRows[0]?.q ?? null,
      }
    })

  return {
    totalFunds,
    fundsWithData,
    totalHoldings,
    uniqueCusips,
    cusipsResolved,
    cusipsPending,
    cusipsUnmapped,
    quarterCoverage,
    fundCoverage,
  }
}

// ---------------------------------------------------------------------------
// getGroupActivity - Biggest adds and trims/exits for a group, weighted by fund size
// ---------------------------------------------------------------------------

export interface GroupActivityEntry {
  cusip: string
  ticker: string | null
  nameOfIssuer: string
  /** Sum of each fund's valueDelta * (fundAUM / groupAUM) — size-weighted dollar move */
  weightedDelta: number
  /** Raw dollar aggregate across all funds for display */
  netValueDelta: number
  fundCount: number
  fundDetails: Array<{ name: string; valueDelta: number; changeType: PositionChangeType }>
}

export interface GroupActivity {
  topAdds: GroupActivityEntry[]
  topTrims: GroupActivityEntry[]
}

/**
 * Returns the biggest adds and trims/exits for a strategy group in a quarter.
 * Each security's delta is weighted by fund AUM so larger funds don't crowd
 * out high-conviction moves from smaller funds.
 */
export function getGroupActivity(
  strategyGroup: string,
  quarter: string,
  limit = 10,
): GroupActivity {
  const groupFunds = getFundsInGroup(strategyGroup)

  let prevQ: string
  try {
    prevQ = previousQuarter(quarter)
  } catch {
    return { topAdds: [], topTrims: [] }
  }

  // Portfolio value per fund (current quarter equity only)
  const fundAUM = new Map<string, number>()
  for (const fund of groupFunds) {
    const row = db
      .select({ total: sql<number>`SUM(${holdings.value})` })
      .from(holdings)
      .where(and(eq(holdings.fundCik, fund.cik), eq(holdings.reportQuarter, quarter), eq(holdings.putCall, '')))
      .get()
    const total = row?.total ?? 0
    if (total > 0) fundAUM.set(fund.cik, total)
  }

  const groupAUM = Array.from(fundAUM.values()).reduce((a, b) => a + b, 0)
  if (groupAUM === 0) return { topAdds: [], topTrims: [] }

  // Aggregate diffs across funds, weighting each fund's delta by its AUM share
  const cusipMap = new Map<string, {
    ticker: string | null
    nameOfIssuer: string
    weightedDelta: number
    netValueDelta: number
    fundDetails: Array<{ name: string; valueDelta: number; changeType: PositionChangeType }>
  }>()

  for (const fund of groupFunds) {
    const aum = fundAUM.get(fund.cik)
    if (!aum) continue // no data this quarter

    const weight = aum / groupAUM
    const diff = computeQoQDiff(db, fund.cik, quarter, prevQ)

    for (const d of diff.diffs) {
      if (d.changeType === 'unchanged') continue

      if (!cusipMap.has(d.cusip)) {
        cusipMap.set(d.cusip, {
          ticker: d.ticker,
          nameOfIssuer: d.nameOfIssuer,
          weightedDelta: 0,
          netValueDelta: 0,
          fundDetails: [],
        })
      }

      const entry = cusipMap.get(d.cusip)!
      entry.weightedDelta += d.valueDelta * weight
      entry.netValueDelta += d.valueDelta
      entry.fundDetails.push({ name: fund.name, valueDelta: d.valueDelta, changeType: d.changeType })
    }
  }

  const entries: GroupActivityEntry[] = Array.from(cusipMap.entries()).map(([cusip, data]) => ({
    cusip,
    ticker: data.ticker,
    nameOfIssuer: data.nameOfIssuer,
    weightedDelta: data.weightedDelta,
    netValueDelta: data.netValueDelta,
    fundCount: data.fundDetails.length,
    fundDetails: data.fundDetails,
  }))

  const topAdds = entries
    .filter((e) => e.weightedDelta > 0)
    .sort((a, b) => b.weightedDelta - a.weightedDelta)
    .slice(0, limit)

  const topTrims = entries
    .filter((e) => e.weightedDelta < 0)
    .sort((a, b) => a.weightedDelta - b.weightedDelta)
    .slice(0, limit)

  return { topAdds, topTrims }
}

// ---------------------------------------------------------------------------
// getQoQFlowData - Aggregated QoQ dollar flow for Sankey chart
// ---------------------------------------------------------------------------

export interface QoQFlowData {
  currentQuarter: string
  previousQuarter: string
  previousTotal: number
  currentTotal: number
  newValue: number
  exitedValue: number
  increasedFrom: number
  increasedTo: number
  decreasedFrom: number
  decreasedTo: number
  unchangedValue: number
  fundCount: number
  // Per-group breakdown
  groupFlows: Array<{
    group: string
    previousTotal: number
    currentTotal: number
    newValue: number
    exitedValue: number
    increasedDelta: number
    decreasedDelta: number
  }>
}

/**
 * Aggregate QoQ dollar flows across all funds for the Sankey chart.
 */
export function getQoQFlowData(quarter: string, includeCiks?: string[]): QoQFlowData | null {
  const prevQ = previousQuarter(quarter)

  let activeFunds = db
    .select({ cik: funds.cik, strategyGroup: funds.strategyGroup })
    .from(funds)
    .where(eq(funds.active, true))
    .all()

  if (includeCiks) {
    const allowed = new Set(includeCiks)
    activeFunds = activeFunds.filter((f) => allowed.has(f.cik))
  }

  let totalPrev = 0
  let totalCurr = 0
  let newValue = 0
  let exitedValue = 0
  let increasedFrom = 0
  let increasedTo = 0
  let decreasedFrom = 0
  let decreasedTo = 0
  let unchangedValue = 0
  let fundCount = 0

  const groupMap = new Map<string, {
    previousTotal: number
    currentTotal: number
    newValue: number
    exitedValue: number
    increasedDelta: number
    decreasedDelta: number
  }>()

  for (const fund of activeFunds) {
    const diff = computeQoQDiff(db, fund.cik, quarter, prevQ)
    if (diff.diffs.length === 0) continue
    fundCount++

    const gKey = fund.strategyGroup
    if (!groupMap.has(gKey)) {
      groupMap.set(gKey, {
        previousTotal: 0, currentTotal: 0,
        newValue: 0, exitedValue: 0,
        increasedDelta: 0, decreasedDelta: 0,
      })
    }
    const gData = groupMap.get(gKey)!

    for (const d of diff.diffs) {
      const cv = d.currentValue ?? 0
      const pv = d.previousValue ?? 0

      switch (d.changeType) {
        case 'new':
          newValue += cv
          gData.newValue += cv
          gData.currentTotal += cv
          totalCurr += cv
          break
        case 'exited':
          exitedValue += pv
          gData.exitedValue += pv
          gData.previousTotal += pv
          totalPrev += pv
          break
        case 'increased':
          increasedFrom += pv
          increasedTo += cv
          gData.increasedDelta += cv - pv
          gData.previousTotal += pv
          gData.currentTotal += cv
          totalPrev += pv
          totalCurr += cv
          break
        case 'decreased':
          decreasedFrom += pv
          decreasedTo += cv
          gData.decreasedDelta += pv - cv
          gData.previousTotal += pv
          gData.currentTotal += cv
          totalPrev += pv
          totalCurr += cv
          break
        case 'unchanged':
          unchangedValue += cv
          gData.previousTotal += pv
          gData.currentTotal += cv
          totalPrev += pv
          totalCurr += cv
          break
      }
    }
  }

  if (fundCount === 0) return null

  const groupFlows = Array.from(groupMap.entries())
    .map(([group, data]) => ({ group, ...data }))
    .sort((a, b) => b.currentTotal - a.currentTotal)

  return {
    currentQuarter: quarter,
    previousQuarter: prevQ,
    previousTotal: totalPrev,
    currentTotal: totalCurr,
    newValue,
    exitedValue,
    increasedFrom,
    increasedTo,
    decreasedFrom,
    decreasedTo,
    unchangedValue,
    fundCount,
    groupFlows,
  }
}

// ---------------------------------------------------------------------------
// getGroupQoQFlowData - QoQ flow scoped to a single strategy group
// ---------------------------------------------------------------------------

export interface GroupQoQFlowData {
  currentQuarter: string
  previousQuarter: string
  previousTotal: number
  currentTotal: number
  newValue: number
  exitedValue: number
  increasedFrom: number
  increasedTo: number
  decreasedFrom: number
  decreasedTo: number
  unchangedValue: number
}

export function getGroupQoQFlowData(strategyGroup: string, quarter: string, includeCiks?: string[]): GroupQoQFlowData | null {
  const prevQ = previousQuarter(quarter)

  let groupFundEntries = getFundsInGroup(strategyGroup)

  if (includeCiks) {
    const allowed = new Set(includeCiks)
    groupFundEntries = groupFundEntries.filter((f) => allowed.has(f.cik))
  }

  const groupFunds = groupFundEntries.map((f) => ({ cik: f.cik }))

  let totalPrev = 0, totalCurr = 0
  let newValue = 0, exitedValue = 0
  let increasedFrom = 0, increasedTo = 0
  let decreasedFrom = 0, decreasedTo = 0
  let unchangedValue = 0
  let hasDiffs = false

  for (const fund of groupFunds) {
    const diff = computeQoQDiff(db, fund.cik, quarter, prevQ)
    if (diff.diffs.length === 0) continue
    hasDiffs = true

    for (const d of diff.diffs) {
      const cv = d.currentValue ?? 0
      const pv = d.previousValue ?? 0
      switch (d.changeType) {
        case 'new': newValue += cv; totalCurr += cv; break
        case 'exited': exitedValue += pv; totalPrev += pv; break
        case 'increased': increasedFrom += pv; increasedTo += cv; totalPrev += pv; totalCurr += cv; break
        case 'decreased': decreasedFrom += pv; decreasedTo += cv; totalPrev += pv; totalCurr += cv; break
        case 'unchanged': unchangedValue += cv; totalPrev += pv; totalCurr += cv; break
      }
    }
  }

  if (!hasDiffs) return null

  return {
    currentQuarter: quarter, previousQuarter: prevQ,
    previousTotal: totalPrev, currentTotal: totalCurr,
    newValue, exitedValue,
    increasedFrom, increasedTo,
    decreasedFrom, decreasedTo,
    unchangedValue,
  }
}

// ---------------------------------------------------------------------------
// getRealEstateData - Real Estate cross-fund view
// ---------------------------------------------------------------------------

/**
 * SIC codes covering all real estate companies:
 * 6500 General Real Estate · 6510 RE Operators · 6512 Nonresidential Operators
 * 6519 Lessors of Real Property · 6531 RE Agents & Managers
 * 6552 Land Subdividers & Developers · 6798 REITs
 */
export const RE_SIC_CODES = ['6500', '6510', '6512', '6519', '6531', '6552', '6798'] as const

export interface REHolder {
  fundCik: string
  fundName: string
  strategyGroup: string
  value: number
  shares: number
  changeType: PositionChangeType | null
  valueDelta: number
  sharesDelta: number
}

export interface RESecurity {
  cusip: string
  ticker: string | null
  nameOfIssuer: string
  sic: string | null
  sicDescription: string | null
  totalValue: number      // sum across all holders this quarter
  prevTotalValue: number  // sum across all holders prior quarter
  totalValueDelta: number // totalValue - prevTotalValue
  fundCount: number       // distinct funds holding this quarter
}

export interface REActivityItem {
  fundCik: string
  fundName: string
  strategyGroup: string
  cusip: string
  ticker: string | null
  nameOfIssuer: string
  value: number        // current value (0 for exits)
  valueDelta: number   // current - prior (dollars)
  sharesDelta: number  // current - prior (shares) — positive = add, negative = trim
  changeType: PositionChangeType
}

export interface RealEstateData {
  quarter: string
  prevQuarter: string | null
  securities: RESecurity[]      // sorted by totalValue desc
  activityItems: REActivityItem[] // new/exited/increased/decreased, sorted by |valueDelta| desc
  totalValue: number            // sum of all RE positions across all funds (current quarter)
  prevTotalValue: number        // same for prior quarter
  fundsWithExposure: number     // distinct funds with ≥1 RE holding
  activityCounts: { new: number; exited: number; increased: number; decreased: number }
}

/**
 * SIC codes covering software and internet companies:
 * 7370 Computer Programming/Data Processing · 7371 Programming Services
 * 7372 Prepackaged Software · 7373 Computer Integrated Systems
 * 7374 Computer Processing & Data Prep · 7377 Computer Rental & Leasing
 */
export const SW_SIC_CODES = ['7370', '7371', '7372', '7373', '7374', '7377'] as const

/**
 * Semiconductors and semicap (semiconductor capital equipment).
 * SIC 3674 Semiconductors & Related Devices · 3559 Special Industry Machinery (semi equipment)
 */
export const SEMI_SIC_CODES = ['3674', '3559'] as const

/** Semis and semicap names the SEC files under other SIC codes (metrology, test, process subsystems, RF). */
export const SEMI_EXTRA_TICKERS = ['KLAC', 'CAMT', 'NVMI', 'ONTO', 'TER', 'AEHR', 'MKSI', 'AEIS', 'QCOM'] as const

/**
 * Non-semi names filed under the semi SIC codes: solar (CSIQ, ENPH, SEDG, TE, NXT),
 * optical/laser (AAOI, LASR) and network test (VIAV). Semi-exposed industrials (GEV, VRT, etc.)
 * are deliberately out of scope.
 */
export const SEMI_EXCLUDE_TICKERS = ['CSIQ', 'ENPH', 'SEDG', 'TE', 'NXT', 'AAOI', 'LASR', 'VIAV'] as const

// ---------------------------------------------------------------------------
// Shared cross-fund holdings builder (used by RE, Software and Semiconductor pages)
// ---------------------------------------------------------------------------

function getCrossFundData(
  quarter: string,
  sicCodes: readonly string[],
  extraTickers: readonly string[] = [],
  excludeTickers: readonly string[] = [],
): RealEstateData {
  const empty: RealEstateData = {
    quarter,
    prevQuarter: null,
    securities: [],
    activityItems: [],
    totalValue: 0,
    prevTotalValue: 0,
    fundsWithExposure: 0,
    activityCounts: { new: 0, exited: 0, increased: 0, decreased: 0 },
  }

  let prevQ: string | null = null
  try { prevQ = previousQuarter(quarter) } catch { /* first quarter */ }

  // All active curated funds
  const activeFunds = db
    .select({ cik: funds.cik, name: funds.name, strategyGroup: funds.strategyGroup })
    .from(funds)
    .where(eq(funds.active, true))
    .all()

  if (activeFunds.length === 0) return { ...empty, prevQuarter: prevQ }

  const fundMap = new Map(activeFunds.map((f) => [f.cik, f]))
  const fundCiks = activeFunds.map((f) => f.cik)

  const includeFilter = or(
    ...sicCodes.map((code) => eq(securities.sic, code)),
    ...(extraTickers.length > 0 ? [inArray(securities.ticker, [...extraTickers])] : []),
  )!
  // Keep rows with no ticker: NOT IN on NULL would silently drop them
  const sicFilter =
    excludeTickers.length > 0
      ? and(includeFilter, or(isNull(securities.ticker), notInArray(securities.ticker, [...excludeTickers])))!
      : includeFilter

  // Current quarter: all RE holdings across active funds
  const currRows = db
    .select({
      fundCik: holdings.fundCik,
      cusip: holdings.cusip,
      value: holdings.value,
      shares: holdings.shares,
      nameOfIssuer: holdings.nameOfIssuer,
      ticker: securities.ticker,
      secName: securities.name,
      sic: securities.sic,
      sicDescription: securities.sicDescription,
    })
    .from(holdings)
    .innerJoin(securities, eq(holdings.cusip, securities.cusip))
    .where(
      and(
        eq(holdings.reportQuarter, quarter),
        eq(holdings.putCall, ''),
        inArray(holdings.fundCik, fundCiks),
        sicFilter,
      ),
    )
    .all()

  // Prior quarter: same filter
  const prevRows = prevQ
    ? db
        .select({
          fundCik: holdings.fundCik,
          cusip: holdings.cusip,
          value: holdings.value,
          shares: holdings.shares,
          nameOfIssuer: holdings.nameOfIssuer,
        })
        .from(holdings)
        .innerJoin(securities, eq(holdings.cusip, securities.cusip))
        .where(
          and(
            eq(holdings.reportQuarter, prevQ),
            eq(holdings.putCall, ''),
            inArray(holdings.fundCik, fundCiks),
            sicFilter,
          ),
        )
        .all()
    : []

  type HoldingKey = string // `${fundCik}:${cusip}`

  const currMap = new Map<HoldingKey, (typeof currRows)[0]>()
  const prevMap = new Map<HoldingKey, (typeof prevRows)[0]>()

  for (const h of currRows) currMap.set(`${h.fundCik}:${h.cusip}`, h)
  for (const h of prevRows) prevMap.set(`${h.fundCik}:${h.cusip}`, h)

  const allKeys = new Set<HoldingKey>([...currMap.keys(), ...prevMap.keys()])

  // Per-security aggregation
  interface SecAgg {
    ticker: string | null
    nameOfIssuer: string
    sic: string | null
    sicDescription: string | null
    totalValue: number
    prevTotalValue: number
    totalValueDelta: number
    fundCount: number
  }
  const secMap = new Map<string, SecAgg>()

  const activityItems: REActivityItem[] = []
  let totalValue = 0
  let prevTotalValue = 0
  const fundsWithExposure = new Set<string>()
  const activityCounts = { new: 0, exited: 0, increased: 0, decreased: 0 }

  for (const key of allKeys) {
    const colonIdx = key.indexOf(':')
    const fundCik = key.slice(0, colonIdx)
    const cusip = key.slice(colonIdx + 1)

    const curr = currMap.get(key)
    const prev = prevMap.get(key)

    const fundInfo = fundMap.get(fundCik)
    if (!fundInfo) continue

    // Classify change (based on shares, same convention as computeQoQDiff)
    let changeType: PositionChangeType
    if (!prev) {
      changeType = 'new'
    } else if (!curr) {
      changeType = 'exited'
    } else if (curr.shares > prev.shares) {
      changeType = 'increased'
    } else if (curr.shares < prev.shares) {
      changeType = 'decreased'
    } else {
      changeType = 'unchanged'
    }

    const value = curr?.value ?? 0
    const prevValue = prev?.value ?? 0
    const valueDelta = value - prevValue
    const sharesDelta = (curr?.shares ?? 0) - (prev?.shares ?? 0)

    if (curr) {
      fundsWithExposure.add(fundCik)
      totalValue += value
    }
    if (prev) {
      prevTotalValue += prevValue
    }

    // Aggregate into per-security entry
    if (!secMap.has(cusip)) {
      secMap.set(cusip, {
        ticker: curr?.ticker ?? null,
        nameOfIssuer: curr?.nameOfIssuer ?? prev!.nameOfIssuer,
        sic: curr?.sic ?? null,
        sicDescription: curr?.sicDescription ?? null,
        totalValue: 0,
        prevTotalValue: 0,
        totalValueDelta: 0,
        fundCount: 0,
      })
    }
    const sec = secMap.get(cusip)!
    sec.totalValue += value
    sec.prevTotalValue += prevValue
    sec.totalValueDelta += valueDelta
    if (curr) sec.fundCount++

    // Activity feed (skip unchanged)
    if (changeType !== 'unchanged') {
      activityCounts[changeType]++
      activityItems.push({
        fundCik,
        fundName: fundInfo.name,
        strategyGroup: fundInfo.strategyGroup,
        cusip,
        ticker: curr?.ticker ?? null,
        nameOfIssuer: curr?.nameOfIssuer ?? prev!.nameOfIssuer,
        value,
        valueDelta,
        sharesDelta,
        changeType,
      })
    }
  }

  // Build securities array, sort by total value desc
  const securitiesArr: RESecurity[] = Array.from(secMap.entries())
    .map(([cusip, agg]) => ({ cusip, ...agg }))
    .sort((a, b) => b.totalValue - a.totalValue)

  // Sort activity by absolute value delta desc (biggest moves first)
  activityItems.sort((a, b) => Math.abs(b.valueDelta) - Math.abs(a.valueDelta))

  return {
    quarter,
    prevQuarter: prevQ,
    securities: securitiesArr,
    activityItems,
    totalValue,
    prevTotalValue,
    fundsWithExposure: fundsWithExposure.size,
    activityCounts,
  }
}

/** Cross-fund real estate holdings view (SIC 6500–6552, 6798). */
export function getRealEstateData(quarter: string): RealEstateData {
  return getCrossFundData(quarter, RE_SIC_CODES)
}

/** Cross-fund software holdings view (SIC 7370–7374, 7377). */
export function getSoftwareData(quarter: string): RealEstateData {
  return getCrossFundData(quarter, SW_SIC_CODES)
}

/** Cross-fund semis + semicap holdings view (SIC 3674, 3559, plus/minus listed tickers). */
export function getSemiconductorData(quarter: string): RealEstateData {
  return getCrossFundData(quarter, SEMI_SIC_CODES, SEMI_EXTRA_TICKERS, SEMI_EXCLUDE_TICKERS)
}
