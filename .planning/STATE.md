# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-19)

**Core value:** Instantly see how strategy-grouped hedge funds changed their portfolios between quarters
**Current focus:** All phases complete

## Current Position

Phase: 3 of 3 (Dashboard)
Plan: 3 of 3 in current phase (03-03 complete)
Status: Complete
Last activity: 2026-02-19 -- Completed 03-03-PLAN.md

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: 4.6min
- Total execution time: 0.61 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-foundation | 3/3 | 15min | 5min |
| 02-analytics-engine | 2/2 | 7min | 3.5min |
| 03-dashboard | 3/3 | 14min | 4.7min |

**Recent Trend:**
- Last 5 plans: 02-01 (4min), 02-02 (3min), 03-01 (8min), 03-02 (3min), 03-03 (3min)
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Three-phase build following strict data dependency chain (ingest -> analytics -> UI)
- [Roadmap]: Phase 1 combines data ingestion, fund configuration, and security reference data since they are all "get correct data into the database"
- [01-01]: Resolved 4 CIK conflicts using best-known institutional filer CIKs (Tudor 1067983, Sachem Head 1598665, Millennium 1535076, Baupost 1082349)
- [01-01]: Used explicit TypeScript return types on getDb() for declaration emit compatibility
- [01-01]: Used zod/v4 import path for Zod 4.x runtime validation
- [01-02]: Used synchronous better-sqlite3 transaction API -- drizzle's adapter does not support async callbacks
- [01-02]: Relaxed CUSIP length validation to 6-9 chars (Amazon CUSIP is 8 digits in SEC data)
- [01-02]: Amendment type detection confirmed working from cover page XML (Research concern resolved)
- [01-03]: Used classifySectorsFromHoldings (ticker -> company_tickers.json -> CIK -> SIC) as primary sector classification approach
- [01-03]: Named imports for node-cron TypeScript compatibility (schedule, ScheduledTask)
- [01-03]: OpenFIGI batch size: 10 without API key (free tier), 100 with key
- [02-01]: Used reduce() for totalValue instead of Drizzle sum() which returns string
- [02-01]: Classify position changes by shares delta (not value) since value fluctuates with market price
- [02-01]: Left join to securities for ticker resolution, returns null if no CUSIP mapping
- [02-02]: Query funds individually in group consensus for adapter portability (not inArray)
- [02-02]: Consecutive additions walk backwards through available quarters, stop at gaps
- [02-02]: Conviction is dual-signal classifier: weight > 5% AND/OR consecutiveAdditions >= 2
- [03-01]: Removed .js extensions from all relative imports for Turbopack bundler compatibility
- [03-01]: Used nuqs with parseAsString for quarter URL state sync
- [03-01]: HMR-safe database singleton via globalThis pattern for Next.js dev
- [03-02]: TanStack Table with shadcn Table primitives for interactive sortable holdings table
- [03-02]: Server-to-client serialization: FundPosition mapped to plain HoldingRow interface for client component
- [03-02]: Sort order: funds with data first (by value desc), then funds without data (alphabetically)
- [03-03]: Horizontal bar chart (not pie) for sector breakdown -- better readability with long sector names
- [03-03]: Custom tooltip with formatCurrency/formatPercent instead of shadcn ChartTooltipContent
- [03-03]: CSS variable sector colors (oklch) matching shadcn theme for dark mode compatibility
- [03-03]: Position detail uses static shadcn Table (not TanStack) for simpler cross-fund view

### Pending Todos

None yet.

### Blockers/Concerns

- [Resolved in 01-03]: CUSIP-to-ticker mapping gap -- Resolved via OpenFIGI API. 10/11 Pershing Square CUSIPs resolved successfully.
- [Resolved in 01-02]: Amendment type detection confirmed -- cover page XML has isAmendment + amendmentType fields, parseCoverPage() extracts correctly.
- [Research]: Stock split handling has no free data source. Heuristic approach may be needed in Phase 2.

## Session Continuity

Last session: 2026-02-19
Stopped at: Completed 03-03-PLAN.md (Position Detail & Sector Charts) -- ALL PLANS COMPLETE
Resume file: .planning/phases/03-dashboard/03-03-SUMMARY.md
