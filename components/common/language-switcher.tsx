'use client';

import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useLocaleStore } from '@/lib/i18n/locale-store';
import { locales, localeNames, type Locale } from '@/i18n/config';
import { useTranslations } from 'next-intl';
import { useSettingsStore } from '@/lib/stores/settings-store';

interface LanguageSwitcherProps {
  variant?: 'ghost' | 'outline' | 'default';
  size?: 'default' | 'sm' | 'icon';
  className?: string;
}

export function LanguageSwitcher({
  variant = 'ghost',
  size = 'icon',
  className,
}: LanguageSwitcherProps) {
  const t = useTranslations('common');
  const { locale, setLocale } = useLocaleStore();
  const setPreference = useSettingsStore((state) => state.setPreference);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant={variant}
              size={size}
              className={className}
              aria-label={t('language')}
            >
              <Languages className="h-5 w-5" />
              {size !== 'icon' && <span className="ml-2">{localeNames[locale]}</span>}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{t('language')}</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => {
              const nextLocale = loc as Locale;
              setLocale(nextLocale);
              setPreference('locale', nextLocale);
            }}
            className={locale === loc ? 'bg-accent' : ''}
          >
            {localeNames[loc as Locale]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
