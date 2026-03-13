import { test, expect } from '@playwright/test';

test.describe('Messier Marathon Guide', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('starmap-onboarding', JSON.stringify({
        state: {
          hasCompletedOnboarding: true,
          hasSeenWelcome: true,
          showOnNextVisit: false,
          phase: 'idle',
          resumeCheckpoint: null,
          tourHubOpen: true,
          hasCompletedSetup: true,
          setupCompletedSteps: ['welcome', 'location', 'equipment', 'preferences', 'complete'],
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
            completedAt: '2026-03-21T12:00:00.000Z',
          },
          activeTourId: null,
          tourProgressById: {},
          completedTours: ['first-run-core'],
          skippedCapabilities: {},
          lastCompletedAt: '2026-03-21T12:00:00.000Z',
        },
        version: 5,
      }));

      localStorage.setItem('starmap-messier-marathon', JSON.stringify({
        state: {
          activeSession: {
            sessionId: 'session-1',
            date: '2026-03-21T12:00:00.000Z',
            latitude: 35,
            longitude: -105,
            readiness: 'recommended',
            visibleTargetCount: 2,
            totalMessierCount: 110,
            darknessHours: 9.5,
            limitingFactors: [],
            stages: [
              {
                id: 'dusk',
                labelKey: 'messierMarathon.stages.dusk',
                checkpointIds: ['M74'],
                completedCount: 0,
                criticalCount: 1,
              },
            ],
            checkpoints: [
              {
                targetId: 'M74',
                targetName: 'M74',
                stageId: 'dusk',
                order: 1,
                critical: true,
                status: 'pending',
                visibilityHours: 0.5,
                transitAltitude: 38,
                recommendedWindowStart: '2026-03-21T19:35:00.000Z',
                recommendedWindowEnd: '2026-03-21T20:10:00.000Z',
              },
            ],
            recovery: {
              mode: 'full',
              nextCheckpointId: 'M74',
              nextStageId: 'dusk',
              catchUpTargetIds: ['M74'],
              updatedAt: '2026-03-21T12:00:00.000Z',
            },
            startedAt: '2026-03-21T12:00:00.000Z',
            updatedAt: '2026-03-21T12:00:00.000Z',
          },
          lastCompletedSessionId: null,
        },
        version: 1,
      }));
    });

    await page.goto('/starmap', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
  });

  test('resumes the guide from onboarding hub and hands off to planner', async ({ page }) => {
    await expect(page.getByText(/Messier Marathon|梅西耶马拉松/i).first()).toBeVisible();
    await page.getByRole('button', { name: /Resume Marathon|继续马拉松/i }).click();

    await expect(page.getByRole('button', { name: /Open Planner|打开规划器/i })).toBeVisible();
    await page.getByRole('button', { name: /Open Planner|打开规划器/i }).click();

    await expect(page.locator('[data-testid="session-planner-dialog"]').first()).toBeVisible();
  });

  test('resets only the guide without leaving planner handoff available', async ({ page }) => {
    await page.getByRole('button', { name: /Resume Marathon|继续马拉松/i }).click();
    const resetButton = page.getByRole('button', { name: /Reset Guide|重置引导/i });
    await expect(resetButton).toBeVisible();
    await resetButton.click();

    await expect(page.getByRole('button', { name: /Open Planner|打开规划器/i })).toBeDisabled();
  });
});
