'use client';

import { useTranslations } from 'next-intl';
import { MoonStar } from 'lucide-react';
import { StatusToggleButton } from '@/components/common/status-toggle-button';
import { useSettingsStore } from '@/lib/stores';
import { useNightModeEffect } from '@/lib/hooks/use-night-mode';
import { cn } from '@/lib/utils';

interface NightModeToggleProps {
  className?: string;
}

export function NightModeToggle({ className }: NightModeToggleProps) {
  const t = useTranslations();
  const nightMode = useSettingsStore((state) => state.stellarium.nightMode);
  const toggleStellariumSetting = useSettingsStore((state) => state.toggleStellariumSetting);

  useNightModeEffect(nightMode);

  return (
    <>
      <StatusToggleButton
        icon={<MoonStar className={cn('h-5 w-5', nightMode && 'fill-current')} />}
        label={t('settings.nightMode')}
        tone="night"
        active={nightMode}
        onClick={() => toggleStellariumSetting('nightMode')}
        className={className}
      />

      {/* Night mode filter overlay */}
      {nightMode && <div className="night-mode-filter" aria-hidden="true" />}
    </>
  );
}
