'use client';

import { useTranslations } from 'next-intl';
import { Telescope, Cpu, Globe2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSettingsStore } from '@/lib/stores/settings-store';
import type { RecommendationProfile } from '@/lib/core/types';
import type { PrecisionMode, EopUpdatePolicy } from '@/lib/stores/settings-store';
import { SettingsSection } from './settings-shared';

const OBSERVATION_PROFILES: RecommendationProfile[] = ['imaging', 'visual', 'hybrid'];
const PRECISION_MODES: PrecisionMode[] = ['core_high_precision', 'realtime_lightweight'];
const EOP_POLICIES: EopUpdatePolicy[] = [
  'auto_with_offline_fallback',
  'embedded_only',
  'strict_offline',
];

/**
 * Advanced engine settings. These apply immediately (no draft session) and are
 * intended for power users; each carries an explanatory description.
 */
export function AdvancedSettings() {
  const t = useTranslations();

  const observationProfile = useSettingsStore((s) => s.observationProfile);
  const setObservationProfile = useSettingsStore((s) => s.setObservationProfile);
  const precisionMode = useSettingsStore((s) => s.precisionMode);
  const setPrecisionMode = useSettingsStore((s) => s.setPrecisionMode);
  const eopUpdatePolicy = useSettingsStore((s) => s.eopUpdatePolicy);
  const setEopUpdatePolicy = useSettingsStore((s) => s.setEopUpdatePolicy);

  return (
    <div className="space-y-4">
      {/* Observation profile */}
      <SettingsSection
        title={t('settingsNew.advanced.observationProfile')}
        icon={<Telescope className="h-4 w-4" />}
        defaultOpen={true}
      >
        <div className="space-y-2 py-2 px-3 rounded-lg bg-muted/30">
          <Label className="text-xs text-muted-foreground" htmlFor="observation-profile">
            {t('settingsNew.advanced.observationProfile')}
          </Label>
          <Select
            value={observationProfile}
            onValueChange={(v) => setObservationProfile(v as RecommendationProfile)}
          >
            <SelectTrigger id="observation-profile" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OBSERVATION_PROFILES.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(`settingsNew.advanced.observationProfile_${p}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t('settingsNew.advanced.observationProfileDesc')}
          </p>
        </div>
      </SettingsSection>

      <Separator />

      {/* Precision mode */}
      <SettingsSection
        title={t('settingsNew.advanced.precisionMode')}
        icon={<Cpu className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-2 py-2 px-3 rounded-lg bg-muted/30">
          <Label className="text-xs text-muted-foreground" htmlFor="precision-mode">
            {t('settingsNew.advanced.precisionMode')}
          </Label>
          <Select
            value={precisionMode}
            onValueChange={(v) => setPrecisionMode(v as PrecisionMode)}
          >
            <SelectTrigger id="precision-mode" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRECISION_MODES.map((m) => (
                <SelectItem key={m} value={m}>
                  {t(`settingsNew.advanced.precisionMode_${m}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t('settingsNew.advanced.precisionModeDesc')}
          </p>
        </div>
      </SettingsSection>

      <Separator />

      {/* EOP update policy */}
      <SettingsSection
        title={t('settingsNew.advanced.eopUpdatePolicy')}
        icon={<Globe2 className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-2 py-2 px-3 rounded-lg bg-muted/30">
          <Label className="text-xs text-muted-foreground" htmlFor="eop-policy">
            {t('settingsNew.advanced.eopUpdatePolicy')}
          </Label>
          <Select
            value={eopUpdatePolicy}
            onValueChange={(v) => setEopUpdatePolicy(v as EopUpdatePolicy)}
          >
            <SelectTrigger id="eop-policy" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EOP_POLICIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(`settingsNew.advanced.eopUpdatePolicy_${p}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t('settingsNew.advanced.eopUpdatePolicyDesc')}
          </p>
        </div>
      </SettingsSection>
    </div>
  );
}
