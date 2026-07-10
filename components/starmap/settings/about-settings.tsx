'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { GitHubIcon } from '@/components/icons';
import {
  Info,
  ExternalLink,
  Database,
  Heart,
  BookOpen,
  Monitor,
  Cpu,
  HardDrive,
  MessageCircleWarning,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SettingsSection } from './settings-shared';
import { useAppSettings } from '@/lib/tauri/hooks';
import { isTauri } from '@/lib/storage/platform';
import { openExternalUrl } from '@/lib/tauri/app-control-api';
import { EXTERNAL_LINKS } from '@/lib/constants/external-links';
import { FeedbackDialog } from '@/components/starmap/dialogs/feedback-dialog';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0';
const BUILD_DATE = process.env.NEXT_PUBLIC_BUILD_DATE || new Date().getFullYear().toString();

export function AboutSettings() {
  const t = useTranslations();
  const { systemInfo, loading: systemLoading } = useAppSettings();
  const isDesktop = isTauri();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* App Info */}
      <SettingsSection
        title={t('settingsNew.about.appInfo')}
        icon={<Info className="h-4 w-4" />}
        defaultOpen={true}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
            <span className="text-sm">{t('settingsNew.about.version')}</span>
            <Badge variant="outline" className="font-mono">v{APP_VERSION}</Badge>
          </div>
          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
            <span className="text-sm">{t('settingsNew.about.buildDate')}</span>
            <span className="text-sm text-muted-foreground">{BUILD_DATE}</span>
          </div>
          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
            <span className="text-sm">{t('settingsNew.about.engine')}</span>
            <span className="text-sm text-muted-foreground">Stellarium Web Engine</span>
          </div>
        </div>
      </SettingsSection>

      {/* System Info (Desktop Only) */}
      {isDesktop && (
        <>
          <Separator />
          <SettingsSection
            title={t('settingsNew.about.systemInfo') || 'System Info'}
            icon={<Monitor className="h-4 w-4" />}
            defaultOpen={false}
          >
            {systemLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : systemInfo ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                  <span className="text-sm flex items-center gap-2">
                    <Cpu className="h-3 w-3" />
                    {t('settingsNew.about.os') || 'Operating System'}
                  </span>
                  <span className="text-sm text-muted-foreground">{systemInfo.os}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                  <span className="text-sm flex items-center gap-2">
                    <Monitor className="h-3 w-3" />
                    {t('settingsNew.about.arch') || 'Architecture'}
                  </span>
                  <span className="text-sm text-muted-foreground">{systemInfo.arch}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                  <span className="text-sm flex items-center gap-2">
                    <HardDrive className="h-3 w-3" />
                    {t('settingsNew.about.tauriVersion') || 'Tauri Version'}
                  </span>
                  <span className="text-sm text-muted-foreground">{systemInfo.tauri_version}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('settingsNew.about.systemInfoUnavailable') || 'System info unavailable'}
              </p>
            )}
          </SettingsSection>
        </>
      )}

      <Separator />

      {/* Links */}
      <SettingsSection
        title={t('settingsNew.about.links')}
        icon={<ExternalLink className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => void openExternalUrl(EXTERNAL_LINKS.repository)}
          >
            <GitHubIcon className="h-4 w-4" />
            {t('settingsNew.about.sourceCode')}
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => void openExternalUrl(EXTERNAL_LINKS.wiki)}
          >
            <BookOpen className="h-4 w-4" />
            {t('settingsNew.about.documentation')}
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => setFeedbackOpen(true)}
            data-testid="about-settings-report-issue-button"
          >
            <MessageCircleWarning className="h-4 w-4" />
            {t('settingsNew.about.reportIssue')}
          </Button>
        </div>
      </SettingsSection>

      <Separator />

      {/* Data Credits */}
      <SettingsSection
        title={t('settingsNew.about.dataCredits')}
        icon={<Database className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-3 text-sm">
          <div className="p-3 rounded-lg bg-muted/30 space-y-1">
            <div className="font-medium">{t('credits.stars')}</div>
            <p className="text-xs text-muted-foreground">Gaia DR3, Hipparcos, Yale Bright Star</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 space-y-1">
            <div className="font-medium">{t('credits.deepSkyObjects')}</div>
            <p className="text-xs text-muted-foreground">OpenNGC, HyperLEDA, SIMBAD</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 space-y-1">
            <div className="font-medium">{t('credits.backgroundImage')}</div>
            <p className="text-xs text-muted-foreground">DSS (STScI/NASA), CDS</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 space-y-1">
            <div className="font-medium">{t('credits.minorPlanets')}</div>
            <p className="text-xs text-muted-foreground">IAU Minor Planet Center</p>
          </div>
        </div>
      </SettingsSection>

      <Separator />

      {/* Credits */}
      <div className="py-4 text-center space-y-2">
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
          {t('about.madeWith')} <Heart className="h-3 w-3 text-red-500 fill-red-500" />
        </p>
        <p className="text-xs text-muted-foreground">
          {t('about.poweredBy')}
        </p>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Cobalt Skymap. {t('about.allRightsReserved')}
        </p>
      </div>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
  );
}
