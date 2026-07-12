'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { StellariumIcon } from '@/components/icons';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import type { StellariumCreditsProps } from '@/types/stellarium-credits';
import { STARMAP_DIALOG_SCROLL_BODY_CLASS } from './dialog-layout';

interface CreditEntry {
  labelKey?: string;
  descriptionKey: string;
}

interface CreditSection {
  id: string;
  titleKey: string;
  descriptionKey?: string;
  entries?: CreditEntry[];
}

const CREDIT_SECTIONS: CreditSection[] = [
  {
    id: 'stars',
    titleKey: 'credits.stars',
    descriptionKey: 'credits.starsDescription',
    entries: [
      { labelKey: 'credits.gaiaLabel', descriptionKey: 'credits.gaiaDescription' },
      { labelKey: 'credits.hipparcosLabel', descriptionKey: 'credits.hipparcosDescription' },
      { labelKey: 'credits.brightStarsLabel', descriptionKey: 'credits.brightStarsDescription' },
    ],
  },
  {
    id: 'dso',
    titleKey: 'credits.deepSkyObjects',
    descriptionKey: 'credits.dsoDescription',
    entries: [
      { labelKey: 'credits.hyperledaLabel', descriptionKey: 'credits.hyperledaDescription' },
      { labelKey: 'credits.simbadLabel', descriptionKey: 'credits.simbadDescription' },
      { labelKey: 'credits.openNgcLabel', descriptionKey: 'credits.openNgcDescription' },
      { descriptionKey: 'credits.caldwellDescription' },
    ],
  },
  {
    id: 'background',
    titleKey: 'credits.backgroundImage',
    descriptionKey: 'credits.dssDescription',
    entries: [
      { descriptionKey: 'credits.dssDetails1' },
      { descriptionKey: 'credits.dssDetails2' },
    ],
  },
  {
    id: 'planet-textures',
    titleKey: 'credits.planetTextures',
    descriptionKey: 'credits.planetTexturesDescription',
    entries: [{ descriptionKey: 'credits.planetTexturesSource' }],
  },
  {
    id: 'minor-planets',
    titleKey: 'credits.minorPlanets',
    descriptionKey: 'credits.minorPlanetsDescription',
  },
  {
    id: 'others',
    titleKey: 'credits.others',
    entries: [
      { descriptionKey: 'credits.landscapeImages' },
      { descriptionKey: 'credits.constellationLines' },
    ],
  },
];

export function StellariumCredits({ trigger }: StellariumCreditsProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  const defaultTrigger = (
    <Button
      variant="outline"
      size="sm"
      className="w-full justify-between"
      aria-label={t('credits.dataCredits')}
    >
      <span className="flex items-center gap-2">
        <StellariumIcon className="h-4 w-4" />
        {t('credits.dataCredits')}
      </span>
      <ChevronRight className="h-4 w-4" />
    </Button>
  );

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen} tier="standard-form">
      <ResponsiveDialogTrigger asChild>
        {trigger || defaultTrigger}
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent desktopClassName="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <StellariumIcon className="h-5 w-5 text-primary" />
            {t('credits.dataCredits')}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="sr-only">
            {t('credits.starsDescription')}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ScrollArea className={`${STARMAP_DIALOG_SCROLL_BODY_CLASS} pr-4`}>
          <div className="space-y-4 pb-1">
            <Card className="gap-3 bg-muted/20 py-4">
              <CardHeader className="px-4 pb-0">
                <CardTitle className="text-sm">{t('credits.dataCredits')}</CardTitle>
                <CardDescription>
                  {t('credits.starsDescription')}
                </CardDescription>
              </CardHeader>
            </Card>

            <Accordion type="multiple" defaultValue={['stars']} className="space-y-2">
              {CREDIT_SECTIONS.map((section) => (
                <AccordionItem
                  key={section.id}
                  value={section.id}
                  className="rounded-lg border px-4"
                >
                  <AccordionTrigger className="py-3 text-sm hover:no-underline">
                    {t(section.titleKey)}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    {section.descriptionKey ? (
                      <p className="text-sm text-muted-foreground">
                        {t(section.descriptionKey)}
                      </p>
                    ) : null}
                    {section.entries?.length ? (
                      <ul className="list-disc space-y-1 pl-5 text-sm">
                        {section.entries.map((entry) => (
                          <li key={`${section.id}-${entry.descriptionKey}`}>
                            {entry.labelKey ? (
                              <>
                                <strong>{t(entry.labelKey)}:</strong>{' '}
                                {t(entry.descriptionKey)}
                              </>
                            ) : (
                              t(entry.descriptionKey)
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </ScrollArea>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
