import { test, expect, type Page } from '@playwright/test';
import { TEST_TIMEOUTS } from '../fixtures/test-data';

type DailyKnowledgeSeedOptions = {
  enabled: boolean;
  autoShow: boolean;
  onlineEnhancement?: boolean;
  locale?: 'en' | 'zh';
  lastShownDate?: string | null;
  snoozedDate?: string | null;
  viewMode?: 'pager' | 'feed';
  wheelPagingEnabled?: boolean;
};

async function seedMobileUserAgent(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    });
  });
}

async function seedStarmapState(page: Page, options: DailyKnowledgeSeedOptions) {
  await page.addInitScript((seed: DailyKnowledgeSeedOptions) => {
    localStorage.setItem('starmap-onboarding', JSON.stringify({
      state: {
        hasCompletedOnboarding: true,
        hasCompletedSetup: true,
        completedSteps: ['welcome', 'search', 'navigation', 'zoom', 'settings', 'fov', 'shotlist', 'tonight', 'contextmenu', 'complete'],
        setupCompletedSteps: ['welcome', 'location', 'equipment', 'preferences', 'complete'],
        showOnNextVisit: false,
        isSetupOpen: false,
        isTourActive: false,
        phase: 'idle',
      },
      version: 3,
    }));

    localStorage.setItem('starmap-settings', JSON.stringify({
      state: {
        preferences: {
          locale: seed.locale ?? 'en',
          showSplash: false,
          dailyKnowledgeEnabled: seed.enabled,
          dailyKnowledgeAutoShow: seed.autoShow,
          dailyKnowledgeOnlineEnhancement: seed.onlineEnhancement ?? false,
        },
      },
      version: 13,
    }));

    localStorage.setItem('starmap-daily-knowledge', JSON.stringify({
      state: {
        favorites: [],
        history: [],
        lastShownDate: seed.lastShownDate ?? null,
        snoozedDate: seed.snoozedDate ?? null,
        lastSeenItemId: null,
        ...(seed.viewMode ? { viewMode: seed.viewMode } : {}),
        ...(typeof seed.wheelPagingEnabled === 'boolean'
          ? { wheelPagingEnabled: seed.wheelPagingEnabled }
          : {}),
      },
      version: 1,
    }));
  }, options);
}

async function openReadyStarmap(page: Page) {
  await page.goto('/starmap', {
    waitUntil: 'domcontentloaded',
    timeout: TEST_TIMEOUTS.wasmInit,
  });

  const splash = page.getByTestId('splash-screen');
  if (await splash.isVisible().catch(() => false)) {
    await splash.click({ force: true });
  }

  await page.waitForFunction(() => {
    const canvasReady = document.querySelectorAll('canvas').length > 0;
    const splashVisible = !!document.querySelector('[data-testid="splash-screen"]');
    const dailyKnowledgeButton = !!document.querySelector(
      '[data-tour-id="daily-knowledge"] button, button[aria-label="Daily Knowledge"], button[aria-label="每日知识"]'
    );

    return canvasReady && dailyKnowledgeButton && !splashVisible;
  }, { timeout: TEST_TIMEOUTS.long });

  await expect(page.locator('canvas').first()).toBeVisible({ timeout: TEST_TIMEOUTS.long });
}

async function openDailyKnowledgeManually(page: Page) {
  const opened = await page.evaluate(() => {
    const selectors = [
      'button[aria-label="Daily Knowledge"]',
      'button[aria-label="每日知识"]',
      '[data-tour-id="daily-knowledge"] button',
      'button[data-tour-id="daily-knowledge"]',
      '[data-tour-id="daily-knowledge"]',
    ];
    for (const selector of selectors) {
      const target = document.querySelector(selector) as HTMLElement | null;
      if (target) {
        target.click();
        return true;
      }
    }
    return false;
  });
  expect(opened).toBe(true);
}

test.describe('Daily Knowledge', () => {
  test('auto shows only once per day', async ({ page }) => {
    await seedStarmapState(page, { enabled: true, autoShow: true, onlineEnhancement: false });
    await openReadyStarmap(page);

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /daily knowledge|每日知识/i });
    await expect(dialog).toBeVisible({ timeout: TEST_TIMEOUTS.medium });

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: TEST_TIMEOUTS.medium });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: TEST_TIMEOUTS.long });
    await page.waitForTimeout(800);

    await expect(dialog).toBeHidden();
  });

  test('does not auto show when feature is disabled', async ({ page }) => {
    await seedStarmapState(page, { enabled: false, autoShow: true, onlineEnhancement: false });
    await openReadyStarmap(page);

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /daily knowledge|每日知识/i });
    await expect(dialog).toBeHidden();
  });

  test('respects do-not-show-today', async ({ page }) => {
    await seedStarmapState(page, { enabled: true, autoShow: true, onlineEnhancement: false });
    await openReadyStarmap(page);

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /daily knowledge|每日知识/i });
    await expect(dialog).toBeVisible({ timeout: TEST_TIMEOUTS.medium });

    const dontShowButton = dialog
      .getByRole('button', { name: /do not show again today|今天不再显示/i })
      .first();
    await dontShowButton.click();
    await expect(dialog).toBeHidden({ timeout: TEST_TIMEOUTS.medium });
    await page.waitForFunction(() => {
      const raw = localStorage.getItem('starmap-daily-knowledge');
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw);
        return Boolean(parsed?.state?.snoozedDate);
      } catch {
        return false;
      }
    }, { timeout: TEST_TIMEOUTS.medium });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: TEST_TIMEOUTS.long });
    await page.waitForTimeout(800);

    await expect(dialog).toBeHidden();
  });

  test('manual entry always works when enabled', async ({ page }) => {
    await seedStarmapState(page, { enabled: true, autoShow: false, onlineEnhancement: false });
    await openReadyStarmap(page);
    await openDailyKnowledgeManually(page);

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /daily knowledge|每日知识/i });
    await expect(dialog).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
  });

  test('related object jump executes without error toast', async ({ page }) => {
    await seedStarmapState(page, { enabled: true, autoShow: false, onlineEnhancement: false });
    await openReadyStarmap(page);
    await openDailyKnowledgeManually(page);

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /daily knowledge|每日知识/i });
    await expect(dialog).toBeVisible({ timeout: TEST_TIMEOUTS.medium });

    const relatedObjectButton = dialog.locator('button:has(svg.lucide-telescope)').first();
    await expect(relatedObjectButton).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
    await relatedObjectButton.click();

    await page.waitForTimeout(600);
    const errorToast = page
      .locator('[data-sonner-toast]')
      .filter({ hasText: /unable to locate|sky engine is not ready|无法定位|未就绪/i });
    await expect(errorToast).toHaveCount(0);
    await expect(dialog).toBeVisible();
  });

  test('shows native-language metadata in Chinese locale', async ({ page }) => {
    await seedStarmapState(page, {
      enabled: true,
      autoShow: false,
      onlineEnhancement: false,
      locale: 'zh',
    });
    await openReadyStarmap(page);
    await openDailyKnowledgeManually(page);

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /daily knowledge|每日知识/i });
    await expect(dialog).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
    await expect(dialog.getByText(/本地语言/)).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
    await expect(dialog.getByText(/事实来源/)).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
  });

  test('desktop opens in pager mode by default', async ({ page }) => {
    await seedStarmapState(page, { enabled: true, autoShow: false, onlineEnhancement: false });
    await openReadyStarmap(page);

    await openDailyKnowledgeManually(page);
    const dialog = page.locator('[role="dialog"]').filter({ hasText: /daily knowledge|每日知识/i });
    await expect(dialog).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
    await expect(dialog.getByTestId('daily-knowledge-view-pager')).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
  });

  test('mobile opens in feed mode and allows selecting another card', async ({ page }) => {
    await seedMobileUserAgent(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await seedStarmapState(page, { enabled: true, autoShow: false, onlineEnhancement: false });
    await openReadyStarmap(page);

    await openDailyKnowledgeManually(page);
    const dialog = page.locator('[role="dialog"]').filter({ hasText: /daily knowledge|每日知识/i });
    await expect(dialog).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
    await expect(dialog.getByTestId('daily-knowledge-view-feed')).toBeVisible({ timeout: TEST_TIMEOUTS.medium });

    const firstCard = dialog.locator('[data-testid="daily-knowledge-view-feed"] [data-current="true"]').first();
    await expect(firstCard).toBeVisible({ timeout: TEST_TIMEOUTS.medium });

    const nonCurrentButton = dialog
      .locator('[data-testid="daily-knowledge-view-feed"] [data-current="false"] button')
      .first();
    await expect(nonCurrentButton).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
    await nonCurrentButton.click();

    const updatedCurrent = dialog.locator('[data-testid="daily-knowledge-view-feed"] [data-current="true"]');
    await expect(updatedCurrent).toHaveCount(1);
  });

  test('manual refresh preserves feed context for the active date', async ({ page }) => {
    await seedStarmapState(page, {
      enabled: true,
      autoShow: false,
      onlineEnhancement: false,
      viewMode: 'feed',
    });
    await openReadyStarmap(page);
    await openDailyKnowledgeManually(page);

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /daily knowledge|每日知识/i });
    await expect(dialog).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
    await expect(dialog.getByTestId('daily-knowledge-view-feed')).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
    await expect(dialog.getByText(/curated fallback|本地策展回退/i)).toBeVisible({ timeout: TEST_TIMEOUTS.medium });

    const refreshButton = dialog.getByRole('button', { name: /refresh current date|刷新当前日期/i });
    await expect(refreshButton).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
    await refreshButton.click();

    await expect(dialog.getByTestId('daily-knowledge-view-feed')).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
    await expect(dialog.getByText(/curated fallback|本地策展回退/i)).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
  });

  test('offline degraded mode surfaces fallback messaging', async ({ page }) => {
    await seedStarmapState(page, { enabled: true, autoShow: false, onlineEnhancement: true });
    await openReadyStarmap(page);
    await page.context().setOffline(true);
    await openDailyKnowledgeManually(page);

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /daily knowledge|每日知识/i });
    await expect(dialog).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
    await expect(dialog.getByText(/^curated fallback$|^本地策展回退$/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.medium,
    });
    await expect(
      dialog.getByText(
        /NASA APOD was skipped because the app is offline|当前处于离线状态，已跳过 NASA APOD/i
      )
    ).toBeVisible({ timeout: TEST_TIMEOUTS.medium });
  });
});
