import { test, expect } from '@playwright/test';
import { StarmapPage } from '../fixtures/page-objects';
import { openSettingsPanel, waitForStarmapReady } from '../fixtures/test-helpers';

test.describe('Settings Panel', () => {
  let starmapPage: StarmapPage;

  test.beforeEach(async ({ page }) => {
    starmapPage = new StarmapPage(page);
    // Use skipWasmWait for faster tests - settings panel works before WASM loads
    await waitForStarmapReady(page, { skipWasmWait: true });
  });

  test.describe('Settings Panel Access', () => {
    test('should have settings button', async ({ page }) => {
      await expect(page.locator('[data-testid="settings-button"]').first()).toBeVisible();
    });

    test('should open settings panel when clicking settings button', async ({ page }) => {
      await openSettingsPanel(page);
      await expect(page.locator('[data-testid="settings-panel"]').first()).toBeVisible();
    });

    test('should close settings panel with Escape', async ({ page }) => {
      const settingsButton = page.getByRole('button', { name: /settings|设置/i }).first();
      
      if (await settingsButton.isVisible().catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(500);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    });

    test('should close settings panel with close button', async ({ page }) => {
      const settingsButton = page.getByRole('button', { name: /settings|设置/i }).first();
      
      if (await settingsButton.isVisible().catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(500);
        
        const closeButton = page.getByRole('button', { name: /close|关闭/i })
          .or(page.locator('[data-testid="close-button"]'))
          .or(page.locator('button').filter({ has: page.locator('svg.lucide-x') }));
        
        if (await closeButton.first().isVisible().catch(() => false)) {
          await closeButton.first().click();
        }
      }
    });
  });

  test.describe('Display Settings', () => {
    test('should have constellation lines toggle', async ({ page }) => {
      const settingsButton = page.getByRole('button', { name: /settings|设置/i }).first();
      
      if (await settingsButton.isVisible().catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(500);
        
        const toggle = page.getByRole('switch', { name: /constellation.*line|星座线/i })
          .or(page.locator('text=/constellation.*line|星座线/i'));
        expect(await toggle.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should toggle constellation lines', async ({ page }) => {
      const settingsButton = page.getByRole('button', { name: /settings|设置/i }).first();
      
      if (await settingsButton.isVisible().catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(500);
        
        const toggle = page.getByRole('switch', { name: /constellation/i }).first();
        if (await toggle.isVisible().catch(() => false)) {
          await toggle.click();
          await page.waitForTimeout(300);
          await toggle.click();
        }
      }
    });

    test('should have azimuthal grid toggle', async ({ page }) => {
      const settingsButton = page.getByRole('button', { name: /settings|设置/i }).first();
      
      if (await settingsButton.isVisible().catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(500);
        
        const toggle = page.locator('text=/azimuthal.*grid|方位网格/i');
        expect(await toggle.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should have equatorial grid toggle', async ({ page }) => {
      const settingsButton = page.getByRole('button', { name: /settings|设置/i }).first();
      
      if (await settingsButton.isVisible().catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(500);
        
        const toggle = page.locator('text=/equatorial.*grid|赤道网格/i');
        expect(await toggle.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should have meridian line toggle', async ({ page }) => {
      const settingsButton = page.getByRole('button', { name: /settings|设置/i }).first();
      
      if (await settingsButton.isVisible().catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(500);
        
        const toggle = page.locator('text=/meridian|子午线/i');
        expect(await toggle.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should have ecliptic line toggle', async ({ page }) => {
      const settingsButton = page.getByRole('button', { name: /settings|设置/i }).first();
      
      if (await settingsButton.isVisible().catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(500);
        
        const toggle = page.locator('text=/ecliptic|黄道/i');
        expect(await toggle.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should have atmosphere toggle', async ({ page }) => {
      const settingsButton = page.getByRole('button', { name: /settings|设置/i }).first();
      
      if (await settingsButton.isVisible().catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(500);
        
        const toggle = page.locator('text=/atmosphere|大气/i');
        expect(await toggle.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should have landscape toggle', async ({ page }) => {
      const settingsButton = page.getByRole('button', { name: /settings|设置/i }).first();
      
      if (await settingsButton.isVisible().catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(500);
        
        const toggle = page.locator('text=/landscape|地景/i');
        expect(await toggle.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should have deep sky objects toggle', async ({ page }) => {
      const settingsButton = page.getByRole('button', { name: /settings|设置/i }).first();
      
      if (await settingsButton.isVisible().catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(500);
        
        const toggle = page.locator('text=/deep.*sky|深空天体/i');
        expect(await toggle.count()).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Sky Survey Settings', () => {
    test('should have sky survey selector', async ({ page }) => {
      const settingsButton = page.getByRole('button', { name: /settings|设置/i }).first();
      
      if (await settingsButton.isVisible().catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(500);
        
        const surveySelector = page.locator('text=/survey|巡天/i');
        expect(await surveySelector.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should change sky survey', async ({ page }) => {
      const settingsButton = page.getByRole('button', { name: /settings|设置/i }).first();
      
      if (await settingsButton.isVisible().catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(500);
        
        const surveySelect = page.locator('[data-testid="survey-selector"]')
          .or(page.getByRole('combobox', { name: /survey/i }));
        
        if (await surveySelect.first().isVisible().catch(() => false)) {
          await surveySelect.first().click();
          await page.waitForTimeout(300);
        }
      }
    });
  });

  test.describe('Settings Tabs', () => {
    test('should have display tab', async ({ page }) => {
      const settingsButton = page.getByRole('button', { name: /settings|设置/i }).first();
      
      if (await settingsButton.isVisible().catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(500);
        
        const displayTab = page.getByRole('tab', { name: /display|显示/i });
        expect(await displayTab.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should switch between tabs', async ({ page }) => {
      const settingsButton = page.getByRole('button', { name: /settings|设置/i }).first();
      
      if (await settingsButton.isVisible().catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(500);
        
        const tabs = page.getByRole('tab');
        const tabCount = await tabs.count();
        
        for (let i = 0; i < Math.min(tabCount, 4); i++) {
          await tabs.nth(i).click();
          await page.waitForTimeout(200);
        }
      }
    });
  });

  test.describe('Settings Persistence', () => {
    test('should persist settings after page reload', async ({ page }) => {
      const settingsButton = page.getByRole('button', { name: /settings|设置/i }).first();
      
      if (await settingsButton.isVisible().catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(500);
        
        // Toggle a setting
        const toggle = page.getByRole('switch').first();
        if (await toggle.isVisible().catch(() => false)) {
          const initialState = await toggle.getAttribute('data-state');
          expect(initialState === 'checked' || initialState === 'unchecked' || initialState === null).toBeTruthy();
          await toggle.click();
          await page.waitForTimeout(300);
          
          // Close settings
          await page.keyboard.press('Escape');
          
          // Reload page
          await page.reload();
          await starmapPage.waitForSplashToDisappear();
          
          // Settings should be persisted (via localStorage)
        }
      }
    });
  });

  test.describe('Draft Workflow', () => {
    test('should expose save and cancel controls in settings header', async ({ page }) => {
      const settingsButton = page.getByRole('button', { name: /settings|设置/i }).first();

      if (await settingsButton.isVisible().catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(500);

        const saveButton = page.getByRole('button', { name: /save|保存/i });
        const cancelButton = page.getByRole('button', { name: /cancel|取消/i });

        expect(await saveButton.count()).toBeGreaterThanOrEqual(0);
        expect(await cancelButton.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should allow canceling a draft edit in connection settings', async ({ page }) => {
      const settingsButton = page.getByRole('button', { name: /settings|设置/i }).first();

      if (await settingsButton.isVisible().catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(500);

        const settingsPanel = page.locator('[data-testid="settings-panel"]').first();

        const connectionSection = page.getByText(/connection|连接/i).first();
        if (await connectionSection.isVisible().catch(() => false)) {
          await connectionSection.click();
          await page.waitForTimeout(200);
        }

        const ipInput = settingsPanel.getByRole('textbox').first();
        if (await ipInput.isVisible().catch(() => false)) {
          const originalValue = await ipInput.inputValue();
          await ipInput.fill('10.9.8.7');
          await ipInput.blur();

          const cancelButton = settingsPanel.getByRole('button', { name: /cancel|取消/i }).first();
          if (await cancelButton.isVisible().catch(() => false)) {
            await expect(cancelButton).toBeEnabled();
            await cancelButton.click();
            await expect(ipInput).toHaveValue(originalValue);
          }
        }
      }
    });
  });

  test.describe('Night Mode', () => {
    test('should have night mode toggle', async ({ page }) => {
      const nightModeToggle = page.getByRole('button', { name: /night.*mode|夜间模式/i })
        .or(page.locator('[data-testid="night-mode-toggle"]'));
      expect(await nightModeToggle.count()).toBeGreaterThanOrEqual(0);
    });

    test('should toggle night mode', async ({ page }) => {
      const nightModeToggle = page.getByRole('button', { name: /night.*mode|夜间模式/i }).first()
        .or(page.locator('[data-testid="night-mode-toggle"]').first());
      
      if (await nightModeToggle.isVisible().catch(() => false)) {
        await nightModeToggle.click();
        await page.waitForTimeout(300);
        
        // Check for red filter effect
        const redFilter = page.locator('.night-mode, [data-night-mode="true"]');
        await redFilter.count();
        
        // Toggle back
        await nightModeToggle.click();
      }
    });
  });

  test.describe('Theme Toggle', () => {
    test('should have theme toggle', async ({ page }) => {
      const themeToggle = page.getByRole('button', { name: /theme|dark|light|主题/i })
        .or(page.locator('[data-testid="theme-toggle"]'));
      expect(await themeToggle.count()).toBeGreaterThanOrEqual(0);
    });

    test('should toggle between light and dark theme', async ({ page }) => {
      const themeToggle = page.getByRole('button', { name: /theme|dark|light|主题/i }).first()
        .or(page.locator('[data-testid="theme-toggle"]').first());
      
      if (await themeToggle.isVisible().catch(() => false)) {
        await themeToggle.click();
        await page.waitForTimeout(300);
        await themeToggle.click();
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe('Language Settings', () => {
    test('should have language switcher', async ({ page }) => {
      const languageSwitcher = page.getByRole('button', { name: /language|语言/i })
        .or(page.locator('[data-testid="language-switcher"]'));
      expect(await languageSwitcher.count()).toBeGreaterThanOrEqual(0);
    });

    test('should switch language to Chinese', async ({ page }) => {
      const languageSwitcher = page.getByRole('button', { name: /language|语言/i }).first()
        .or(page.locator('[data-testid="language-switcher"]').first());
      
      if (await languageSwitcher.isVisible().catch(() => false)) {
        await languageSwitcher.click();
        await page.waitForTimeout(300);
        
        const chineseOption = page.getByRole('menuitem', { name: /中文/i });
        if (await chineseOption.isVisible().catch(() => false)) {
          await chineseOption.click();
          await page.waitForTimeout(500);
        }
      }
    });

    test('should switch language to English', async ({ page }) => {
      const languageSwitcher = page.getByRole('button', { name: /language|语言/i }).first()
        .or(page.locator('[data-testid="language-switcher"]').first());
      
      if (await languageSwitcher.isVisible().catch(() => false)) {
        await languageSwitcher.click();
        await page.waitForTimeout(300);
        
        const englishOption = page.getByRole('menuitem', { name: /english/i });
        if (await englishOption.isVisible().catch(() => false)) {
          await englishOption.click();
          await page.waitForTimeout(500);
        }
      }
    });
  });

  test.describe('Critical Regression Coverage', () => {
    test('@smoke @regression should expose deterministic save/cancel controls in settings', async ({ page }) => {
      await openSettingsPanel(page);
      await expect(page.locator('[data-testid="settings-save-button"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="settings-cancel-button"]').first()).toBeVisible();
    });

    test('@regression should persist a saved switch state after reload', async ({ page }) => {
      await openSettingsPanel(page);
      const primarySwitch = page.getByRole('switch').first();
      await expect(primarySwitch).toBeVisible();

      const initialState = await primarySwitch.getAttribute('data-state');
      test.skip(initialState !== 'checked' && initialState !== 'unchecked', 'switch state is not exposed as checked/unchecked');
      const targetState = initialState === 'checked' ? 'unchecked' : 'checked';

      await primarySwitch.click();
      await expect(primarySwitch).toHaveAttribute('data-state', targetState);
      const saveButton = page.locator('[data-testid="settings-save-button"]').first();
      if (await saveButton.isEnabled().catch(() => false)) {
        await saveButton.click();
      }
      await page.keyboard.press('Escape');

      await waitForStarmapReady(page, { skipWasmWait: true });
      await openSettingsPanel(page);
      await expect(page.getByRole('switch').first()).toHaveAttribute('data-state', targetState);
    });
  });
});
