'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { LanguageSwitcher } from '@/components/common/language-switcher';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { Menu } from 'lucide-react';
import { GitHubIcon, CobaltSkymapLogo } from '@/components/icons';
import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { EXTERNAL_LINKS } from '@/lib/constants/external-links';

interface NavItem {
  href: string;
  labelKey: string;
  external?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '#features', labelKey: 'nav.features' },
  { href: '#screenshots', labelKey: 'nav.screenshots' },
  { href: '#tech', labelKey: 'nav.technology' },
  { href: EXTERNAL_LINKS.repository, labelKey: 'nav.github', external: true },
];

const SECTION_IDS = ['features', 'screenshots', 'tech'] as const;

interface NavLinkProps {
  item: NavItem;
  label: string;
  className?: string;
  activeHref?: string;
  onClick?: () => void;
}

function NavLink({ item, label, className, activeHref, onClick }: NavLinkProps) {
  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn('text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5', className)}
        onClick={onClick}
      >
        <GitHubIcon className="h-4 w-4" />
        {label}
      </a>
    );
  }

  // Hash links use <a> with smooth scroll to avoid Next.js router interference
  if (item.href.startsWith('#')) {
    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      const id = item.href.slice(1);
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      onClick?.();
    };
    return (
      <a
        href={item.href}
        className={cn(
          'text-sm transition-colors',
          activeHref === item.href
            ? 'text-foreground font-medium'
            : 'text-muted-foreground hover:text-foreground',
          className
        )}
        onClick={handleClick}
      >
        {label}
      </a>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'text-sm transition-colors',
        activeHref === item.href
          ? 'text-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground',
        className
      )}
      onClick={onClick}
    >
      {label}
    </Link>
  );
}

export function Navbar() {
  const t = useTranslations('landing');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');

  const rafRef = useRef<number>(0);
  const scrolledRef = useRef(false);
  const activeSectionRef = useRef('');

  const updateScrollState = useCallback(() => {
    const nowScrolled = window.scrollY > 50;
    let current = '';
    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= 120 && rect.bottom > 120) {
          current = `#${id}`;
          break;
        }
      }
    }

    // Only trigger re-render if values actually changed
    if (nowScrolled !== scrolledRef.current) {
      scrolledRef.current = nowScrolled;
      setScrolled(nowScrolled);
    }
    if (current !== activeSectionRef.current) {
      activeSectionRef.current = current;
      setActiveSection(current);
    }
  }, []);

  useEffect(() => {
    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateScrollState);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [updateScrollState]);

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 border-b transition-all duration-300 safe-area-top',
        scrolled
          ? 'glass border-border/50 shadow-sm'
          : 'bg-transparent border-transparent'
      )}
      style={{ paddingLeft: 'var(--safe-area-left)', paddingRight: 'var(--safe-area-right)' }}
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <CobaltSkymapLogo className="h-6 w-6 text-primary group-hover:text-secondary transition-colors" />
            <span className="font-serif text-xl font-bold text-foreground">
              Cobalt Skymap
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                label={t(item.labelKey)}
                activeHref={activeSection}
              />
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
            <Link href="/starmap" className="hidden sm:block">
              <Button size="sm" className="font-medium">
                {t('nav.launchApp')}
              </Button>
            </Link>

            {/* Mobile menu */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden touch-target" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <CobaltSkymapLogo className="h-5 w-5 text-primary" />
                    Cobalt Skymap
                  </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 mt-4">
                  {NAV_ITEMS.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      label={t(item.labelKey)}
                      className="px-3 py-2 hover:bg-muted/50 rounded-md"
                      onClick={() => setSheetOpen(false)}
                    />
                  ))}
                  <div className="flex items-center gap-2 px-3 pt-4">
                    <LanguageSwitcher />
                    <ThemeToggle />
                  </div>
                  <div className="px-3 pt-2">
                    <Link href="/starmap" className="block" onClick={() => setSheetOpen(false)}>
                      <Button size="sm" className="w-full font-medium">
                        {t('nav.launchApp')}
                      </Button>
                    </Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
