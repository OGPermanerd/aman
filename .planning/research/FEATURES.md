# Feature Research

**Domain:** Hedge fund 13F portfolio analytics dashboard
**Researched:** 2026-02-19
**Confidence:** MEDIUM — based on analysis of 10+ competitor products via public feature pages and reviews; no direct user interviews

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Fund holdings table** — list all positions for a fund in a given quarter with share count, market value, and portfolio weight % | Every competitor shows this (WhaleWisdom, HedgeFollow, TIKR, Dataroma, GuruFocus, 13F.info). It is the atomic unit of 13F data. | LOW | Core data model: fund -> quarter -> holdings. Requires SEC EDGAR XML/CSV parsing. |
| **Quarter-over-quarter diff** — flag new buys, exits (sold out), additions, reductions, and unchanged positions per fund | WhaleWisdom, 13Radar, GuruFocus, Fintel, HedgeFollow all show this. Users come specifically to see *what changed*. | MEDIUM | Requires storing at least two consecutive quarters and computing diffs. Need to handle CUSIP changes, stock splits, corporate actions. |
| **Fund directory / search** — browse or search for a specific fund by name or CIK number | Every platform provides this as the entry point. Users arrive looking for a specific manager. | LOW | Index of all 13F filers from SEC EDGAR. HedgeLens scopes to curated groups, which simplifies this. |
| **Position detail** — for a given holding, show share count, market value, % of portfolio, and quarter-over-quarter change in shares | Standard on every competitor. The minimum useful information per position. | LOW | Derived directly from parsed 13F filing data. |
| **Historical quarters** — view a fund's holdings across multiple past quarters, not just the latest | WhaleWisdom (back to 2001), GuruFocus (back to 2008), Dataroma (back to 2013). Users expect at least 4-8 quarters to see trends. | MEDIUM | Storage scales linearly with quarters. Need a data backfill strategy. Start with last 2 years (8 quarters). |
| **Sector/industry breakdown** — pie chart or bar chart of portfolio allocation by sector | 13F Pro, WhaleWisdom, and most competitors show sector allocation. Users expect to see where a fund is concentrated. | MEDIUM | 13F data has CUSIPs, not sectors. Requires mapping CUSIP -> ticker -> sector via a reference dataset (e.g., SEC ticker list + SIC codes or a free API). |
| **Top holdings view** — show top 10 or top 20 positions ranked by portfolio weight | Dataroma, GuruFocus, HedgeMind, TIKR all lead with top holdings. Quick way to see a fund's highest-conviction bets. | LOW | Sort holdings by weight, take top N. Trivial once holdings data exists. |
| **Filing metadata** — show filing date, reporting period, total portfolio value, number of positions | Basic metadata that contextualizes everything else. Every platform shows this. | LOW | Parsed directly from 13F filing header. |

### Differentiators (Competitive Advantage)

Features that set HedgeLens apart. Not required, but valuable. Ordered by alignment with HedgeLens's core concept.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Strategy group views** — pre-curated groupings (Tiger Cubs, Activist, Macro, Quant, Multi-Strategy) with group-level portfolio aggregation | **Core differentiator for HedgeLens.** No free competitor groups funds by investment strategy. WhaleWisdom has custom fund groups but behind paywall and user-created. HedgeLens ships with opinionated, editorially curated groups. | MEDIUM | Requires a curated mapping of fund CIK -> strategy group. The curation is the moat, not the code. Group-level aggregation (consensus picks, overlap, shared exits) adds analytical value. |
| **Group consensus / overlap** — across all funds in a strategy group, show which stocks appear most frequently, which are being collectively bought or sold | WhaleWisdom has "consensus picks" as a premium feature. Novus does this for Tiger Cubs specifically. Showing "7 of 12 Tiger Cubs hold NVDA" is immediately legible and actionable. | MEDIUM | For each group, intersect holdings across member funds. Count frequency, weight, and direction of change. Depends on: strategy group views + Q/Q diff. |
| **Conviction scoring** — highlight positions where a fund has high portfolio weight (>5%) or has been adding for 2+ consecutive quarters | WhaleWisdom's "WhaleScore" is a paid feature. Conviction is the signal users actually want from 13F data. A simple heuristic (weight > X% OR added N quarters in a row) is powerful. | LOW | Derived metric from existing holdings + historical data. No external data needed. Depends on: historical quarters. |
| **Weight shift visualization** — show portfolio weight change as a visual (bar or arrow) rather than just numbers, making it scannable which positions grew or shrank | Most competitors show tables of numbers. A visual weight-shift indicator (green bar growing, red bar shrinking) makes Q/Q changes instantly scannable without reading numbers. | LOW | Frontend-only. Small horizontal bar or arrow in the holdings table. No new data needed. |
| **Group landing page / dashboard** — overview page showing all strategy groups with summary stats (# funds, total AUM, top collective holdings, notable moves this quarter) | No free competitor has this view. Most start with a search box or alphabetical fund list. A curated overview is the "magazine cover" that makes HedgeLens feel opinionated rather than like a database. | MEDIUM | Aggregation across groups. Depends on: strategy groups + Q/Q diff + group consensus. |
| **Notable moves feed** — a chronological or ranked list of the most significant portfolio changes across tracked funds (large new positions, complete exits, major weight shifts) | HedgeFollow's "Hedge Fund Tracker" and Fintel's "Latest 13F Filings" show raw activity. A curated "notable moves" feed filtered to meaningful changes (not noise) is more useful. | MEDIUM | Heuristic filtering: new positions > X% weight, exits from top-20, weight changes > Y%. Depends on: Q/Q diff + conviction scoring. |
| **Fund comparison** — side-by-side view of two funds' holdings showing overlap, unique positions, and divergent bets | WhaleWisdom has "combined holdings report" as a Pro feature. HedgeMind has "Compare Portfolios" as premium. Useful for seeing how two Tiger Cubs differ. | MEDIUM | Set intersection/difference on two funds' holdings for a given quarter. Depends on: fund holdings table. |
| **Position timeline** — for a specific stock held by a fund, show share count and weight across all available quarters as a mini chart | GuruFocus and WhaleWisdom show historical position data in tables. A sparkline or mini area chart makes the trajectory instantly visible. | MEDIUM | Requires querying a single stock across all quarters for a fund. Frontend charting component. Depends on: historical quarters. |

### Anti-Features (Commonly Requested, Often Problematic)

Features to explicitly NOT build for HedgeLens.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time price data / live portfolio valuation** | Users want to see "what's the portfolio worth now?" | Requires a real-time price feed (API costs, rate limits, complexity). 13F data is inherently 45-90 days stale. Adding live prices creates a false sense of recency and misframes a quarterly snapshot tool as a live tracker. | Show the reported market value as of the filing date. Clearly label the reporting period. The value of HedgeLens is the *changes*, not the current price. |
| **Portfolio backtesting / clone performance** | WhaleWisdom's backtester is a headline feature. Users want to know "what if I copied this fund?" | Backtesting requires historical price data, dividend adjustments, rebalancing logic, and benchmarking infrastructure. It is an entire product category unto itself (WhaleWisdom charges for it). Massive scope for a personal dashboard. | Link to WhaleWisdom's backtester for users who want this. HedgeLens shows *what* funds hold, not *how to trade*. |
| **User accounts / auth / saved watchlists** | Users want to save favorites and get personalized views. | Project scope says single user, no auth. Adding auth means session management, password reset, database for user state, GDPR/privacy concerns. Massive complexity increase. | Use browser localStorage for any personalization (collapsed groups, last-viewed quarter). Keep it zero-auth. |
| **Email/push alerts on new filings** | WhaleWisdom and HedgeFollow offer free email alerts. Users want to know the moment a filing drops. | Requires a background job that polls SEC EDGAR, a notification service, email infrastructure (or push), and subscription management. Operational burden for a personal project. | Show "last updated" and "days since quarter end" prominently. User can bookmark and check manually. 13F deadlines are predictable (45 days after quarter end). |
| **Options / short position analysis** | Some 13F filings include options positions. Users want the full picture. | 13F only reports long equity options in a limited format. Short positions, bonds, and foreign equities are NOT reported. Building options analysis on incomplete data is misleading. Short data won't be available via Form SHO until Feb 2028. | Clearly note 13F limitations in a visible disclaimer. Focus on long equity positions, which is what 13F data actually captures well. |
| **AI-powered insights / natural language analysis** | Trendy feature; GitHub projects are adding "AI-powered insights." | Adds LLM API dependency, cost, latency, and unpredictable output quality. The insights from 13F data are structural (diffs, concentrations, overlaps) — they don't need generative AI. | Build clear, well-designed visualizations that make the insights self-evident. A good table with color-coded diffs IS the insight. |
| **Comprehensive fund coverage (all 10,000+ 13F filers)** | Competitors cover every filer. Users may search for obscure funds. | HedgeLens's value proposition is curated strategy groups, not exhaustive coverage. Ingesting all filers means massive data volume, noisy results, and losing the editorial point of view. | Cover 50-100 hand-picked funds across 5-6 strategy groups. Quality over quantity. Let WhaleWisdom be the comprehensive database. |
| **API / data export / Excel integration** | Power users want raw data access. WhaleWisdom has API and Excel add-in. | Building and maintaining a public API is significant engineering overhead (rate limiting, documentation, versioning, auth). Overkill for a personal dashboard. | If needed later, expose a simple JSON endpoint per fund per quarter. But don't build API infrastructure upfront. |

## Feature Dependencies

```
[SEC EDGAR Data Ingestion]
    ├──requires──> [13F XML/CSV Parser]
    │                  └──produces──> [Fund Holdings Table] (table stakes)
    │                                     ├──requires──> [Filing Metadata] (table stakes)
    │                                     ├──enables──> [Top Holdings View] (table stakes)
    │                                     └──enables──> [Fund Comparison] (differentiator)
    │
    └──across quarters──> [Historical Quarters Store] (table stakes)
                              ├──enables──> [Q/Q Diff Engine] (table stakes)
                              │                 ├──enables──> [Conviction Scoring] (differentiator)
                              │                 ├──enables──> [Weight Shift Visualization] (differentiator)
                              │                 └──enables──> [Notable Moves Feed] (differentiator)
                              │
                              └──enables──> [Position Timeline] (differentiator)

[CUSIP-to-Sector Mapping]
    └──enables──> [Sector/Industry Breakdown] (table stakes)

[Strategy Group Curation] (manual editorial work)
    └──enables──> [Strategy Group Views] (differentiator)
                      ├──enables──> [Group Consensus / Overlap] (differentiator)
                      └──enables──> [Group Landing Page / Dashboard] (differentiator)
                                        └──depends on──> [Q/Q Diff Engine] + [Group Consensus]
```

### Dependency Notes

- **Q/Q Diff Engine requires Historical Quarters Store:** You cannot compute changes without at least two quarters of data. This means the data pipeline must backfill before the diff feature works.
- **Sector Breakdown requires CUSIP-to-Sector Mapping:** 13F filings contain CUSIPs, not sector labels. An external reference dataset is needed. SEC provides a company ticker/CIK/SIC mapping file that can be used.
- **Strategy Group Views require manual curation:** The fund-to-strategy mapping is editorial, not algorithmic. This is a one-time research task (~50-100 funds) but must be done before group features work.
- **Group Landing Page depends on multiple features:** It aggregates group consensus + Q/Q diffs + strategy metadata. It should be built last among the differentiators.
- **Conviction Scoring and Notable Moves both depend on Q/Q Diff Engine:** Build the diff engine well, and both of these become straightforward derivations.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept and feel like a real tool.

- [ ] **SEC EDGAR data ingestion + 13F parser** — foundational; nothing works without this
- [ ] **Fund holdings table with filing metadata** — the atomic view; show one fund, one quarter
- [ ] **Quarter-over-quarter diff (new/exit/add/reduce)** — this is *why* people look at 13F data
- [ ] **Strategy group curation (static mapping)** — the core HedgeLens differentiator; start with 5 groups, ~50 funds
- [ ] **Strategy group landing page** — the entry point; overview of all groups with top holdings and notable moves
- [ ] **Top holdings view** — trivial once holdings exist; high value per line of code

### Add After Validation (v1.x)

Features to add once the core data pipeline and UI are working.

- [ ] **Sector/industry breakdown** — add when CUSIP-to-sector mapping is resolved
- [ ] **Group consensus / overlap analysis** — add once group views are validated as useful
- [ ] **Conviction scoring** — add once 3+ quarters of historical data are loaded
- [ ] **Weight shift visualization** — add when the holdings table feels too number-heavy
- [ ] **Historical quarters (8+)** — backfill more data once the pipeline is stable

### Future Consideration (v2+)

Features to defer until the core product is solid.

- [ ] **Fund comparison (side-by-side)** — useful but not core to the group-first design
- [ ] **Position timeline (sparklines)** — nice visual polish; requires charting library
- [ ] **Notable moves feed** — requires tuning heuristics to avoid noise; build after understanding what users (you) actually look at

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| SEC EDGAR ingestion + parser | HIGH | HIGH | P1 |
| Fund holdings table | HIGH | LOW | P1 |
| Q/Q diff (new/exit/add/reduce) | HIGH | MEDIUM | P1 |
| Strategy group curation | HIGH | LOW (editorial) | P1 |
| Strategy group landing page | HIGH | MEDIUM | P1 |
| Top holdings view | MEDIUM | LOW | P1 |
| Filing metadata display | MEDIUM | LOW | P1 |
| Sector/industry breakdown | MEDIUM | MEDIUM | P2 |
| Group consensus / overlap | HIGH | MEDIUM | P2 |
| Conviction scoring | MEDIUM | LOW | P2 |
| Weight shift visualization | MEDIUM | LOW | P2 |
| Historical quarters (deep backfill) | MEDIUM | MEDIUM | P2 |
| Fund comparison | MEDIUM | MEDIUM | P3 |
| Position timeline | LOW | MEDIUM | P3 |
| Notable moves feed | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch — the core loop of "pick a strategy group, see funds, see changes"
- P2: Should have, add when possible — enhances the analytical depth
- P3: Nice to have, future consideration — polish and power-user features

## Competitor Feature Analysis

| Feature | WhaleWisdom | HedgeFollow | Dataroma | 13F.info | GuruFocus | TIKR | HedgeLens Approach |
|---------|-------------|-------------|----------|----------|-----------|------|--------------------|
| Fund holdings table | Yes (all filers) | Yes (all filers) | Yes (82 curated) | Yes (all filers) | Yes (4500+) | Yes (10000+) | Yes (50-100 curated by strategy) |
| Q/Q diff | Yes | Yes (merged filings) | Yes (activity column) | Yes (compare tool) | Yes (buy/sell/add/reduce) | Yes | Yes — core feature, color-coded |
| Strategy grouping | No (user-created groups, paid) | No | No (value investors only) | No | No | No | **Yes — editorial, pre-curated groups. Key differentiator.** |
| Group consensus | Paid (consensus picks) | No | "Most owned" view | No | No | No | **Yes — per strategy group** |
| Sector breakdown | Yes | Limited | No | No | Yes | Yes | Yes (P2) |
| Backtesting | Yes (paid) | No | No | No | No | No | **No — anti-feature** |
| Email alerts | Yes (free) | No | No | No | Yes | No | **No — anti-feature** |
| Fund comparison | Yes (Pro) | No | No | Yes | No | No | Yes (P3) |
| Historical data | 2001+ (paid) | Limited | 2013+ | 2013+ | 2008+ | Recent quarters | Last 2 years initially |
| Price: Free tier | 2 years, 5 funds | Free | Free | Free | Limited free | Limited free | **Fully free, single-user** |
| Conviction metrics | WhaleScore (paid) | Star ratings | No | No | No | No | Yes — simple heuristic (P2) |

## Sources

- [WhaleWisdom features](https://whalewisdom.com/info/features) — comprehensive 13F analytics platform, pricing at $90-500/yr
- [WhaleWisdom pricing and review](https://bullishbears.com/whalewisdom-review/) — free tier limitations, feature comparison
- [HedgeFollow](https://hedgefollow.com/) — free 13F tracker with merged filing types and fund ratings
- [Dataroma](https://dataroma.com/) — free, curated to 82 superinvestors, simple activity views
- [13F.info](https://13f.info/) — open source, cross-quarter comparison, minimal UI
- [GuruFocus guru portfolios](https://www.gurufocus.com/guru/portfolio) — 4500+ funds, quarterly buy/sell classification
- [TIKR blog on 13F tracking](https://www.tikr.com/blog/7-best-free-websites-to-track-hedge-fund-portfolios) — integration with financial analysis tools
- [Fintel institutional ownership](https://fintel.io/institutional-ownership-data) — Fund Sentiment Score, accumulation tracking
- [13Radar](https://www.13radar.com/) — curated guru list, consensus tracking, stock splits adjustment
- [HedgeMind](https://hedgemind.com/13f-filing-dashboard) — 1000+ curated hedge funds, $299/yr premium
- [Unusual Whales institutions](https://unusualwhales.com/institutions) — institutional portfolio tracking with options data
- [13F Pro](https://www.13fpro.com/) — sector allocation and concentration analysis
- [FundFollower](https://www.fundfollower.co/) — merged filings, error correction, custom trackers
- [SEC 13F FAQ](https://www.sec.gov/rules-regulations/staff-guidance/division-investment-management-frequently-asked-questions/frequently-asked-questions-about-form-13f) — official limitations (no shorts, no bonds, no foreign equities)
- [Dakota comparison: WhaleWisdom vs Opportunity Hunter vs SEC-API](https://www.dakota.com/resources/blog/whalewisdom-opportunity-hunter-sec-api-which-is-right-for-you) — platform positioning comparison
- [WhaleWisdom backtesting whitepaper](https://whalewisdom.com/whitepapers/backtesting) — clone portfolio methodology
- [Novus Tiger Cubs analysis](https://www.novus.com/blog/tiger-cubs-during-covid-19) — strategy group aggregation example

---
*Feature research for: Hedge fund 13F portfolio analytics dashboard (HedgeLens)*
*Researched: 2026-02-19*
