# Build Project Fixer Typecheck Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the repository TypeScript gate by fixing the current root-cause type regressions without weakening checks or overwriting unrelated user work.

**Architecture:** Fix the failing `pnpm exec tsc --noEmit` surface in narrow clusters. Prefer root-cause repairs that realign tests and typing contracts with current production interfaces instead of broad casts or config relaxations.

**Tech Stack:** TypeScript, Jest, React Testing Library, Next.js 16, Zustand

---

## Chunk 1: Map Test Contract Alignment

### Task 1: Update map-related tests to follow current mocks and interfaces

**Files:**
- Modify: `components/starmap/map/__tests__/location-search.test.tsx`
- Modify: `components/starmap/map/__tests__/map-api-key-manager.test.tsx`
- Modify: `components/starmap/map/__tests__/map-health-monitor.test.tsx`
- Modify: `components/starmap/map/__tests__/map-location-picker.test.tsx`
- Modify: `components/starmap/map/__tests__/map-provider-settings.test.tsx`

- [ ] **Step 1: Keep the current failing signal visible**
Run: `pnpm exec tsc --noEmit`
Expected: failures for `useTranslations` reassignment, `SecretVaultStatus`, and missing `config` in map provider mocks.

- [ ] **Step 2: Replace readonly export reassignment with spy-based translation overrides**

- [ ] **Step 3: Update secret-vault status mocks to the current `SecretVaultStatus` shape**

- [ ] **Step 4: Add provider `config` objects anywhere `MapProviderSettings` mocks are constructed**

- [ ] **Step 5: Re-run TypeScript**
Run: `pnpm exec tsc --noEmit`
Expected: map-cluster errors are removed.

## Chunk 2: Device Profile Type Narrowing

### Task 2: Restore type correlation between `profile.type` and `profile.metadata`

**Files:**
- Modify: `lib/core/types/device.ts`
- Modify: `lib/core/device-readiness.ts`
- Modify: `lib/core/__tests__/device-profile-normalize.test.ts`
- Modify: `lib/stores/__tests__/device-store.test.ts`

- [ ] **Step 1: Preserve the current failing signal**
Run: `pnpm exec tsc --noEmit`
Expected: failures for `selectedDeviceId`, `selectedDevice`, `capabilitySnapshot`, and `actionAvailability`.

- [ ] **Step 2: Apply the smallest root-cause typing fix so mount metadata narrows correctly**

- [ ] **Step 3: Update tests or production narrowing only where still required**

- [ ] **Step 4: Re-run TypeScript**
Run: `pnpm exec tsc --noEmit`
Expected: device-profile errors are removed.

## Chunk 3: Test Fixture Typing Cleanup

### Task 3: Align logger, plate-solving, and settings fixtures with current types

**Files:**
- Modify: `lib/logger/__tests__/tauri-transport.test.ts`
- Modify: `lib/logger/__tests__/utils.test.ts`
- Modify: `lib/plate-solving/__tests__/online-solve-contract.test.ts`
- Modify: `lib/plate-solving/__tests__/solve-utils.test.ts`
- Modify: `lib/settings/settings-profile.ts`
- Modify: `lib/settings/__tests__/settings-profile-io.test.ts`
- Modify: `lib/settings/__tests__/settings-profile-transaction.test.ts`

- [ ] **Step 1: Preserve the current failing signal**
Run: `pnpm exec tsc --noEmit`
Expected: failures for tuple inference, bigint literal target, plate solve result shape, readonly domain arrays, and `never[]` test fixtures.

- [ ] **Step 2: Tighten or annotate test fixtures to the current production contracts**

- [ ] **Step 3: Re-run TypeScript**
Run: `pnpm exec tsc --noEmit`
Expected: these fixture typing errors are removed.

## Chunk 4: Observer Location Test Environment

### Task 4: Rebuild the observer-location test harness with browser-like storage types

**Files:**
- Modify: `lib/utils/__tests__/observer-location.test.ts`

- [ ] **Step 1: Preserve the current failing signal**
Run: `pnpm exec tsc --noEmit`
Expected: failures for `Storage` shape and `window` reassignment in the observer-location tests.

- [ ] **Step 2: Model `localStorage` with a proper `Storage`-compatible mock and install it via property descriptors**

- [ ] **Step 3: Re-run TypeScript**
Run: `pnpm exec tsc --noEmit`
Expected: observer-location typing errors are removed.

## Chunk 5: Verification

### Task 5: Reproduce green from narrow to broad

**Files:**
- Modify: none

- [ ] **Step 1: Re-run the original failing gate**
Run: `pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run the next broader repository check in the same area**
Run: `pnpm lint`
Expected: PASS or a newly surfaced, unrelated failure to report separately.

- [ ] **Step 3: Run the main build/verification path if the narrower checks pass**
Run: `pnpm build`
Expected: PASS or a clearly reported blocker.
