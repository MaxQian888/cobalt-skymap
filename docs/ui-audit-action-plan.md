# Starmap UI Audit — Action Plan & Progress

> Source: multi-agent component-by-component audit (architecture / performance / layout / responsiveness / best-practice), adversarially verified. Generated 2026-06-10.
> Severities reflect the **verified** verdict. Ordered by impact / effort.

**Legend:** ✅ done & verified · 🟡 in progress · ⬜ pending

| # | Status | Problem | Fix | Dim | Sev | Effort | Key files |
|---|---|---|---|---|---|---|---|
| 1 | ✅ | 640–900px + landscape dead-zones; mobile search invisible at ~800px | Drive all surface switches off `isMobileShell` (root `data-shell`, `TopToolbar` conditional-mounts subtrees, `RightControlPanel` gated `!isMobileShell`); drop shell-level `sm:hidden`/`hidden sm:flex`/`md:*` | responsiveness | critical/high | medium | stellarium-view, mobile-layout, right-control-panel, top-toolbar, search-panel, use-mobile-shell |
| 2 | ✅ | 2Hz idle re-render storm | Idempotent `updateViewDirection` (value-compare, ε=1e-6 rad) | perf | high | small | stellarium-store.ts:264 |
| 3 | ✅ | Double-mounted Sensor/AR → 2 rAF loops | Toggles now conditionally MOUNTED once via `isMobileShell` (not CSS-hidden) | perf | high | medium | top-toolbar.tsx |
| 12 | ✅ | memo(TopToolbar) defeated by inline closure | `toggleSessionPanel` useCallback in view-state hook; used at both call sites | perf | medium | small | use-stellarium-view-state, stellarium-view |
| 4 | ✅ | `AppControlMenu` renders Minimize/Maximize **twice** | Deleted duplicate `!showsNativeWindowControls` block; added "exactly one minimize" TDD test | best-practice | high | trivial | app-control-menu.tsx |
| 5 | ✅ | Coarse whole-store subscriptions (no selector) | Per-field selectors; `getState()` for sky-atlas catalog guard. (theme-customization-sections deliberately kept whole-store — see note) | perf | high/med | small | exposure-calculator, sky-atlas-panel, fov-settings, offline-cache-manager, use-object-search |
| 6 | ❌ REFUTED | "Eager settings tabs" — finding was **rate-limited, not adversarially verified**. Verified by hand: `ui/tabs.tsx` is stock Radix `Tabs.Content` with NO `forceMount` → Radix unmounts inactive tab content by default. Only the active tab mounts; Leaflet/DisplaySettings are already lazy. **No change needed.** | — | — | — | ui/tabs.tsx (verified) |
| 7 | ⬜ | Redundant per-`Tooltip` provider | Revert `Tooltip` to stock; keep single root provider | perf | medium | small | ui/tooltip.tsx:41-49 |
| 8 | ⬜ | Always-mounted heavy tool subtrees (subscriptions/memos run while closed) | Thin trigger + lazy `*Content`; `next/dynamic` heaviest bodies | perf | high | large | right-control-panel:162-201; mobile-layout:100-164; shot-list:452-477; satellite-tracker:236-338 |
| 9 | ⬜ | `allTools` rebuilds 17 elements on zoom/pan | `React.memo` leaves; split fov/ocular into separate memos | perf | high | medium | mobile-layout.tsx:100-194 |
| 10 | ⬜ | `display-settings.tsx` god-component (1155 lines) | Extract `ar-camera`/`stellarium-rendering`/`aladin-display` sub-panels | architecture | high | large | display-settings.tsx |
| 11 | ⬜ | Toolbar icon-button styling duplicated (~20×, 3 blur tokens) | Add `ToolbarIconButton`/`StatusToggleButton` CVA primitives | architecture | high | medium | app-control-menu, top-toolbar, right-control-panel, toolbar-button |
| 13 | ⬜ | Bidirectional panel mirror (implicit invariant) | Extract `useMobilePanelSync`; derive local booleans; one-directional close for store-backed | architecture | medium | large | stellarium-view.tsx:182-289 |
| 14 | ⬜ | AR concern + `querySelector().click()` in root | Extract `<ARLayer/>`; replace `handleToggleAr` with store action | architecture | medium | medium | stellarium-view.tsx:146,363,420-495 |
| 15 | ⬜ | Duplicated tool registry (sidebar vs mobile) | `useStarmapToolElements()` factory hook | architecture | medium | large | right-control-panel, mobile-layout |
| 16 | ⬜ | `observation-log.tsx` god-component (~1600 lines) | Extract `SessionFormDialog`/`ObservationFormDialog`; memoize `filteredSessions` | architecture | medium | medium | observation-log.tsx |
| 17 | ⬜ | Hardcoded English (i18n) | `useTranslations` + en/zh keys | best-practice | medium | small | device-workspace:51-81; equipment-settings:131 |
| 18 | ⬜ | Three toggle-row primitives | Consolidate on `ToggleItem`; delete `switch-item.tsx` | best-practice | medium | small | settings-shared:66; ui/switch-item:16; fov-settings:42 |
| 19 | ❌ REFUTED | `overlays/status-bar.tsx` is DEAD CODE — only rendered in its own test, never in the live app (live bar is `BottomStatusBar`). No runtime impact; flagged not deleted. | — | — | — | overlays/status-bar.tsx (unused) |
| 20 | ✅ | `containerBounds` state re-render storm on resize | rAF-coalesce + prev-equality guard (mirrors handleFovChange) | perf | low | small | use-stellarium-view-state.ts |
| 21 | ⬜ | Floating session-panel magic offsets (`right-10`/`right-[72px]`) | Derive from `--rail-width`/`--rail-gap` calc or flex sibling | layout | medium | small | right-control-panel.tsx:216-219 |
| 22 | 🟡 | Vertically-centered rail clip + missing `--safe-area-right` | DONE: added safe-area-right. TODO: top/bottom band anchor (needs runtime) | layout/resp | medium | small | right-control-panel.tsx |
| 23 | ⬜ | `useAdaptivePosition` tall-panel clamp + magic chrome numbers | Final re-clamp; shared `layout.ts` constants | layout | medium | small | use-adaptive-position.ts |
| 24 | ✅ | Drawer 30s forceUpdate + inline `new Date()` | currentTime held in state, advanced only by the 30s tick (info-panel had no such issue — report imprecise) | perf | medium | small | object-detail-drawer.tsx |
| 25 | ✅ | Mount-store rebuilds mountInfo+maps per poll | Value-equal short-circuit (return same state → Zustand Object.is skip); setCapabilities still recomputes feedback | perf | medium | small | mount-store.ts |
| 26 | ⬜ | ShotList unmemoized filter + full-list feasibility | Memoize filtered/grouped; cache feasibility by coord key | perf | medium | medium | shot-list.tsx:452-480 |
| 27 | ✅ | Duplicate `max-h` vh/dvh utilities (order-dependent winner) | Collapsed to single dvh value (modern webview supports dvh) | layout/resp | medium | small | right-control-panel.tsx |
| 28 | ⬜ | Magic-number ScrollArea heights | `flex-1 min-h-0` fill layout | layout | low | small | marker-manager:558; offline-cache-manager:280,351 |
| 29 | ✅ | Double `safe-area-bottom` on mobile bar | Dropped the redundant safe-area inset from `.mobile-bottom-bar` padding | layout | medium | trivial | globals.css |
| 30 | ❌ REFUTED | `.one-hand-bottom-bar` is an intentional TEST/STATE MARKER (2 tests detect one-hand mode via it), NOT a dead class. Left as-is. | — | — | — | mobile-layout.tsx (marker) |
| 31 | ⬜ | Default `compactBottomBar:false` overflows 360px phone; **action-rail 2px overflow @320px** (pre-existing, red on baseline) | Default true; fix narrow-phone rail width (root cause `scrollbar-gutter: stable both-edges` × `<main>` `w-screen`) — needs runtime | responsiveness | high | small | settings-store; mobile-layout; globals.css |
| 32 | ❌ REFUTED | Premise wrong — useMobileShell keys its snapshot on width×height, so a visualViewport scroll (pinch-pan, no dimension change) yields the same key → useSyncExternalStore bails, NO re-render. | — | — | — | use-mobile-shell.ts (verified) |
| 33 | ⬜ | Action-rail labels truncate in 361–430px | Raise `.mobile-rail-label` hide threshold to ~420px | layout | low | trivial | globals.css:758 |
| 34 | ⬜ | InfoPanel `sm:` styles dead under 900px guard | Collapse `sm:` to base or container-query | responsiveness | high | medium | info-panel.tsx:251,455,523 |
| 35 | ⬜ | `useAdaptivePosition` opts recreated each render | Memoize merged `opts`; `ResizeObserver`-driven measure | perf | high | medium | use-adaptive-position.ts:37,47,89 |
| 36 | ⬜ | Toolbar primitives bypass `ToolbarGroup`/`ToolbarButton` | Add `ToolbarGroup orientation`/`ToolbarSurface` | architecture | low | small | right-control-panel; app-control-menu |
| 37 | ⬜ | Misc low-cost leaks | I18nProvider memo; LogPanel memo; clock cadence; gallery `src=''`; map-interaction timestamp | perf/best-practice | low | small | (several) |
| 38 | 🟡 | a11y: missing labels + decorative emoji | DONE: `aria-label` on LanguageSwitcher/Search/MobileMenu; `inert` on collapsed rail. TODO: `aria-hidden` on ToggleItem emoji | accessibility | low/med | trivial | language-switcher, top-toolbar, right-control-panel |

**Best-practice adoption (cross-cutting, from §6):** React Compiler eval; container queries (`@container`) for sidebar/info-panel; `@theme --breakpoint-*` token; `useDeferredValue`/`useTransition` for search/FOV; lazy dialog bodies; ref-as-prop migration; toggle-row consolidation.

**Kept as-is (verified justified, do NOT "simplify"):** the request-id counter "event bus" (`onboarding-bridge-store`/`cli-bridge-store`) is the correct fire-once cross-tree command idiom. `MobileMenuDrawer` registry is NOT permanently mounted (vaul unmounts closed content) — only a per-render micro-alloc (just `useMemo` it).

**Suggested order:** 1–7 first (highest impact, small/medium), then 8–16 (structural), then layout/best-practice cleanup. Rows 1/31/34 share the breakpoint contract.

---

## Popup Components Audit (2026-06-11)

> Focused follow-up audit of the dialog/popup components (per goal: 每日事件 + 天文计算器 等弹窗 + 移动端自适应). Component-by-component read of `astro-calculator-dialog` (+11 tabs), `astro-events-calendar`, `event-detail-dialog`, `daily-knowledge-dialog` (810), `exposure-calculator` (1263) and the shared `ResponsiveDialog` shell. Status as of this commit: **all items below DONE; unit/tsc/lint green (203 suites / 3092 tests). Mobile-drawer + tab-cache benefit still need runtime verification.**

| # | Status | Problem | Fix | Dim | Sev | Key files |
|---|---|---|---|---|---|---|
| X1 | ✅ | `max-h-[Xvh] max-h-[Xdvh]` double-class is dead (twMerge keeps last → vh stripped); worse, `astro-calculator`+`daily-knowledge` passed `max-h-[100vh]` which twMerge-**overrode the shell's 88vh desktop cap** → those two ran full-height on desktop | Removed the redundant/overriding `max-h-*` from the three ResponsiveDialog popups; desktop now inherits the shell's `max-h-[88vh]`, mobile keeps its tier height. (Same insight as row 27, extended to dialogs.) | layout/resp | high (bug) | astro-calculator-dialog, daily-knowledge-dialog, event-detail-dialog |
| X2 | ✅ | Dialog trigger sizing inconsistent (`h-9 w-9` / bare `size=icon` / `h-10 w-10`) despite an unused `STARMAP_DIALOG_ICON_TRIGGER_CLASS` constant | astro-calculator + events triggers now use the shared constant. **Exposure trigger left as-is** — its `touch-target toolbar-btn` (44px) is load-bearing per the refuted #15. | architecture | medium | astro-calculator-dialog, astro-events-calendar, dialog-layout |
| X3 | ✅ | `astro-events-calendar` + `exposure-calculator` used raw `Dialog` → cramped centered popup on mobile instead of a bottom drawer like their siblings | Converted both to `ResponsiveDialog` (events=`standard-form`, exposure=`complex-editor`; exposure width scoped via `desktopClassName` so the mobile drawer stays full-width) | architecture/resp | high/med | astro-events-calendar, exposure-calculator |
| E-1 | ✅ | `event-detail-dialog` `EVENT_TYPE_LABELS` hardcoded English (not `t()`) → type labels untranslated in zh (new instance of row 17) | Added `eventDetail.typeLabel.*` (12 types, en+zh); label now `t(getEventTypeLabelKey(type))` | best-practice/i18n | high (bug) | event-detail-dialog, i18n/messages/{en,zh}.json |
| E-2 | ✅ | `EVENT_ICON_MAP`/`EVENT_COLOR_MAP` copy-pasted verbatim in calendar + detail (detail even carried a false "shared with calendar" comment) | Extracted `event-visuals.tsx` (maps + `getEventIcon`/`getEventColorClass`/`getEventTypeLabelKey` + unit test) | architecture | medium | event-visuals.tsx (new), astro-events-calendar, event-detail-dialog |
| E-3 | ✅ | `EventCard` not memoized + inline `onClick` closure → all cards re-render on any parent state change | `React.memo` + stable `onSelect(event)` prop (`setSelectedEvent` directly) | perf | medium | astro-events-calendar |
| C-1 | ✅ | Astro-calculator's 9 tabs use Radix default unmount → every tab switch remounts + recomputes heavy memos and loses in-tab selections | Lazy-mount + keep-alive: `mountedTabs` set, `forceMount` on visited tabs + `data-[state=inactive]:hidden`. First visit mounts; re-visit is instant; unopened tabs never mount (no eager all-tab compute) | perf | medium | astro-calculator-dialog |
| C-2 | ✅ | `sharedConstraints` held in `useState` with no setter | Plain module-const reference | best-practice | trivial | astro-calculator-dialog |
| D-1 | ✅ | daily-knowledge declared pure helpers (`normalizeMonths`/`getTodayDateKey`/formatters) inside the component body each render | Hoisted to module scope (formatters parameterized by `t`/`monthFormatter`) | best-practice | low | daily-knowledge-dialog |
| D-2 | ✅ | daily-knowledge feed cards rendered inline, not memoized → all re-render when the active item changes | Extracted memoized `KnowledgeFeedCard` (stable `item`/`onSelect`/`monthFormatter`) | perf | low | daily-knowledge-dialog |

**Refuted / out of scope this pass:** exposure-calculator's 3 tabs already **share top-level memos** (switching tabs does not recompute) → no C-1-style caching needed there. `bortleInfo` `.find()` in render is trivial (small array), left as-is.

**Still needs runtime verification (not yet done):** (a) mobile bottom-drawer rendering for `astro-events-calendar` + `exposure-calculator` at ≤640px (Playwright/visual); (b) the C-1 tab-cache benefit via React Profiler (switch away/back → no recompute); (c) desktop dialog height after X1 (should sit at 88vh with margin, was full-screen).
