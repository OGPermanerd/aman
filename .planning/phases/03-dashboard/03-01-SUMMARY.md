---
phase: 03-dashboard
plan: 01
subsystem: ui
tags: [nextjs, react, tailwindcss, shadcn, nuqs, turbopack, server-components]

# Dependency graph
requires:
  - phase: 02-analytics-engine
    provides: "Analytics functions (portfolio-weights, qoq-diff, group-consensus, conviction)"
  - phase: 01-data-foundation
    provides: "Database schema, connection, fund config, ingestion pipeline"
provides:
  - "Next.js app shell with Turbopack"
  - "Root layout with HedgeLens nav bar and quarter picker"
  - "Server-only data access layer wrapping all analytics"
  - "Shared UI components (ChangeBadge, WeightBar, StatCard, QuarterDisplay, QuarterPicker)"
  - "Utility modules (formatters, slug mapping)"
  - "shadcn/ui component library (card, table, badge, select, tabs, skeleton, separator)"
affects: [03-02, 03-03]

# Tech tracking
tech-stack:
  added: [next@16, react@19, nuqs, server-only, shadcn/ui, tailwindcss@4, @tailwindcss/postcss, tw-animate-css]
  patterns: [server-components, nuqs-url-state, hmr-safe-singleton, server-only-guard]

key-files:
  created:
    - src/lib/data.ts
    - src/lib/formatters.ts
    - src/lib/slugs.ts
    - src/app/layout.tsx
    - src/app/page.tsx
    - src/app/loading.tsx
    - src/app/_components/quarter-picker.tsx
    - src/app/_components/quarter-display.tsx
    - src/app/_components/change-badge.tsx
    - src/app/_components/weight-bar.tsx
    - src/app/_components/stat-card.tsx
    - next.config.ts
    - postcss.config.mjs
    - components.json
  modified:
    - package.json
    - tsconfig.json
    - src/db/connection.ts
    - .gitignore

key-decisions:
  - "Removed .js extensions from all relative imports for Turbopack bundler compatibility"
  - "Used nuqs with parseAsString for quarter URL state sync"
  - "HMR-safe database singleton via globalThis pattern"

patterns-established:
  - "Server-only data layer: all DB access through src/lib/data.ts with 'server-only' guard"
  - "URL state: quarter selection synced to ?quarter= via nuqs"
  - "Shared components in src/app/_components/ (co-located, not shared across route groups)"
  - "shadcn/ui components in src/components/ui/"

# Metrics
duration: 8min
completed: 2026-02-19
---

# Phase 3 Plan 1: Next.js Foundation Summary

**Next.js 16 with Turbopack, shadcn/ui component library, server-only data layer wrapping all analytics, and root layout with quarter-synced URL state via nuqs**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-19T02:25:40Z
- **Completed:** 2026-02-19T02:33:29Z
- **Tasks:** 2
- **Files modified:** 50

## Accomplishments
- Next.js 16 with Turbopack running successfully alongside existing better-sqlite3 native module
- Data access layer (6 functions) composing all Phase 2 analytics into page-ready data
- Root layout with nav bar and quarter picker that reads available quarters from DB
- 7 shadcn/ui components installed, 5 custom shared components built

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Next.js and configure project** - `21c6596` (feat)
2. **Task 2: Create data layer, utilities, and shared components** - `aaccb7d` (feat)

## Files Created/Modified
- `next.config.ts` - Next.js config with serverExternalPackages for better-sqlite3
- `postcss.config.mjs` - PostCSS config for Tailwind v4
- `components.json` - shadcn/ui configuration
- `src/lib/data.ts` - Server-only data access layer (getGlobalQuarters, getGroupOverview, getGroupDetail, getFundDetail, getPositionDetail, getSectorBreakdown, getGroupSectorBreakdown)
- `src/lib/formatters.ts` - Currency, percent, number, shares, quarter formatting
- `src/lib/slugs.ts` - Bidirectional strategy group slug mapping
- `src/lib/utils.ts` - shadcn cn() utility
- `src/app/layout.tsx` - Root layout with NuqsAdapter, nav bar, QuarterPicker
- `src/app/page.tsx` - Landing page redirect to /groups
- `src/app/loading.tsx` - Skeleton loading state
- `src/app/_components/quarter-picker.tsx` - Client-side quarter selector using nuqs
- `src/app/_components/quarter-display.tsx` - Server component showing quarter period
- `src/app/_components/change-badge.tsx` - QoQ position change type badges
- `src/app/_components/weight-bar.tsx` - Visual portfolio weight proportion bar
- `src/app/_components/stat-card.tsx` - Reusable metric card using shadcn Card
- `src/components/ui/*.tsx` - 7 shadcn/ui components (card, table, badge, select, tabs, skeleton, separator)
- `tsconfig.json` - Updated for Next.js (jsx, plugins, noEmit, isolatedModules)
- `src/db/connection.ts` - HMR-safe singleton pattern via globalThis

## Decisions Made
- Removed `.js` extensions from all relative imports across the entire codebase (Turbopack/Next.js bundler does not resolve `.js` -> `.ts`; the `bundler` moduleResolution supports extensionless imports, and vitest/tsx also work fine without them)
- Used `nuqs` with `parseAsString` for quarter URL state (lightweight, SSR-compatible)
- HMR-safe database singleton via `globalThis.__hedgelens_db` to prevent multiple connections during Next.js dev

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed .js extensions from all relative imports for Turbopack compatibility**
- **Found during:** Task 2 (verification step)
- **Issue:** Turbopack cannot resolve `.js` extension imports pointing to `.ts` files. All existing analytics, db, ingestion, and CLI files used `.js` extensions for Node.js ESM compatibility.
- **Fix:** Removed `.js` from all relative import paths across 22 files using perl regex replacement. Both Turbopack bundler and existing tsx/vitest tooling support extensionless imports with `moduleResolution: "bundler"`.
- **Files modified:** All files under src/analytics/, src/db/, src/cli/, src/config/, src/ingestion/, src/security/
- **Verification:** `tsc --noEmit` passes, all 33 tests pass, Next.js dev server starts and renders pages without errors
- **Committed in:** aaccb7d (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for Next.js bundler compatibility. No scope creep. All existing tests continue to pass.

## Issues Encountered
- shadcn/ui init required Next.js config, app directory, Tailwind CSS, and PostCSS to all be in place before it could detect the framework. Resolved by creating files in the correct order.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All shared infrastructure ready for page development
- Plan 03-02 can immediately build /groups and /groups/[slug] and /funds/[cik] pages using data layer and shared components
- Plan 03-03 can build position detail and sector breakdown pages

## Self-Check: PASSED

- All 22 key files verified present
- Both task commits verified (21c6596, aaccb7d)
- TypeScript compiles without errors
- All 33 existing tests pass
- Next.js dev server starts and renders pages

---
*Phase: 03-dashboard*
*Completed: 2026-02-19*
