# HedgeLens

## What This Is

A personal dashboard that visualizes quarter-over-quarter changes in portfolio composition for groups of hedge funds, organized by investment strategy. Pulls 13F filings from SEC EDGAR and surfaces what changed — new positions, exits, weight shifts, and conviction changes — with interactive drill-down from strategy groups to individual funds to cross-fund position analysis.

## Core Value

Instantly see how strategy-grouped hedge funds changed their portfolios between quarters — what they bought, sold, and where they shifted conviction.

## Current State

**Shipped:** v1.0 MVP (2026-02-19)
**Codebase:** 9,754 LOC TypeScript across 100 files
**Stack:** Next.js 16, SQLite + Drizzle ORM, TanStack Table, Recharts, shadcn/ui
**Data:** 50 funds across 5 strategy groups, ingested from SEC EDGAR
**Tests:** 33 tests (Vitest, in-memory SQLite)

## Requirements

### Validated

- ✓ Pull and parse 13F filings from SEC EDGAR for configured fund managers — v1.0
- ✓ Group fund managers by investment strategy (Tiger Cubs, Activist, Macro, Quant, Multi-Strategy) — v1.0
- ✓ Seed each strategy group with well-known fund managers, stored in editable config — v1.0
- ✓ Show group overview landing page with high-level stats per strategy — v1.0
- ✓ Detect and display new positions, exited positions, weight shifts, conviction changes — v1.0
- ✓ Compare latest filing quarter vs previous quarter with drill-down — v1.0
- ✓ Sector/industry breakdown charts for funds and groups — v1.0
- ✓ CUSIP-to-ticker resolution and sector classification — v1.0
- ✓ Fund management UI with SEC search and multi-group support — v1.0 (iteration)
- ✓ Sankey flow charts and QoQ comparison visualization — v1.0 (iteration)

### Active

(None yet — define with `/gsd:new-milestone`)

### Out of Scope

- Multi-user/auth — personal tool, single user
- Real-time price data — 13F data is inherently 45-90 days stale
- Portfolio backtesting — massive scope, WhaleWisdom charges for this
- Mobile app — web dashboard only
- AI-powered insights — 13F insights are structural (diffs, concentrations)
- Comprehensive fund coverage (all 10K+ filers) — value is curated groups

## Context

- 13F filings submitted quarterly to SEC by institutional managers with $100M+ AUM
- ~45-day filing deadline after quarter end means data arrives in waves
- Strategy group membership is subjective — config-based approach lets user adjust
- Post-v1 iteration added: fund management page, charts page, data quality dashboard, hideEmpty filter, add fund modal with SEC search, mobile hydration fixes, multi-group fund support, build log page

## Constraints

- **Data source**: SEC EDGAR only — no paid APIs or third-party data subscriptions
- **Single user**: No authentication or access control needed
- **Filing format**: Must handle SEC EDGAR's XML/XBRL 13F formats

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SEC EDGAR as sole data source | Free, authoritative, no API keys needed | ✓ Good — works reliably with rate limiting |
| Fixed strategy groups via config | Simpler than UI-based management, user can edit JSON | ✓ Good — extended with UI management in iteration |
| Quarter-over-quarter comparison only | Keeps scope focused, most actionable timeframe | ✓ Good — sufficient for v1 |
| Seed with well-known funds per strategy | Gets user started fast, adjustable via config | ✓ Good — 50 funds across 5 groups |
| SQLite + Drizzle ORM | Simple, zero-config, fast for local dashboard | ✓ Good — sync operations, WAL mode |
| fast-xml-parser with parseTagValue: false | Prevents scientific notation corruption of CUSIPs | ✓ Good — critical fix discovered in iteration |
| Config-driven group membership | funds.json as source of truth, DB stores one row per CIK | ✓ Good — enables multi-group without schema change |
| TanStack Table for holdings | Interactive sorting without full client-side data loading | ✓ Good — performant with server-rendered data |
| nuqs for URL state | Quarter param in URL enables shareable links and server re-render | ✓ Good — required mounted gate for hydration |
| OpenFIGI for CUSIP resolution | Free tier sufficient, caches in securities table | ✓ Good — 91%+ resolution rate |

---
*Last updated: 2026-02-19 after v1.0 milestone*
