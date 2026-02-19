import 'server-only'
import { db } from '@/db/connection'
import { funds, holdings, securities } from '@/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { computePortfolioWeights } from '@/analytics/portfolio-weights'
import { computeQoQDiff } from '@/analytics/qoq-diff'
import { computeGroupConsensus } from '@/analytics/group-consensus'
import { computeConvictionScores } from '@/analytics/conviction'
import { previousQuarter } from '@/analytics/quarter-utils'
import { groupToSlug, getAllGroups } from '@/lib/slugs'
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
export function getGroupOverview(quarter: string): GroupOverviewItem[] {
  const groups = getAllGroups()
  const result: GroupOverviewItem[] = []

  for (const group of groups) {
    // Get all active funds in this group
    const groupFunds = db
      .select({ cik: funds.cik })
      .from(funds)
      .where(and(eq(funds.strategyGroup, group), eq(funds.active, true)))
      .all()

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
        aggregateValue += total
        fundsWithDataSet.add(cik)
      }
    }

    // Get top 5 consensus holdings
    const consensus = computeGroupConsensus(db, group, quarter)
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

  const groupFunds = db
    .select({ cik: funds.cik, name: funds.name })
    .from(funds)
    .where(and(eq(funds.strategyGroup, strategyGroup), eq(funds.active, true)))
    .orderBy(funds.name)
    .all()

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
export function getGroupSectorBreakdown(strategyGroup: string, quarter: string): SectorBreakdownItem[] {
  const groupFunds = db
    .select({ cik: funds.cik })
    .from(funds)
    .where(and(eq(funds.strategyGroup, strategyGroup), eq(funds.active, true)))
    .all()

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
