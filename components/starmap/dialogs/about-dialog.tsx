'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Info,
  FileText,
  Package,
  ExternalLink,
  Heart,
  MessageCircleWarning,
} from 'lucide-react';
import { GitHubIcon, SkyMapLogo } from '@/components/icons';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { isTauri } from '@/lib/storage/platform';
import { cn } from '@/lib/utils';
import type { LicenseInfo, DataCreditInfo, DependencyGroup } from '@/types/about';
import {
  APP_INFO,
  LICENSES,
  DATA_CREDITS,
  getDependencyGroups,
  getVisibleDependencies,
} from '@/lib/constants/about-data';
import {
  STARMAP_DIALOG_ICON_TRIGGER_CLASS,
  STARMAP_DIALOG_SCROLL_BODY_CLASS,
} from './dialog-layout';
import { StellariumCredits } from './stellarium-credits';
import { FeedbackDialog } from './feedback-dialog';

const DEPENDENCY_TYPE_COLORS: Record<string, string> = {
  framework: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  desktop: 'bg-sky-500/20 text-sky-700 dark:text-sky-400',
  style: 'bg-purple-500/20 text-purple-700 dark:text-purple-400',
  state: 'bg-green-500/20 text-green-700 dark:text-green-400',
  i18n: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  ui: 'bg-pink-500/20 text-pink-700 dark:text-pink-400',
  util: 'bg-orange-500/20 text-orange-700 dark:text-orange-400',
  astronomy: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-400',
  mapping: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400',
  testing: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
  tooling: 'bg-slate-500/20 text-slate-700 dark:text-slate-400',
  other: 'bg-gray-500/20 text-gray-700 dark:text-gray-400',
};

function LicenseAccordionItem({
  item,
  t,
}: {
  item: LicenseInfo;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <AccordionItem value={item.name} className="rounded-lg border px-3">
      <AccordionTrigger className="py-3 hover:no-underline">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{item.name}</span>
          <Badge variant="outline" className="text-[10px]">
            {item.license}
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-3 pb-3">
        <p className="text-xs text-muted-foreground">{t(item.descriptionKey)}</p>
        <Button variant="outline" size="sm" asChild className="w-full justify-between">
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            <span className="truncate">{item.url}</span>
            <ExternalLink className="h-4 w-4 shrink-0" />
          </a>
        </Button>
      </AccordionContent>
    </AccordionItem>
  );
}

function DataCreditRow({
  item,
  t,
}: {
  item: DataCreditInfo;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
    >
      <span>{t(item.nameKey)}</span>
      <span className="text-xs text-muted-foreground">{item.source}</span>
    </a>
  );
}

function DependencyTable({
  group,
  t,
}: {
  group: DependencyGroup;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="space-y-2" data-testid={`dependency-group-${group.runtime}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">{t(`about.depRuntime.${group.runtime}`)}</h3>
          <p className="text-xs text-muted-foreground">{group.items.length}</p>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('about.depPackage')}</TableHead>
              <TableHead>{t('about.depVersion')}</TableHead>
              <TableHead>{t('about.depTypeLabel')}</TableHead>
              <TableHead className="text-right">{t('about.depSourceLabel')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.items.map((item) => (
              <TableRow key={`${item.source}:${item.name}`} data-testid="dependency-row">
                <TableCell>
                  <div className="font-mono">{item.name}</div>
                  <div className="text-[10px] text-muted-foreground">{item.manifestSection}</div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {item.version}
                </TableCell>
                <TableCell>
                  <Badge
                    className={cn(
                      'text-[10px]',
                      DEPENDENCY_TYPE_COLORS[item.type] || DEPENDENCY_TYPE_COLORS.other
                    )}
                  >
                    {t(`about.depType.${item.type}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className="text-[10px]">
                    {t(`about.depSource.${item.source}`)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function AboutDialog() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackPending, setFeedbackPending] = useState(false);
  const tauriRuntime = isTauri();
  const dependencyGroups = getDependencyGroups(tauriRuntime);
  const visibleDependencies = getVisibleDependencies(tauriRuntime);

  useEffect(() => {
    if (open || !feedbackPending) {
      return;
    }

    const timer = window.setTimeout(() => {
      setFeedbackOpen(true);
      setFeedbackPending(false);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [feedbackPending, open]);

  const handleReportIssue = () => {
    setOpen(false);
    setFeedbackPending(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <Button
          data-testid="about-button"
          variant="ghost"
          size="icon"
          className={STARMAP_DIALOG_ICON_TRIGGER_CLASS}
          aria-label={t('about.title')}
          onClick={() => setOpen(true)}
        >
          <Info className="h-5 w-5" />
        </Button>

        <DialogContent data-testid="about-dialog" className="flex max-h-[85vh] max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[680px]">
          <DialogHeader className="shrink-0 p-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <SkyMapLogo className="h-5 w-5 text-primary" />
              {t('about.title')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('about.appDescription')}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="about" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-6 mt-4 grid shrink-0 grid-cols-3">
              <TabsTrigger value="about" className="text-xs sm:text-sm">
                <Info className="mr-1 hidden h-4 w-4 sm:inline" />
                {t('about.aboutTab')}
              </TabsTrigger>
              <TabsTrigger value="licenses" className="text-xs sm:text-sm">
                <FileText className="mr-1 hidden h-4 w-4 sm:inline" />
                {t('about.licensesTab')}
              </TabsTrigger>
              <TabsTrigger value="deps" className="text-xs sm:text-sm">
                <Package className="mr-1 hidden h-4 w-4 sm:inline" />
                {t('about.depsTab')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="about" className="min-h-0 flex-1 p-6 pt-4">
              <ScrollArea className={STARMAP_DIALOG_SCROLL_BODY_CLASS}>
                <div className="space-y-4 pr-2">
                  <Card className="gap-4 py-4">
                    <CardHeader className="px-4 pb-0">
                      <div className="flex flex-col items-center gap-4 sm:flex-row">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20">
                          <SkyMapLogo className="h-8 w-8 text-primary" />
                        </div>
                        <div className="text-center sm:text-left">
                          <CardTitle>{APP_INFO.name}</CardTitle>
                          <CardDescription className="mt-1">
                            v{APP_INFO.version}
                          </CardDescription>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {t('about.appDescription')}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>

                  <Card className="gap-3 py-4">
                    <CardHeader className="px-4 pb-0">
                      <CardTitle className="text-sm">{t('about.sourceCode')}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 px-4 sm:grid-cols-2">
                      <Button
                        variant="outline"
                        asChild
                        className="h-auto justify-start gap-3 p-3"
                      >
                        <a href={APP_INFO.repository} target="_blank" rel="noopener noreferrer">
                          <GitHubIcon className="h-5 w-5" />
                          <div className="text-left">
                            <p className="text-sm font-medium">{t('about.sourceCode')}</p>
                            <p className="text-xs text-muted-foreground">GitHub</p>
                          </div>
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-auto justify-start gap-3 p-3 text-left"
                        onClick={handleReportIssue}
                        data-testid="report-issue-button"
                      >
                        <MessageCircleWarning className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{t('about.reportIssue')}</p>
                          <p className="text-xs text-muted-foreground">
                            {t('about.reportIssueDescription')}
                          </p>
                        </div>
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="gap-3 py-4">
                    <CardHeader className="px-4 pb-0">
                      <CardTitle className="text-sm">{t('about.dataCredits')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 px-4">
                      {DATA_CREDITS.map((item) => (
                        <DataCreditRow key={item.nameKey} item={item} t={t} />
                      ))}
                      <StellariumCredits />
                    </CardContent>
                  </Card>

                  <Card className="gap-2 py-4">
                    <CardContent className="flex items-center gap-3 px-4">
                      <Heart className="h-5 w-5 text-red-500" />
                      <div>
                        <p className="text-sm font-medium">{t('about.madeWith')}</p>
                        <p className="text-xs text-muted-foreground">{APP_INFO.author}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="pt-2 text-center text-xs text-muted-foreground">
                    <p>
                      © {new Date().getFullYear()} {APP_INFO.author}.{' '}
                      {t('about.allRightsReserved')}
                    </p>
                    <p className="mt-1">{t('about.poweredBy')}</p>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="licenses" className="min-h-0 flex-1 p-6 pt-4">
              <ScrollArea className={STARMAP_DIALOG_SCROLL_BODY_CLASS}>
                <div className="space-y-3 pr-2">
                  <p className="text-sm text-muted-foreground">
                    {t('about.licensesDescription')}
                  </p>
                  <Accordion type="multiple" className="space-y-2">
                    {LICENSES.map((item) => (
                      <LicenseAccordionItem key={item.name} item={item} t={t} />
                    ))}
                  </Accordion>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="deps" className="min-h-0 flex-1 p-6 pt-4">
              <ScrollArea className={STARMAP_DIALOG_SCROLL_BODY_CLASS}>
                <div className="space-y-4 pr-2">
                  <p className="text-sm text-muted-foreground">{t('about.depsDescription')}</p>
                  {dependencyGroups.map((group) => (
                    <DependencyTable key={group.runtime} group={group} t={t} />
                  ))}
                  <p className="text-center text-xs text-muted-foreground">
                    {t('about.totalDeps', { count: visibleDependencies.length })}
                  </p>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
