'use client';

import { useEffect, useRef, useState } from 'react';
import { DailyKnowledgeDialog } from './daily-knowledge-dialog';
import { useDailyKnowledgeStore, useOnboardingBridgeStore, useOnboardingStore, useSettingsStore } from '@/lib/stores';

interface StartupModalCoordinatorProps {
  showSplash: boolean;
}

export function StartupModalCoordinator({ showSplash }: StartupModalCoordinatorProps) {
  const openDailyKnowledgeRequestId = useOnboardingBridgeStore((state) => state.openDailyKnowledgeRequestId);
  const hasCompletedOnboarding = useOnboardingStore((state) => state.hasCompletedOnboarding);
  const showOnNextVisit = useOnboardingStore((state) => state.showOnNextVisit);
  const isSetupOpen = useOnboardingStore((state) => state.isSetupOpen);
  const isTourActive = useOnboardingStore((state) => state.isTourActive);
  const phase = useOnboardingStore((state) => state.phase);
  const dailyKnowledgeEnabled = useSettingsStore((state) => state.preferences.dailyKnowledgeEnabled);
  const shouldAutoShowToday = useDailyKnowledgeStore((state) => state.shouldAutoShowToday);
  const openDialog = useDailyKnowledgeStore((state) => state.openDialog);

  const autoTriggeredRef = useRef(false);
  const handledOpenRequestRef = useRef(0);
  const [dailyKnowledgeHydrated, setDailyKnowledgeHydrated] = useState(() => {
    const persistApi = (
      useDailyKnowledgeStore as typeof useDailyKnowledgeStore & {
        persist?: {
          hasHydrated?: () => boolean;
        };
      }
    ).persist;

    return persistApi?.hasHydrated ? persistApi.hasHydrated() : true;
  });

  useEffect(() => {
    const persistApi = (
      useDailyKnowledgeStore as typeof useDailyKnowledgeStore & {
        persist?: {
          onFinishHydration?: (cb: () => void) => (() => void) | void;
          hasHydrated?: () => boolean;
        };
      }
    ).persist;

    if (!persistApi?.onFinishHydration || !persistApi?.hasHydrated) {
      return;
    }

    const markHydrated = () => setDailyKnowledgeHydrated(true);
    const unsubscribe = persistApi.onFinishHydration(markHydrated);

    if (!dailyKnowledgeHydrated && persistApi.hasHydrated()) {
      queueMicrotask(markHydrated);
    }

    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
  }, [dailyKnowledgeHydrated]);

  useEffect(() => {
    if (
      openDailyKnowledgeRequestId > 0 &&
      openDailyKnowledgeRequestId !== handledOpenRequestRef.current
    ) {
      handledOpenRequestRef.current = openDailyKnowledgeRequestId;
      void openDialog('manual');
    }
  }, [openDailyKnowledgeRequestId, openDialog]);

  useEffect(() => {
    if (autoTriggeredRef.current) return;
    if (showSplash) return;
    if (!dailyKnowledgeEnabled) return;
    if (!dailyKnowledgeHydrated) return;

    const onboardingBlocking =
      isSetupOpen ||
      isTourActive ||
      phase !== 'idle' ||
      (!hasCompletedOnboarding && showOnNextVisit);

    if (onboardingBlocking) return;
    if (!shouldAutoShowToday()) return;

    autoTriggeredRef.current = true;
    void openDialog('auto');
  }, [
    dailyKnowledgeEnabled,
    dailyKnowledgeHydrated,
    hasCompletedOnboarding,
    isSetupOpen,
    isTourActive,
    openDialog,
    phase,
    shouldAutoShowToday,
    showOnNextVisit,
    showSplash,
  ]);

  return <DailyKnowledgeDialog />;
}
