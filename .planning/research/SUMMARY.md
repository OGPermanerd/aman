# Project Research Summary

**Project:** HedgeLens
**Domain:** Hedge Fund 13F Portfolio Analytics Dashboard
**Researched:** 2026-02-19
**Confidence:** HIGH

## Executive Summary

HedgeLens is a single-user, locally-run dashboard that visualizes quarter-over-quarter portfolio changes for hedge funds grouped by investment strategy. The expert approach to building this type of product follows a clear pattern: batch-ingest SEC EDGAR 13F filings into a local relational database, compute analytics (diffs, weights, conviction) as pure functions over stored snapshots, and render a drill-down dashboard from group overview to fund detail to position detail. The recommended stack is Next.js 16 with SQLite (via better-sqlite3 and Drizzle ORM), using React Server Components to keep the data-heavy views fast. This is a well-understood domain with free, structured data from the SEC -- the primary challenge is data correctness, not system complexity.

The recommended approach is to build the data ingestion pipeline first and validate it thoroughly before touching any UI. Research across all four areas converges on the same conclusion: getting 13F data right is the hard part. The SEC changed the value reporting format in January 2023 (thousands to exact dollars), funds file amendments that supersede originals, CUSIPs are unreliable as permanent identifiers, and options positions must be separated from equities. Every downstream feature -- QoQ diffs, conviction scoring, group consensus -- is only as good as the underlying data. Build the pipeline, test it against known funds, then layer analytics and UI on top.

The key risks are data quality issues that silently produce wrong results. A 1000x value error from the 2023 format change, a missed amendment, or an options position treated as equity will make the entire dashboard untrustworthy. The mitigation strategy is simple: write explicit tests that compare ingested data against known values from WhaleWisdom or 13F.info for a handful of reference funds, and run those tests on every ingestion pipeline change. The second risk is scope creep -- features like real-time pricing, backtesting, and email alerts are explicitly anti-features that would transform a focused personal tool into an unfinishable platform.

## Key Findings

### Recommended Stack

The stack is a standard modern Next.js application optimized for a single-user, data-heavy dashboard. SQLite is the correct database -- no concurrent writes, zero config, file-based, and more than sufficient for the data volume (50-100 funds, ~500-2000 holdings each, across 8+ quarters). Drizzle ORM provides type-safe SQL with minimal overhead, which matters for analytical queries with GROUP BY and window functions. The data ingestion layer uses the free SEC EDGAR REST API with fast-xml-parser for 13F XML documents.

**Core technologies:**
- **Next.js 16.2 + React 19:** Full-stack framework with Server Components for fast, data-heavy rendering. API routes eliminate need for separate backend.
- **SQLite (better-sqlite3) + Drizzle ORM:** Zero-config relational storage. Drizzle gives type-safe SQL without Prisma's runtime overhead. SQLite handles millions of rows for this use case.
- **TypeScript 5.7 (not 6.0 beta):** Strict typing catches data-shape bugs at compile time. 13F data has rigid structure (CUSIPs, share counts, market values).
- **Tailwind CSS 4.1 + shadcn/ui:** Utility-first styling with ownable component primitives. Standard modern approach.
- **Recharts 3.7 + TanStack Table 8.21:** Charts for portfolio composition (treemaps, bars, area) and headless tables for 100+ holding drill-downs with sorting, filtering, and virtual scrolling.
- **fast-xml-parser 5.3 + Zod 4.3:** Parse 13F XML info tables and validate transformed data before database insertion.
- **SEC EDGAR REST API (free, no key):** Direct source for 13F filings. Bulk TSV data sets for historical backfill, incremental JSON/XML for quarterly updates.

### Expected Features

**Must have (table stakes):**
- Fund holdings table with filing metadata (the atomic unit of 13F data)
- Quarter-over-quarter diff: new buys, exits, additions, reductions (this is why users look at 13F data)
- Fund directory/search by name or CIK
- Top holdings view ranked by portfolio weight
- Historical quarters (at least 8 quarters / 2 years)
- Sector/industry breakdown via CUSIP-to-sector mapping
- Filing metadata: dates, total portfolio value, position count

**Should have (differentiators -- what makes HedgeLens different):**
- Strategy group views with pre-curated groupings (Tiger Cubs, Activist, Macro, Quant, Multi-Strategy) -- no free competitor does this
- Group consensus/overlap: "7 of 12 Tiger Cubs hold NVDA" -- WhaleWisdom charges for this
- Group landing page/dashboard: the "magazine cover" entry point showing all groups with summary stats
- Conviction scoring: high weight (>5%) or added 2+ consecutive quarters
- Weight shift visualization: visual bars/arrows instead of raw numbers

**Defer (v2+):**
- Fund comparison (side-by-side) -- useful but not core to group-first design
- Position timeline sparklines -- visual polish, not essential
- Notable moves feed -- needs heuristic tuning, build after understanding actual usage patterns
- Real-time pricing, backtesting, email alerts, user accounts, AI insights, comprehensive coverage -- all explicitly anti-features

### Architecture Approach

The architecture follows a strict layered pattern: Ingestion Pipeline (EDGAR Fetcher, XML Parser, Normalizer/Loader) feeds a Storage Layer (SQLite with fund, holding, and security tables), which is queried through a Data Access Layer, processed by a pure-function Analytics Engine (diff calculator, weight engine, conviction scorer), and rendered by a three-level Presentation Layer (group overview, fund drill-down, position detail). Ingestion runs as a separate batch process (CLI or cron), never during page loads. All analytics are pure functions that take holdings arrays and return computed results -- no I/O, no side effects, easy to test.

**Major components:**
1. **Ingestion Pipeline** -- Fetches 13F filings from SEC EDGAR, parses XML, normalizes data (CUSIP resolution, amendment handling), and stores complete quarterly snapshots. Isolated from the web app; runs on demand or via cron.
2. **Analytics Engine** -- Pure functions computing QoQ diffs, portfolio weights, conviction scores, and group aggregations. No database access; receives data, returns results.
3. **Presentation Layer** -- Three-level drill-down: group overview (landing page) -> fund detail (holdings + changes) -> position detail (cross-fund ownership). Uses React Server Components for data-heavy rendering.
4. **Storage Layer** -- Snapshot-based storage (full holdings per fund per quarter, not diffs). Core entities: Fund (CIK, name, strategy group), Holding (fund+quarter+CUSIP composite key), Security (CUSIP master with ticker/sector).
5. **Config Layer** -- Fund universe and strategy group definitions as code/config. Adding a fund means adding a CIK; no code changes required.

### Critical Pitfalls

1. **Value format era mismatch (1000x error)** -- Pre-2023 filings report values in thousands; post-2023 in exact dollars. Detect by filing date (not reporting period), apply correct multiplier, and store a format flag. Test by comparing a known fund's Q4 2022 vs Q1 2023 values.
2. **Missed or mishandled amendments (13F-HR/A)** -- Restatements replace the entire filing; additive amendments add omitted holdings. Parse amendment type from cover page. Always use the latest filing for a fund+quarter. Test by ingesting a fund with known amendments.
3. **CUSIP-to-ticker mapping failures** -- CUSIPs are proprietary, change during corporate actions, and can have typos in filings. Use SEC's `company_tickers.json` as a starting point, build a curated local mapping, and accept "unmapped" CUSIPs gracefully rather than dropping them.
4. **Options mixed with equity positions** -- Options report notional value (not premium), which can dwarf equity positions and break portfolio weight calculations. Parse `putCall` and `sshPrnamt` fields; separate options from equities in the data model from day one.
5. **Incorrect QoQ diff logic** -- Match by CUSIP (never issuer name), account for stock splits (share count doubles but value unchanged), and flag possible CUSIP changes (large "exit" paired with similarly-sized "new position"). Compute weight changes (percentage of portfolio) rather than absolute value changes.
6. **Filing lag confusion in UI** -- 13F data is 45-90+ days stale. Always display "Positions as of [quarter end date]" prominently. Never label data as "current holdings." Show staleness indicators.
7. **CIK misidentification** -- One fund organization may file under multiple CIKs. Manually curate and maintain a CIK-to-fund mapping for the tracked universe rather than auto-classifying.

## Implications for Roadmap

Based on combined research, the build order is dictated by hard data dependencies: you cannot compute diffs without holdings, cannot render UI without analytics, and cannot do group analysis without individual fund data. The architecture research explicitly prescribes a three-phase build order that aligns with the feature dependency graph.

### Phase 1: Data Foundation (Ingestion Pipeline + Storage)

**Rationale:** Everything downstream depends on having correct, normalized 13F data in the database. This phase addresses the hardest problems first (data quality, format eras, amendments) when they are cheapest to fix. Architecture research says "WHY FIRST: Nothing useful can be displayed without holdings data."
**Delivers:** Working ingestion pipeline that fetches 13F filings from SEC EDGAR, parses XML, handles the pre/post-2023 value format, processes amendments correctly, separates options from equities, stores complete quarterly snapshots in SQLite, and includes a CUSIP-to-ticker mapping table.
**Addresses features:** SEC EDGAR data ingestion + 13F parser, filing metadata, historical quarters storage.
**Addresses pitfalls:** Value format era mismatch (Pitfall 1), amendment handling (Pitfall 2), CUSIP mapping (Pitfall 3), options separation (Pitfall 4), CIK identification (Pitfall 7), EDGAR rate limiting.
**Stack elements:** better-sqlite3, Drizzle ORM, fast-xml-parser, Zod, node-cron, SEC EDGAR API.

### Phase 2: Analytics Engine + Fund Configuration

**Rationale:** With data in the database, build the computation layer before any UI. Pure functions are easy to test in isolation. The diff engine is the most fundamental analytics feature and the most error-prone (Pitfall 5). Validating analytics against known reference data (WhaleWisdom, 13F.info) before building UI prevents expensive rework.
**Delivers:** QoQ diff calculator (new, exit, increased, decreased, unchanged), portfolio weight engine, conviction scorer, and strategy group aggregation functions. Also delivers the curated fund-to-strategy-group configuration (50-100 funds across 5 groups).
**Addresses features:** Quarter-over-quarter diff, top holdings view, conviction scoring (P2), strategy group curation.
**Addresses pitfalls:** Incorrect QoQ diff logic (Pitfall 5). This is the phase where diff correctness must be validated.
**Stack elements:** TypeScript pure functions, Vitest for testing, date-fns for quarter calculations.

### Phase 3: Core Dashboard UI (Group Overview + Fund Drill-Down)

**Rationale:** The UI is the most iterative layer. Building it on top of stable data and analytics makes development fast. Start with the group overview (simplest view, validates full data flow) then the fund drill-down (most complex view, the core usage loop). These two views together deliver the core value proposition: "pick a strategy group, see funds, see what changed."
**Delivers:** Group overview landing page with all strategy groups, summary stats, and top collective holdings. Fund detail page with full holdings table, QoQ diff badges (new/exit/increased/decreased), weight bars, and quarter selector.
**Addresses features:** Strategy group landing page, fund holdings table, filing metadata display, top holdings view, weight shift visualization, fund directory/search.
**Addresses pitfalls:** Filing lag confusion in UI (Pitfall 6) -- reporting period prominently displayed on every view.
**Stack elements:** Next.js 16 App Router, React Server Components, shadcn/ui, TanStack Table, Recharts, Tailwind CSS 4.1, nuqs for URL state.

### Phase 4: Advanced Analytics + Group Features

**Rationale:** With the core loop working (groups -> funds -> holdings + diffs), layer on the deeper analytical features that depend on multiple phases being complete. Group consensus requires both strategy groups and QoQ diffs. Sector breakdown requires the CUSIP mapping infrastructure from Phase 1.
**Delivers:** Group consensus/overlap analysis ("7 of 12 Tiger Cubs hold NVDA"), sector/industry breakdown charts, conviction scoring in the UI, position detail view (cross-fund ownership for a single security).
**Addresses features:** Group consensus/overlap (P2), sector/industry breakdown (P2), conviction scoring UI (P2), position detail view.
**Stack elements:** Recharts (treemaps, donut/pie for sectors), analytics grouping functions.

### Phase 5: Polish + v2 Features

**Rationale:** These features are valuable but not essential. Build them once the core product is stable and you understand actual usage patterns.
**Delivers:** Fund comparison (side-by-side), position timeline sparklines, notable moves feed, deeper historical backfill, UI refinements based on actual usage.
**Addresses features:** Fund comparison (P3), position timeline (P3), notable moves feed (P3), historical quarters deep backfill (P2).

### Phase Ordering Rationale

- **Data first, UI last:** The architecture has a strict dependency chain (ingestion -> analytics -> UI). Building data and analytics first means the UI development phase is fast and reliable because the underlying layers are stable and tested.
- **Pitfalls cluster in Phases 1-2:** Six of seven critical pitfalls are data/analytics issues. Addressing them early prevents cascading errors that would be expensive to fix after UI development.
- **Strategy groups are the differentiator:** The curated fund-to-strategy mapping is editorial work that should happen in Phase 2 alongside analytics, not deferred. It is the product's core value proposition and must be ready when the UI is built.
- **Group features build on individual fund features:** Group consensus is an aggregation of per-fund QoQ diffs. The dependency graph demands this order.
- **Defer what needs usage data:** Notable moves feed and fund comparison benefit from understanding what the user (you) actually looks at. Build the core, use it for a quarter, then add these.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Data Foundation):** The SEC EDGAR ingestion pipeline has significant complexity around XML parsing, amendment types, value format eras, and rate limiting. Recommend `/gsd:research-phase` to produce detailed parsing specifications and test fixtures from real EDGAR filings.
- **Phase 2 (Analytics Engine):** The QoQ diff logic has subtle edge cases (stock splits, CUSIP changes, corporate actions). Recommend researching specific funds with known edge cases to build a test suite.

Phases with standard patterns (skip research-phase):
- **Phase 3 (Core Dashboard UI):** Standard Next.js App Router patterns. shadcn/ui + TanStack Table + Recharts are well-documented. The architecture research provides the exact page structure and component breakdown.
- **Phase 4 (Advanced Analytics):** Set intersection/aggregation across fund holdings is straightforward once the data model is correct.
- **Phase 5 (Polish):** Standard UI features, no novel patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified against npm/official releases. Version compatibility confirmed. SEC EDGAR API documented by the SEC itself. No speculative choices. |
| Features | MEDIUM | Based on analysis of 10+ competitor products via public feature pages, not direct user interviews. Feature priorities are sound but the MVP scope (which differentiators to include at launch) may need adjustment based on actual usage. |
| Architecture | HIGH | Standard patterns for batch-ingestion + dashboard applications. Build order derived from hard data dependencies, not preferences. SEC EDGAR integration patterns are well-documented. |
| Pitfalls | HIGH | Pitfalls sourced from SEC official documentation, Harvard/Columbia Law research papers on 13F mis-filings, and real-world data quality issues documented by WhaleWisdom. The value format era change is a documented SEC amendment. |

**Overall confidence:** HIGH

### Gaps to Address

- **CUSIP-to-ticker mapping source:** The SEC's `company_tickers.json` maps CIK-to-ticker, not CUSIP-to-ticker directly. The gap between CUSIP and ticker needs a curated bridging strategy. During Phase 1 planning, research whether the SEC's 13F securities list or another free source provides adequate CUSIP-to-ticker coverage. Accept that some CUSIPs will remain unmapped at launch.
- **Stock split handling in QoQ diffs:** No free, reliable stock split data source was identified. During Phase 2 planning, evaluate whether a simple heuristic (share count doubles, value roughly unchanged) is sufficient, or whether a free API (e.g., from a stock data provider) is needed.
- **Amendment type detection:** The amendment type (restatement vs. additive) is on the 13F cover page, not the information table XML. During Phase 1, research the exact XML/SGML location of this field in EDGAR filings to confirm it can be reliably parsed.
- **Confidential treatment filings:** Some funds (notably Berkshire Hathaway) file confidential treatment requests that withhold positions. The dashboard should indicate partial disclosure. Research during Phase 1 how to detect these filings via EDGAR metadata.
- **Strategy group fund curation:** The fund-to-strategy mapping is editorial work with no algorithmic shortcut. This requires subject-matter research (which funds are "Tiger Cubs," which are "Activist," etc.). Plan for this as a research task in Phase 2, producing a curated JSON config.

## Sources

### Primary (HIGH confidence)
- [SEC EDGAR API Documentation](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) -- API endpoints, rate limits, data formats
- [SEC EDGAR Accessing Data](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data) -- User-Agent requirements, 10 req/s rate limit
- [SEC Form 13F Data Sets](https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets) -- Bulk TSV data structure, format documentation
- [SEC Form 13F FAQ](https://www.sec.gov/rules-regulations/staff-guidance/division-investment-management-frequently-asked-questions/frequently-asked-questions-about-form-13f) -- Filing requirements, deadlines, amendment types, options reporting
- [EDGAR 13F XML Technical Specification](https://www.sec.gov/edgar/filer-information/specifications/form13fxmltechspec-draft) -- XML schema and field definitions
- [Form 13F (Mis)Filings - Harvard Law](https://corpgov.law.harvard.edu/2016/08/08/form-13f-mis-filings/) -- Academic study on CUSIP errors and data quality
- Next.js 16.2, Tailwind CSS 4.1, Recharts 3.7, better-sqlite3 12.6, Drizzle ORM 0.45, TanStack Table 8.21, Zod 4.3, Vitest 4.x, TypeScript 5.7 -- all verified via npm/official releases

### Secondary (MEDIUM confidence)
- [SEC Amendments to Form 13F - Workiva](https://www.workiva.com/blog/sec-filing-updates-what-know-about-amendments-form-13f) -- January 2023 value format change documentation
- [Strategic Use of 13F Restatements - Columbia Law](https://clsbluesky.law.columbia.edu/2021/09/07/the-strategic-use-of-13f-restatements-by-hedge-funds/) -- Amendment behavior research
- [WhaleWisdom FAQ](https://whalewisdom.com/faq) -- Real-world data aggregation challenges
- Competitor analysis: WhaleWisdom, HedgeFollow, Dataroma, 13F.info, GuruFocus, TIKR, Fintel, 13Radar, HedgeMind, 13F Pro -- feature landscape and competitive positioning
- [Novus Tiger Cubs Analysis](https://www.novus.com/blog/tiger-cubs-during-covid-19) -- Strategy group aggregation example

### Tertiary (LOW confidence)
- [13Radar HN discussion](https://news.ycombinator.com/item?id=45949993) -- Limited technical detail on similar architecture
- [Do Hedge Funds Strategically Misreport? - Notre Dame](https://www3.nd.edu/~zda/Restatement.pdf) -- Academic evidence on deliberate misreporting

---
*Research completed: 2026-02-19*
*Ready for roadmap: yes*
