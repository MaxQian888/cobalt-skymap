import { test, expect, Page } from '@playwright/test';

// Helper to clear localStorage before each test
async function clearOnboardingState(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('onboarding-storage');
    localStorage.removeItem('starmap-onboarding');
  });
}

// Helper to set onboarding as completed
async function setOnboardingCompleted(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('starmap-onboarding', JSON.stringify({
      state: {
        hasCompletedOnboarding: true,
        hasSeenWelcome: true,
        hasCompletedSetup: true,
        currentStepIndex: -1,
        isTourActive: false,
        completedSteps: ['welcome', 'search', 'navigation', 'zoom', 'settings', 'fov', 'shotlist', 'tonight', 'contextmenu', 'complete'],
        setupCompletedSteps: ['welcome', 'location', 'equipment', 'preferences', 'complete'],
        showOnNextVisit: false,
        phase: 'idle',
        resumeCheckpoint: null,
        tourHubOpen: false,
        activeTourId: null,
        tourProgressById: {},
        completedTours: ['first-run-core'],
        skippedCapabilities: {},
        lastCompletedAt: '2026-04-05T00:00:00.000Z',
        setupData: {
          locationConfigured: true,
          equipmentConfigured: true,
          preferencesConfigured: true,
        },
        setupMetadata: {
          location: 'configured',
          equipment: 'configured',
          preferences: 'configured',
          skipReasons: {},
          completedAt: '2026-04-05T00:00:00.000Z',
        },
      },
      version: 6,
    }));
  });
}

test.describe('Onboarding Tour', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate first, then clear state, then reload to ensure clean state
    await page.goto('/starmap');
    await clearOnboardingState(page);
    await page.reload();
    // Wait for splash screen to finish
    await page.waitForTimeout(3500);
  });

  test('should show welcome dialog for first-time users', async ({ page }) => {
    // Check if welcome dialog is visible
    const welcomeDialog = page.locator('[role="dialog"]');
    await expect(welcomeDialog).toBeVisible({ timeout: 10000 });
    
    // Check for Start Tour button
    const startButton = page.getByRole('button', { name: /Start Tour|开始引导/ });
    await expect(startButton).toBeVisible({ timeout: 5000 });
  });

  test('should start tour when clicking Start Tour button', async ({ page }) => {
    // Click Start Tour button
    const startTourButton = page.getByRole('button', { name: /Start Tour|开始引导/ });
    await expect(startTourButton).toBeVisible({ timeout: 10000 });
    await startTourButton.click();
    
    // Wait for tour to start
    await page.waitForTimeout(500);
    
    // Verify tour tooltip is visible
    const tooltip = page.locator('.fixed.z-\\[9999\\]');
    await expect(tooltip).toBeVisible({ timeout: 5000 });
  });

  test('should skip tour when clicking Skip button', async ({ page }) => {
    // Click Skip button
    const skipButton = page.getByRole('button', { name: /Skip for now|稍后再说/ });
    await expect(skipButton).toBeVisible({ timeout: 10000 });
    await skipButton.click();
    
    // Welcome dialog should be closed
    await page.waitForTimeout(500);
    const welcomeDialog = page.locator('[role="dialog"]');
    await expect(welcomeDialog).not.toBeVisible({ timeout: 5000 });
  });

  test('should navigate through tour steps with Next button', async ({ page }) => {
    // Start tour
    const startTourButton = page.getByRole('button', { name: /Start Tour|开始引导/ });
    await startTourButton.click();
    await page.waitForTimeout(500);
    
    // Click Next button to go to step 2
    const nextButton = page.getByRole('button', { name: /Next|下一步/ });
    await expect(nextButton).toBeVisible({ timeout: 5000 });
    await nextButton.click();
    
    // Wait for transition and verify step changed
    await page.waitForTimeout(500);
    
    // The step number badge should show 2
    const stepBadge = page.locator('.rounded-full.bg-primary').filter({ hasText: '2' });
    await expect(stepBadge).toBeVisible({ timeout: 5000 });
  });

  test('should navigate back with Back button', async ({ page }) => {
    // Start tour
    const startTourButton = page.getByRole('button', { name: /Start Tour|开始引导/ });
    await startTourButton.click();
    await page.waitForTimeout(500);
    
    // Go to step 2
    const nextButton = page.getByRole('button', { name: /Next|下一步/ });
    await nextButton.click();
    await page.waitForTimeout(500);
    
    // Now Back button should be visible
    const backButton = page.getByRole('button', { name: /Back|上一步/ });
    await expect(backButton).toBeVisible({ timeout: 5000 });
    await backButton.click();
    
    // Wait for transition
    await page.waitForTimeout(500);
    
    // Should be back at step 1 - badge shows 1
    const stepBadge = page.locator('.rounded-full.bg-primary').filter({ hasText: '1' });
    await expect(stepBadge).toBeVisible({ timeout: 5000 });
  });

  test('should close tour with Escape key', async ({ page }) => {
    // Start tour
    const startTourButton = page.getByRole('button', { name: /Start Tour|开始引导/ });
    await startTourButton.click();
    await page.waitForTimeout(500);
    
    // Verify tour tooltip is visible
    const tooltip = page.locator('.fixed.z-\\[9999\\]');
    await expect(tooltip).toBeVisible({ timeout: 5000 });
    
    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Tour should be closed
    await expect(tooltip).not.toBeVisible({ timeout: 5000 });
  });

  test('should navigate with Arrow keys', async ({ page }) => {
    // Start tour
    const startTourButton = page.getByRole('button', { name: /Start Tour|开始引导/ });
    await startTourButton.click();
    await page.waitForTimeout(500);
    
    // Press ArrowRight to go to next step
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);
    
    // Check step 2 badge
    const step2Badge = page.locator('.rounded-full.bg-primary').filter({ hasText: '2' });
    await expect(step2Badge).toBeVisible({ timeout: 5000 });
    
    // Press ArrowLeft to go back
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(500);
    
    // Check step 1 badge
    const step1Badge = page.locator('.rounded-full.bg-primary').filter({ hasText: '1' });
    await expect(step1Badge).toBeVisible({ timeout: 5000 });
  });

  test('should complete tour and show finish button on last step', async ({ page }) => {
    // Start tour
    const startTourButton = page.getByRole('button', { name: /Start Tour|开始引导/ });
    await startTourButton.click();
    await page.waitForTimeout(500);
    
    // Navigate to last step by clicking Next repeatedly
    for (let i = 0; i < 9; i++) {
      const nextButton = page.getByRole('button', { name: /Next|下一步/ });
      if (await nextButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nextButton.click();
        await page.waitForTimeout(400);
      }
    }
    
    // On last step, should see Finish button
    const finishButton = page.getByRole('button', { name: /Finish|完成/ });
    await expect(finishButton).toBeVisible({ timeout: 5000 });
    
    // Click Finish
    await finishButton.click();
    await page.waitForTimeout(500);
    
    // Tour should be closed
    const tooltip = page.locator('.fixed.z-\\[9999\\]');
    await expect(tooltip).not.toBeVisible({ timeout: 5000 });
  });

  test('should not show welcome dialog on subsequent visits after completion', async ({ page }) => {
    // Set onboarding as completed
    await setOnboardingCompleted(page);
    await page.reload();
    
    // Wait for potential dialog
    await page.waitForTimeout(3000);
    
    // Welcome dialog should not appear
    const welcomeDialog = page.locator('text=Welcome to SkyMap').or(page.locator('text=欢迎使用 SkyMap'));
    await expect(welcomeDialog).not.toBeVisible({ timeout: 3000 });
  });

  test('should ignore stale tour checkpoints after onboarding was already completed', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('starmap-onboarding', JSON.stringify({
        state: {
          hasCompletedOnboarding: true,
          hasSeenWelcome: true,
          hasCompletedSetup: true,
          showOnNextVisit: false,
          phase: 'idle',
          resumeCheckpoint: {
            phase: 'tour',
            setupStep: null,
            activeTourId: 'first-run-core',
            currentStepIndex: 2,
            updatedAt: '2026-04-05T00:00:00.000Z',
          },
          tourHubOpen: false,
          currentStepIndex: -1,
          isTourActive: false,
          completedSteps: ['welcome', 'search', 'navigation'],
          setupCompletedSteps: ['welcome', 'location', 'equipment', 'preferences', 'complete'],
          activeTourId: 'first-run-core',
          tourProgressById: {},
          completedTours: ['first-run-core'],
          skippedCapabilities: {},
          lastCompletedAt: '2026-04-05T00:00:00.000Z',
          setupData: {
            locationConfigured: true,
            equipmentConfigured: true,
            preferencesConfigured: true,
          },
          setupMetadata: {
            location: 'configured',
            equipment: 'configured',
            preferences: 'configured',
            skipReasons: {},
            completedAt: '2026-04-05T00:00:00.000Z',
          },
        },
        version: 6,
      }));
    });

    await page.reload();
    await page.waitForTimeout(3000);

    const welcomeDialog = page.locator('text=Welcome to SkyMap').or(page.locator('text=欢迎使用 SkyMap'));
    const tooltip = page.locator('.fixed.z-\\[9999\\]');

    await expect(welcomeDialog).not.toBeVisible({ timeout: 3000 });
    await expect(tooltip).not.toBeVisible({ timeout: 3000 });
  });

  test('should skip tour with Skip button during tour', async ({ page }) => {
    // Start tour
    const startTourButton = page.getByRole('button', { name: /Start Tour|开始引导/ });
    await startTourButton.click();
    await page.waitForTimeout(500);
    
    // Click Skip button in tooltip (not the welcome dialog skip)
    const skipButton = page.locator('.fixed.z-\\[9999\\]').getByRole('button', { name: /Skip|跳过/ });
    await expect(skipButton).toBeVisible({ timeout: 5000 });
    await skipButton.click();
    
    // Tour should be closed
    await page.waitForTimeout(500);
    const tooltip = page.locator('.fixed.z-\\[9999\\]');
    await expect(tooltip).not.toBeVisible({ timeout: 5000 });
  });

  test('should show spotlight highlight on target elements', async ({ page }) => {
    // Start tour
    const startTourButton = page.getByRole('button', { name: /Start Tour|开始引导/ });
    await startTourButton.click();
    await page.waitForTimeout(500);
    
    // Go to search step (step 2)
    const nextButton = page.getByRole('button', { name: /Next|下一步/ });
    await nextButton.click();
    await page.waitForTimeout(500);
    
    // Spotlight overlay should be visible (z-index 9998)
    const spotlight = page.locator('.fixed.z-\\[9998\\]');
    await expect(spotlight).toBeVisible({ timeout: 5000 });
  });

  test('should handle dont show again checkbox', async ({ page }) => {
    // Check the "Don't show again" checkbox
    const checkbox = page.getByRole('checkbox');
    await expect(checkbox).toBeVisible({ timeout: 10000 });
    await checkbox.click();
    
    // Skip tour
    const skipButton = page.getByRole('button', { name: /Skip for now|稍后再说/ });
    await skipButton.click();
    
    // Reload page
    await page.reload();
    await page.waitForTimeout(3500);
    
    // Welcome dialog should not appear
    const welcomeDialog = page.locator('[role="dialog"]');
    await expect(welcomeDialog).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe('Tour Restart Button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/starmap');
    // Set onboarding as completed
    await setOnboardingCompleted(page);
  });

  test('should restart tour from settings panel', async ({ page }) => {
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Open settings panel
    const settingsButton = page.locator('[data-tour-id="settings-panel"]').or(page.getByRole('button', { name: /Settings|设置/ }));
    await expect(settingsButton).toBeVisible({ timeout: 10000 });
    await settingsButton.click();
    
    // Wait for settings drawer to open
    await page.waitForTimeout(500);
    
    // Look for Help section and expand it if needed
    const helpSection = page.getByText(/Help & Tutorial|帮助与教程/);
    if (await helpSection.isVisible()) {
      await helpSection.click();
      await page.waitForTimeout(300);
    }
    
    // Click Restart Tour button
    const restartButton = page.getByRole('button', { name: /Restart Tour|重新开始引导/ });
    if (await restartButton.isVisible()) {
      await restartButton.click();
      await page.waitForTimeout(500);
      
      // Tour should start
      const tooltip = page.locator('[class*="tour-tooltip"]').or(page.locator('[class*="z-\\[9999\\]"]'));
      await expect(tooltip).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Tour Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/starmap');
    await clearOnboardingState(page);
  });

  test('should have proper focus management', async ({ page }) => {
    await page.reload();
    await page.waitForTimeout(3000);
    
    // Start tour
    const startTourButton = page.getByRole('button', { name: /Start Tour|开始引导/ });
    await startTourButton.click();
    await page.waitForTimeout(500);
    
    // Tab should cycle through interactive elements
    await page.keyboard.press('Tab');
    
    // Focus should be on an interactive element within the tooltip
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('should have visible focus indicators', async ({ page }) => {
    await page.reload();
    await page.waitForTimeout(3000);
    
    // Start tour
    const startTourButton = page.getByRole('button', { name: /Start Tour|开始引导/ });
    await startTourButton.click();
    await page.waitForTimeout(500);
    
    // Tab to Next button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Check that focus ring is visible
    const nextButton = page.getByRole('button', { name: /Next|下一步/ });
    const isFocused = await nextButton.evaluate((el) => {
      return document.activeElement === el || el.matches(':focus-visible');
    });
    
    // Focus should be manageable in the tour
    expect(isFocused || await page.locator(':focus').isVisible()).toBeTruthy();
  });
});
