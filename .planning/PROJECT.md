# HedgeLens

## What This Is

A personal dashboard that visualizes quarter-over-quarter changes in portfolio composition for groups of hedge funds, organized by investment strategy. It pulls 13F filings directly from SEC EDGAR and surfaces what changed — new positions, exits, weight shifts, and conviction changes — so you can quickly see how Tiger Cubs, Activists, Macro funds, and others are repositioning.

## Core Value

Instantly see how strategy-grouped hedge funds changed their portfolios between quarters — what they bought, sold, and where they shifted conviction.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Pull and parse 13F filings from SEC EDGAR for configured fund managers
- [ ] Group fund managers by investment strategy (Tiger Cubs, Activist, Macro, Quant, Multi-Strategy)
- [ ] Seed each strategy group with well-known fund managers, stored in editable config
- [ ] Show group overview landing page with high-level stats per strategy
- [ ] Detect and display new positions (stocks appearing this quarter that weren't held last quarter)
- [ ] Detect and display exited positions (stocks held last quarter but gone this quarter)
- [ ] Calculate and display weight shifts (sector/stock allocation percentage changes)
- [ ] Calculate and display conviction changes (largest increases/decreases in shares held)
- [ ] Compare latest filing quarter vs previous quarter
- [ ] Drill into any strategy group for detailed change breakdown

### Out of Scope

- Multi-user/auth — personal tool, single user
- Multi-quarter trend analysis — QoQ only for v1
- Custom/editable strategy groups in the UI — config file editing only
- Real-time data — 13F filings are quarterly by nature
- Mobile app — web dashboard only

## Context

- 13F filings are submitted quarterly to the SEC by institutional investment managers with $100M+ AUM
- Filings are available via SEC EDGAR (XBRL/XML format)
- ~45-day filing deadline after quarter end means data arrives in waves
- Strategy group membership is subjective — the config-based approach lets the user adjust as needed
- Well-known strategy groups:
  - **Tiger Cubs**: Managers who trained under Julian Robertson at Tiger Management
  - **Activist**: Funds that take active roles in influencing company direction
  - **Macro**: Global macro strategy funds
  - **Quant**: Quantitative/systematic strategy funds
  - **Multi-Strategy**: Funds running multiple strategies simultaneously

## Constraints

- **Data source**: SEC EDGAR only — no paid APIs or third-party data subscriptions
- **Single user**: No authentication or access control needed
- **Filing format**: Must handle SEC EDGAR's XML/XBRL 13F formats

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SEC EDGAR as sole data source | Free, authoritative, no API keys needed | — Pending |
| Fixed strategy groups via config | Simpler than UI-based management, user can edit JSON | — Pending |
| Quarter-over-quarter comparison only | Keeps scope focused, most actionable timeframe | — Pending |
| Seed with well-known funds per strategy | Gets user started fast, adjustable via config | — Pending |

---
*Last updated: 2026-02-19 after initialization*
