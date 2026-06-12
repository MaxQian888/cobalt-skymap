# Starmap Shell Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the starmap top toolbar width-adaptive (priority+ overflow), unify the duplicated toolbar icon-button styling behind shared CVA primitives, de-duplicate the desktop/mobile tool registries with lazy bodies, and replace the sidebar's magic offsets with derived tokens — with zero behavior regressions verified by the existing Jest + Playwright suites.

**Architecture:** Four sequenced phases. Phase 1 lands low-risk shared primitives (`StatusToggleButton`, `ToolbarGroup` vertical orientation, single Tooltip provider) that the later phases build on. Phase 2 makes the desktop top toolbar adapt to width 900–1300px via a content-measuring `useToolbarOverflow` hook that folds lower-priority toolbar groups into a "More" popover (priority+ pattern). Phase 3 extracts a single `useStarmapToolElements()` factory shared by the desktop rail and mobile layout, splitting static-vs-dynamic tools so zoom/pan stops rebuilding 17 elements, and converts the heaviest always-mounted tool bodies to thin trigger + lazy body. Phase 4 replaces sidebar magic offsets (`right-10`/`right-[72px]`) with rail-width-derived CSS variables, routes the vertical rail through `ToolbarGroup orientation="vertical"`, and hardens `useAdaptivePosition` clamping.

**Tech Stack:** Next.js 16 / React 19 / TypeScript strict / Tailwind v4 / shadcn (Radix) / Zustand / next-intl. Tests: Jest + jsdom + React Testing Library (`*.test.tsx` in `__tests__/`), Playwright E2E (`tests/e2e/`). Class-variance-authority for variants. `cn()` from `@/lib/utils`.

**Verified findings backing this plan** (read from current code on 2026-06-10, not the partly-unverified audit report):
- `#11` duplicated icon-button class string `h-9 w-9 text-foreground/80 hover:text-foreground hover:bg-accent rounded-md` appears 4× in `top-toolbar.tsx:292-305`; search button has its own active-state inline variant (`185-190`); toggles each re-implement active coloring (`night-mode-toggle.tsx:33-39`).
- `#36` `ToolbarGroup` hard-codes `aria-orientation="horizontal"` (`toolbar-button.tsx:124`); the vertical rail re-implements the group container styling by hand (`right-control-panel.tsx:126/138/207`).
- `#7` every `Tooltip` self-wraps a `TooltipProvider` (`ui/tooltip.tsx:41-49`) while the root already provides one (`stellarium-view.tsx:378`).
- NEW (not in the 38-item plan): the desktop top toolbar renders ~27 controls + clock in a single non-wrapping `flex justify-between` row (`top-toolbar.tsx:155-157`) with no overflow/wrap/progressive-hide → crowds/clips on 900–1300px desktop windows.
- `#9` `mobile-layout.tsx:100-194` rebuilds all 17 tool elements whenever `currentFov`/`selectedObject`/`rotationAngle` change (zoom/pan).
- `#15` `right-control-panel.tsx` and `mobile-layout.tsx` independently construct the same ~17 tool elements with identical props.
- `#8` `FOVSimulator`/`ExposureCalculator`/`ShotList`/`ObservationLog`/`SatelliteTracker` are full heavy components mounted regardless of open state in both surfaces.
- `#21` floating session panel uses hard-coded `right-10`/`right-[72px]` (`right-control-panel.tsx:220`); rail is `w-[52px]` (`:124`).
- `#23` `useAdaptivePosition` bottom-edge clamp can push `top` above the top bar with no final re-clamp (`use-adaptive-position.ts:84-86`).

**Decisions locked with the user (2026-06-10):** top-bar strategy = progressive overflow menu (priority+). Scope = all four phases, no simplification.

---

## Verification Outcomes (2026-06-11, two adversarial workflow runs, 44 agents)

Every pending finding was re-verified against current code (the original audit's verifiers were rate-limited and never ran). User confirmed: do everything incl. a new a11y cluster; unify the toolbar resting token (✅ done — `TOOLBAR_ICON_RESTING_CLASS`).

**❌ REFUTED — removed from scope (adversarial reasoning, do NOT implement):**
- `#8` heavy-body `next/dynamic` lazy-split — memos are correctly gated, idle re-runs = 0; net-negative (breaks FOVSimulator's shared mosaic effect feeding the always-on overlay; janky opens).
- `#15` `useStarmapToolElements()` factory — the big dup is already shared via `useEquipmentFOVProps`; a shared factory would eagerly instantiate the mobile superset on desktop (perf regression) and flatten the intentional 44px mobile touch target.
- `#13` panel-mirror extraction — the `was*OpenRef` latches are load-bearing (detect close-from-inside); "derived booleans / one-directional" breaks desktop + close-from-inside + `stellarium-view.test.tsx:510-573`.
- `#14` AR `querySelector().click()` hook-extraction — "breaks on small shells" is FALSE (mounted in both); a shared hook spawns a 2nd `useDeviceOrientation` (violates the single-rAF invariant) + 2nd `savedSettingsRef` (state-restore regression). At most leave a comment that the testid is load-bearing.
- `#7` Tooltip provider de-dup — **SKIP**. `app/layout.tsx` has NO root provider; `/test-map` has bare `<Tooltip>` that would break; 167 tooltips/71 files; providers are lightweight (no re-render on open); self-wrap is shadcn canonical; collapsing changes skipDelay grouping app-wide. Keep the self-wrap.
- `#16` observation-log dialog extraction — refuted as a *perf* item (`filteredSessions` memo is a non-win: default `all` short-circuits). Optional maintainability refactor only, not this scope.
- `#18` toggle-row consolidation — `ToggleItem`(card) vs `SwitchItem`(chrome-less) are intentionally differentiated; merge is lossy (chrome doubling / id synthesis / 2 mock rewrites). Only the sliver: collapse the 2 inline `fov-settings` rows onto existing `ToggleItem`.
- `#35` adaptive `opts` identity — non-issue; the primitive `opts.*` deps already make `position` stable.

**✅ CONFIRMED — in scope (survived adversarial):**
- **Phase 2** top-bar priority+ overflow (UPHELD) — ResizeObserver fold of Preferences→Display→Instruments→Planning into a "More" popover; View/Help+Window always visible. Constraints: `memo(TopToolbar)` → local state not props; **folded items MUST keep their `data-tour-id` mounted** (onboarding tour `querySelector`); aria/keyboard parity (More trigger `aria-label`, popover reachable, folded toggles keep `aria-pressed`). Cheap partial mitigation: center clock lacks `flex-shrink` guard (squeezed first).
- **Phase 3 (slim)** `#9` mobile `allTools` static/dynamic split + `buildSelectionData` memo (NEW-perf-1); `#26` ShotList memo-gating; NEW-perf-4 `TargetCard` `React.memo`; small Satellite/FOV effect fixes (NEW-perf-3-sat / NEW-perf-2-fov). Sidebar NEW-perf-1 (`will-change` always-on) + NEW-perf-2 (collapsed subtree still re-renders).
- **Phase 4 sidebar** `#21` rail-width token (+ the session panel is **missing `--safe-area-right`** — real bug); `#22` band-anchor (needs runtime); `#36` vertical `ToolbarGroup` (watch bg-card/80↔/60, p-0.5↔p-1, and ToolbarSeparator default-orientation bug NEW-a11y-toolbar-2); `#23` final top-clamp.
- `#34` InfoPanel `sm:` dead under the 900px guard + NEW-perf-1 (memo defeated by 3 inline-closure props).
- **NEW a11y cluster** (user-approved): `#38` ToggleItem emoji `aria-hidden`; SwitchItem label non-associated span (breaks click-to-toggle); fov-settings rows lack label/switch association; marker group chips not keyboard-operable; ToolbarGroup stacks 9 `role="toolbar"` with no roving-tabindex (use `role="group"`+aria-label per cluster, `role="toolbar"` only on the outer); ToolbarSeparator orientation bug.

**Revised execution order:** Phase 2 (headline, runtime-verified) → Phase 3 (slim perf) → Phase 4 (sidebar) → a11y cluster. Phase 1 + resting-token unification already shipped.

**Progress (2026-06-11):** ✅ Phase 1 (1.1–1.5) · ✅ resting-token unification · ✅ **Phase 2 top-bar priority+ overflow** — `useToolbarOverflow` hook + `TopToolbarOverflowMenu` + top-toolbar integration + `openToolbarOverflow` tour reveal (9 capabilities wired) + E2E (`top-toolbar-overflow.spec.ts`); runtime-verified at 960/1100/1440px (0 clipped, was 11 at 1100), un-folds cleanly, folded tour anchors reachable. → Next: Phase 3.

---

## Roadmap & Dependencies

| Phase | Title | Depends on | Risk | Runtime verify needed |
|-------|-------|-----------|------|-----------------------|
| 1 | Shared primitives foundation | — | low | no (unit only) |
| 2 | Top-bar priority+ overflow | 1 (StatusToggleButton, single provider) | medium | yes (Playwright widths) |
| 3 | Tool registry factory + lazy bodies | 1 | high | yes (Playwright parity + perf) |
| 4 | Sidebar layout tokens & clamp | 1 (vertical ToolbarGroup) | low/med | yes (Playwright short viewport) |

Each phase ends green on `pnpm test` (changed files) + `pnpm exec tsc --noEmit` + `pnpm lint`, and Phases 2–4 additionally on the relevant Playwright spec. **Phases 2–4 below are specified to an unambiguous interface level; each will be expanded into its own full TDD plan (same format as Phase 1) at the start of that phase, after a checkpoint with the user.** This keeps each plan a working, testable unit per the writing-plans scope rule.

---

# Phase 1 — Shared Primitives Foundation

**Outcome:** A `StatusToggleButton` CVA primitive unifies the toggle/active-button styling; `ToolbarGroup` gains a backward-compatible `orientation` prop; `Tooltip` stops nesting a redundant provider (with a root-level provider guarantee). No visual or behavioral change intended — purely structural de-duplication, verified by existing + new unit tests.

**Files:**
- Create: `components/common/status-toggle-button.tsx`
- Create: `components/common/__tests__/status-toggle-button.test.tsx`
- Modify: `components/common/toolbar-button.tsx` (add `orientation` to `ToolbarGroup`)
- Modify: `components/common/__tests__/toolbar-button.test.tsx` (add vertical-orientation test)
- Modify: `components/ui/tooltip.tsx` (remove per-`Tooltip` provider)
- Modify: `app/layout.tsx` (or the top-level client provider) — guarantee one root `TooltipProvider`
- Modify: `components/common/night-mode-toggle.tsx` (adopt `StatusToggleButton`, tone="night") — **only after** the primitive task is green
- Modify: `components/starmap/view/top-toolbar.tsx` (search button → `StatusToggleButton`; drop the duplicated `h-9 w-9 …` className passed to the Display-group toggles)

> **Verified scope note (2026-06-10):** `SensorControlToggle`/`ARModeToggle` are rich multi-state status buttons (status dots, `data-*` attrs, 3+ active sub-states, disabled state). They are NOT simple two-state toggles and adopting the primitive would require one-off tones per button — over-abstraction. They stay bespoke (justified divergence). `StatusToggleButton` adoption is limited to NightModeToggle + the search button; the Display-group `#11` win is removing the redundant passed className, letting each toggle own its resting size/style.

---

### Task 1.1: `ToolbarGroup` gains `orientation` (backward compatible)

**Files:**
- Modify: `components/common/toolbar-button.tsx:105-138`
- Test: `components/common/__tests__/toolbar-button.test.tsx`

- [ ] **Step 1: Write the failing test** — append inside the existing `describe('ToolbarGroup', ...)` block:

```tsx
  it('defaults to horizontal orientation', () => {
    render(
      <ToolbarGroup>
        <div>Child</div>
      </ToolbarGroup>
    );
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal');
    expect(toolbar).toHaveClass('flex-row');
  });

  it('applies vertical orientation', () => {
    render(
      <ToolbarGroup orientation="vertical">
        <div>Child</div>
      </ToolbarGroup>
    );
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toHaveAttribute('aria-orientation', 'vertical');
    expect(toolbar).toHaveClass('flex-col');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- components/common/__tests__/toolbar-button.test.tsx`
Expected: FAIL — the vertical test fails (`aria-orientation` is `horizontal`, no `flex-col`).

- [ ] **Step 3: Implement** — replace `ToolbarGroupProps` + `ToolbarGroup` in `toolbar-button.tsx`:

```tsx
export interface ToolbarGroupProps {
  children: React.ReactNode;
  className?: string;
  /** Gap between buttons */
  gap?: "none" | "sm" | "md";
  /** Layout axis (default horizontal) */
  orientation?: "horizontal" | "vertical";
}

/**
 * Container for grouping toolbar buttons together
 */
export function ToolbarGroup({
  children,
  className,
  gap = "sm",
  orientation = "horizontal",
}: ToolbarGroupProps) {
  const gapClass = {
    none: "gap-0",
    sm: "gap-1",
    md: "gap-2",
  }[gap];

  return (
    <div
      role="toolbar"
      aria-orientation={orientation}
      className={cn(
        "flex items-center",
        orientation === "vertical" ? "flex-col" : "flex-row",
        "bg-card/60 backdrop-blur-md",
        "border border-border/50 rounded-lg",
        "p-1",
        gapClass,
        className
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- components/common/__tests__/toolbar-button.test.tsx`
Expected: PASS (including the pre-existing `aria-orientation="horizontal"` test — still green because default is horizontal).

- [ ] **Step 5: Commit**

```bash
rtk git add components/common/toolbar-button.tsx components/common/__tests__/toolbar-button.test.tsx
rtk git commit -m "feat(toolbar): add orientation prop to ToolbarGroup"
```

---

### Task 1.2: `StatusToggleButton` primitive

A single component encapsulating the repeated "icon button that reflects an on/off state" pattern: shared resting style, `tone`-driven active style, built-in tooltip, and `aria-pressed` for a11y. The resting style standardizes on the toolbar default (`bg-card/60 text-foreground/80 hover:text-foreground hover:bg-accent border border-border/50`), which is the consistency win `#11` targets.

**Files:**
- Create: `components/common/status-toggle-button.tsx`
- Test: `components/common/__tests__/status-toggle-button.test.tsx`

- [ ] **Step 1: Write the failing test** — `status-toggle-button.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusToggleButton } from '../status-toggle-button';
import { TooltipProvider } from '@/components/ui/tooltip';

const renderWithTooltip = (ui: React.ReactElement) =>
  render(<TooltipProvider>{ui}</TooltipProvider>);

describe('StatusToggleButton', () => {
  it('renders the icon and exposes the label as accessible name', () => {
    renderWithTooltip(
      <StatusToggleButton
        icon={<span data-testid="icon">I</span>}
        label="Toggle search"
        active={false}
        onClick={() => {}}
      />
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toggle search' })).toBeInTheDocument();
  });

  it('reflects active state via aria-pressed and the primary tone class', () => {
    renderWithTooltip(
      <StatusToggleButton
        icon={<span>I</span>}
        label="Search"
        active
        onClick={() => {}}
      />
    );
    const button = screen.getByRole('button', { name: 'Search' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveClass('text-primary');
  });

  it('uses the night tone active styling when tone="night"', () => {
    renderWithTooltip(
      <StatusToggleButton
        icon={<span>I</span>}
        label="Night"
        tone="night"
        active
        onClick={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: 'Night' })).toHaveClass('text-red-400');
  });

  it('fires onClick', () => {
    const onClick = jest.fn();
    renderWithTooltip(
      <StatusToggleButton icon={<span>I</span>} label="X" active={false} onClick={onClick} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'X' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('merges custom className', () => {
    renderWithTooltip(
      <StatusToggleButton icon={<span>I</span>} label="X" active={false} onClick={() => {}} className="custom" />
    );
    expect(screen.getByRole('button', { name: 'X' })).toHaveClass('custom');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- components/common/__tests__/status-toggle-button.test.tsx`
Expected: FAIL — module `../status-toggle-button` not found.

- [ ] **Step 3: Implement** — `components/common/status-toggle-button.tsx`:

```tsx
'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const statusToggleButtonVariants = cva(
  'h-9 w-9 backdrop-blur-md border border-border/50 transition-colors touch-target toolbar-btn',
  {
    variants: {
      tone: {
        primary: '',
        night: '',
      },
      active: { true: '', false: '' },
    },
    compoundVariants: [
      {
        active: false,
        className: 'bg-card/60 text-foreground/80 hover:text-foreground hover:bg-accent',
      },
      {
        tone: 'primary',
        active: true,
        className: 'bg-primary/20 text-primary border-primary/50',
      },
      {
        tone: 'night',
        active: true,
        className: 'bg-red-900/50 text-red-400 hover:bg-red-900/70',
      },
    ],
    defaultVariants: { tone: 'primary', active: false },
  }
);

export interface StatusToggleButtonProps
  extends Omit<React.ComponentProps<typeof Button>, 'children'>,
    VariantProps<typeof statusToggleButtonVariants> {
  icon: React.ReactNode;
  /** Accessible name + tooltip text */
  label: string;
  /** On/off state — drives aria-pressed and active styling */
  active: boolean;
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * Icon button that reflects an on/off state. Unifies the resting toolbar
 * style and tone-driven active style so search/night/sensor/AR toggles stop
 * re-declaring the same class strings (see ui-audit #11).
 */
export function StatusToggleButton({
  icon,
  label,
  active,
  tone = 'primary',
  tooltipSide = 'bottom',
  className,
  ...props
}: StatusToggleButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={active}
          className={cn(statusToggleButtonVariants({ tone, active }), className)}
          {...props}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- components/common/__tests__/status-toggle-button.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add components/common/status-toggle-button.tsx components/common/__tests__/status-toggle-button.test.tsx
rtk git commit -m "feat(common): add StatusToggleButton primitive for stateful icon buttons"
```

---

### Task 1.3: Single Tooltip provider — ⛔ ESCALATED (do NOT auto-implement)

**Decision (2026-06-10, verified):** The audit labelled `#7` "perf medium," but verification shows: (a) blast radius is **169 `<Tooltip>` across 73 files**; (b) only `stellarium-view`/`landing/footer`/`landing/hero-section` carry their own provider, so sibling landing sections rely on the auto-wrap; (c) each `TooltipProvider` is a lightweight context (a skip-delay timer) — 169 of them is a negligible runtime cost; (d) the self-wrapping `Tooltip` is shadcn's **current canonical** pattern, so "revert to stock" means adopting an *older* idiom. Cost/benefit is poor and risk is real. **Escalated to the Phase-1 verification workflow (rigorous cost/benefit) and the user checkpoint — not implemented inline.** The steps below are retained as the implementation recipe IF approved.

**Risk:** removing the per-`Tooltip` provider breaks any `<Tooltip>` whose render tree has no ancestor `TooltipProvider`. Mitigate by first guaranteeing a provider at the app root, then removing the nested one.

**Files:**
- Modify: `app/layout.tsx` (or the root client wrapper it renders)
- Modify: `components/ui/tooltip.tsx:41-49`

- [ ] **Step 1: Audit current provider coverage**

Run: `rtk grep -n "TooltipProvider" components app` and `rtk grep -rn "<Tooltip" app/(routes outside stellarium-view)`
Record: every entry route that renders a `<Tooltip>` (directly or via shared components) and whether it already has an ancestor `TooltipProvider`. The starmap route is covered by `stellarium-view.tsx:378`; confirm landing/onboarding/standalone dialog routes.

- [ ] **Step 2: Write the failing test** — `components/ui/__tests__/tooltip.test.tsx` (create):

```tsx
/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../tooltip';

describe('Tooltip', () => {
  it('does not render a nested TooltipProvider (relies on a single root provider)', () => {
    const { container } = render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>open</TooltipTrigger>
          <TooltipContent>hi</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    // Exactly one provider slot in the tree (the root one we rendered).
    expect(container.querySelectorAll('[data-slot="tooltip-provider"]').length).toBe(0);
    // Root provider is not a DOM node (Radix Provider is context-only); assert the
    // trigger renders, proving no "must be used within provider" throw occurred.
    expect(container.textContent).toContain('open');
  });
});
```

> Note: Radix `Provider` renders no DOM and `data-slot="tooltip-provider"` is set on the provider component props but does not emit a DOM attribute (it has no host element). The meaningful assertion is "no throw + trigger renders". Keep the `querySelectorAll(...).length` line only if a DOM marker exists after Step 4; otherwise delete it and rely on the render-success assertion. Decide during Step 2 by inspecting the rendered HTML.

- [ ] **Step 3: Run test to verify current behavior**

Run: `pnpm test -- components/ui/__tests__/tooltip.test.tsx`
Expected: PASS already for the "renders" assertion (self-wrapping provider also works inside a root provider). This test mainly locks in that a bare `<Tooltip>` under a single root provider works after the change.

- [ ] **Step 4: Add root provider, then remove nested provider**

In `app/layout.tsx` root client subtree, wrap children with `<TooltipProvider>` (import from `@/components/ui/tooltip`) if Step 1 found uncovered routes. Then in `components/ui/tooltip.tsx` change `Tooltip`:

```tsx
function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}
```

(Remove the `<TooltipProvider>` wrapper; keep the standalone `TooltipProvider` export for roots.)

- [ ] **Step 5: Run the broad tooltip-dependent test set**

Run: `pnpm test -- components/common components/starmap/view` and `pnpm exec tsc --noEmit`
Expected: PASS — no "must be used within TooltipProvider" errors. If any test renders a `<Tooltip>` without a provider, wrap that test's render in `<TooltipProvider>` (mirrors `night-mode-toggle.test.tsx:42`).

- [ ] **Step 6: Commit**

```bash
rtk git add app/layout.tsx components/ui/tooltip.tsx components/ui/__tests__/tooltip.test.tsx
rtk git commit -m "perf(tooltip): drop redundant per-instance provider, guarantee single root provider"
```

---

### Task 1.4: Adopt `StatusToggleButton` in `NightModeToggle`

Refactor only `NightModeToggle` (the clean two-state fit) to render `StatusToggleButton`, preserving the night-mode filter overlay + `useNightModeEffect`. Its existing test (queries by role + asserts store call + overlay) must stay green. Sensor/AR are intentionally left bespoke per the verified scope note above.

**Files:**
- Modify: `components/common/night-mode-toggle.tsx`

- [ ] **Step 1: Refactor `NightModeToggle`** — keep the overlay + `useNightModeEffect`; swap the Button/Tooltip block for:

```tsx
return (
  <>
    <StatusToggleButton
      icon={<MoonStar className={cn('h-5 w-5', nightMode && 'fill-current')} />}
      label={t('settings.nightMode')}
      tone="night"
      active={nightMode}
      onClick={() => toggleStellariumSetting('nightMode')}
      className={className}
    />
    {nightMode && <div className="night-mode-filter" aria-hidden="true" />}
  </>
);
```

Import `StatusToggleButton` from `@/components/common/status-toggle-button`; drop the now-unused `Button`/`Tooltip*` imports.

- [ ] **Step 2: Run the toggle test**

Run: `pnpm test -- components/common/__tests__/night-mode-toggle.test.tsx`
Expected: PASS. Fix accessible-name / side-effect mismatches in the refactor, not the test — the test asserts behavior (render, click → `toggleStellariumSetting('nightMode')`, `night-mode` document class, overlay presence), none of which the primitive changes.

- [ ] **Step 3: Commit**

```bash
rtk git add components/common/night-mode-toggle.tsx
rtk git commit -m "refactor(common): route NightModeToggle through StatusToggleButton"
```

---

### Task 1.5: Top toolbar consumes the primitives

Replace the inline search button and the duplicated icon-toggle classNames in `top-toolbar.tsx` with the primitives. The Display-group toggles already render their own internal Button, so the `h-9 w-9 …` className they receive becomes unnecessary once they use `StatusToggleButton` internally (Task 1.4) — drop the passed className here.

**Files:**
- Modify: `components/starmap/view/top-toolbar.tsx:176-200` (search button), `:291-305` (Display group classNames)
- Test: `components/starmap/view/__tests__/top-toolbar.test.tsx`

- [ ] **Step 1: Read `top-toolbar.test.tsx`** to learn how it queries the search button (`data-testid="search-toggle-button"`) and what it asserts, so the refactor keeps those hooks.

- [ ] **Step 2: Replace the search button** (lines 176-200) with:

```tsx
<div data-tour-id="search">
  <StatusToggleButton
    data-tour-id="search-button"
    data-testid="search-toggle-button"
    icon={isSearchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
    label={t('starmap.searchObjects')}
    active={isSearchOpen}
    onClick={onToggleSearch}
  />
</div>
```

(Import `StatusToggleButton` from `@/components/common/status-toggle-button`. The outer `<Tooltip>` wrapper is removed — the primitive provides its own.)

- [ ] **Step 3: De-duplicate the icon-toggle class string.** Add to `components/common/toolbar-button.tsx`:

```tsx
/** Shared resting style for bespoke stateful icon buttons in the toolbar (Sensor/AR/Language). */
export const TOOLBAR_ICON_TOGGLE_CLASS =
  "h-9 w-9 text-foreground/80 hover:text-foreground hover:bg-accent rounded-md";
```

In `top-toolbar.tsx`: import `TOOLBAR_ICON_TOGGLE_CLASS`; drop NightModeToggle's `className` entirely (the primitive owns its resting style now); replace the literal string on `SensorControlToggle`/`ARModeToggle` (`:294-295`) and `LanguageSwitcher` (`:305`) with `className={TOOLBAR_ICON_TOGGLE_CLASS}`. Verify the literal string no longer appears in top-toolbar:

Run: `rtk grep -c "h-9 w-9 text-foreground/80 hover:text-foreground hover:bg-accent rounded-md" components/starmap/view/top-toolbar.tsx`
Expected: `0` (it now lives once in `toolbar-button.tsx`).

> Deferred to checkpoint: fully unifying the Display group's resting backgrounds (NightMode via primitive = `bg-card/60`+border; Sensor/AR = `bg-background/60`) is a visual decision, not bundled here.

- [ ] **Step 4: Run top-toolbar tests + types**

Run: `pnpm test -- components/starmap/view/__tests__/top-toolbar.test.tsx && pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add components/starmap/view/top-toolbar.tsx
rtk git commit -m "refactor(top-toolbar): use StatusToggleButton, remove duplicated icon-button classes"
```

---

### Phase 1 exit gate

- [ ] `pnpm test -- components/common components/starmap/view components/ui` green
- [ ] `pnpm exec tsc --noEmit` → 0 errors
- [ ] `pnpm lint` clean on changed files
- [ ] **Checkpoint with user** before Phase 2 (per goal: discuss). Then expand Phase 2 into a full TDD plan.

---

# Phase 2 — Top-Bar Priority+ Overflow (spec → full plan at phase start)

**Outcome:** On the desktop shell, when the toolbar's content exceeds available width, the lowest-priority toolbar groups collapse, in priority order, into a single "⋯ More" popover anchored on the right cluster — content-measured, not breakpoint-guessed. Above ~1300px everything shows inline (current behavior). Keyboard/`aria` parity with inline buttons.

**Key interfaces (locked):**

- New `lib/hooks/use-toolbar-overflow.ts`:

```ts
export interface ToolbarOverflowItem { id: string; priority: number } // lower = drop first
export interface UseToolbarOverflowResult {
  containerRef: RefObject<HTMLDivElement | null>;
  measureRef: RefObject<HTMLDivElement | null>; // hidden full-width mirror for intrinsic widths
  visibleIds: Set<string>;   // ids that fit inline
  overflowIds: string[];     // ids folded into the More popover, priority order
}
export function useToolbarOverflow(items: ToolbarOverflowItem[]): UseToolbarOverflowResult;
```

Implementation: a `ResizeObserver` on `containerRef` plus a one-time intrinsic-width measure of each group from a visually-hidden `measureRef` mirror (keyed by `data-overflow-id`). On resize, greedily keep highest-priority groups whose summed width + the More-button width ≤ available; the rest become `overflowIds`. rAF-coalesced; `prefers-reduced-motion` respected for the popover.

- New `components/starmap/view/top-toolbar-overflow-menu.tsx`: a `Popover` (shadcn) trigger (`Ellipsis` icon, `aria-label` "More tools") rendering the overflow groups in a vertical stack, reusing the SAME group elements (no second registry — pass the already-built group nodes by id).

**Group priority order (drop-first → keep-last)** for the right cluster, from `top-toolbar.tsx:251-308`:
`display(4) < preferences(2) < instruments(3) < config(2) < planning(3)` — View/Help + Window groups never overflow (always-visible). Left cluster: `navigation(3) < discovery(3)` overflow after the right cluster is exhausted; search + mobile entry never overflow. Final order is finalized in the Phase 2 plan with measured widths.

**Tasks (outline — expanded with full code at phase start):**
1. `useToolbarOverflow` hook + unit test (jsdom: mock `ResizeObserver`, feed widths via `getBoundingClientRect` spies, assert visible/overflow partition at 1400/1100/950px).
2. `TopToolbarOverflowMenu` component + test (renders given group nodes; trigger has accessible name; reduced-motion).
3. Integrate into `top-toolbar.tsx`: wrap right-cluster groups with `data-overflow-id`, render the mirror, feed `useToolbarOverflow`, conditionally route overflowed groups into the menu. Keep `memo` intact (no new inline closures — wrap handlers already in `use-stellarium-view-state`).
4. Playwright `tests/e2e/starmap/top-toolbar-overflow.spec.ts`: at 1440/1100/960px desktop assert (a) no horizontal clipping of `[data-starmap-ui-control]`, (b) the More button appears ≤ threshold, (c) a known low-priority tool (e.g. ObjectTypeLegend) is reachable via the menu when overflowed.

**Verify:** existing `breakpoint-contract.spec.ts` stays green (desktop ≥ 900 still desktop shell); new overflow spec green; `tsc`/lint clean.

---

# Phase 3 — Tool Registry Factory + Targeted Perf (spec → full plan at phase start)

> **PLAN CORRECTION (2026-06-10, workflow-verified, adversarially survived):** `#8` "heavy tool bodies execute while closed → next/dynamic lazy-split" is **REFUTED**. Verified against current code: every expensive calc in FOVSimulator/ExposureCalculator/ShotList/SatelliteTracker is `useMemo`-gated with correct deps, so idle re-runs are **zero**; the satellite "nested loop" iterates `SAMPLE_SATELLITES` = **5** entries (microseconds, memoized); the network fetch is already `if (!open) return`-gated (`satellite-tracker.tsx:270`). The prescribed lazy-split is **net-negative** — it would break FOVSimulator's mosaic `useEffect` that feeds the always-on `FOVOverlay`, and turn instant dialog opens janky, for near-zero idle-CPU savings. **Do NOT lazy-split.** The genuine perf wins are the targeted memoizations below.

**Outcome:** One source of truth for the ~17 starmap tool elements, consumed by both the desktop rail and mobile layout; static (zoom/pan-independent) tools no longer rebuild on FOV/selection change (`#9`); the ShotList drawer's heavy work is gated on `open` and its list/cards memoized (`#26` + `NEW-perf-4`); two small always-mounted-effect smells fixed (`NEW-perf-2-fov`, `NEW-perf-3-sat`). No `next/dynamic` lazy-splitting of tool bodies.

**Key interfaces (locked):**

- New `lib/hooks/use-starmap-tool-elements.tsx`:

```ts
export interface StarmapToolElement { id: MobileToolId; element: React.ReactNode; dynamic: boolean }
export interface UseStarmapToolElementsParams {
  currentFov: number;
  selectedObject: SkyObject | null;
  contextMenuCoords: { ra: number; dec: number } | null;
  onGoToCoordinates: (ra: number, dec: number) => void;
  onSelectObject: (o: SkyObject | null) => void;
  onFovSliderChange: (fov: number) => void;
  onLocationChange: (...) => void;
}
export function useStarmapToolElements(p: UseStarmapToolElementsParams): StarmapToolElement[];
```

`dynamic: false` tools (`daily-knowledge`, `tonight`, `astro-events`, `astro-calculator`, `sky-atlas`, `equipment-manager`, `offline-cache`) are built once and `React.memo`-stable; only `dynamic: true` tools (`fov`, `exposure`, `markers`, `shotlist`, `observation-log`, `mount`, `ocular`, `plate-solver`, `location`) depend on the changing props. `mobile-layout.tsx` and `right-control-panel.tsx` both consume this and apply their own ordering/surface filtering (`sortByMobileToolPriority`, `getMobileToolsForSurface`).

**Tasks (outline):**
1. Extract factory hook from the union of `right-control-panel.tsx:124-210` + `mobile-layout.tsx:100-194`; unit test that all 17 ids are present and that re-rendering with a changed `currentFov` keeps `dynamic:false` element identities stable (memoized) while `dynamic:true` ones update.
2. Rewrite `mobile-layout.tsx` to consume the factory (delete its local `allTools` useMemo); keep compact/overflow logic. Memoize leaf tool components where they aren't already (`React.memo` on `DailyKnowledgeButton`, `TonightRecommendations`, etc. if cheap).
3. Rewrite `right-control-panel.tsx` rail to consume the factory.
4. **`#26` ShotList (high impact-per-effort, adversarially survived):** gate the O(n²) `targetPlan` + O(n) `targetFeasibility` memos on `open` (every consumer is inside `DrawerContent`); memoize `filteredTargets` via `useMemo` on real filter inputs instead of calling the imperative `getFilteredTargets()` each render; fix the **stale** `groupedTargets` memo (key it on `filteredTargets`+`groupBy`, not the stable `getGroupedTargets` ref); derive `plannedCount`/`completedCount` in one pass.
5. **`NEW-perf-4`:** wrap `ShotList` `TargetCard` (`shot-list.tsx:131`) in `React.memo` (SatelliteCard/PassCard already are), stabilizing per-card feasibility/plan props (depends on task 4's memoization).
6. **`NEW-perf-3-sat` / `NEW-perf-2-fov` (small):** SatelliteTracker — replace the `handleRefresh` blank-then-mutate-`dataSources` pattern with an explicit `refreshToken` in the fetch deps (keep stale satellites during the spinner), and memoize `observerLocation` on primitive lat/lon/elevation. FOVSimulator — sanitize on the `setMosaic` write path (or gate the reconciling effect on `open`) instead of an always-mounted `onMosaicChange` effect; ensure `validateMosaicSettings` is idempotent.
7. Playwright `mobile-functional-parity.spec.ts` stays green; add a React-profiler unit test that a simulated zoom does not re-render `dynamic:false` tools and that a closed ShotList does not run `targetPlan`.

**Verify:** parity spec green; `tsc`/lint; spot-check no double-mount of stateful overlays (sensor/AR already handled in Phase 1/existing). `#8` lazy-split intentionally NOT done (refuted).

---

# Phase 4 — Sidebar Layout Tokens & Clamp (spec → full plan at phase start)

**Outcome:** The right rail's geometry is driven by CSS variables instead of magic numbers; the floating session panel offset derives from the rail width; the vertical rail uses `ToolbarGroup orientation="vertical"`; `useAdaptivePosition` never positions a panel under the top bar.

**Tasks (outline):**
1. Add `--rail-width: 52px` and `--rail-gap: 0.5rem` tokens (globals.css or a layout constants module `lib/constants/starmap-layout.ts`); set rail `w-[var(--rail-width)]`; replace `right-10`/`right-[72px]` (`right-control-panel.tsx:220`) with `right-[calc(var(--rail-width)+var(--rail-gap)+var(--safe-area-right))]` (expanded) / `right-[calc(var(--rail-gap)+var(--safe-area-right))]` (collapsed). Unit/snapshot test asserts the computed class, not a literal magic number.
2. Route the rail's three hand-built containers (`right-control-panel.tsx:126/138/207`) through `ToolbarGroup orientation="vertical"` (from Phase 1).
3. `useAdaptivePosition` (`use-adaptive-position.ts:84-86`): after the bottom-edge clamp, re-clamp `top = Math.max(top, opts.topBarHeight + opts.padding)`; add unit test for a panel taller than the available band (asserts `top >= topBarHeight + padding`). Memoize `opts` so the `position` memo is stable (`#35`).
4. `#22` band-anchor: if runtime (Playwright at 768px-tall desktop) shows the centered rail clipping, switch `top-1/2 -translate-y-1/2` to a top/bottom-anchored band with `max-h` already in place; gate this change on the Playwright evidence.

**Verify:** new short-viewport Playwright check; existing `right-control-panel.test.tsx` green; `tsc`/lint.

---

## Self-Review (Phase 1 — the immediately-executed phase)

1. **Spec coverage:** `#36` → Task 1.1; `#11` → Tasks 1.2/1.4/1.5; `#7` → Task 1.3. ✓
2. **Placeholder scan:** Phase 1 tasks contain full component + test code, exact files, exact commands. Phases 2–4 are explicitly marked spec-level with locked interfaces, to be expanded into full TDD plans at phase start (per the writing-plans multi-subsystem rule) — not placeholders within an executing phase. ✓
3. **Type consistency:** `StatusToggleButton` props (`icon`, `label`, `active`, `tone`, `tooltipSide`, `className`) are used identically in Tasks 1.2/1.4/1.5. `ToolbarGroup` `orientation` default `"horizontal"` keeps the existing `aria-orientation="horizontal"` test green. ✓
