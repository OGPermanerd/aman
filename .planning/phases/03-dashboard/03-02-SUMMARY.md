---
phase: 03-dashboard
plan: 02
subsystem: ui
tags: [nextjs, react, tanstack-table, server-components, drill-down, interactive-table]

# Dependency graph
requires:
  - phase: 03-dashboard
    plan: 01
    provides: "App shell, data layer, shared components (ChangeBadge, WeightBar, StatCard, QuarterDisplay)"
  - phase: 02-analytics-engine
    provides: "Analytics functions (portfolio-weights, qoq-diff, group-consensus, conviction)"
provides:
  - "Strategy group overview page at /groups with aggregate stats and top consensus holdings"
  - "Group detail page at /groups/[slug] with fund table and QoQ change summaries"
  - "Fund detail page at /groups/[slug]/funds/[cik] with full interactive holdings table"
  - "HoldingsTable client component with TanStack Table sorting"
affects: [03-03]

# Tech tracking
tech-stack:
  added: [@tanstack/react-table]
  patterns: [tanstack-table-sorting, server-to-client-serialization, breadcrumb-navigation]

key-files:
  created:
    - src/app/groups/page.tsx
    - src/app/groups/loading.tsx
    - src/app/groups/[group]/page.tsx
    - src/app/groups/[group]/loading.tsx
    - src/app/groups/[group]/funds/[cik]/page.tsx
    - src/app/groups/[group]/funds/[cik]/loading.tsx
    - src/app/_components/holdings-table.tsx

key-decisions:
  - "TanStack Table with shadcn Table primitives for interactive sortable holdings table"
  - "Server-to-client serialization: FundPosition mapped to plain HoldingRow interface for client component"
  - "Sort order: funds with data first (by value desc), then funds without data (alphabetically)"

patterns-established:
  - "Drill-down hierarchy: /groups -> /groups/[slug] -> /groups/[slug]/funds/[cik] with breadcrumb navigation"
  - "Quarter preservation: all internal links pass ?quarter= param to maintain selection"
  - "Skeleton loading: each route has a loading.tsx matching its layout structure"

# Metrics
duration: 3min
completed: 2026-02-19
---

# Phase 3 Plan 2: Core Pages Summary

**Three-level drill-down hierarchy (groups, group detail, fund detail) with TanStack Table interactive holdings view, QoQ change badges, conviction indicators, and quarter-preserving navigation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-19T02:35:55Z
- **Completed:** 2026-02-19T02:39:14Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Strategy group overview renders all 5 groups as cards with fund count, aggregate value, and top 5 consensus holdings
- Group detail page shows fund table with portfolio value, holdings count, and QoQ change summaries (new/exit/add/trim)
- Fund detail page with interactive sortable holdings table showing name, change badge, value+delta, shares+delta, weight bar, and conviction level
- Full breadcrumb navigation and quarter parameter preservation across all pages

## Task Commits

Each task was committed atomically:

1. **Task 1: Strategy group overview and group detail pages** - `5a577e4` (feat)
2. **Task 2: Fund detail page with interactive holdings table** - `173f920` (feat)

## Files Created/Modified
- `src/app/groups/page.tsx` - Strategy group overview (DASH-01) with responsive card grid
- `src/app/groups/loading.tsx` - Skeleton loading for groups page
- `src/app/groups/[group]/page.tsx` - Group detail (DASH-02) with fund table and QoQ summaries
- `src/app/groups/[group]/loading.tsx` - Skeleton loading for group detail
- `src/app/groups/[group]/funds/[cik]/page.tsx` - Fund detail (DASH-03) with stat cards and holdings
- `src/app/groups/[group]/funds/[cik]/loading.tsx` - Skeleton loading for fund detail
- `src/app/_components/holdings-table.tsx` - Client component with TanStack Table, sortable columns, conviction badges

## Decisions Made
- Used TanStack Table with shadcn Table primitives for the interactive holdings table (provides sorting infrastructure with minimal custom code)
- Server-to-client boundary: FundPosition from data layer mapped to plain HoldingRow interface (no Drizzle objects or functions cross the boundary)
- Funds sorted with data-bearing funds first (by portfolio value descending), then no-data funds alphabetically
- Default sort: weight descending in holdings table (most important positions first)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three core drill-down pages functional
- Plan 03-03 can build position detail (/positions/[cusip]) and any remaining dashboard features
- HoldingsTable component is reusable for any page needing holdings display

## Self-Check: PASSED

- All 7 key files verified present
- Both task commits verified (5a577e4, 173f920)
- TypeScript compiles without errors
- All 33 existing tests pass

---
*Phase: 03-dashboard*
*Completed: 2026-02-19*
