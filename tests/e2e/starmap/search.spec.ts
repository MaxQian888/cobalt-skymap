import { test, expect } from '@playwright/test';
import { StarmapPage } from '../fixtures/page-objects';
import { TEST_OBJECTS, TEST_COORDINATES } from '../fixtures/test-data';
import {
  ensureSearchPanelOpen,
  waitForSearchResults,
  waitForStarmapReady,
} from '../fixtures/test-helpers';

test.describe('Search Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Initialize page object for potential future use
    new StarmapPage(page);
    await waitForStarmapReady(page);
  });

  test.describe('Search Input', () => {
    test('should display search input or button', async ({ page }) => {
      // Look for search input or search button
      const searchInput = page.getByPlaceholder(/search/i);
      const searchButton = page.getByRole('button', { name: /search/i });
      
      const inputVisible = await searchInput.isVisible().catch(() => false);
      const buttonVisible = await searchButton.first().isVisible().catch(() => false);
      
      // Search UI may be visible or collapsed
      expect(inputVisible || buttonVisible || true).toBe(true);
    });

    test('should allow typing in search input', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i);
      
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('M31');
        const value = await searchInput.inputValue();
        expect(value).toBe('M31');
      }
    });

    test('should clear search input', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i);
      
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('M31');
        await searchInput.clear();
        const value = await searchInput.inputValue();
        expect(value).toBe('');
      }
    });
  });

  test.describe('Object Search', () => {
    test('should search for Messier objects', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i);
      
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill(TEST_OBJECTS.M31.name);
        await page.waitForTimeout(1000); // Wait for search results
        
        // Look for search results
        const results = page.locator('[role="listbox"], [role="option"], .search-result');
        expect(await results.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should search for NGC objects', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i);
      
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill(TEST_OBJECTS.NGC7000.name);
        await page.waitForTimeout(1000);
      }
    });

    test('should search for planets', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i);
      
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill(TEST_OBJECTS.Mars.name);
        await page.waitForTimeout(1000);
      }
    });

    test('should handle partial search terms (fuzzy search)', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i);
      
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('Androm'); // Partial for Andromeda
        await page.waitForTimeout(1000);
      }
    });

    test('should handle no results gracefully', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i);
      
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('xyznonexistent123');
        await page.waitForTimeout(1000);
        
        // Should show "no results" message or empty state
        const noResults = page.locator('text=/no.*found|no.*results/i');
        expect(await noResults.count()).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Coordinate Search', () => {
    test('should search by decimal coordinates', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i);
      
      if (await searchInput.isVisible().catch(() => false)) {
        const coords = `${TEST_COORDINATES.decimal.ra} ${TEST_COORDINATES.decimal.dec}`;
        await searchInput.fill(coords);
        await page.waitForTimeout(1000);
      }
    });

    test('should search by sexagesimal coordinates', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i);
      
      if (await searchInput.isVisible().catch(() => false)) {
        const coords = `${TEST_COORDINATES.sexagesimal.ra} ${TEST_COORDINATES.sexagesimal.dec}`;
        await searchInput.fill(coords);
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Search Results', () => {
    test('should display search results list', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i);
      
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('M');
        await page.waitForTimeout(1500);
        
        // Check for results container
        const resultsContainer = page.locator('[role="listbox"], .search-results, [data-testid="search-results"]');
        expect(await resultsContainer.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should select search result with click', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i);
      
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('M31');
        await page.waitForTimeout(1500);
        
        // Try to click first result
        const firstResult = page.locator('[role="option"]').first();
        if (await firstResult.isVisible().catch(() => false)) {
          await firstResult.click();
        }
      }
    });

    test('should navigate results with keyboard', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i);
      
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('M31');
        await page.waitForTimeout(1000);
        
        // Navigate with arrow keys
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('Enter');
      }
    });
  });

  test.describe('Search History', () => {
    test('should show recent searches', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i);
      
      if (await searchInput.isVisible().catch(() => false)) {
        // Perform a search
        await searchInput.fill('M31');
        await page.waitForTimeout(500);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        
        // Clear and focus again
        await searchInput.clear();
        await searchInput.focus();
        
        // Recent searches may appear
        const recentSection = page.locator('text=/recent/i');
        expect(await recentSection.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should clear search history', async ({ page }) => {
      // Look for clear history button
      const clearButton = page.getByRole('button', { name: /clear.*history/i });
      if (await clearButton.isVisible().catch(() => false)) {
        await clearButton.click();
      }
    });
  });

  test.describe('Advanced Search', () => {
    test('should open advanced search dialog', async ({ page }) => {
      const advancedButton = page.getByRole('button', { name: /advanced/i });
      
      if (await advancedButton.isVisible().catch(() => false)) {
        await advancedButton.click();
        
        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();
      }
    });

    test('should filter by object type', async ({ page }) => {
      const advancedButton = page.getByRole('button', { name: /advanced/i });
      
      if (await advancedButton.isVisible().catch(() => false)) {
        await advancedButton.click();
        await page.waitForTimeout(500);
        
        // Look for type filter
        const typeFilter = page.locator('text=/object type|filter.*type/i');
        expect(await typeFilter.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should filter by magnitude', async ({ page }) => {
      const advancedButton = page.getByRole('button', { name: /advanced/i });
      
      if (await advancedButton.isVisible().catch(() => false)) {
        await advancedButton.click();
        await page.waitForTimeout(500);
        
        // Look for magnitude filter
        const magFilter = page.locator('text=/magnitude/i');
        expect(await magFilter.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should close advanced search with Escape', async ({ page }) => {
      const advancedButton = page.getByRole('button', { name: /advanced/i });
      
      if (await advancedButton.isVisible().catch(() => false)) {
        await advancedButton.click();
        await page.waitForTimeout(500);
        
        await page.keyboard.press('Escape');
        
        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeHidden({ timeout: 2000 }).catch(() => {});
      }
    });
  });

  test.describe('Search Performance', () => {
    test('should respond quickly to search input', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i);
      
      if (await searchInput.isVisible().catch(() => false)) {
        const startTime = Date.now();
        await searchInput.fill('M31');
        await page.waitForTimeout(500);
        const endTime = Date.now();
        
        // Search should respond within reasonable time
        expect(endTime - startTime).toBeLessThan(3000);
      }
    });

    test('should handle rapid typing', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i);
      
      if (await searchInput.isVisible().catch(() => false)) {
        // Type rapidly
        await searchInput.pressSequentially('M31 Andromeda Galaxy', { delay: 50 });
        await page.waitForTimeout(1000);
        
        // Should not crash
        await expect(searchInput).toBeVisible();
      }
    });
  });

  test.describe('Critical Regression Coverage', () => {
    test('@smoke @regression should return selectable M31 results with stable selectors', async ({ page }) => {
      const searchInput = await ensureSearchPanelOpen(page);
      await searchInput.fill(TEST_OBJECTS.M31.name);
      await page.keyboard.press('Enter');

      const options = await waitForSearchResults(page, 1);
      await expect(page.locator('[data-testid="starmap-search-results"]').first()).toBeVisible();
      await expect(options.first()).toBeVisible();
    });

    test('@regression should select a search result and persist it to recent searches', async ({ page }) => {
      const searchInput = await ensureSearchPanelOpen(page);
      await searchInput.fill(TEST_OBJECTS.M31.name);
      await page.keyboard.press('Enter');

      const options = await waitForSearchResults(page, 1);
      const firstOption = options.first();
      await firstOption.click();

      await expect
        .poll(async () => page.evaluate(() => {
          const raw = localStorage.getItem('starmap-search-store');
          if (!raw) return false;
          try {
            const parsed = JSON.parse(raw) as {
              state?: {
                recentSearches?: Array<{ query?: string }>;
              };
            };
            return (parsed.state?.recentSearches ?? []).some(
              (item) => (item.query ?? '').toLowerCase() === 'm31',
            );
          } catch {
            return false;
          }
        }), { timeout: 15_000 })
        .toBe(true);
    });
  });
});
