import { Page, Locator, expect } from '@playwright/test';
import { TEST_TIMEOUTS } from './test-data';

/**
 * Selector for the Stellarium loading overlay
 */
const LOADING_OVERLAY_SELECTOR = '[data-testid="stellarium-loading-overlay"]';
const SPLASH_SELECTOR = '[data-testid="splash-screen"]';
const SEARCH_TOGGLE_SELECTOR = '[data-testid="search-toggle-button"]';
const SEARCH_INPUT_SELECTOR = '[data-testid="starmap-search-input"]';
const SETTINGS_BUTTON_SELECTOR = '[data-testid="settings-button"]';
const SETTINGS_PANEL_SELECTOR = '[data-testid="settings-panel"]';
const SESSION_PLANNER_BUTTON_SELECTOR = '[data-testid="session-planner-button"]';
const SESSION_PLANNER_DIALOG_SELECTOR = '[data-testid="session-planner-dialog"]';
const ABOUT_BUTTON_SELECTOR = '[data-testid="about-button"]';
const ABOUT_DIALOG_SELECTOR = '[data-testid="about-dialog"]';

async function neutralizeSplash(page: Page) {
  await page.evaluate((selector) => {
    document.querySelectorAll(selector).forEach((node) => {
      if (node instanceof HTMLElement) {
        node.style.pointerEvents = 'none';
        node.style.display = 'none';
        node.style.visibility = 'hidden';
        node.setAttribute('aria-hidden', 'true');
      }
    });
  }, SPLASH_SELECTOR).catch(() => {});
}

async function dismissSplashIfVisible(page: Page) {
  const splash = page.locator(SPLASH_SELECTOR).first();
  const skipHint = page.getByText(/press any key or click to skip|按任意键或点击跳过/i).first();
  const dialogOverlay = page.locator('[data-slot="dialog-overlay"][data-state="open"]').first();

  for (let attempt = 0; attempt < 3; attempt++) {
    const splashVisible = await splash.isVisible().catch(() => false);
    const hintVisible = await skipHint.isVisible().catch(() => false);

    if (splashVisible) {
      await splash.click({ timeout: TEST_TIMEOUTS.short }).catch(() => {});
    } else if (hintVisible) {
      await skipHint.click({ timeout: TEST_TIMEOUTS.short }).catch(() => {});
    }

    if (await dialogOverlay.isVisible().catch(() => false)) {
      await dialogOverlay.click({ force: true }).catch(() => {});
    }
    await page.keyboard.press('Escape').catch(() => {});

    const splashHidden = await splash.isHidden().catch(() => false);
    const overlayHidden = await dialogOverlay.isHidden().catch(() => false);
    if (splashHidden && overlayHidden) return;

    await page.waitForTimeout(300);
  }

  await splash.waitFor({ state: 'hidden', timeout: TEST_TIMEOUTS.splash }).catch(() => {});

  await neutralizeSplash(page);
}

/**
 * Helper to skip onboarding and setup wizard via localStorage
 */
export async function skipOnboardingAndSetup(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();

    localStorage.setItem('starmap-onboarding', JSON.stringify({
      state: {
        hasCompletedOnboarding: true,
        hasCompletedSetup: true,
        completedSteps: ['welcome', 'search', 'navigation', 'zoom', 'settings', 'fov', 'shotlist', 'tonight', 'contextmenu', 'complete'],
        setupCompletedSteps: ['welcome', 'location', 'equipment', 'preferences', 'complete'],
        showOnNextVisit: false,
      },
      version: 3,
    }));

    // Backward-compat keys kept for older tests/components.
    localStorage.setItem('onboarding-storage', JSON.stringify({
      state: {
        hasCompletedOnboarding: true,
        hasSeenWelcome: true,
        currentStepIndex: -1,
        isTourActive: false,
        completedSteps: ['welcome', 'search', 'navigation', 'zoom', 'settings', 'fov', 'shotlist', 'tonight', 'contextmenu', 'complete'],
        showOnNextVisit: false,
      },
      version: 0,
    }));
    localStorage.setItem('starmap-setup-wizard', JSON.stringify({
      state: {
        hasCompletedSetup: true,
        showOnNextVisit: false,
        completedSteps: ['welcome', 'location', 'equipment', 'preferences', 'complete'],
      },
      version: 1,
    }));

    // Disable splash during E2E runs for deterministic toolbar interactions.
    const rawSettings = localStorage.getItem('starmap-settings');
    try {
      const parsed = rawSettings
        ? (JSON.parse(rawSettings) as { state?: { preferences?: Record<string, unknown> }; version?: number })
        : {};
      parsed.state = parsed.state ?? {};
      const existingPreferences = parsed.state.preferences ?? {};
      parsed.state.preferences = {
        locale: existingPreferences.locale ?? 'en',
        ...existingPreferences,
        showSplash: false,
        dailyKnowledgeAutoShow: false,
      };
      localStorage.setItem('starmap-settings', JSON.stringify(parsed));
    } catch {
      localStorage.setItem('starmap-settings', JSON.stringify({
        state: { preferences: { locale: 'en', showSplash: false, dailyKnowledgeAutoShow: false } },
        version: 14,
      }));
    }
  });
}

async function seedOnboardingAndSetupOnInit(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();

    localStorage.setItem('starmap-onboarding', JSON.stringify({
      state: {
        hasCompletedOnboarding: true,
        hasCompletedSetup: true,
        completedSteps: ['welcome', 'search', 'navigation', 'zoom', 'settings', 'fov', 'shotlist', 'tonight', 'contextmenu', 'complete'],
        setupCompletedSteps: ['welcome', 'location', 'equipment', 'preferences', 'complete'],
        showOnNextVisit: false,
        hasSeenWelcome: true,
        isTourActive: false,
        isSetupOpen: false,
        phase: 'idle',
        resumeCheckpoint: null,
        tourHubOpen: false,
        activeTourId: null,
        tourProgressById: {},
        completedTours: ['first-run-core'],
        skippedCapabilities: {},
        lastCompletedAt: '2026-04-05T00:00:00.000Z',
      },
      version: 6,
    }));

    localStorage.setItem('onboarding-storage', JSON.stringify({
      state: {
        hasCompletedOnboarding: true,
        hasSeenWelcome: true,
        currentStepIndex: -1,
        isTourActive: false,
        completedSteps: ['welcome', 'search', 'navigation', 'zoom', 'settings', 'fov', 'shotlist', 'tonight', 'contextmenu', 'complete'],
        showOnNextVisit: false,
      },
      version: 0,
    }));

    localStorage.setItem('starmap-setup-wizard', JSON.stringify({
      state: {
        hasCompletedSetup: true,
        showOnNextVisit: false,
        completedSteps: ['welcome', 'location', 'equipment', 'preferences', 'complete'],
      },
      version: 1,
    }));

    localStorage.setItem('starmap-settings', JSON.stringify({
      state: {
        preferences: {
          locale: 'en',
          showSplash: false,
          dailyKnowledgeAutoShow: false,
        },
      },
      version: 19,
    }));
  });
}

/**
 * Helper to wait for starmap ready and dismiss onboarding.
 * This bypasses the WASM loading wait and skips onboarding dialogs
 * for faster and more reliable tests.
 */
export async function waitForStarmapReady(page: Page, options?: { skipWasmWait?: boolean }) {
  await seedOnboardingAndSetupOnInit(page);

  const openStarmap = async () => {
    await page.goto('/starmap', {
      waitUntil: 'domcontentloaded',
      timeout: TEST_TIMEOUTS.wasmInit,
    });
  };

  try {
    await openStarmap();
  } catch {
    // Retry once when dev server is still compiling the first page load.
    await page.waitForTimeout(1500);
    await openStarmap();
  }

  await dismissSplashIfVisible(page);
  
  // Wait for canvas to be visible
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible({ timeout: TEST_TIMEOUTS.long });
  
  // Wait for WASM loading overlay to disappear (if not skipping)
  if (!options?.skipWasmWait) {
    const loadingOverlay = page.locator(LOADING_OVERLAY_SELECTOR);
    try {
      // Check if loading overlay exists and wait for it to disappear
      const overlayVisible = await loadingOverlay.isVisible().catch(() => false);
      if (overlayVisible) {
        await loadingOverlay.waitFor({ state: 'hidden', timeout: TEST_TIMEOUTS.wasmInit });
      }
    } catch {
      // If timeout, log but continue - some tests may work without full WASM init
      console.warn('WASM loading timeout - continuing with test');
    }
  }
  
  // Wait a bit for UI to stabilize
  await page.waitForTimeout(1000);
  await neutralizeSplash(page);

  const compileIndicator = page.getByText(/Compiling/i).first();
  await compileIndicator.waitFor({ state: 'hidden', timeout: TEST_TIMEOUTS.wasmInit }).catch(() => {});
}

export async function ensureSearchPanelOpen(page: Page): Promise<Locator> {
  const searchInput = page.locator(SEARCH_INPUT_SELECTOR).first();
  const isInputVisible = await searchInput.isVisible().catch(() => false);
  if (isInputVisible) {
    return searchInput;
  }

  await neutralizeSplash(page);

  const searchToggleByTestId = page.locator(SEARCH_TOGGLE_SELECTOR).first();
  const hasTestIdToggle = await searchToggleByTestId.count();
  if (hasTestIdToggle > 0) {
    await expect(searchToggleByTestId).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
    await searchToggleByTestId.click();
  } else {
    const searchToggleFallback = page.getByRole('button', { name: /search objects|search|搜索/i }).first();
    await expect(searchToggleFallback).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
    await searchToggleFallback.click();
  }

  const testIdInputVisible = await searchInput.isVisible().catch(() => false);
  if (testIdInputVisible) {
    return searchInput;
  }

  const comboboxInput = page.locator('input[role="combobox"]').first();
  const hasComboboxInput = await comboboxInput.count();
  if (hasComboboxInput > 0) {
    await expect(comboboxInput).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
    return comboboxInput;
  }

  const placeholderInput = page.getByPlaceholder(/search|搜索/i).first();
  await expect(placeholderInput).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
  return placeholderInput;
}

export async function waitForSearchResults(page: Page, minOptions = 1): Promise<Locator> {
  const options = page.locator('[role="option"]');
  await expect
    .poll(async () => options.count(), { timeout: TEST_TIMEOUTS.long })
    .toBeGreaterThanOrEqual(minOptions);
  return options;
}

export async function openSettingsPanel(page: Page): Promise<Locator> {
  const panel = page.locator(SETTINGS_PANEL_SELECTOR).first();
  const panelVisible = await panel.isVisible().catch(() => false);
  if (panelVisible) {
    return panel;
  }

  const settingsButton = page.locator(SETTINGS_BUTTON_SELECTOR).first()
    .or(page.getByRole('button', { name: /settings|设置/i }).first());
  await neutralizeSplash(page);
  await expect(settingsButton).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
  await settingsButton.click();
  await expect(panel).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
  return panel;
}

export async function openSessionPlannerDialog(page: Page): Promise<Locator> {
  const dialog = page.locator(SESSION_PLANNER_DIALOG_SELECTOR).first();
  const alreadyOpen = await dialog.isVisible().catch(() => false);
  if (alreadyOpen) {
    return dialog;
  }

  const plannerButton = page.locator(SESSION_PLANNER_BUTTON_SELECTOR).first()
    .or(page.getByRole('button', { name: /session.*plan|观测.*计划/i }).first());
  await neutralizeSplash(page);
  await expect(plannerButton).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
  await plannerButton.click();
  await expect(dialog).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
  return dialog;
}

export async function openAboutDialog(page: Page): Promise<Locator> {
  const dialog = page.locator(ABOUT_DIALOG_SELECTOR).first();
  const alreadyOpen = await dialog.isVisible().catch(() => false);
  if (alreadyOpen) {
    return dialog;
  }

  const aboutButton = page.locator(ABOUT_BUTTON_SELECTOR).first()
    .or(page.getByRole('button', { name: /about|关于/i }).first());
  await neutralizeSplash(page);
  await expect(aboutButton).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
  await aboutButton.click();
  await expect(dialog).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
  return dialog;
}

/**
 * Helper to click on the starmap canvas at a specific position
 */
export async function clickCanvas(page: Page, x = 100, y = 100) {
  const canvas = page.locator('canvas').first();
  await canvas.click({ position: { x, y } });
}

/**
 * Helper to get the canvas locator
 */
export function getCanvas(page: Page) {
  return page.locator('canvas').first();
}

/**
 * Helper to search for an object and select the first result
 */
export async function searchAndSelectObject(page: Page, objectName: string) {
  await neutralizeSplash(page);
  const searchButton = page.getByRole('button', { name: /search|搜索/i }).first();
  if (await searchButton.isVisible().catch(() => false)) {
    await searchButton.click();
  }
  
  const searchInput = page.getByPlaceholder(/search/i).first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill(objectName);
    await page.waitForTimeout(1000);
    
    const firstResult = page.locator('[role="option"]').first();
    if (await firstResult.isVisible().catch(() => false)) {
      await firstResult.click();
      await page.waitForTimeout(500);
      return true;
    }
  }
  return false;
}

interface BoxLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

function right(box: BoxLike) {
  return box.x + box.width;
}

function bottom(box: BoxLike) {
  return box.y + box.height;
}

export async function getVisibleBox(locator: Locator, label: string): Promise<BoxLike> {
  await expect(locator, `${label} should be visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} should expose a layout box`).not.toBeNull();
  return box as BoxLike;
}

export async function expectInViewport(
  page: Page,
  locator: Locator,
  label: string,
  padding = 0,
) {
  const viewport = page.viewportSize();
  expect(viewport, 'viewport must be available in headed/headless browser context').not.toBeNull();
  const box = await getVisibleBox(locator, label);
  const viewportWidth = viewport!.width;
  const viewportHeight = viewport!.height;

  expect(box.x, `${label} should start within viewport`).toBeGreaterThanOrEqual(padding);
  expect(box.y, `${label} should start within viewport`).toBeGreaterThanOrEqual(padding);
  expect(right(box), `${label} should end within viewport`).toBeLessThanOrEqual(viewportWidth - padding);
  expect(bottom(box), `${label} should end within viewport`).toBeLessThanOrEqual(viewportHeight - padding);
}

export function boxesOverlap(a: BoxLike, b: BoxLike, minGap = 0) {
  return !(
    right(a) + minGap <= b.x
    || right(b) + minGap <= a.x
    || bottom(a) + minGap <= b.y
    || bottom(b) + minGap <= a.y
  );
}

export async function expectNoOverlap(
  first: Locator,
  second: Locator,
  firstLabel: string,
  secondLabel: string,
  minGap = 0,
) {
  const firstBox = await getVisibleBox(first, firstLabel);
  const secondBox = await getVisibleBox(second, secondLabel);
  expect(
    boxesOverlap(firstBox, secondBox, minGap),
    `${firstLabel} and ${secondLabel} should not overlap (minGap=${minGap}px)`,
  ).toBe(false);
}

export async function expectMinimumTouchTarget(
  locator: Locator,
  label: string,
  minSize = 44,
) {
  const box = await getVisibleBox(locator, label);
  expect(box.width, `${label} width should be >= ${minSize}px`).toBeGreaterThanOrEqual(minSize);
  expect(box.height, `${label} height should be >= ${minSize}px`).toBeGreaterThanOrEqual(minSize);
}
