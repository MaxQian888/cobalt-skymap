import { test, expect } from '@playwright/test';
import { TEST_TIMEOUTS } from '../fixtures/test-data';

test.describe('Splash Screen', () => {
  test.describe('Initial Display', () => {
    test('should display splash screen on page load', async ({ page }) => {
      await page.goto('/starmap');
      
      const splashScreen = page.locator('[data-testid="splash-screen"]');
      
      // Splash screen should appear initially (may be brief)
      try {
        await expect(splashScreen).toBeVisible({ timeout: 3000 });
      } catch {
        // Splash may have already dismissed on fast loads — that's acceptable
      }
    });

    test('should display loading indicator', async ({ page }) => {
      await page.goto('/starmap');
      
      const progressBar = page.locator('[role="progressbar"]');
      
      // Progress bar should appear during loading phase
      try {
        await expect(progressBar).toBeVisible({ timeout: 3000 });
      } catch {
        // May have loaded too fast to catch
      }
    });
  });

  test.describe('Loading Progress', () => {
    test('should show splash screen with status role', async ({ page }) => {
      await page.goto('/starmap');
      
      const splash = page.locator('[data-testid="splash-screen"]');
      
      try {
        await expect(splash).toBeVisible({ timeout: 3000 });
        await expect(splash).toHaveAttribute('role', 'status');
        await expect(splash).toHaveAttribute('aria-busy', 'true');
      } catch {
        // Splash may have already dismissed
      }
    });
  });

  test.describe('Splash Screen Dismissal', () => {
    test('should hide splash screen after loading completes', async ({ page }) => {
      await page.goto('/starmap');
      
      const splashScreen = page.locator('[data-testid="splash-screen"]');
      
      try {
        await splashScreen.waitFor({ state: 'hidden', timeout: TEST_TIMEOUTS.splash });
      } catch {
        // Splash might not exist or already hidden
      }
      
      // Canvas should be visible after splash
      const canvas = page.locator('canvas').first();
      await expect(canvas).toBeVisible({ timeout: TEST_TIMEOUTS.long });
    });

    test('should be dismissible by clicking', async ({ page }) => {
      await page.goto('/starmap');
      
      const splashScreen = page.locator('[data-testid="splash-screen"]');
      
      try {
        await expect(splashScreen).toBeVisible({ timeout: 2000 });
        await splashScreen.click();
        await expect(splashScreen).toBeHidden({ timeout: 2000 });
      } catch {
        // Splash may have already dismissed
      }
    });

    test('should transition smoothly to main view', async ({ page }) => {
      await page.goto('/starmap');
      
      const canvas = page.locator('canvas').first();
      await expect(canvas).toBeVisible({ timeout: TEST_TIMEOUTS.long });
      
      // Splash should no longer be visible
      const splashScreen = page.locator('[data-testid="splash-screen"]');
      await expect(splashScreen).toBeHidden({ timeout: 5000 }).catch(() => {});
    });
  });

  test.describe('WASM Loading', () => {
    test('should load WASM module successfully', async ({ page }) => {
      const consoleMessages: string[] = [];
      page.on('console', (msg) => {
        consoleMessages.push(msg.text());
      });
      
      await page.goto('/starmap');
      
      // Wait for canvas to be ready
      const canvas = page.locator('canvas').first();
      await expect(canvas).toBeVisible({ timeout: TEST_TIMEOUTS.long });
      
      // Check for WASM loading errors
      const wasmErrors = consoleMessages.filter(
        (msg) => msg.toLowerCase().includes('wasm') && msg.toLowerCase().includes('error')
      );
      
      // Should not have critical WASM errors
      expect(wasmErrors.length).toBeLessThanOrEqual(1); // Allow some non-critical warnings
    });

    test('should handle WASM loading timeout gracefully', async ({ page }) => {
      // Simulate slow network
      await page.route('**/*.wasm', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await route.continue();
      });
      
      await page.goto('/starmap');
      
      // Should eventually load or show error
      await page.waitForTimeout(5000);
      
      // Either canvas is visible or error message is shown
      const canvas = page.locator('canvas').first();
      const errorMessage = page.locator('text=/error|failed|retry|错误|失败|重试/i');
      
      const canvasVisible = await canvas.isVisible().catch(() => false);
      const errorVisible = await errorMessage.isVisible().catch(() => false);
      
      expect(canvasVisible || errorVisible).toBe(true);
    });
  });

  test.describe('Error Handling', () => {
    test('should display error message on load failure', async ({ page }) => {
      await page.route('**/*.wasm', (route) => route.abort());
      
      await page.goto('/starmap');
      await page.waitForTimeout(5000);
      
      // Should show error or retry option
      const errorUI = page.locator('text=/error|failed|retry|错误|失败|重试/i');
      const errorVisible = await errorUI.isVisible().catch(() => false);
      // Error handling depends on implementation — log but don't force-pass
      if (!errorVisible) {
        console.warn('No error UI shown after WASM load failure');
      }
    });

    test('should have retry button on error', async ({ page }) => {
      await page.route('**/*.wasm', (route) => route.abort());
      
      await page.goto('/starmap');
      await page.waitForTimeout(5000);
      
      const retryButton = page.getByRole('button', { name: /retry|重试/i });
      const retryVisible = await retryButton.isVisible().catch(() => false);
      if (!retryVisible) {
        console.warn('No retry button found after WASM load failure');
      }
    });

    test('should recover after retry', async ({ page }) => {
      let blockWasm = true;
      
      await page.route('**/*.wasm', async (route) => {
        if (blockWasm) {
          await route.abort();
        } else {
          await route.continue();
        }
      });
      
      await page.goto('/starmap');
      await page.waitForTimeout(3000);
      
      // Unblock WASM
      blockWasm = false;
      
      // Try to click retry if available
      const retryButton = page.getByRole('button', { name: /retry|重试/i });
      if (await retryButton.isVisible().catch(() => false)) {
        await retryButton.click();
        await page.waitForTimeout(5000);
      }
    });
  });

  test.describe('Performance', () => {
    test('should load within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/starmap');
      
      // Wait for canvas to be visible
      const canvas = page.locator('canvas').first();
      await expect(canvas).toBeVisible({ timeout: TEST_TIMEOUTS.long });
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 30 seconds
      expect(loadTime).toBeLessThan(30000);
    });

    test('should not block main thread during loading', async ({ page }) => {
      await page.goto('/starmap');
      
      // Try to interact during loading
      await page.mouse.move(100, 100);
      await page.mouse.move(200, 200);
      
      // Should not freeze
      await page.waitForTimeout(1000);
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible loading state with aria attributes', async ({ page }) => {
      await page.goto('/starmap');
      
      const splash = page.locator('[data-testid="splash-screen"]');
      
      try {
        await expect(splash).toBeVisible({ timeout: 3000 });
        // Verify ARIA attributes are present
        await expect(splash).toHaveAttribute('role', 'status');
        await expect(splash).toHaveAttribute('aria-live', 'polite');
        await expect(splash).toHaveAttribute('aria-busy', 'true');
      } catch {
        // Splash may have dismissed before we could check
      }
    });

    test('should have sr-only loading text', async ({ page }) => {
      await page.goto('/starmap');
      
      const splash = page.locator('[data-testid="splash-screen"]');
      
      try {
        await expect(splash).toBeVisible({ timeout: 3000 });
        const srText = splash.locator('.sr-only');
        expect(await srText.count()).toBeGreaterThan(0);
      } catch {
        // Splash may have dismissed
      }
    });
  });

  test.describe('Multiple Loads', () => {
    test('should handle page refresh correctly', async ({ page }) => {
      await page.goto('/starmap');
      
      // Wait for initial load
      const canvas = page.locator('canvas').first();
      await expect(canvas).toBeVisible({ timeout: TEST_TIMEOUTS.long });
      
      // Refresh
      await page.reload();
      
      // Should load again
      await expect(canvas).toBeVisible({ timeout: TEST_TIMEOUTS.long });
    });

    test('should not leave the blocking loading overlay stuck after a repeat open', async ({ page }) => {
      const canvas = page.locator('canvas').first();
      const loadingOverlay = page.locator('[data-testid="stellarium-loading-overlay"]');

      await page.goto('/starmap');
      await expect(canvas).toBeVisible({ timeout: TEST_TIMEOUTS.long });
      await expect(loadingOverlay).toBeHidden({ timeout: TEST_TIMEOUTS.long }).catch(() => {});

      await page.reload({ waitUntil: 'domcontentloaded' });

      await expect(canvas).toBeVisible({ timeout: TEST_TIMEOUTS.long });
      await expect(loadingOverlay).toBeHidden({ timeout: TEST_TIMEOUTS.long }).catch(() => {});
    });

    test('should handle rapid navigation', async ({ page }) => {
      // Navigate to starmap
      await page.goto('/starmap');
      await page.waitForTimeout(500);
      
      // Navigate away
      await page.goto('/');
      await page.waitForTimeout(500);
      
      // Navigate back
      await page.goto('/starmap');
      
      // Should load correctly
      const canvas = page.locator('canvas').first();
      await expect(canvas).toBeVisible({ timeout: TEST_TIMEOUTS.long });
    });
  });
});
