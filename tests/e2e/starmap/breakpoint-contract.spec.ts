import { test, expect } from '@playwright/test';
import { waitForStarmapReady } from '../fixtures/test-helpers';

/**
 * Breakpoint contract — locks down the fix for the 640–900px / landscape
 * "dead-zone" where the JS shell decision (useMobileShell, 900px + landscape
 * rule) disagreed with the CSS sm/md breakpoints, leaving a half-state with no
 * usable controls.
 *
 * The contract: at EVERY viewport, exactly one tool surface exists —
 *   - mobile shell  → the mobile action rail is visible, the desktop rail is NOT in the DOM
 *   - desktop shell → the desktop rail is in the DOM, the mobile rail is NOT
 * and `data-shell` on the view root matches the same single source of truth.
 *
 * Before the fix, at e.g. 800px the mobile rail was `sm:hidden` (display:none)
 * AND the desktop rail was shown — this matrix would have failed at 700/768/800/
 * 860/900 and at the 1024×600 / 1180×600 landscape sizes.
 */

const MOBILE_SHELL_MAX_WIDTH = 900;
const LANDSCAPE_MAX_WIDTH = 1200;
const LANDSCAPE_MAX_HEIGHT = 640;

function expectedShell(width: number, height: number): 'mobile' | 'desktop' {
  const isMobile =
    width <= MOBILE_SHELL_MAX_WIDTH ||
    (width > height && width <= LANDSCAPE_MAX_WIDTH && height <= LANDSCAPE_MAX_HEIGHT);
  return isMobile ? 'mobile' : 'desktop';
}

const VIEWPORTS: Array<{ width: number; height: number; note: string }> = [
  { width: 640, height: 900, note: 'sm boundary (portrait, mobile)' },
  { width: 700, height: 900, note: 'former dead-zone' },
  { width: 768, height: 900, note: 'md boundary / former dead-zone seam' },
  { width: 800, height: 900, note: 'former dead-zone (search was invisible here)' },
  { width: 860, height: 900, note: 'former dead-zone' },
  { width: 900, height: 900, note: 'shell boundary (still mobile)' },
  { width: 901, height: 900, note: 'first desktop width' },
  { width: 1024, height: 900, note: 'lg desktop' },
  { width: 1280, height: 900, note: 'wide desktop' },
  { width: 1024, height: 600, note: 'landscape tablet (mobile via landscape rule)' },
  { width: 1180, height: 600, note: 'landscape phone (mobile via landscape rule)' },
];

test.describe('Starmap breakpoint contract', () => {
  test('exposes exactly one tool surface that matches data-shell at every width', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await waitForStarmapReady(page, { skipWasmWait: true });

    const root = page.getByTestId('stellarium-view-root');
    const desktopRail = page.getByTestId('right-control-panel-content');
    const mobileRail = page.getByTestId('mobile-action-rail');

    for (const { width, height, note } of VIEWPORTS) {
      await page.setViewportSize({ width, height });
      // Let useMobileShell's resize subscription + React commit settle.
      await expect(root).toHaveAttribute('data-shell', expectedShell(width, height), {
        timeout: 5000,
      });

      if (expectedShell(width, height) === 'mobile') {
        await expect(mobileRail, `mobile rail must be visible at ${width}x${height} (${note})`).toBeVisible();
        await expect(
          desktopRail,
          `desktop rail must NOT exist in the mobile shell at ${width}x${height} (${note})`,
        ).toHaveCount(0);
      } else {
        await expect(
          desktopRail,
          `desktop rail must exist on desktop at ${width}x${height} (${note})`,
        ).toHaveCount(1);
        await expect(
          mobileRail,
          `mobile rail must NOT exist on desktop at ${width}x${height} (${note})`,
        ).toHaveCount(0);
      }
    }
  });

  test('search button reveals a visible, interactive panel across the former dead-zone', async ({ page }) => {
    // 800px was the concrete functional break: clicking Search routed to the
    // mobile drawer whose content was itself `sm:hidden` → search invisible.
    for (const width of [800, 700, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await waitForStarmapReady(page, { skipWasmWait: true });

      const searchToggle = page.getByTestId('search-toggle-button');
      await expect(searchToggle).toBeVisible();
      await searchToggle.click();

      const searchPanel = page.getByTestId('search-panel');
      await expect(searchPanel, `search panel must be visible at ${width}px`).toBeVisible();

      // And the search input inside must be reachable (truly interactive, not opacity:0 chrome).
      // The field is an <input type="search"> (role=searchbox), so locate by element.
      const searchInput = searchPanel.locator('input').first();
      await expect(searchInput, `search input must be visible at ${width}px`).toBeVisible();

      await page.keyboard.press('Escape');
    }
  });
});
