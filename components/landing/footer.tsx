'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ComponentType } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { EXTERNAL_LINKS } from '@/lib/constants/external-links';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Star, Heart, ExternalLink, Map, BookOpen, ArrowUp, Mail } from 'lucide-react';
import { GitHubIcon, CobaltSkymapLogo, StellariumIcon } from '@/components/icons';

interface FooterLinkProps {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  tooltip: string;
  external?: boolean;
}

function FooterLink({ href, icon: Icon, label, tooltip, external }: FooterLinkProps) {
  const linkContent = (
    <>
      <Icon className="h-3.5 w-3.5" />
      {label}
      {external && <ExternalLink className="h-3 w-3 opacity-50" />}
    </>
  );

  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="link" className="h-auto p-0 text-muted-foreground hover:text-foreground" asChild>
            {external ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5"
              >
                {linkContent}
              </a>
            ) : (
              <Link href={href} className="inline-flex items-center gap-1.5">
                {linkContent}
              </Link>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </li>
  );
}

export function Footer() {
  const t = useTranslations('landing.footer');
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-12 bg-card border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4 group">
              <CobaltSkymapLogo className="h-6 w-6 text-primary group-hover:text-secondary transition-colors" />
              <span className="font-serif text-xl font-bold text-foreground">
                Cobalt Skymap
              </span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('description')}
            </p>
          </div>

          {/* Links */}
          <nav aria-label="Footer links">
            <h4 className="font-semibold text-foreground mb-4">{t('links')}</h4>
            <TooltipProvider>
              <ul className="space-y-2">
                <FooterLink href="/starmap" icon={Map} label={t('starmap')} tooltip={t('starmapTooltip')} />
                <FooterLink href={EXTERNAL_LINKS.repository} icon={GitHubIcon} label={t('github')} tooltip={t('githubTooltip')} external />
                <FooterLink href="https://stellarium.org" icon={BookOpen} label={t('stellarium')} tooltip={t('stellariumTooltip')} external />
              </ul>
            </TooltipProvider>
          </nav>

          {/* Community */}
          <nav aria-label="Community links">
            <h4 className="font-semibold text-foreground mb-4">{t('community')}</h4>
            <TooltipProvider>
              <ul className="space-y-2">
                <FooterLink href={EXTERNAL_LINKS.discussions} icon={GitHubIcon} label={t('discussions')} tooltip={t('discussionsTooltip')} external />
                <FooterLink href={EXTERNAL_LINKS.newIssueUrl()} icon={Mail} label={t('reportIssue')} tooltip={t('reportIssueTooltip')} external />
              </ul>
            </TooltipProvider>
          </nav>

          {/* Credits */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">{t('credits')}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <StellariumIcon className="h-3 w-3 text-primary" />
                {t('stellariumEngine')}
              </li>
              <li className="flex items-center gap-1.5">
                <Star className="h-3 w-3 text-primary" />
                {t('gaiaData')}
              </li>
              <li className="flex items-center gap-1.5">
                <Star className="h-3 w-3 text-primary" />
                {t('dssImages')}
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {currentYear} Cobalt Skymap. {t('allRightsReserved')}
          </p>
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              {t('madeWith')} <Heart className="h-3 w-3 text-destructive animate-pulse-subtle" /> {t('forAstronomers')}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="touch-target rounded-full"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              aria-label={t('backToTop')}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}
