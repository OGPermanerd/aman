# Roadmap: HedgeLens

## Overview

HedgeLens delivers a personal dashboard for visualizing quarter-over-quarter hedge fund portfolio changes, grouped by investment strategy. The build follows the hard dependency chain of the domain: ingest and normalize 13F filing data from SEC EDGAR (the foundation everything depends on), compute analytics over that data (diffs, weights, conviction, consensus), then render the three-level drill-down dashboard (groups, funds, positions). Data correctness is the hardest problem and gets solved first.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Data Foundation** - Ingest, parse, and store 13F filings with fund config and security reference data ✓ 2026-02-19
- [x] **Phase 2: Analytics Engine** - Compute QoQ diffs, portfolio weights, conviction scores, and group consensus ✓ 2026-02-19
- [ ] **Phase 3: Dashboard** - Render the full drill-down UI from strategy groups to fund detail to position detail

## Phase Details

### Phase 1: Data Foundation
**Goal**: The system has correct, normalized 13F holdings data in a local database for all configured funds, with CUSIP-to-ticker mapping and options separated from equities
**Depends on**: Nothing (first phase)
**Requirements**: INGEST-01, INGEST-02, INGEST-03, INGEST-04, INGEST-05, INGEST-06, INGEST-07, FUND-01, FUND-02, FUND-03, SEC-01, SEC-02, SEC-03, SEC-04
**Success Criteria** (what must be TRUE):
  1. Running the ingestion CLI for a known fund (e.g., Pershing Square, CIK 0001336528) fetches its latest two 13F filings from SEC EDGAR and stores complete holdings snapshots in SQLite
  2. Ingested holdings for a reference fund match known values from WhaleWisdom or 13F.info (position names, share counts, market values within rounding tolerance)
  3. Options positions (puts/calls) are stored separately from equity positions and do not appear in equity-only queries
  4. CUSIPs resolve to human-readable ticker symbols for the majority of holdings, and unmapped CUSIPs are flagged rather than dropped
  5. The fund config JSON contains at least 50 funds across 5 strategy groups, and editing the config file changes which funds are ingested
**Plans**: 3 plans in 3 waves

Plans:
- [x] 01-01-PLAN.md -- Project bootstrap, database schema, and fund configuration (wave 1) ✓
- [x] 01-02-PLAN.md -- EDGAR client, XML parsing, and ingestion pipeline (wave 2) ✓
- [x] 01-03-PLAN.md -- CUSIP resolution, sector classification, and CLI (wave 3) ✓

### Phase 2: Analytics Engine
**Goal**: The system computes all QoQ portfolio analytics -- diffs, weights, rankings, conviction scores, and group-level consensus -- as tested, pure functions over stored holdings data
**Depends on**: Phase 1
**Requirements**: ANLYT-01, ANLYT-02, ANLYT-03, ANLYT-04, ANLYT-05, ANLYT-06
**Success Criteria** (what must be TRUE):
  1. For a fund with two quarters of data, the system correctly identifies new positions, exited positions, increased positions, and decreased positions by comparing holdings matched on CUSIP
  2. Portfolio weights (position value / total portfolio value) sum to approximately 100% for any fund-quarter and the top holdings view ranks correctly by weight
  3. Group consensus for a strategy group shows which stocks are held by the most member funds (e.g., "5 of 8 Tiger Cubs hold NVDA")
  4. Conviction scores correctly flag high-conviction positions based on portfolio weight threshold (>5%) and consecutive quarter additions
**Plans**: 2 plans in 2 waves

Plans:
- [x] 02-01-PLAN.md -- Core analytics: types, test infra, portfolio weights, QoQ diff (wave 1) ✓
- [x] 02-02-PLAN.md -- Group consensus and conviction scoring (wave 2) ✓

### Phase 3: Dashboard
**Goal**: Users can browse the complete drill-down dashboard -- from strategy group overview to fund detail to position detail -- with QoQ change indicators, quarter selection, and sector breakdowns
**Depends on**: Phase 2
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07
**Success Criteria** (what must be TRUE):
  1. The landing page shows all 5 strategy groups with fund count, aggregate portfolio stats, and top collective holdings per group
  2. Drilling into a strategy group shows all member funds with their QoQ changes; drilling into a fund shows the full holdings table with new/exit/increase/decrease badges and portfolio weight indicators
  3. A position detail page shows all tracked funds that hold a specific security, with cross-fund ownership counts and change direction per fund
  4. Sector/industry breakdown charts display portfolio allocation by sector for any fund or strategy group
  5. Every data view prominently displays the reporting quarter-end date (not filing date) as temporal context, and the user can switch between available quarters

**Plans**: 3 plans in 2 waves

Plans:
- [ ] 03-01-PLAN.md -- Next.js setup, data access layer, shared components, and root layout (wave 1)
- [ ] 03-02-PLAN.md -- Strategy group overview, group detail, and fund detail with holdings table (wave 2)
- [ ] 03-03-PLAN.md -- Position detail page and sector breakdown charts (wave 2)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Data Foundation | 3/3 | ✓ Complete | 2026-02-19 |
| 2. Analytics Engine | 2/2 | ✓ Complete | 2026-02-19 |
| 3. Dashboard | 0/3 | Not started | - |
