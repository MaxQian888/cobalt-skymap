import { test, expect, type Locator } from '@playwright/test';
import {
  waitForStarmapReady,
  expectInViewport,
  expectNoOverlap,
  expectMinimumTouchTarget,
} from '../fixtures/test-helpers';

async function clickRailButton(forceLocator: Locator) {
  await forceLocator.evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
}

test.describe('Mobile Functional Parity', () => {
  test('supports search -> details -> planning -> settings flow on mobile shell', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForStarmapReady(page, { skipWasmWait: true });

    const searchRailButton = page.getByTestId('mobile-rail-search');
    const detailRailButton = page.getByTestId('mobile-rail-details');
    const planningRailButton = page.getByTestId('mobile-rail-planning');
    const settingsRailButton = page.getByTestId('mobile-rail-settings');

    await expect(searchRailButton).toBeVisible();
    await expect(detailRailButton).toBeVisible();
    await expect(planningRailButton).toBeVisible();
    await expect(settingsRailButton).toBeVisible();

    await clickRailButton(searchRailButton);
    await expect(searchRailButton).toHaveAttribute('data-variant', 'default');
    await page.keyboard.press('Escape');
    await expect(searchRailButton).toHaveAttribute('data-variant', 'ghost');

    await clickRailButton(planningRailButton);
    await expect(planningRailButton).toBeVisible();
    await expect(planningRailButton).toHaveAttribute('data-variant', 'default');
    await expect(
      page.locator('[role="dialog"]').filter({ hasText: /session planner|观测计划|session/i }).first(),
    ).toBeVisible();
    await page.keyboard.press('Escape');

    await clickRailButton(settingsRailButton);
    await expect(settingsRailButton).toHaveAttribute('data-variant', 'default');
    await expect(page.getByTestId('settings-panel').first()).toBeVisible();
  });

  test('allows transition from search overlay to planning panel on mobile shell', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForStarmapReady(page, { skipWasmWait: true });

    const searchRailButton = page.getByTestId('mobile-rail-search');
    const planningRailButton = page.getByTestId('mobile-rail-planning');

    await clickRailButton(searchRailButton);
    await expect(searchRailButton).toHaveAttribute('data-variant', 'default');
    await page.keyboard.press('Escape');
    await expect(searchRailButton).toHaveAttribute('data-variant', 'ghost');

    await clickRailButton(planningRailButton);
    await expect(planningRailButton).toBeVisible();
    await expect(planningRailButton).toHaveAttribute('data-variant', 'default');
    await expect(
      page.locator('[role="dialog"]').filter({ hasText: /session planner|观测计划|session/i }).first(),
    ).toBeVisible();
  });

  test('keeps core mobile rail actions reachable on narrow viewport and orientation changes', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await waitForStarmapReady(page, { skipWasmWait: true });

    const searchRailButton = page.getByTestId('mobile-rail-search');
    const detailRailButton = page.getByTestId('mobile-rail-details');
    const planningRailButton = page.getByTestId('mobile-rail-planning');
    const settingsRailButton = page.getByTestId('mobile-rail-settings');
    const actionRail = page.getByTestId('mobile-action-rail');
    const bottomTools = page.getByTestId('mobile-bottom-tools-bar');
    const zoomCluster = page.getByTestId('mobile-zoom-cluster');
    const markersTool = bottomTools.locator('[data-tour-id="markers"]').first();

    await expect(actionRail).toBeVisible();
    await expect(bottomTools).toBeVisible();
    await expect(zoomCluster).toBeVisible();
    await expect(markersTool).toBeVisible();

    await expectInViewport(page, actionRail, 'mobile action rail');
    await expectInViewport(page, zoomCluster, 'mobile zoom cluster');
    await expectInViewport(page, markersTool, 'mobile markers tool entry');

    await expectNoOverlap(actionRail, zoomCluster, 'action rail', 'zoom cluster', 2);

    await expectMinimumTouchTarget(searchRailButton, 'mobile search rail button');
    await expectMinimumTouchTarget(planningRailButton, 'mobile planning rail button');
    await expectMinimumTouchTarget(settingsRailButton, 'mobile settings rail button');
    await expectMinimumTouchTarget(detailRailButton, 'mobile details rail button');

    await page.setViewportSize({ width: 812, height: 375 });

    const landscapeSearchEntry = page.getByTestId('mobile-rail-search')
      .or(page.locator('[data-tour-id="search-button"]').first())
      .first();
    const landscapePlanningEntry = page.getByTestId('mobile-rail-planning')
      .or(page.locator('[data-tour-id="session-planner"]').first())
      .first();
    const landscapeSettingsEntry = page.getByTestId('mobile-rail-settings')
      .or(page.getByTestId('settings-button'))
      .first();

    await expect(landscapeSearchEntry).toBeVisible();
    await expect(landscapePlanningEntry).toBeVisible();
    await expect(landscapeSettingsEntry).toBeVisible();

    const actionRailVisible = await actionRail.isVisible().catch(() => false);
    const bottomToolsVisible = await bottomTools.isVisible().catch(() => false);
    const zoomClusterVisible = await zoomCluster.isVisible().catch(() => false);

    if (actionRailVisible) {
      await expectInViewport(page, actionRail, 'mobile action rail (landscape)');
    }
    if (bottomToolsVisible) {
      await expect(markersTool).toBeVisible();
    }
    if (zoomClusterVisible) {
      await expectInViewport(page, zoomCluster, 'mobile zoom cluster (landscape)');
    }
  });

  test('shows actionable fallback when sensor permission is denied in AR flow', async ({ page }) => {
    await page.addInitScript(() => {
      class MockDeviceOrientationEvent extends Event {
        static async requestPermission() {
          return 'denied' as const;
        }
      }
      Object.defineProperty(window, 'DeviceOrientationEvent', {
        configurable: true,
        writable: true,
        value: MockDeviceOrientationEvent,
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await waitForStarmapReady(page, { skipWasmWait: true });

    const arToggle = page.getByTestId('ar-mode-toggle').first();
    await expect(arToggle).toBeVisible();
    await arToggle.click();

    await expect(page.getByText(/Use Sensor Control to grant or retry orientation permission\./i)).toBeVisible();
  });


  test('shows calibration-required fallback when AR sensor is available and uncalibrated', async ({ page }) => {
    await page.addInitScript(() => {
      class MockDeviceOrientationEvent extends Event {
        // Intentionally omit requestPermission to simulate environments
        // where orientation access is already allowed.
      }
      Object.defineProperty(window, 'DeviceOrientationEvent', {
        configurable: true,
        writable: true,
        value: MockDeviceOrientationEvent,
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await waitForStarmapReady(page, { skipWasmWait: true });

    const arToggle = page.getByTestId('ar-mode-toggle').first();
    await expect(arToggle).toBeVisible();
    await arToggle.click();

    await expect(page.getByText(/Calibrate sensor from Sensor Control to improve pointing\./i)).toBeVisible();
  });

  test('keeps desktop AR launch in camera-first guidance when no live sensor path is available', async ({ page }) => {
    await page.addInitScript(() => {
      class MockDesktopDeviceOrientationEvent extends Event {}

      Object.defineProperty(window, 'DeviceOrientationEvent', {
        configurable: true,
        writable: true,
        value: MockDesktopDeviceOrientationEvent,
      });

      Object.defineProperty(window.navigator, 'maxTouchPoints', {
        configurable: true,
        value: 0,
      });

      const originalMatchMedia = window.matchMedia?.bind(window);
      window.matchMedia = ((query: string) => {
        if (query === '(pointer: coarse)') {
          return {
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
          } as MediaQueryList;
        }

        return originalMatchMedia
          ? originalMatchMedia(query)
          : {
              matches: false,
              media: query,
              onchange: null,
              addListener: () => {},
              removeListener: () => {},
              addEventListener: () => {},
              removeEventListener: () => {},
              dispatchEvent: () => false,
            } as MediaQueryList;
      }) as typeof window.matchMedia;
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await waitForStarmapReady(page, { skipWasmWait: true });

    const arToggle = page.getByTestId('ar-mode-toggle').first();
    await expect(arToggle).toBeVisible();
    await arToggle.click();

    await expect(arToggle).toHaveAttribute('data-ar-operating-mode', 'camera-first');
    await expect(page.getByTestId('ar-launch-assistant')).toHaveAttribute('data-ar-operating-mode', 'camera-first');
    await expect(page.getByText(/camera-first AR guidance path/i).first()).toBeVisible();
  });
});
