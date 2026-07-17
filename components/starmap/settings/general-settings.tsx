'use client';

import { useTranslations } from 'next-intl';
import {
  Globe,
  Clock,
  Ruler,
  Thermometer,
  MapPin,
  Power,
  XCircle,
} from 'lucide-react';
import { isDesktop, isTauri } from '@/lib/storage/platform';
import { useIsClient } from '@/lib/hooks/use-is-client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAutostartStore, useDailyKnowledgeStore } from '@/lib/stores';
import type {
  AppLocale,
  TimeFormat,
  DateFormat,
  CoordinateFormat,
  DistanceUnit,
  TemperatureUnit,
  StartupView,
} from '@/lib/stores/settings-store';
import { usePreferencesDraftModel } from '@/lib/hooks/use-settings-draft';
import { SettingsSection, ToggleItem } from './settings-shared';

export function GeneralSettings() {
  const t = useTranslations();

  const { preferences, setPreference } = usePreferencesDraftModel();
  const openDailyKnowledge = useDailyKnowledgeStore((state) => state.openDialog);
  const autostartSupported = useAutostartStore((state) => state.supported);
  const autostartLoading = useAutostartStore((state) => state.loading);
  const autostartActualEnabled = useAutostartStore((state) => state.actualEnabled);
  const autostartError = useAutostartStore((state) => state.error);

  // Close-to-tray only applies to the desktop app. Gate on the client flag so
  // the isTauri/isDesktop (window-reading) checks stay hydration-safe.
  const isClient = useIsClient();
  const isDesktopApp = isClient && isTauri() && isDesktop();

  const autostartDescription = autostartError
    ? t('settingsNew.general.launchOnStartupError', { message: autostartError })
    : autostartLoading
      ? t('settingsNew.general.launchOnStartupChecking')
      : autostartActualEnabled
        ? t('settingsNew.general.launchOnStartupEnabled')
        : t('settingsNew.general.launchOnStartupDesc');

  const handleLocaleChange = (locale: AppLocale) => {
    setPreference('locale', locale);
  };

  return (
    <div className="space-y-4">
      {/* Language */}
      <SettingsSection
        title={t('settingsNew.general.language')}
        icon={<Globe className="h-4 w-4" />}
        defaultOpen={true}
      >
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            {t('settingsNew.general.appLanguage')}
          </Label>
          <Select
            value={preferences.locale}
            onValueChange={(v) => handleLocaleChange(v as AppLocale)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t('settingsNew.general.languageEnglish')}</SelectItem>
              <SelectItem value="zh">{t('settingsNew.general.languageChinese')}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t('settingsNew.general.languageDescription')}
          </p>
        </div>
      </SettingsSection>

      <Separator />

      {/* Time & Date Format */}
      <SettingsSection
        title={t('settingsNew.general.timeDate')}
        icon={<Clock className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {t('settingsNew.general.timeFormat')}
            </Label>
            <Select
              value={preferences.timeFormat}
              onValueChange={(v) => setPreference('timeFormat', v as TimeFormat)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">{t('settingsNew.general.time24h')}</SelectItem>
                <SelectItem value="12h">{t('settingsNew.general.time12h')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {t('settingsNew.general.dateFormat')}
            </Label>
            <Select
              value={preferences.dateFormat}
              onValueChange={(v) => setPreference('dateFormat', v as DateFormat)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="iso">{t('settingsNew.general.dateFormatIso')}</SelectItem>
                <SelectItem value="us">{t('settingsNew.general.dateFormatUs')}</SelectItem>
                <SelectItem value="eu">{t('settingsNew.general.dateFormatEu')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsSection>

      <Separator />

      {/* Coordinates Format */}
      <SettingsSection
        title={t('settingsNew.general.coordinates')}
        icon={<MapPin className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            {t('settingsNew.general.coordinateFormat')}
          </Label>
          <Select
            value={preferences.coordinateFormat}
            onValueChange={(v) => setPreference('coordinateFormat', v as CoordinateFormat)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dms">{t('settingsNew.general.formatDMS')}</SelectItem>
              <SelectItem value="hms">{t('settingsNew.general.formatHMS')}</SelectItem>
              <SelectItem value="degrees">{t('settingsNew.general.formatDegrees')}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t('settingsNew.general.coordinateFormatDesc')}
          </p>
        </div>
      </SettingsSection>

      <Separator />

      {/* Units */}
      <SettingsSection
        title={t('settingsNew.general.units')}
        icon={<Ruler className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {t('settingsNew.general.distanceUnit')}
            </Label>
            <Select
              value={preferences.distanceUnit}
              onValueChange={(v) => setPreference('distanceUnit', v as DistanceUnit)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="metric">{t('settingsNew.general.metric')}</SelectItem>
                <SelectItem value="imperial">{t('settingsNew.general.imperial')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">
                {t('settingsNew.general.temperatureUnit')}
              </Label>
            </div>
            <Select
              value={preferences.temperatureUnit}
              onValueChange={(v) => setPreference('temperatureUnit', v as TemperatureUnit)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="celsius">{t('settingsNew.general.celsius')}</SelectItem>
                <SelectItem value="fahrenheit">{t('settingsNew.general.fahrenheit')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsSection>

      <Separator />

      {/* Startup Behavior */}
      <SettingsSection
        title={t('settingsNew.general.startup')}
        icon={<Power className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {t('settingsNew.general.startupView')}
            </Label>
            <Select
              value={preferences.startupView}
              onValueChange={(v) => setPreference('startupView', v as StartupView)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last">{t('settingsNew.general.startupViewLast')}</SelectItem>
                <SelectItem value="default">{t('settingsNew.general.startupViewDefault')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('settingsNew.general.startupViewDesc')}
            </p>
          </div>

          {autostartSupported && (
            <ToggleItem
              id="launch-on-startup"
              label={t('settingsNew.general.launchOnStartup')}
              description={autostartDescription}
              checked={preferences.launchOnStartup}
              onCheckedChange={(checked) => setPreference('launchOnStartup', checked)}
            />
          )}
          <ToggleItem
            id="show-splash"
            label={t('settingsNew.general.showSplash')}
            description={t('settingsNew.general.showSplashDesc')}
            checked={preferences.showSplash}
            onCheckedChange={(checked) => setPreference('showSplash', checked)}
          />
          <ToggleItem
            id="auto-connect-backend"
            label={t('settingsNew.general.autoConnect')}
            description={t('settingsNew.general.autoConnectDesc')}
            checked={preferences.autoConnectBackend}
            onCheckedChange={(checked) => setPreference('autoConnectBackend', checked)}
          />
          <ToggleItem
            id="daily-knowledge-enabled"
            label={t('settingsNew.general.dailyKnowledgeEnabled')}
            description={t('settingsNew.general.dailyKnowledgeEnabledDesc')}
            checked={preferences.dailyKnowledgeEnabled}
            onCheckedChange={(checked) => setPreference('dailyKnowledgeEnabled', checked)}
          />
          <ToggleItem
            id="daily-knowledge-auto-show"
            label={t('settingsNew.general.dailyKnowledgeAutoShow')}
            description={t('settingsNew.general.dailyKnowledgeAutoShowDesc')}
            checked={preferences.dailyKnowledgeAutoShow}
            onCheckedChange={(checked) => setPreference('dailyKnowledgeAutoShow', checked)}
          />
          <ToggleItem
            id="daily-knowledge-online-enhancement"
            label={t('settingsNew.general.dailyKnowledgeOnlineEnhancement')}
            description={t('settingsNew.general.dailyKnowledgeOnlineEnhancementDesc')}
            checked={preferences.dailyKnowledgeOnlineEnhancement}
            onCheckedChange={(checked) => setPreference('dailyKnowledgeOnlineEnhancement', checked)}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={!preferences.dailyKnowledgeEnabled}
            onClick={() => {
              void openDailyKnowledge('manual');
            }}
          >
            {t('settingsNew.general.openDailyKnowledgeNow')}
          </Button>
        </div>
      </SettingsSection>

      <Separator />

      {/* Close Confirmation */}
      <SettingsSection
        title={t('settingsNew.general.behavior')}
        icon={<XCircle className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <ToggleItem
            id="skip-close-confirmation"
            label={t('settingsNew.general.skipCloseConfirmation')}
            description={t('settingsNew.general.skipCloseConfirmationDesc')}
            checked={preferences.skipCloseConfirmation}
            onCheckedChange={(checked) => setPreference('skipCloseConfirmation', checked)}
          />
          {isDesktopApp && (
            <ToggleItem
              id="close-to-tray"
              label={t('settingsNew.general.closeToTray')}
              description={t('settingsNew.general.closeToTrayDesc')}
              checked={preferences.closeToTray}
              onCheckedChange={(checked) => setPreference('closeToTray', checked)}
            />
          )}
        </div>
      </SettingsSection>
    </div>
  );
}
