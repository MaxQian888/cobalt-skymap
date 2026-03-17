'use client';

import { useState } from 'react';
import { StellariumView, SplashScreen } from '@/components/starmap';
import { LogPanel } from '@/components/common';
import { useCacheInit, useWindowState } from '@/lib/hooks';
import { useSettingsStore, useStellariumStore } from '@/lib/stores';

export default function StarmapPage() {
  const showSplashPreference = useSettingsStore((state) => state.preferences.showSplash);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const showSplash = showSplashPreference && !splashDismissed;

  // Engine ready signal — splash can dismiss early when the engine is loaded
  const engineLoaded = useStellariumStore((state) => state.stel !== null);

  // Initialize unified cache system
  useCacheInit({ strategy: 'cache-first', enableInterception: true });
  
  // Restore desktop window state through the official Tauri plugin
  useWindowState();

  return (
    <main className="relative w-screen h-screen h-dvh min-h-screen min-h-dvh bg-black overflow-hidden">
      {showSplash && (
        <SplashScreen
          onComplete={() => setSplashDismissed(true)}
          isReady={engineLoaded}
        />
      )}
      <StellariumView showSplash={showSplash} />
      <LogPanel />
    </main>
  );
}
