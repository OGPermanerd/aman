# Architecture Research

**Domain:** Hedge fund 13F portfolio analytics dashboard
**Researched:** 2026-02-19
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Presentation Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Group        │  │  Fund        │  │  Position    │              │
│  │  Overview     │  │  Drill-Down  │  │  Detail      │              │
│  │  Landing      │  │  View        │  │  View        │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                  │                      │
├─────────┴─────────────────┴──────────────────┴──────────────────────┤
│                        Analytics Engine                              │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  QoQ Diff Calculator  |  Weight Engine  |  Conviction Scorer  │  │
│  └───────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                        Data Access Layer                             │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Holdings Queries  |  Fund Metadata  |  Security Lookup       │  │
│  └───────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                        Storage Layer                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Holdings    │  │  Funds       │  │  Securities  │              │
│  │  (per qtr)   │  │  (metadata)  │  │  (master)    │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
├─────────────────────────────────────────────────────────────────────┤
│                        Ingestion Pipeline                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  EDGAR       │  │  XML         │  │  Normalizer  │              │
│  │  Fetcher     │  │  Parser      │  │  & Loader    │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SEC EDGAR (External)                              │
│  data.sec.gov/submissions  |  Archives/edgar/data  |  efts.sec.gov │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **EDGAR Fetcher** | Discovers 13F-HR filings for tracked funds via SEC EDGAR APIs. Respects 10 req/s rate limit and User-Agent requirement. | SEC EDGAR (external), XML Parser |
| **XML Parser** | Extracts holdings from 13F XML information tables. Handles the standard post-2013 XML schema (nameOfIssuer, cusip, value, shrsOrPrnAmt, etc.). | EDGAR Fetcher, Normalizer |
| **Normalizer & Loader** | Resolves CUSIPs to tickers/names, deduplicates amended filings (13F/A), and writes clean records to storage. | XML Parser, Storage Layer, Security Master |
| **Storage Layer** | Persists fund metadata, per-quarter holdings snapshots, and security reference data. | Data Access Layer, Normalizer |
| **Data Access Layer** | Provides query interface for holdings by fund, quarter, strategy group. Joins across tables. | Storage Layer, Analytics Engine |
| **Analytics Engine** | Computes QoQ diffs (new positions, exits, weight shifts), portfolio weights, conviction scores. Pure calculation, no I/O. | Data Access Layer, Presentation Layer |
| **Presentation Layer** | Renders group overview, fund drill-down, and position detail views. Calls analytics engine for computed data. | Analytics Engine, User |

## Recommended Project Structure

```
src/
├── ingestion/              # EDGAR data pipeline
│   ├── edgar-client.ts     # SEC EDGAR API wrapper (rate-limited)
│   ├── xml-parser.ts       # 13F XML information table parser
│   ├── normalizer.ts       # CUSIP resolution, amendment handling
│   └── pipeline.ts         # Orchestrates fetch -> parse -> normalize -> store
├── data/                   # Storage and data access
│   ├── schema.ts           # Database schema definitions
│   ├── db.ts               # Database connection and setup
│   └── queries.ts          # Named query functions (holdings by fund, by quarter, etc.)
├── analytics/              # Pure computation, no I/O
│   ├── diff.ts             # QoQ position diff (new, exit, changed)
│   ├── weights.ts          # Portfolio weight calculation
│   ├── conviction.ts       # Conviction scoring (weight * change direction)
│   └── grouping.ts         # Strategy group aggregation
├── config/                 # Fund universe and strategy definitions
│   ├── funds.ts            # Tracked fund CIKs, names, strategy tags
│   └── strategy-groups.ts  # Tiger Cubs, Activist, Macro, Quant, Multi-Strategy
├── server/                 # API routes (if using server-rendered or API pattern)
│   └── routes.ts           # Endpoint handlers
└── ui/                     # Dashboard views
    ├── pages/              # Route-level page components
    │   ├── group-overview/  # Landing page: all strategy groups
    │   ├── fund-detail/     # Single fund drill-down
    │   └── position-detail/ # Single position across funds
    ├── components/          # Shared UI components
    │   ├── holdings-table/  # Sortable holdings table
    │   ├── diff-badge/      # New/Exit/Increased/Decreased indicators
    │   ├── weight-bar/      # Portfolio weight visualization
    │   └── quarter-picker/  # Quarter selection control
    └── layouts/             # Page layout shells
```

### Structure Rationale

- **ingestion/:** Isolated from the rest of the app. Runs as a separate operation (CLI command or scheduled job), not during page requests. This is the only module that touches SEC EDGAR.
- **analytics/:** Pure functions with no side effects. Takes holdings data in, returns computed results. Easy to test, easy to change calculation logic without touching data or UI.
- **config/:** The fund universe (which CIKs to track, what strategy group each belongs to) is configuration, not code. Changing tracked funds should not require modifying business logic.
- **data/:** Single source of truth for all database interactions. UI and analytics never talk to the database directly.
- **ui/:** Standard page-based structure. Three levels of drill-down map to three page folders.

## Architectural Patterns

### Pattern 1: Snapshot-Based Storage (not Diff-Based)

**What:** Store the full holdings snapshot for each fund-quarter pair rather than storing diffs/deltas between quarters.
**When to use:** Always, for this type of application.
**Trade-offs:** Uses more storage space (each quarter is a complete snapshot), but makes queries dramatically simpler. Computing "what did Fund X hold in Q3 2025?" is a single table scan, not a chain of diffs. QoQ comparisons are computed at read time by joining two snapshots.

**Example:**
```typescript
// Each row = one holding for one fund in one quarter
interface HoldingRecord {
  fundCik: string;
  quarter: string;        // "2025Q3"
  cusip: string;
  issuerName: string;
  titleOfClass: string;
  value: number;          // market value in thousands
  shares: number;
  type: 'SH' | 'PRN';    // shares vs principal
  investmentDiscretion: 'SOLE' | 'DEFINED' | 'OTHER';
}

// QoQ diff computed at read time
function computeDiff(current: HoldingRecord[], previous: HoldingRecord[]) {
  const prevMap = new Map(previous.map(h => [h.cusip, h]));
  const currMap = new Map(current.map(h => [h.cusip, h]));

  return {
    newPositions: current.filter(h => !prevMap.has(h.cusip)),
    exits: previous.filter(h => !currMap.has(h.cusip)),
    increased: current.filter(h => {
      const prev = prevMap.get(h.cusip);
      return prev && h.shares > prev.shares;
    }),
    decreased: current.filter(h => {
      const prev = prevMap.get(h.cusip);
      return prev && h.shares < prev.shares;
    }),
  };
}
```

### Pattern 2: Rate-Limited EDGAR Client with Request Queue

**What:** Wrap all SEC EDGAR HTTP calls in a client that enforces the 10 requests/second limit with a queue. Never allow burst requests.
**When to use:** Every EDGAR interaction. The SEC will block your IP if you exceed limits.
**Trade-offs:** Slower ingestion, but mandatory. A full ingestion run for ~50 funds across 1 quarter takes roughly 5-10 seconds of EDGAR requests (each fund needs 2-3 requests: submissions lookup, filing index, XML document).

**Example:**
```typescript
class EdgarClient {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly MIN_INTERVAL_MS = 100; // 10 req/s

  private headers = {
    'User-Agent': 'HedgeLens admin@example.com', // SEC requires this
    'Accept': 'application/json',
  };

  async fetch(url: string): Promise<Response> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        const elapsed = Date.now() - this.lastRequestTime;
        if (elapsed < this.MIN_INTERVAL_MS) {
          await sleep(this.MIN_INTERVAL_MS - elapsed);
        }
        this.lastRequestTime = Date.now();
        try {
          resolve(await fetch(url, { headers: this.headers }));
        } catch (e) {
          reject(e);
        }
      });
      this.processQueue();
    });
  }
}
```

### Pattern 3: Derived Analytics as Pure Functions

**What:** All analytics (weight calculation, QoQ diffs, conviction scoring) are pure functions that take holdings arrays and return computed results. No database calls, no side effects.
**When to use:** All computation in the analytics layer.
**Trade-offs:** Requires loading holdings data into memory before computing. For ~50 funds with ~50-500 holdings each, this is a few MB at most -- trivially fits in memory. The benefit is testability and clarity.

## Data Flow

### Ingestion Flow (Runs Periodically or On-Demand)

```
[Trigger: CLI command or cron]
    │
    ▼
[Read fund config] → list of {cik, name, strategyGroup}
    │
    ▼ (for each fund)
[EDGAR Fetcher]
    │  GET data.sec.gov/submissions/CIK{cik}.json
    │  → find most recent 13F-HR filing accession number
    │  GET sec.gov/Archives/edgar/data/{cik}/{accession}/index.json
    │  → find XML information table filename
    │  GET sec.gov/Archives/edgar/data/{cik}/{accession}/{filename}
    │  → raw XML
    │
    ▼
[XML Parser]
    │  Parse <informationTable> → array of holdings
    │  Extract: nameOfIssuer, cusip, value, shrsOrPrnAmt, etc.
    │
    ▼
[Normalizer]
    │  Resolve CUSIP → ticker (via local mapping or SEC company_tickers.json)
    │  Handle 13F/A amendments (replace prior filing for same quarter)
    │  Validate data (drop malformed rows, log warnings)
    │
    ▼
[Loader]
    │  Upsert holdings snapshot into database
    │  Key: (fundCik, quarter, cusip)
    │
    ▼
[Database] ← holdings stored per fund per quarter
```

### Dashboard Request Flow (Serves Pages)

```
[User visits /groups]
    │
    ▼
[Group Overview Page]
    │  Query: all funds grouped by strategy
    │  For each group: count of funds, aggregate stats
    │
    ▼
[User clicks "Tiger Cubs"]
    │
    ▼
[Fund Drill-Down Page]
    │  Query: holdings for all Tiger Cub funds, current + previous quarter
    │  Analytics: computeDiff(), computeWeights()
    │  Display: table of holdings with New/Exit/+/-/Unchanged badges
    │
    ▼
[User clicks specific fund, e.g., "Coatue Management"]
    │
    ▼
[Fund Detail Page]
    │  Query: holdings for this fund, current + previous quarter
    │  Analytics: computeDiff(), computeWeights(), convictionScore()
    │  Display: full holdings table, weight chart, conviction ranking
    │
    ▼
[User clicks specific position, e.g., "AAPL"]
    │
    ▼
[Position Detail View]
    │  Query: all funds holding this CUSIP, current + previous quarter
    │  Analytics: who added, who exited, who increased/decreased
    │  Display: cross-fund ownership table for this security
```

### Key Data Flows

1. **EDGAR to Database (ingestion):** EDGAR APIs return JSON metadata and XML holdings documents. The pipeline fetches, parses, normalizes, and stores complete quarterly snapshots. This is a batch operation, not real-time.
2. **Database to UI (serving):** The dashboard queries stored holdings snapshots, feeds them through the analytics engine (pure functions), and renders the results. No EDGAR calls happen during page loads.
3. **Configuration to Pipeline (fund universe):** Which funds to track and their strategy group assignments come from a config file. Adding a new fund means adding a CIK to config, then re-running ingestion.

## Data Model

### Core Entities

```
┌──────────────┐       ┌───────────────────┐       ┌──────────────┐
│   Fund       │       │   Holding         │       │   Security   │
├──────────────┤       ├───────────────────┤       ├──────────────┤
│ cik (PK)     │──┐    │ fundCik (FK)      │    ┌──│ cusip (PK)   │
│ name         │  │    │ quarter           │    │  │ ticker       │
│ strategyGroup│  └───>│ cusip (FK)        │<───┘  │ issuerName   │
│ active       │       │ value             │       │ sector       │
└──────────────┘       │ shares            │       └──────────────┘
                       │ type (SH/PRN)     │
                       │ investDiscretion   │
                       │ PK: (fundCik,      │
                       │  quarter, cusip)   │
                       └───────────────────┘
```

### Strategy Groups (Configuration, Not Database)

```typescript
const STRATEGY_GROUPS = {
  'tiger-cubs': {
    label: 'Tiger Cubs',
    description: 'Descendants of Julian Robertson\'s Tiger Management',
    funds: [
      { cik: '0001167483', name: 'Coatue Management' },
      { cik: '0001006438', name: 'Lone Pine Capital' },
      { cik: '0001103804', name: 'Viking Global Investors' },
      // ...
    ],
  },
  'activist': {
    label: 'Activist',
    description: 'Funds that take active roles in influencing companies',
    funds: [
      { cik: '0001336528', name: 'Pershing Square Capital' },
      { cik: '0001159159', name: 'Elliott Investment Management' },
      // ...
    ],
  },
  // macro, quant, multi-strategy...
};
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **data.sec.gov/submissions** | REST GET, JSON response | Company filing history. CIK must be zero-padded to 10 digits. No auth required. Rate limit: 10 req/s. User-Agent header with contact email is mandatory. |
| **sec.gov/Archives/edgar/data** | REST GET, XML/JSON responses | Filing index and actual 13F XML documents. Same rate limits apply. URL pattern: `/Archives/edgar/data/{cik}/{accession-no-dashes}/{filename}`. |
| **efts.sec.gov/LATEST/search-index** | REST GET, JSON response | Full-text search across all EDGAR filings. Useful for discovery but not needed for routine ingestion if you know fund CIKs. |
| **sec.gov/files/company_tickers.json** | REST GET, JSON response | Maps ticker symbols to CIK numbers. Useful for building a basic CUSIP-to-ticker lookup. Updated frequently. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Ingestion Pipeline <-> Storage | Direct database writes via data access layer | Pipeline runs independently of the web server. Could be a separate process. |
| Analytics Engine <-> Storage | Data access layer provides holdings arrays to analytics functions | Analytics functions are pure -- they receive data, return computed results. No direct DB access. |
| UI <-> Analytics Engine | Function calls or API routes | If server-rendered: direct function calls during page render. If SPA with API: JSON API routes that call analytics functions. |
| Config <-> Ingestion | Import/read at pipeline start | Fund universe is read once when ingestion starts. No dynamic config changes during a run. |

## Anti-Patterns

### Anti-Pattern 1: Fetching from EDGAR on Every Page Load

**What people do:** Call SEC EDGAR APIs when a user views a dashboard page, treating EDGAR as a live data source.
**Why it's wrong:** 13F data updates quarterly (45 days after quarter end). Hitting EDGAR on every page load wastes requests against the rate limit, adds latency (EDGAR responses are not fast), and risks IP blocking. The data does not change between ingestion runs.
**Do this instead:** Run ingestion as a separate batch process (on-demand or scheduled). Serve dashboard pages entirely from local storage. Zero EDGAR calls during page rendering.

### Anti-Pattern 2: Storing Diffs Instead of Snapshots

**What people do:** Store only the changes between quarters (added positions, removed positions, share count changes) to save space.
**Why it's wrong:** Makes it impossible to answer "what was the complete portfolio in quarter X?" without replaying all diffs from the beginning. Corrupted or missing diffs break the entire chain. For a personal dashboard with ~50 funds, storage is trivially cheap.
**Do this instead:** Store complete snapshots per fund per quarter. Compute diffs at read time. Storage cost is negligible (a few MB per quarter for 50 funds).

### Anti-Pattern 3: Ignoring 13F/A (Amended Filings)

**What people do:** Only process the first 13F-HR filing found for a fund in a quarter, ignoring subsequent amendments.
**Why it's wrong:** Funds frequently file amendments (13F/A) that correct errors or add missing positions. The amendment supersedes the original filing.
**Do this instead:** During ingestion, check for both 13F-HR and 13F-HR/A form types. If an amendment exists for the same quarter, use the amendment. The submissions API lists filings chronologically, so the latest 13F-HR or 13F-HR/A for a given reporting period is the authoritative one.

### Anti-Pattern 4: Treating CUSIP as a Stable Identifier Across Time

**What people do:** Assume a CUSIP always maps to the same company/security.
**Why it's wrong:** CUSIPs can be reassigned after mergers, acquisitions, or delistings. A CUSIP from 2020 may refer to a different security than the same CUSIP in 2025.
**Do this instead:** Build a simple security master table that maps CUSIP + effective date range to issuer/ticker. For a personal dashboard, a simpler approach is to use the issuerName from the 13F filing itself and only use CUSIP for cross-fund matching within the same quarter.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single user (HedgeLens target) | SQLite database, no caching layer, ingestion runs as CLI command. Everything runs on one machine. This is the correct approach for this project. |
| Multi-user, small team | Move to PostgreSQL, add simple API caching with HTTP cache headers. Ingestion remains a batch job. |
| Public service, many users | Add Redis caching, precompute analytics results after ingestion, serve from CDN. Consider background workers for ingestion. |

### Scaling Priorities

1. **First bottleneck:** EDGAR rate limiting (10 req/s). If tracking 100+ funds, a single ingestion run takes minutes. Solution: queue requests, parallelize within rate limit, cache EDGAR responses locally.
2. **Second bottleneck:** Analytics computation for large fund universes. If expanding to hundreds of funds, precompute QoQ diffs after ingestion rather than on page load. For HedgeLens (~50 funds), this is not a concern.

## Build Order (Dependencies Between Components)

The architecture has clear dependency chains that dictate build order:

```
Phase 1: Ingestion Pipeline (no dependencies)
   EDGAR Fetcher → XML Parser → Normalizer → Storage Schema
   WHY FIRST: Everything downstream depends on having data in the database.
   Nothing useful can be displayed without holdings data.

Phase 2: Data Access + Analytics Engine (depends on Phase 1)
   Query functions → Diff calculator → Weight engine → Conviction scorer
   WHY SECOND: The UI needs computed results, not raw holdings rows.
   Building analytics before UI lets you validate computations independently.

Phase 3: Dashboard UI (depends on Phase 1 + 2)
   Group overview → Fund drill-down → Position detail
   WHY LAST: UI is the most iterative layer. Having stable data and
   analytics underneath makes UI development fast and reliable.
```

**Within each phase, build in this order:**
- Phase 1: Schema first, then fetcher, then parser, then normalizer, then loader. Each step's output feeds the next.
- Phase 2: Diff calculator first (most fundamental), then weights, then conviction scoring. Group aggregation comes last since it composes the others.
- Phase 3: Group overview first (simplest view, validates data flow), then fund drill-down (most complex view), then position detail (cross-fund view).

## Sources

- SEC EDGAR API documentation: https://www.sec.gov/search-filings/edgar-application-programming-interfaces (HIGH confidence)
- SEC Form 13F data set specification: https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets (HIGH confidence)
- SEC EDGAR rate limits and fair access policy: https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data (HIGH confidence)
- SEC EDGAR submissions API at data.sec.gov: https://www.sec.gov/about/developer-resources (HIGH confidence)
- SEC Form 13F FAQ: https://www.sec.gov/rules-regulations/staff-guidance/division-investment-management-frequently-asked-questions/frequently-asked-questions-about-form-13f (HIGH confidence)
- 13F XML schema specification: https://www.sec.gov/submit-filings/filer-support-resources/how-do-i-guides/create-xml-information-table-form-13f-using-excel (HIGH confidence)
- EDGAR 13F data parsing methodology: https://elsaifym.github.io/EDGAR-Parsing/ (MEDIUM confidence)
- 13Radar HN discussion (architecture patterns): https://news.ycombinator.com/item?id=45949993 (LOW confidence -- limited technical detail)
- WhalWisdom, HedgeMind, HedgeFollow, 13f.info as reference implementations of similar dashboards (MEDIUM confidence -- external observation only)

---
*Architecture research for: HedgeLens -- hedge fund 13F portfolio analytics dashboard*
*Researched: 2026-02-19*
