# Frontend Styling Normalization TODO

## Foundations (ScalarAI exact)
- [x] `src/styles/globals.css`: copy ScalarAI tokens, fonts, surfaces, motion, scrollbars.
- [x] `src/styles/components.css`: copy ScalarAI component classes.
- [x] `src/styles/index.css`: import Tailwind + global + component styles.
- [x] `src/main.tsx`: import `index.css`.
- [x] `index.html`: load Plus Jakarta Sans/JetBrains Mono; ScalarAI body classes.

## App shell and navigation
- [x] `App.tsx`: use ScalarAI page shell (`min-h-screen bg-slate-900 ... flex flex-col`, `max-w-7xl ... py-6 space-y-6`).
- [x] Single ScalarAI-style header wrapper (`Navbar.tsx`).
- [x] Mobile drawer component created and wired.
- [x] Tab navigation uses `.nav-tab-btn`/`.nav-tab-active`.
- [x] Footer uses ScalarAI status-bar class pattern.

## Header and mobile UX
- [x] Brand block, telemetry strip, quick action button styled like ScalarAI.
- [x] Mobile stop/action + hamburger button styled like ScalarAI.
- [x] Mobile drawer backdrop/panel/cards/navigation styled like ScalarAI.
- [x] Status dots/chips where used follow ScalarAI variants.

## Dashboard and terminal page
- [x] `DashboardPage.tsx`: standardized spacing/surfaces.
- [x] `AccountMetricsBar.tsx`: six metrics converted to `metric-box` + `metric-label` + `metric-val`.
- [x] `CurrentChartSymbolCard.tsx`: surfaces converted, compact badges normalized.
- [x] `LivePriceChart.tsx`, `LiveTickStream.tsx`, `MarketDepthPanel.tsx`: standard surfaces/buttons.
- [x] `MT5ConnectionRadar.tsx`, `ApiConnectionRadar.tsx`, `EaConnectionRadar.tsx`: standard surfaces/buttons/chips.
- [x] `AllTrackedSymbolsTable.tsx`, `OpenPositionsTable.tsx`, `PendingOrdersDock.tsx`, `TradeHistoryViewer.tsx`: tables converted to `data-table-*`.

## Order execution
- [x] `OrderExecutionDock.tsx`: inputs converted to `input-control`; buttons to `btn` variants; magic chip to `badge badge-info`.

## Gateway and MCP
- [x] `MT5GatewayPage.tsx`: card/button/table/chip normalization; status pill to badge.
- [x] `McpConsole.tsx`: surfaces/buttons normalized to ScalarAI classes.

## Risk and database
- [x] `RiskSettingsPanel.tsx`: inputs/buttons standard surfaces.
- [x] `RiskManagementPage.tsx`: delegates to normalized components.
- [x] `AsyncQueueMonitor.tsx`: tables and surface normalization.
- [x] `DatabaseExplorer.tsx`: table wrappers and surfaces normalized; accidental compact classes avoided.

## Audit/history/logs
- [x] `AuditLogViewer.tsx`, `AuditLogPage.tsx`: inputs/table/surface normalization.
- [x] `TradeHistoryViewer.tsx`: table cells and surfaces normalized.

## Pages
- [x] `BotStudioPage.tsx`: buttons/tables/raw surface normalization.
- [x] `DaemonPage.tsx`: buttons/surfaces/scroll area normalization.
- [x] `KnowledgeBasePage.tsx`: tab/button/table/surface normalization; compact chip badge.
- [x] `RiskManagementPage.tsx`: delegates to normalized components.
- [x] `DatabaseExplorer.tsx` (used via page): normalized.

## Shared styling conventions
- [x] Buttons: every major button uses `.btn` + variant + size.
- [x] Inputs/selects: standard controls use `.input-control`.
- [x] Tables: wrappers and table cells use `.data-table-*`.
- [x] Surfaces: major cards use `.card-panel` or ScalarAI subtle utilities; no leftover large raw card panels.
- [x] Chips/dots: remaining compact indicators converted to `.badge`/`.status-dot` variants where applicable.
- [x] Layout/header/footer follow ScalarAI’s exact classes.
- [x] Semantic metric values use `.metric-val`; labels use `.metric-label`.

## Final checks
- [x] `npm run lint` passes.
- [x] `npm run build` passes.
- [x] `FRONTEND_STYLING_TODO.md` updated.