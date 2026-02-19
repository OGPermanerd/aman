# Phase 3: Dashboard - Research

**Researched:** 2026-02-19
**Domain:** Next.js App Router dashboard with server components, shadcn/ui, Recharts, TanStack Table over existing better-sqlite3 + Drizzle analytics
**Confidence:** HIGH

## Summary

Phase 3 adds a web dashboard to an existing TypeScript project that has a mature data ingestion pipeline (Phase 1) and a complete analytics engine (Phase 2). The core technical challenge is integrating Next.js into an existing non-Next.js project with better-sqlite3 (a native C++ module) and Drizzle ORM, while building a three-level drill-down UI (strategy groups -> funds -> positions) with charts and data tables.

The existing codebase uses ESM (`"type": "module"`), TypeScript with `moduleResolution: "bundler"`, and path aliases (`@/*` -> `./src/*`). All analytics functions are synchronous pure functions that take a Drizzle `db` instance. This is highly compatible with Next.js Server Components, which can call synchronous functions directly during server-side rendering -- no API layer needed.

The key architectural decision is that **this is a manual Next.js installation into the existing project**, not a `create-next-app` scaffold. The existing `src/` directory structure (db, analytics, config, security, ingestion) must coexist with the new Next.js `src/app/` directory. better-sqlite3 is already on Next.js's auto-externalized packages list, so no special webpack configuration is needed.

**Primary recommendation:** Manually install Next.js + React + Tailwind CSS into the existing project, use `src/app/` for routes that import existing analytics functions directly in Server Components, use `"use client"` components only for interactive elements (charts, table sorting, quarter picker).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.x (latest) | Full-stack React framework | App Router provides file-based routing with Server Components. Server Components can call better-sqlite3/Drizzle directly -- no API layer. Turbopack for fast dev. Already recommended in initial stack research. |
| React | 19.x | UI library | Ships with Next.js 16. Server Components reduce client bundle for this data-heavy dashboard. |
| Tailwind CSS | 4.x | Utility-first styling | CSS-first config (no tailwind.config.js in v4). Standard pairing with shadcn/ui. Install via `@tailwindcss/postcss`. |
| shadcn/ui | latest (CLI) | Component primitives | Copy-paste components built on Radix UI + Tailwind. Provides Table, Card, Badge, Select, Tabs, Skeleton, and Chart components. Not a dependency -- source code lives in project. |
| Recharts | 2.x (shadcn bundled) | Charts (pie, bar, area) | shadcn/ui Chart component wraps Recharts in a composable pattern. Used for sector breakdown pie/bar charts and portfolio allocation visuals. Must be rendered in client components (`"use client"`). |
| TanStack Table | 8.x | Holdings data tables | Headless table with sorting, filtering, pagination. shadcn/ui has a Data Table recipe built on TanStack Table. Essential for position-level views with 100+ holdings. |
| nuqs | latest | URL search params state | Sync quarter selector and filter state to URL. Enables shareable/bookmarkable views. ~6KB gzipped. Works with Next.js App Router. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx | latest | Conditional class names | Standard shadcn/ui utility for component styling. |
| tailwind-merge | latest | Merge conflicting Tailwind classes | Standard shadcn/ui utility. Paired with clsx in a `cn()` helper. |
| class-variance-authority | latest | Component variants | Used by shadcn/ui for variant-based component styling (Button variants, Badge variants). |
| lucide-react | latest | Icons | Default icon library for shadcn/ui. Used for navigation, sort indicators, change direction arrows. |
| server-only | latest | Prevent server code in client | Mark data access modules with `import 'server-only'` to prevent accidental client imports of database code. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server Components calling DB directly | API routes + client-side fetch | API routes add unnecessary indirection for a single-user app. Server Components are simpler and faster for this use case. |
| nuqs | Manual URL searchParams | nuqs provides type-safe parsers, history management, and server-side access. Manual handling is error-prone with quarter format parsing. |
| Recharts via shadcn/ui Chart | Recharts directly | shadcn/ui Chart provides `ChartContainer`, `ChartTooltip`, `ChartLegend` helpers that integrate with the design system. Using Recharts directly means building these from scratch. |
| TanStack Table via shadcn/ui Data Table | AG Grid | AG Grid is 500KB+ and requires a paid enterprise license. TanStack Table is headless and free. For < 2000 rows per fund, TanStack Table is more than sufficient. |

**Installation:**
```bash
# Core Next.js + React (manual install into existing project)
pnpm add next@latest react@latest react-dom@latest

# Tailwind CSS v4 for Next.js
pnpm add -D @tailwindcss/postcss postcss

# URL state management
pnpm add nuqs

# Server-only guard
pnpm add server-only

# Type definitions for React
pnpm add -D @types/react @types/react-dom

# shadcn/ui initialization (installs Radix primitives, clsx, tailwind-merge, class-variance-authority, lucide-react)
pnpm dlx shadcn@latest init

# shadcn/ui components (install as needed)
pnpm dlx shadcn@latest add card table badge select tabs skeleton chart
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/                          # NEW: Next.js App Router
│   ├── layout.tsx                # Root layout (html, body, nav, quarter picker)
│   ├── page.tsx                  # Landing page -> redirect to /groups
│   ├── globals.css               # Tailwind CSS entry + shadcn theme variables
│   ├── loading.tsx               # Root loading skeleton
│   ├── groups/
│   │   ├── page.tsx              # DASH-01: Strategy group overview
│   │   └── [group]/
│   │       ├── page.tsx          # DASH-02: Group drill-down (funds list)
│   │       └── funds/
│   │           └── [cik]/
│   │               └── page.tsx  # DASH-03: Fund detail (holdings table)
│   ├── positions/
│   │   └── [cusip]/
│   │       └── page.tsx          # DASH-04: Position detail (cross-fund)
│   └── _components/              # Private folder: shared UI components
│       ├── quarter-picker.tsx    # DASH-07: Quarter selector (client component)
│       ├── holdings-table.tsx    # DASH-03: Holdings data table (client component)
│       ├── change-badge.tsx      # New/Exit/Increased/Decreased badge
│       ├── sector-chart.tsx      # DASH-05: Sector breakdown chart (client component)
│       ├── weight-bar.tsx        # Portfolio weight visual indicator
│       ├── stat-card.tsx         # Dashboard stat card
│       └── quarter-display.tsx   # DASH-06: Reporting period display
├── lib/                          # NEW: Shared utilities for Next.js
│   ├── data.ts                   # Data access layer: wraps analytics for pages
│   ├── utils.ts                  # cn() helper (clsx + tailwind-merge)
│   └── formatters.ts             # Number/currency/percentage formatters
├── components/                   # NEW: shadcn/ui generated components
│   └── ui/                       # Button, Card, Table, Badge, etc.
├── analytics/                    # EXISTING: Unchanged
│   ├── types.ts
│   ├── quarter-utils.ts
│   ├── portfolio-weights.ts
│   ├── qoq-diff.ts
│   ├── group-consensus.ts
│   └── conviction.ts
├── db/                           # EXISTING: Unchanged
│   ├── schema.ts
│   └── connection.ts
├── config/                       # EXISTING: Unchanged
│   ├── funds.json
│   └── loader.ts
├── security/                     # EXISTING: Unchanged
│   └── sector-classifier.ts
├── ingestion/                    # EXISTING: Unchanged
│   └── ...
└── cli/                          # EXISTING: Unchanged
    └── ingest.ts
```

### Pattern 1: Server Components Calling Analytics Directly

**What:** Page server components import and call the existing synchronous analytics functions directly. No API routes, no client-side data fetching.
**When to use:** Every data-fetching page. This is the primary data flow pattern.
**Why it works:** better-sqlite3 is synchronous, and Server Components run on the server. The analytics functions (computePortfolioWeights, computeQoQDiff, computeGroupConsensus, computeConvictionScores) all take a `db` instance and return plain objects. Server Components can call them and render the results directly.

**Example:**
```typescript
// src/app/groups/[group]/funds/[cik]/page.tsx (Server Component)
import { db } from '@/db/connection'
import { computePortfolioWeights } from '@/analytics/portfolio-weights'
import { computeQoQDiff } from '@/analytics/qoq-diff'
import { computeConvictionScores } from '@/analytics/conviction'
import { getAvailableQuarters, previousQuarter } from '@/analytics/quarter-utils'
import { HoldingsTable } from '@/app/_components/holdings-table'

export default async function FundDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ group: string; cik: string }>
  searchParams: Promise<{ quarter?: string }>
}) {
  const { cik } = await params
  const { quarter: selectedQuarter } = await searchParams

  const quarters = getAvailableQuarters(db, cik)
  const quarter = selectedQuarter || quarters[0]
  const prevQ = previousQuarter(quarter)

  // All sync -- no await needed for better-sqlite3
  const weights = computePortfolioWeights(db, cik, quarter)
  const diff = computeQoQDiff(db, cik, quarter, prevQ)
  const conviction = computeConvictionScores(db, cik, quarter)

  return (
    <div>
      <QuarterDisplay quarter={quarter} />
      <HoldingsTable weights={weights} diffs={diff.diffs} conviction={conviction} />
    </div>
  )
}
```

### Pattern 2: Data Access Layer for Complex Queries

**What:** A `src/lib/data.ts` module that composes multiple analytics calls into page-specific data shapes. Marked with `import 'server-only'` to prevent accidental client imports.
**When to use:** When a page needs data from multiple analytics functions combined into a single view model.
**Why:** Keeps page components clean. Centralizes data composition logic. The `server-only` import ensures this code never leaks to the client bundle.

**Example:**
```typescript
// src/lib/data.ts
import 'server-only'
import { db } from '@/db/connection'
import { funds } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { computeGroupConsensus } from '@/analytics/group-consensus'
import { computePortfolioWeights } from '@/analytics/portfolio-weights'

export function getGroupOverview(quarter: string) {
  const strategyGroups = ['Tiger Cubs', 'Activist', 'Macro', 'Quant', 'Multi-Strategy']

  return strategyGroups.map((group) => {
    const groupFunds = db
      .select()
      .from(funds)
      .where(and(eq(funds.strategyGroup, group), eq(funds.active, true)))
      .all()

    const consensus = computeGroupConsensus(db, group, quarter)

    // Compute aggregate portfolio value across all funds in group
    let aggregateValue = 0
    for (const fund of groupFunds) {
      const weights = computePortfolioWeights(db, fund.cik, quarter)
      aggregateValue += weights.reduce((sum, w) => sum + w.value, 0)
    }

    return {
      name: group,
      fundCount: groupFunds.length,
      aggregateValue,
      topHoldings: consensus.slice(0, 10),
    }
  })
}
```

### Pattern 3: Client Components for Interactive Elements

**What:** Charts (Recharts), sortable tables (TanStack Table), and the quarter picker are client components with `"use client"`. Data is passed as props from server components.
**When to use:** Any component that needs browser APIs, event handlers, or React hooks (useState, useEffect).
**Why:** Recharts uses D3.js which requires DOM access. TanStack Table uses React state for sort/filter. The quarter picker uses nuqs hooks.

**Example:**
```typescript
// src/app/_components/sector-chart.tsx
'use client'
import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'

interface SectorData {
  sector: string
  weight: number
}

export function SectorChart({ data }: { data: SectorData[] }) {
  return (
    <ChartContainer config={chartConfig}>
      <PieChart>
        <Pie data={data} dataKey="weight" nameKey="sector">
          {data.map((entry, i) => (
            <Cell key={entry.sector} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltipContent />} />
      </PieChart>
    </ChartContainer>
  )
}
```

### Pattern 4: URL-Based Quarter Selection with nuqs

**What:** Quarter selection synced to URL via `?quarter=2025Q4` using nuqs. Every page reads the selected quarter from search params. Default to latest available quarter.
**When to use:** Implementing DASH-06 and DASH-07 (quarter display and selection).
**Why:** Enables bookmarkable views, back/forward navigation through quarter changes, and SSR with the correct quarter on first load.

**Example:**
```typescript
// src/app/_components/quarter-picker.tsx
'use client'
import { useQueryState, parseAsString } from 'nuqs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function QuarterPicker({ quarters }: { quarters: string[] }) {
  const [quarter, setQuarter] = useQueryState('quarter', parseAsString.withDefault(quarters[0]))

  return (
    <Select value={quarter} onValueChange={setQuarter}>
      <SelectTrigger>
        <SelectValue placeholder="Select quarter" />
      </SelectTrigger>
      <SelectContent>
        {quarters.map((q) => (
          <SelectItem key={q} value={q}>{formatQuarter(q)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

### Anti-Patterns to Avoid

- **Building API routes for data access:** Server Components can query the database directly. API routes add unnecessary indirection, latency, and client-side loading states for a single-user app where all data is local.
- **Making analytics functions async:** The existing analytics are synchronous (better-sqlite3 is sync). Do not wrap them in async/Promises. Server Components can call sync functions directly.
- **Importing database code in client components:** Any file importing `better-sqlite3` or `drizzle-orm/better-sqlite3` must be server-only. Use `import 'server-only'` in data modules. Pass only serializable data (plain objects/arrays) as props to client components.
- **Putting `"use client"` on page components:** Pages should be server components. Only leaf UI components that need interactivity (charts, tables, pickers) should be client components.
- **Duplicating analytics logic in the UI layer:** The analytics engine (Phase 2) already computes diffs, weights, conviction, and consensus. The dashboard should call these functions, not recompute from raw holdings.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data table with sort/filter/paginate | Custom table with manual sort state | TanStack Table + shadcn/ui Data Table | Sort direction state, multi-column sort, filter predicates, pagination math are surprisingly complex. TanStack Table handles all edge cases. |
| Pie/bar charts for sector breakdown | Custom SVG rendering | Recharts via shadcn/ui Chart | SVG math, tooltip positioning, responsive scaling, animation, accessibility are all handled. D3 under the hood. |
| Badge variants (new/exit/increase/decrease) | Custom styled spans | shadcn/ui Badge with variant prop | Consistent styling, proper semantic HTML, accessible color contrast. |
| Quarter format display ("Q4 2025") | String concatenation | Dedicated formatter function | Quarter format "2025Q4" needs to display as "Q4 2025" with full date "December 31, 2025". Centralize to avoid inconsistency. |
| Number formatting ($1.2B, 12.3%) | Inline Intl.NumberFormat calls | Centralized formatters module | Currency, percentage, compact notation all need consistent formatting. Centralize in `src/lib/formatters.ts`. |
| URL state for quarter selection | Manual searchParams parsing | nuqs | History management, type-safe parsing, server-side access, and React hook integration. Manual approach leads to bugs with encoding and shallow routing. |
| Loading skeletons | Custom shimmer animations | shadcn/ui Skeleton | Already styled to match the design system. |

**Key insight:** The dashboard phase is primarily UI composition. Every data computation is already handled by Phase 2 analytics. The risk is spending time on UI infrastructure (tables, charts, state) instead of using battle-tested libraries.

## Common Pitfalls

### Pitfall 1: Native Module Bundling Errors with better-sqlite3

**What goes wrong:** Next.js Turbopack tries to bundle better-sqlite3's native `.node` addon, producing build errors like "Module parse failed: Unexpected character" or "Cannot find module 'better-sqlite3'".
**Why it happens:** better-sqlite3 is a C++ native addon that must use Node.js `require()`, not bundler resolution. If it gets pulled into the client bundle or incorrectly processed by the bundler, it fails.
**How to avoid:** better-sqlite3 is already on Next.js's auto-externalized packages list (verified in Next.js 16.x documentation). It should work without configuration. If issues arise, add `serverExternalPackages: ['better-sqlite3']` to `next.config.ts`. Additionally, use `import 'server-only'` in any module that imports the database connection to prevent accidental client-side imports.
**Warning signs:** Build errors mentioning `.node` files, "Module not found: better-sqlite3" in client components, or SQLite errors about missing database file.

### Pitfall 2: Importing Server-Only Code in Client Components

**What goes wrong:** A client component (`"use client"`) transitively imports `@/db/connection` or an analytics module, causing the bundler to try to include better-sqlite3 and Node.js `fs` in the client bundle.
**Why it happens:** Client components are bundled for the browser. Any import chain that reaches a Node.js-only module will fail. This happens subtly when a shared utility imports a data function.
**How to avoid:** Add `import 'server-only'` at the top of `src/lib/data.ts` and `src/db/connection.ts`. This causes a build error if any client component imports these files, catching the mistake early. Pass only plain serializable data (not Drizzle instances, not functions) as props to client components.
**Warning signs:** Build errors about "server-only" package, or runtime errors about missing Node.js built-ins (fs, path, crypto) in the browser.

### Pitfall 3: Displaying Filing Date Instead of Reporting Period

**What goes wrong:** The dashboard shows the filing date (when the SEC received the filing) instead of the report date (quarter-end date the data represents). Users see "as of February 2026" when the data is actually a snapshot of December 31, 2025.
**Why it happens:** The `filings` table has both `filingDate` and `reportDate`. It is easy to use the wrong field, or to not display the temporal context at all.
**How to avoid:** This is DASH-06. Every page server component must extract and display the `reportDate` (or the `reportQuarter` from holdings, which is the "2025Q4" format). Build a `QuarterDisplay` component that converts "2025Q4" to "Q4 2025 (as of December 31, 2025)" and place it prominently at the top of every data view. The root layout's quarter picker inherently surfaces this.
**Warning signs:** Any page that shows data without a visible quarter label. Any date reference that is not a quarter-end date (March 31, June 30, September 30, December 31).

### Pitfall 4: Hydration Mismatch from Recharts/TanStack Table

**What goes wrong:** Server-rendered HTML doesn't match client-rendered HTML for chart or table components, producing React hydration warnings and visual flicker.
**Why it happens:** Recharts measures DOM dimensions on mount and D3 generates dynamic SVG. TanStack Table's sort/filter state is client-side. If the server attempts to render these, the output won't match.
**How to avoid:** All Recharts and TanStack Table components must be client components (`"use client"`). Do not attempt to server-render charts. For TanStack Table, the server component passes data as props; the client component initializes the table instance. Use `<Suspense>` with `<Skeleton>` fallbacks for chart containers to show loading states during client hydration.
**Warning signs:** Console warnings about hydration mismatches. Charts that flash/resize on page load.

### Pitfall 5: Stale Database Connection in Development

**What goes wrong:** Next.js hot-reloads modules during development, which can create multiple SQLite connections or reference stale singleton instances.
**Why it happens:** The existing `connection.ts` exports a singleton `const defaultConnection = getDb()`. During HMR (hot module replacement), this module may be re-evaluated, creating a new connection while the old one is still open.
**How to avoid:** Use a global variable to cache the database connection in development:
```typescript
// Prevent multiple connections during HMR
const globalForDb = globalThis as unknown as { db?: DbConnection }
const connection = globalForDb.db ?? getDb()
if (process.env.NODE_ENV !== 'production') globalForDb.db = connection
```
This is a standard Next.js pattern for singletons (Prisma documentation recommends the same).
**Warning signs:** "database is locked" errors in development. Multiple "WAL mode" pragma logs on each page refresh.

### Pitfall 6: Slow Group Overview Page Due to N+1 Analytics Calls

**What goes wrong:** The landing page (DASH-01) calls analytics for every fund in every strategy group, causing the page to take seconds to load even with local SQLite.
**Why it happens:** 50 funds across 5 groups, each needing portfolio weights and possibly QoQ diffs. That is 50+ separate synchronous query batches, each doing multiple SQL queries.
**How to avoid:** The group overview page should show aggregate stats that are cheap to compute: fund count (single query per group), total portfolio value (sum of holdings.value), and top consensus holdings (already computed by `computeGroupConsensus`). Defer per-fund analytics (QoQ diffs, conviction) to the drill-down pages. Consider computing aggregate values with a single SQL query rather than per-fund calls.
**Warning signs:** Group overview page taking > 500ms. Browser showing loading spinner for the landing page.

## Code Examples

### next.config.ts for existing project integration

```typescript
// next.config.ts
// Source: Next.js 16 docs - manual installation
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // better-sqlite3 and node-cron are auto-externalized by Next.js,
  // but explicitly listing them is a safety net
  serverExternalPackages: ['better-sqlite3', 'node-cron'],

  // The existing src/ directory contains non-Next.js code (analytics, db, etc.)
  // Next.js only cares about src/app/ for routing
}

export default nextConfig
```

### tsconfig.json adaptation

```jsonc
// tsconfig.json -- adapted for Next.js coexistence
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*", "next-env.d.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### Root layout with quarter context

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

export const metadata: Metadata = {
  title: 'HedgeLens',
  description: 'Hedge fund portfolio analytics dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NuqsAdapter>
          <nav>{/* Navigation: Groups, current quarter display */}</nav>
          <main>{children}</main>
        </NuqsAdapter>
      </body>
    </html>
  )
}
```

### Change badge component

```typescript
// src/app/_components/change-badge.tsx
import { Badge } from '@/components/ui/badge'
import type { PositionChangeType } from '@/analytics/types'

const BADGE_CONFIG: Record<PositionChangeType, { label: string; variant: string }> = {
  new: { label: 'NEW', variant: 'default' },       // green
  exited: { label: 'EXIT', variant: 'destructive' }, // red
  increased: { label: 'ADD', variant: 'secondary' }, // blue
  decreased: { label: 'TRIM', variant: 'outline' },  // amber
  unchanged: { label: '---', variant: 'ghost' },
}

export function ChangeBadge({ changeType }: { changeType: PositionChangeType }) {
  const config = BADGE_CONFIG[changeType]
  return <Badge variant={config.variant as any}>{config.label}</Badge>
}
```

### Sector breakdown data derivation

```typescript
// src/lib/data.ts (addition for DASH-05)
import 'server-only'
import { db } from '@/db/connection'
import { holdings, securities } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export function getSectorBreakdown(fundCik: string, quarter: string) {
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
    const sector = row.sector || 'Unclassified'
    sectorMap.set(sector, (sectorMap.get(sector) || 0) + row.value)
    totalValue += row.value
  }

  return Array.from(sectorMap.entries())
    .map(([sector, value]) => ({
      sector,
      value,
      weight: totalValue > 0 ? value / totalValue : 0,
    }))
    .sort((a, b) => b.weight - a.weight)
}
```

### Database connection singleton for Next.js HMR

```typescript
// src/db/connection.ts -- HMR-safe adaptation
import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema.js'

const DEFAULT_DB_PATH = 'hedgelens.db'

export type DbConnection = {
  db: BetterSQLite3Database<typeof schema>
  sqlite: DatabaseType
}

export function getDb(dbPath: string = DEFAULT_DB_PATH): DbConnection {
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  return { db, sqlite }
}

// HMR-safe singleton: prevent multiple connections during Next.js development
const globalForDb = globalThis as unknown as { __hedgelens_db?: DbConnection }
const defaultConnection = globalForDb.__hedgelens_db ?? getDb()
if (process.env.NODE_ENV !== 'production') {
  globalForDb.__hedgelens_db = defaultConnection
}

export const db: BetterSQLite3Database<typeof schema> = defaultConnection.db
export const sqlite: DatabaseType = defaultConnection.sqlite
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| API routes for all data access | Server Components query DB directly | Next.js 13+ App Router (2023) | Eliminates client-side loading states for initial page loads. Simpler architecture. |
| `getServerSideProps` / `getStaticProps` | `async` Server Components with `await` | Next.js 13+ App Router (2023) | Data fetching is colocated with components. No separate data layer needed. |
| `serverComponentsExternalPackages` | `serverExternalPackages` | Next.js 15.0 (2024) | Renamed config option. Also, better-sqlite3 is now auto-externalized. |
| Tailwind CSS v3 (JS config) | Tailwind CSS v4 (CSS-first, no config file) | Tailwind v4 (2025) | No `tailwind.config.js` needed. Uses `@import "tailwindcss"` in CSS. |
| Custom chart wrappers | shadcn/ui Chart (Recharts composition) | shadcn/ui 2024 | Built-in `ChartContainer`, `ChartTooltip`, `ChartLegend` components. |
| Manual URL param parsing | nuqs type-safe URL state | nuqs matured 2024-2025 | Handles encoding, history, server-side access, and React hooks. |
| Pages Router | App Router (stable) | Next.js 16 (2025) | Turbopack by default. App Router is the standard. |

**Deprecated/outdated:**
- `pages/` directory: Still works but App Router is the standard for new projects
- `getServerSideProps` / `getStaticProps`: Replaced by Server Components
- `tailwind.config.js`: Replaced by CSS-first `@theme` in Tailwind v4
- `serverComponentsExternalPackages`: Renamed to `serverExternalPackages` in Next.js 15+

## Open Questions

1. **Database file path in Next.js context**
   - What we know: The existing `connection.ts` defaults to `hedgelens.db` (relative path). Next.js runs from the project root, so this should resolve correctly.
   - What's unclear: Whether Turbopack's file watching interacts with the SQLite WAL file, causing unnecessary recompilation.
   - Recommendation: Use an absolute path derived from `process.cwd()` for clarity. Add `hedgelens.db*` to `.gitignore` and any Turbopack watch exclusions if needed.

2. **Global available quarters for quarter picker**
   - What we know: The quarter picker (DASH-07) needs the list of available quarters, which varies per fund. The root layout needs access to this.
   - What's unclear: Whether to derive quarters globally (union of all funds' quarters) or per-page (current fund/group's quarters).
   - Recommendation: Compute a global available quarters list (DISTINCT reportQuarter across all holdings, ordered descending) in the layout or a shared data function. Individual pages can further filter if needed.

3. **Strategy group URL slugs**
   - What we know: Strategy groups are "Tiger Cubs", "Activist", "Macro", "Quant", "Multi-Strategy". URL paths need sluggified versions.
   - What's unclear: Whether to use URL encoding or create a slug mapping.
   - Recommendation: Create a simple slug mapping: `tiger-cubs`, `activist`, `macro`, `quant`, `multi-strategy`. Store as a constant in the data layer with bidirectional lookup.

4. **Handling funds with no data for selected quarter**
   - What we know: Not all 50 funds will have filings for every quarter. Some may be newer, some may have delayed filings.
   - What's unclear: How to display funds with missing data in the group drill-down.
   - Recommendation: Show the fund in the list with a "No data for this quarter" indicator. Do not hide funds with missing data -- their absence is informative.

## Sources

### Primary (HIGH confidence)
- [Next.js 16 serverExternalPackages docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages) - Verified better-sqlite3 is on the auto-externalized list. Config option is `serverExternalPackages`.
- [Next.js Data Fetching docs](https://nextjs.org/docs/app/getting-started/fetching-data) - Verified Server Components can query ORMs/databases directly. React `cache` function for deduplication.
- [Next.js Project Structure docs](https://nextjs.org/docs/app/getting-started/project-structure) - Verified `src/` directory convention, private folders (`_folder`), route groups.
- [Next.js Installation docs](https://nextjs.org/docs/app/getting-started/installation) - Verified manual installation steps, `next.config.ts` structure, `src/app/` layout.
- [shadcn/ui Installation for Next.js](https://ui.shadcn.com/docs/installation/next) - Verified `pnpm dlx shadcn@latest init` workflow, components.json setup.
- [shadcn/ui Chart docs](https://ui.shadcn.com/docs/components/radix/chart) - Verified composition-based approach with Recharts, ChartContainer/ChartTooltip components.
- [shadcn/ui Data Table docs](https://ui.shadcn.com/docs/components/radix/data-table) - Verified TanStack Table integration recipe with sorting, filtering, pagination.
- [nuqs docs](https://nuqs.dev) - Verified type-safe search params, server-side usage, NuqsAdapter for Next.js App Router.

### Secondary (MEDIUM confidence)
- [Next.js 16.1 blog post](https://nextjs.org/blog/next-16-1) - Turbopack transitive dependency externalization fixed. Relevant for better-sqlite3 being a dependency of drizzle.
- [Recharts GitHub](https://github.com/recharts/recharts) - Recharts 3.x in development; shadcn/ui currently uses Recharts 2.x. Pie, Bar, Area, Treemap components available.
- [TanStack Table docs](https://tanstack.com/table/v8/docs/introduction) - Headless, React 19 compatible, sorting/filtering/pagination built-in.

### Tertiary (LOW confidence)
- Various Medium/blog posts about Next.js + SQLite integration patterns -- used for general pattern validation, not specific API details.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs and existing stack research
- Architecture: HIGH - Pattern of Server Components calling sync DB functions is well-documented; project structure follows Next.js conventions
- Pitfalls: HIGH - Native module handling, HMR singletons, and server/client boundary are well-known Next.js patterns with official solutions
- Integration (existing codebase): MEDIUM - Manual installation into existing non-Next.js project is less documented than `create-next-app`, but the manual installation path is officially supported

**Research date:** 2026-02-19
**Valid until:** 2026-04-19 (60 days -- Next.js and shadcn/ui update frequently but core patterns are stable)
