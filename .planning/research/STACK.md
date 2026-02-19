# Stack Research

**Domain:** Hedge Fund 13F Portfolio Analytics Dashboard
**Researched:** 2026-02-19
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.2.x | Full-stack React framework | Server-side rendering for fast initial loads, API routes for SEC EDGAR data fetching, App Router for layouts/drill-downs. The standard React meta-framework in 2026. Turbopack for fast dev builds. Single binary deployment. |
| TypeScript | 5.7.x (stable) | Type safety | 13F data has strict structure (CUSIPs, share counts, market values). TypeScript catches data-shape bugs at compile time. Use 5.7 stable, not 6.0 beta -- too new for production. |
| React | 19.x | UI library | Ships with Next.js 16. Server Components reduce client bundle for data-heavy dashboard views. |
| Tailwind CSS | 4.1.x | Utility-first styling | CSS-first config (no tailwind.config.js), automatic content detection, 5x faster builds vs v3. Standard pairing with shadcn/ui. |
| SQLite (via better-sqlite3) | better-sqlite3 12.6.x | Local database | Single-user dashboard with no concurrent writes. Zero-config, file-based, no server process. 13F data is structured and relational (filings, holdings, funds). SQLite handles millions of rows for this use case. PostgreSQL would be overkill. |
| Drizzle ORM | 0.45.x | Database access layer | Type-safe SQL with zero runtime overhead (~7.4kb). SQLite-first support. Schema-as-code generates migrations. Lighter than Prisma, closer to raw SQL for query control. |

### Data Ingestion

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| SEC EDGAR REST API (data.sec.gov) | N/A | 13F filing source | Free, no API key required. JSON submissions endpoint at `data.sec.gov/submissions/CIK{cik}.json` lists all filings per filer. Individual 13F-HR XML info tables fetched from EDGAR archives. Rate limit: 10 req/sec with User-Agent header. |
| SEC EDGAR 13F Data Sets | N/A | Bulk quarterly data | Tab-delimited flat files at sec.gov/data-research/sec-markets-data/form-13f-data-sets. Contains SUBMISSION, COVERPAGE, INFOTABLE files. Use for historical backfill -- faster than crawling individual filings. |
| fast-xml-parser | 5.3.x | Parse 13F XML info tables | 13F-HR information tables are XML. fast-xml-parser is the fastest pure-JS XML parser (no native dependencies). TypeScript types included. Converts XML to JS objects directly. |
| node-cron | 4.2.x | Scheduled data refresh | Quarterly 13F filings arrive ~45 days after quarter end. Schedule daily checks during filing windows (Feb, May, Aug, Nov). Lightweight cron for Node.js. |

### UI Components

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| shadcn/ui | latest (CLI-installed) | Component primitives | Copy-paste components built on Radix UI + Tailwind. You own the source code -- critical for customizing fund cards, position tables, and drill-down layouts. No version lock-in. Most popular React UI approach in 2026. |
| Recharts | 3.7.x | Charts (bar, area, treemap) | Built on D3, React-native components. Covers portfolio composition (treemaps, stacked bars), position changes over time (area/line charts), sector allocation (donut/pie). Simpler API than raw D3. Good enough for this use case -- not a trading terminal. |
| TanStack Table | 8.21.x | Holdings data tables | Headless table with sorting, filtering, grouping, pagination. Essential for position-level drill-downs showing 100+ holdings per fund. Virtual scrolling for large datasets. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 4.3.x | Schema validation | Validate 13F XML-to-JSON transformations. Define schemas for holdings, filings, fund metadata. Runtime validation prevents bad data in DB. |
| date-fns | 4.1.x | Date manipulation | Quarter calculations (Q1-Q4 boundaries), filing date formatting, "45 days after quarter end" deadline logic. Tree-shakeable -- only import what you use. |
| clsx + tailwind-merge | latest | Conditional class names | Standard shadcn/ui utilities for component styling. |
| nuqs | latest | URL search params state | Sync filter state (quarter selector, fund group, sort) to URL. Enables shareable/bookmarkable dashboard views. Works with Next.js App Router. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| pnpm 10.x | Package manager | Faster installs, strict dependency resolution, disk-efficient. Standard for modern Next.js projects. |
| Vitest 4.x | Unit/integration testing | Native ESM, same config as Vite/Next.js. Test data transformations (XML parsing, quarter-over-quarter diffs). |
| ESLint 9.x + @eslint/js | Linting | Flat config format. Use with typescript-eslint and eslint-plugin-react. |
| Prettier | Code formatting | Paired with eslint-config-prettier to avoid conflicts. |

## Installation

```bash
# Initialize Next.js project
pnpm create next-app@latest hedgelens --typescript --tailwind --eslint --app --src-dir

# Core dependencies
pnpm add better-sqlite3 drizzle-orm fast-xml-parser recharts @tanstack/react-table zod date-fns node-cron nuqs clsx tailwind-merge

# Type definitions
pnpm add -D @types/better-sqlite3 @types/node-cron

# Dev/build tools
pnpm add -D drizzle-kit vitest @vitest/ui

# shadcn/ui initialization (installs Radix primitives on demand)
pnpm dlx shadcn@latest init
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| SQLite + better-sqlite3 | PostgreSQL | If you later need multi-user access, concurrent writes, or full-text search across filings. For single-user dashboard, SQLite wins on simplicity. |
| SQLite + better-sqlite3 | Turso (libSQL) | If you want SQLite with edge replication or remote access. Unnecessary for a local single-user app. |
| Drizzle ORM | Prisma | If you prefer a more opinionated ORM with a GUI (Prisma Studio). Drizzle is lighter and gives more SQL control, which matters for analytical queries (GROUP BY, window functions for QoQ changes). |
| Recharts | Tremor | If you want pre-built dashboard card layouts with charts baked in. Tremor wraps Recharts anyway. Using Recharts directly gives more control for custom portfolio visualizations (treemaps, custom tooltips with position data). |
| Recharts | Apache ECharts | If you need 50+ chart types or extreme performance with 100K+ data points per chart. ECharts has a steeper learning curve and heavier bundle. 13F data is ~500-2000 holdings per fund, well within Recharts range. |
| Recharts | Lightweight Charts (TradingView) | If building a trading terminal with candlestick/OHLC charts. 13F analytics is portfolio composition, not price action. Wrong tool. |
| fast-xml-parser | cheerio | If you need to scrape HTML pages from EDGAR. For structured 13F XML info tables, fast-xml-parser is faster and more appropriate. Cheerio is for HTML DOM traversal. |
| fast-xml-parser | xml2js | If you want callback-based XML parsing. xml2js is slower and less maintained. fast-xml-parser is actively developed and benchmark-faster. |
| Next.js API routes | Separate Express/Fastify backend | If you need a standalone API server or microservice architecture. For a single-user dashboard, Next.js API routes + Server Actions eliminate the need for a separate backend process. |
| SEC EDGAR direct API | sec-api.io (paid) | If you need real-time streaming, full-text search across all filings, or pre-parsed JSON for all form types. For 13F specifically, the free SEC EDGAR API provides everything needed. sec-api.io costs $49-299/mo. |
| node-cron | BullMQ + Redis | If you need job queues, retries, and distributed task processing. For a single scheduled quarterly data refresh, node-cron is sufficient. No Redis dependency. |
| TanStack Table | AG Grid | If you need Excel-like editing, pivoting, and enterprise grid features. AG Grid is heavy (500KB+) and the enterprise license is paid. TanStack Table is headless and free. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Create React App (CRA) | Deprecated, no longer maintained. No SSR, no API routes, no file-based routing. | Next.js 16 |
| Moment.js | Deprecated by its own maintainers. Mutable API, massive bundle (300KB+). | date-fns 4.x (tree-shakeable, immutable) |
| D3.js directly | Steep learning curve for standard chart types. Imperative DOM manipulation fights React's declarative model. | Recharts (built on D3, React-friendly API) |
| MongoDB | Document store is wrong model for relational 13F data (holdings belong to filings belong to funds, with cross-fund CUSIP lookups). Schema-less invites data inconsistency. | SQLite with Drizzle ORM |
| Firebase / Supabase | Cloud services add latency, cost, and auth complexity for a single-user local dashboard. | SQLite (zero-config, file-based, free) |
| Tailwind CSS v3 | v4 is stable and significantly faster. v3 requires JavaScript config file. Migrating later is annoying. Start on v4. | Tailwind CSS v4.1 |
| Redux / Zustand | Global state management is unnecessary. Dashboard state is URL params (quarter, fund, view) + server-fetched data. React Server Components + nuqs handle this. | nuqs for URL state, React Server Components for data |
| Webpack | Turbopack (bundled with Next.js 16) is 10x faster for dev and stable for production. No reason to eject to Webpack. | Turbopack (built into Next.js) |
| TypeScript 6.0 beta | Released Feb 11, 2026. Too new, potential breaking changes. ESM-by-default and strict-by-default changes may cause ecosystem friction. | TypeScript 5.7.x (stable, battle-tested) |

## Stack Patterns by Variant

**If you later want multi-user access:**
- Swap SQLite for PostgreSQL + connection pooling
- Add NextAuth.js for authentication
- Deploy to Vercel/Railway instead of local
- Drizzle ORM migration path: change driver, keep schema definitions

**If you want to track more than 13F (e.g., Form 4 insider trades, 13D/G activist positions):**
- Same XML parsing pipeline (fast-xml-parser), different schemas
- Add Zod schemas per form type
- Extend DB schema with new tables, same Drizzle patterns

**If data volume grows beyond SQLite comfort (>10GB):**
- Migrate to DuckDB for analytical queries (columnar storage, fast aggregations)
- Or PostgreSQL with materialized views for pre-computed QoQ diffs
- Drizzle supports both

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Next.js 16.2.x | React 19.x | Next.js 16 requires React 19. Ships together. |
| Next.js 16.2.x | Tailwind CSS 4.1.x | Native support via `@tailwindcss/postcss`. No extra config. |
| better-sqlite3 12.6.x | Drizzle ORM 0.45.x | Use `drizzle-orm/better-sqlite3` driver. Documented first-class support. |
| Drizzle ORM 0.45.x | drizzle-kit (latest) | drizzle-kit generates migrations from schema. Keep versions in sync. |
| shadcn/ui (latest) | Tailwind CSS 4.x | shadcn/ui updated for v4. Uses `@theme` directive instead of config file. |
| Recharts 3.7.x | React 19.x | Recharts 3.x supports React 18+ including React 19. |
| TanStack Table 8.21.x | React 19.x | Framework-agnostic core. React adapter works with 18+. |
| Vitest 4.x | TypeScript 5.7.x | Native TypeScript support. No ts-jest needed. |

## Data Access Strategy

### Approach: Hybrid (Bulk Backfill + Incremental Updates)

**Historical backfill (one-time):**
- Download SEC 13F bulk data sets (TSV files) from sec.gov
- Parse SUBMISSION, COVERPAGE, INFOTABLE files
- Load into SQLite via Drizzle ORM
- Covers all filings from May 2013 to present

**Incremental updates (quarterly):**
- For each tracked fund CIK, fetch `data.sec.gov/submissions/CIK{cik}.json`
- Identify new 13F-HR filings since last check
- Fetch individual XML info tables from EDGAR archives
- Parse with fast-xml-parser, validate with Zod, insert into SQLite

**Rate limiting:**
- Respect SEC 10 req/sec limit
- Set User-Agent header: `"HedgeLens admin@youremail.com"`
- Add 100ms delay between requests as safety margin
- Queue requests, never parallelize beyond limit

### Why NOT a third-party API:
- sec-api.io costs $49-299/mo for a personal project
- SEC EDGAR is free, no API key, no terms-of-service restrictions for personal use
- 13F data is structured XML -- straightforward to parse
- Quarterly update cadence means no need for real-time streaming

## Sources

- [SEC EDGAR Application Programming Interfaces](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) -- Official API docs, endpoints, rate limits (HIGH confidence)
- [SEC EDGAR Accessing Data](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data) -- User-Agent requirements, 10 req/sec rate limit (HIGH confidence)
- [SEC Form 13F Data Sets](https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets) -- Bulk TSV data sets structure (HIGH confidence)
- [SEC Form 13F FAQ](https://www.sec.gov/rules-regulations/staff-guidance/division-investment-management-frequently-asked-questions/frequently-asked-questions-about-form-13f) -- Filing requirements, deadlines (HIGH confidence)
- [Next.js Releases](https://github.com/vercel/next.js/releases) -- v16.2.x current stable (HIGH confidence)
- [Tailwind CSS v4.0 Announcement](https://tailwindcss.com/blog/tailwindcss-v4) -- CSS-first config, performance gains (HIGH confidence)
- [Recharts npm](https://www.npmjs.com/package/recharts) -- v3.7.0 latest (HIGH confidence)
- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3) -- v12.6.2 latest (HIGH confidence)
- [Drizzle ORM npm](https://www.npmjs.com/package/drizzle-orm) -- v0.45.1, SQLite support (HIGH confidence)
- [fast-xml-parser npm](https://www.npmjs.com/package/fast-xml-parser) -- v5.3.6 latest (HIGH confidence)
- [TanStack Table npm](https://www.npmjs.com/package/@tanstack/react-table) -- v8.21.3 latest (HIGH confidence)
- [Zod npm](https://www.npmjs.com/package/zod) -- v4.3.6 latest (HIGH confidence)
- [shadcn/ui](https://ui.shadcn.com/) -- CLI-based component installation, Radix + Tailwind (HIGH confidence)
- [Vitest v4](https://vitest.dev/blog/vitest-4) -- v4.0.18 latest (HIGH confidence)
- [TypeScript Releases](https://github.com/microsoft/typescript/releases) -- 5.7.x stable, 6.0 beta (HIGH confidence)
- [edgartools PyPI](https://pypi.org/project/edgartools/) -- Python alternative for 13F parsing, v5.16.1 (MEDIUM confidence -- not recommended for this JS/TS stack but noted)
- [pnpm](https://pnpm.io/) -- v10.30.x latest (HIGH confidence)

---
*Stack research for: Hedge Fund 13F Portfolio Analytics Dashboard (HedgeLens)*
*Researched: 2026-02-19*
