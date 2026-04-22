import { chromium, FullConfig } from '@playwright/test';

/**
 * Global setup for E2E tests
 * Pre-warms the WASM cache by loading the starmap page once before tests run
 */
async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  
  if (!baseURL) {
    console.log('No baseURL configured, skipping WASM pre-warm');
    return;
  }

  console.log('🔄 Pre-warming WASM cache...');
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to starmap and wait for WASM to load
    await page.goto(`${baseURL}/starmap`, {
      waitUntil: 'domcontentloaded',
      timeout: 180000,
    });
    
    // Wait for the loading overlay to disappear (WASM loaded)
    const loadingOverlay = page.locator('[data-testid="stellarium-loading-overlay"]');
    
    await loadingOverlay.waitFor({ state: 'hidden', timeout: 180000 }).catch(() => {
      console.log('⚠️ WASM loading timeout - tests may be slower');
    });

    // Give extra time for full initialization
    await page.waitForTimeout(2000);
    
    console.log('✅ WASM cache pre-warmed successfully');
  } catch (error) {
    console.log('⚠️ WASM pre-warm failed:', error);
    // Don't fail the setup - tests will just be slower
  } finally {
    await browser.close();
  }
}

export default globalSetup;
