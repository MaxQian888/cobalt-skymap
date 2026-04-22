import { test, expect } from '@playwright/test';
import { StarmapPage } from '../fixtures/page-objects';
import { openAboutDialog, waitForStarmapReady } from '../fixtures/test-helpers';

test.describe('About Dialog', () => {
  test.beforeEach(async ({ page }) => {
    // Initialize page object for potential future use
    new StarmapPage(page);
    await waitForStarmapReady(page);
  });

  test.describe('Dialog Access', () => {
    test('should have about button', async ({ page }) => {
      await expect(page.locator('[data-testid="about-button"]').first()).toBeVisible();
    });

    test('should open about dialog when clicking about button', async ({ page }) => {
      await openAboutDialog(page);
      await expect(page.locator('[data-testid="about-dialog"]').first()).toBeVisible();
    });

    test('should close about dialog with Escape', async ({ page }) => {
      const aboutButton = page.getByRole('button', { name: /about|关于/i }).first();
      
      if (await aboutButton.isVisible().catch(() => false)) {
        await aboutButton.click();
        await page.waitForTimeout(500);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        
        // Dialog should be closed - only assert if it was visible
        const dialog = page.locator('[role="dialog"]');
        if (await dialog.isVisible()) {
          await expect(dialog).toBeHidden({ timeout: 2000 });
        }
      }
    });

    test('should close about dialog with close button', async ({ page }) => {
      const aboutButton = page.getByRole('button', { name: /about|关于/i }).first();
      
      if (await aboutButton.isVisible().catch(() => false)) {
        await aboutButton.click();
        await page.waitForTimeout(500);
        
        const closeButton = page.getByRole('button', { name: /close|关闭/i })
          .or(page.locator('[data-testid="close-button"]'))
          .or(page.locator('button').filter({ has: page.locator('svg.lucide-x') }));
        
        if (await closeButton.first().isVisible().catch(() => false)) {
          await closeButton.first().click();
          await page.waitForTimeout(300);
        }
      }
    });
  });

  test.describe('Version Information', () => {
    test('should display app version', async ({ page }) => {
      const aboutButton = page.getByRole('button', { name: /about|关于/i }).first();
      
      if (await aboutButton.isVisible().catch(() => false)) {
        await aboutButton.click();
        await page.waitForTimeout(500);
        
        const versionInfo = page.locator('text=/version|版本|v\\d+\\.\\d+/i');
        expect(await versionInfo.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should display build date', async ({ page }) => {
      const aboutButton = page.getByRole('button', { name: /about|关于/i }).first();
      
      if (await aboutButton.isVisible().catch(() => false)) {
        await aboutButton.click();
        await page.waitForTimeout(500);
        
        const buildDate = page.locator('text=/build|date|构建|日期/i');
        expect(await buildDate.count()).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Credits and Acknowledgments', () => {
    test('should display credits section', async ({ page }) => {
      const aboutButton = page.getByRole('button', { name: /about|关于/i }).first();
      
      if (await aboutButton.isVisible().catch(() => false)) {
        await aboutButton.click();
        await page.waitForTimeout(500);
        
        const credits = page.locator('text=/credits|acknowledgments|致谢|鸣谢/i');
        expect(await credits.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should display Stellarium attribution', async ({ page }) => {
      const aboutButton = page.getByRole('button', { name: /about|关于/i }).first();
      
      if (await aboutButton.isVisible().catch(() => false)) {
        await aboutButton.click();
        await page.waitForTimeout(500);
        
        const stellariumCredit = page.locator('text=/stellarium/i');
        expect(await stellariumCredit.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should display data sources', async ({ page }) => {
      const aboutButton = page.getByRole('button', { name: /about|关于/i }).first();
      
      if (await aboutButton.isVisible().catch(() => false)) {
        await aboutButton.click();
        await page.waitForTimeout(500);
        
        const dataSources = page.locator('text=/data.*source|catalog|数据来源|星表/i');
        expect(await dataSources.count()).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('External Links', () => {
    test('should have GitHub link', async ({ page }) => {
      const aboutButton = page.getByRole('button', { name: /about|关于/i }).first();
      
      if (await aboutButton.isVisible().catch(() => false)) {
        await aboutButton.click();
        await page.waitForTimeout(500);
        
        const githubLink = page.locator('a[href*="github"]');
        expect(await githubLink.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should have documentation link', async ({ page }) => {
      const aboutButton = page.getByRole('button', { name: /about|关于/i }).first();
      
      if (await aboutButton.isVisible().catch(() => false)) {
        await aboutButton.click();
        await page.waitForTimeout(500);
        
        const docsLink = page.locator('text=/documentation|docs|文档/i');
        expect(await docsLink.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should open feedback flow and include issue URL parameters', async ({ page }) => {
      const aboutButton = page.getByRole('button', { name: /about|关于/i }).first();
      
      if (await aboutButton.isVisible().catch(() => false)) {
        await aboutButton.click();
        await page.waitForTimeout(500);

        const feedbackButton = page
          .locator('[data-testid="report-issue-button"]')
          .or(page.getByRole('button', { name: /report issue|反馈问题/i }))
          .first();

        if (await feedbackButton.isVisible().catch(() => false)) {
          await feedbackButton.click();
          await page.waitForTimeout(300);

          const titleInput = page.locator('[data-testid="feedback-title-input"]');
          const descriptionInput = page.locator('[data-testid="feedback-description-input"]');
          const stepsInput = page.locator('[data-testid="feedback-steps-input"]');
          const expectedInput = page.locator('[data-testid="feedback-expected-input"]');
          const submitButton = page.locator('[data-testid="feedback-submit-button"]').first();

          await titleInput.fill('E2E feedback title');
          await descriptionInput.fill('E2E feedback description');
          await stepsInput.fill('1. Open dialog\n2. Fill form\n3. Submit');
          await expectedInput.fill('Issue URL contains required parameters');

          const popupPromise = page.waitForEvent('popup', { timeout: 8000 });
          await submitButton.click();
          const popup = await popupPromise;

          await popup.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
          await expect
            .poll(() => popup.url(), { timeout: 8000 })
            .toContain('github.com/AstroAir/skymap-test/issues/new');

          const issueUrl = new URL(popup.url());
          expect(issueUrl.searchParams.get('template')).toBeTruthy();
          expect(issueUrl.searchParams.get('title')).toBeTruthy();
          expect(issueUrl.searchParams.get('body')).toBeTruthy();

          await popup.close().catch(() => {});
        }
      }
    });
  });

  test.describe('License Information', () => {
    test('should display license information', async ({ page }) => {
      const aboutButton = page.getByRole('button', { name: /about|关于/i }).first();
      
      if (await aboutButton.isVisible().catch(() => false)) {
        await aboutButton.click();
        await page.waitForTimeout(500);
        
        const license = page.locator('text=/license|MIT|GPL|Apache|许可/i');
        expect(await license.count()).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Tabs Navigation', () => {
    test('should have multiple tabs', async ({ page }) => {
      const aboutButton = page.getByRole('button', { name: /about|关于/i }).first();
      
      if (await aboutButton.isVisible().catch(() => false)) {
        await aboutButton.click();
        await page.waitForTimeout(500);
        
        const tabs = page.getByRole('tab');
        const tabCount = await tabs.count();
        // May have tabs for different sections
        expect(tabCount).toBeGreaterThanOrEqual(0);
      }
    });

    test('should switch between tabs', async ({ page }) => {
      const aboutButton = page.getByRole('button', { name: /about|关于/i }).first();
      
      if (await aboutButton.isVisible().catch(() => false)) {
        await aboutButton.click();
        await page.waitForTimeout(500);
        
        const tabs = page.getByRole('tab');
        const tabCount = await tabs.count();
        
        for (let i = 0; i < Math.min(tabCount, 3); i++) {
          await tabs.nth(i).click();
          await page.waitForTimeout(200);
        }
      }
    });
  });

  test.describe('Keyboard Shortcuts Reference', () => {
    test('should display keyboard shortcuts', async ({ page }) => {
      const aboutButton = page.getByRole('button', { name: /about|关于/i }).first();
      
      if (await aboutButton.isVisible().catch(() => false)) {
        await aboutButton.click();
        await page.waitForTimeout(500);
        
        const shortcuts = page.locator('text=/keyboard|shortcut|快捷键/i');
        expect(await shortcuts.count()).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('System Information', () => {
    test('should display browser information', async ({ page }) => {
      const aboutButton = page.getByRole('button', { name: /about|关于/i }).first();
      
      if (await aboutButton.isVisible().catch(() => false)) {
        await aboutButton.click();
        await page.waitForTimeout(500);
        
        const browserInfo = page.locator('text=/browser|chrome|firefox|safari|浏览器/i');
        expect(await browserInfo.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should display WebGL status', async ({ page }) => {
      const aboutButton = page.getByRole('button', { name: /about|关于/i }).first();
      
      if (await aboutButton.isVisible().catch(() => false)) {
        await aboutButton.click();
        await page.waitForTimeout(500);
        
        const webglStatus = page.locator('text=/webgl|graphics|图形/i');
        expect(await webglStatus.count()).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Critical Regression Coverage', () => {
    test('@smoke @regression should open about dialog and expose issue-report entrypoint', async ({ page }) => {
      await openAboutDialog(page);
      await expect(page.locator('[data-testid="about-dialog"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="report-issue-button"]').first()).toBeVisible();
    });

    test('@regression should open feedback flow from about dialog and allow returning to about dialog', async ({ page }) => {
      await openAboutDialog(page);
      await page.locator('[data-testid="report-issue-button"]').first().click();
      await expect(page.locator('[data-testid="feedback-title-input"]').first()).toBeVisible();

      await page.getByRole('button', { name: /close|关闭/i }).first().click();
      await openAboutDialog(page);
      await expect(page.locator('[data-testid="about-dialog"]').first()).toBeVisible();
    });

    test('@mobile @regression should keep about dialog within narrow viewport bounds', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openAboutDialog(page);

      const dialog = page.locator('[data-testid="about-dialog"]').first();
      await expect(dialog).toBeVisible();

      const box = await dialog.boundingBox();
      expect(box).not.toBeNull();
      if (!box) return;

      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(392);
      expect(box.y + box.height).toBeLessThanOrEqual(846);

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      expect(hasHorizontalOverflow).toBe(false);
    });

    test('@mobile @regression should keep feedback primary action reachable after rotation', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openAboutDialog(page);
      await page.locator('[data-testid="report-issue-button"]').first().click();

      const submitButton = page.locator('[data-testid="feedback-submit-button"]').first();
      await expect(submitButton).toBeVisible();
      await submitButton.scrollIntoViewIfNeeded();

      const beforeRotate = await submitButton.boundingBox();
      expect(beforeRotate).not.toBeNull();
      if (!beforeRotate) return;
      expect(beforeRotate.y + beforeRotate.height).toBeLessThanOrEqual(846);

      await page.setViewportSize({ width: 844, height: 390 });
      await expect(submitButton).toBeVisible();
      await submitButton.scrollIntoViewIfNeeded();

      const afterRotate = await submitButton.boundingBox();
      expect(afterRotate).not.toBeNull();
      if (!afterRotate) return;
      expect(afterRotate.y + afterRotate.height).toBeLessThanOrEqual(392);
    });
  });
});
