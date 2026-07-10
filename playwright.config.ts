import { defineConfig, devices } from '@playwright/test';

const port = process.env.PLAYWRIGHT_PORT ?? '3001';
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';
const configuredWorkers = process.env.PLAYWRIGHT_WORKERS
  ? Number.parseInt(process.env.PLAYWRIGHT_WORKERS, 10)
  : process.env.CI
    ? 1
    : process.platform === 'win32'
      ? 1
      : undefined;

/**
 * Playwright configuration for Cobalt Skymap E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  /* Global setup to pre-warm WASM cache */
  globalSetup: './tests/e2e/global-setup.ts',
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Keep local Windows runs serial because Next dev + WASM bootstrap is unstable under multi-worker pressure. */
  workers: Number.isFinite(configuredWorkers) ? configuredWorkers : undefined,
  
  /* Reporter to use */
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['list'],
  ],
  
  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: `http://localhost:${port}`,

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Video on failure */
    video: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    /* Test against tablet viewports */
    {
      name: 'Tablet',
      use: { ...devices['iPad Pro 11'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  ...(skipWebServer ? {} : {
    webServer: {
      command: 'pnpm exec next dev --webpack',
      url: `http://localhost:${port}/starmap`,
      reuseExistingServer: !process.env.CI,
      env: { ...process.env, PORT: port },
      timeout: 120 * 1000,
    },
  }),
  
  /* Global timeout for each test - extended for WASM initialization */
  timeout: 120 * 1000,
  
  /* Expect timeout */
  expect: {
    timeout: 10 * 1000,
  },
});
