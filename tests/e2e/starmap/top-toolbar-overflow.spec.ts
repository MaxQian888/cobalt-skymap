import { test, expect } from '@playwright/test';
import { waitForStarmapReady } from '../fixtures/test-helpers';

/**
 * Desktop top-bar priority+ overflow contract.
 *
 * The desktop bar renders ~28-30 controls + clock in one non-wrapping
 * justify-between row. Below ~1376px it used to clip controls off the right
 * edge. The fix folds the lowest-priority right-cluster groups
 * (Preferences -> Display -> Instruments -> Planning) into a "More" popover,
 * keeping Config / View-Help / Window always inline, and un-folds on widen.
 *
 * Contract verified here:
 *  - no control is ever clipped past the row's right edge at any desktop width
 *  - the "More" trigger appears only when at least one group is folded
 *  - folding follows priority order and un-folds cleanly when widened
 *  - folded groups keep their data-tour-id anchors reachable once the menu opens
 */

// Returns true if any toolbar control is clipped past the row's right edge.
async function measure(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('div[data-starmap-ui-control="true"]')];
    const row = rows.find((el) => el.className.includes('justify-between')) as HTMLElement | undefined;
    if (!row) return { found: false, clipped: -1, more: false, inline: {} as Record<string, boolean> };
    const vw = window.innerWidth;
    const controls = [...row.querySelectorAll('[role="toolbar"], button')];
    const clipped = controls.filter((c) => {
      const r = c.getBoundingClientRect();
      return r.right > vw + 0.5 || r.left < -0.5;
    }).length;
    const present = (id: string) => !!row.querySelector(`[data-tour-id="${id}"]`);
    return {
      found: true,
      clipped,
      more: !!document.querySelector('[data-testid="toolbar-overflow-trigger"]'),
      inline: {
        planning: present('session-planner'),
        instruments: present('plate-solver'),
        display: present('night-mode'),
        preferences: present('theme'),
        config: present('settings'),
        viewHelp: present('about'),
      },
    };
  });
}

test.describe('Desktop top-bar priority+ overflow', () => {
  test('never clips, and folds/un-folds in priority order across desktop widths', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await waitForStarmapReady(page, { skipWasmWait: true });

    // Wide: everything fits, nothing folded, no overflow trigger.
    await expect
      .poll(async () => (await measure(page)).more, { timeout: 5000 })
      .toBe(false);
    {
      const m = await measure(page);
      expect(m.clipped, 'no clipping at 1440px').toBe(0);
      expect(m.inline.planning && m.inline.instruments && m.inline.display && m.inline.preferences).toBe(true);
    }

    // Mid: the row would overflow -> some groups fold, trigger appears, no clip.
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect
      .poll(async () => (await measure(page)).more, { timeout: 5000 })
      .toBe(true);
    {
      const m = await measure(page);
      expect(m.clipped, 'no clipping at 1100px').toBe(0);
      // Config / View-Help stay inline; the lowest-priority groups fold first.
      expect(m.inline.config, 'config stays inline').toBe(true);
      expect(m.inline.viewHelp, 'view/help stays inline').toBe(true);
      expect(m.inline.preferences, 'preferences (lowest priority) folds first').toBe(false);
    }

    // Narrow desktop: all four foldable groups collapse, still no clip.
    await page.setViewportSize({ width: 960, height: 900 });
    await expect
      .poll(async () => {
        const m = await measure(page);
        return m.more && m.clipped === 0 && !m.inline.planning && !m.inline.preferences;
      }, { timeout: 5000 })
      .toBe(true);

    // Open the "More" menu -> the folded anchors become reachable (tour support).
    await page.getByTestId('toolbar-overflow-trigger').click();
    const content = page.getByTestId('toolbar-overflow-content');
    await expect(content).toBeVisible();
    for (const id of ['night-mode', 'theme', 'satellite', 'session-planner']) {
      await expect(content.locator(`[data-tour-id="${id}"]`)).toHaveCount(1);
    }
    await page.keyboard.press('Escape');

    // Widen back -> un-folds cleanly, trigger disappears, still no clip.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect
      .poll(async () => {
        const m = await measure(page);
        return !m.more && m.clipped === 0 && m.inline.preferences && m.inline.planning;
      }, { timeout: 5000 })
      .toBe(true);
  });
});
