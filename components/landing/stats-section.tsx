'use client';

import { useTranslations } from 'next-intl';
import { useInView } from '@/lib/hooks/use-in-view';
import { useEffect, useState } from 'react';
import { Star, Users, Monitor, Globe } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getScrollAnimationProps } from '@/lib/utils/scroll-animation';

interface StatItem {
  icon: LucideIcon;
  key: string;
  value: number;
  suffix: string;
}

const stats: StatItem[] = [
  { icon: Star, key: 'celestialObjects', value: 2, suffix: 'B+' },
  { icon: Monitor, key: 'platforms', value: 3, suffix: '' },
  { icon: Users, key: 'openSource', value: 100, suffix: '%' },
  { icon: Globe, key: 'languages', value: 2, suffix: '+' },
];

function CountUp({ target, suffix, active }: { target: number; suffix: string; active: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) return;

    const duration = 1500;
    let start: number | null = null;
    let rafId: number;

    const animate = (timestamp: number) => {
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      setCount(Math.round(progress * target));
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [active, target]);

  return (
    <span className="tabular-nums">
      {count}
      {suffix}
    </span>
  );
}

export function StatsSection() {
  const t = useTranslations('landing.stats');
  const { ref: sectionRef, isInView } = useInView<HTMLDivElement>({ threshold: 0.3 });

  return (
    <section className="py-16 bg-muted/30 relative" aria-label="Statistics">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          ref={sectionRef}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8"
        >
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.key}
                className={cn(
                  'flex flex-col items-center text-center gap-3',
                  getScrollAnimationProps(isInView, index, 0.15).className
                )}
                style={getScrollAnimationProps(isInView, index, 0.15).style}
              >
                <div className="p-3 rounded-full bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-foreground">
                  <CountUp target={stat.value} suffix={stat.suffix} active={isInView} />
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  {t(`${stat.key}.label`)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
