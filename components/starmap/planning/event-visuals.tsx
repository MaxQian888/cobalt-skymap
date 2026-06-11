import type { ComponentType } from 'react';
import {
  CircleDot,
  Eclipse,
  Moon,
  Orbit,
  Sparkles,
  Star,
  Sun,
} from 'lucide-react';

/**
 * Shared visual vocabulary for astronomical events (icon, color, type label).
 *
 * Single source of truth consumed by both `astro-events-calendar` and
 * `event-detail-dialog`; previously these maps were copy-pasted verbatim in
 * both files (the detail dialog even carried a "shared with calendar" comment
 * that was not actually shared).
 */

export const EVENT_ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  lunar_phase: Moon,
  meteor_shower: Sparkles,
  planet_conjunction: CircleDot,
  eclipse: Eclipse,
  planet_opposition: Orbit,
  planet_elongation: Star,
  equinox_solstice: Sun,
  comet: Star,
  asteroid: CircleDot,
  supernova: Star,
  aurora: Sparkles,
  other: Star,
};

export const EVENT_COLOR_MAP: Record<string, string> = {
  lunar_phase: 'text-amber-400 bg-amber-400/10',
  meteor_shower: 'text-purple-400 bg-purple-400/10',
  planet_conjunction: 'text-blue-400 bg-blue-400/10',
  eclipse: 'text-red-400 bg-red-400/10',
  planet_opposition: 'text-orange-400 bg-orange-400/10',
  planet_elongation: 'text-cyan-400 bg-cyan-400/10',
  equinox_solstice: 'text-yellow-400 bg-yellow-400/10',
  comet: 'text-green-400 bg-green-400/10',
  asteroid: 'text-stone-400 bg-stone-400/10',
  supernova: 'text-pink-400 bg-pink-400/10',
  aurora: 'text-emerald-400 bg-emerald-400/10',
  other: 'text-muted-foreground bg-muted',
};

/** Maps each event type to its `eventDetail.typeLabel.*` translation key. */
export const EVENT_TYPE_LABEL_KEYS: Record<string, string> = {
  lunar_phase: 'eventDetail.typeLabel.lunar_phase',
  meteor_shower: 'eventDetail.typeLabel.meteor_shower',
  planet_conjunction: 'eventDetail.typeLabel.planet_conjunction',
  eclipse: 'eventDetail.typeLabel.eclipse',
  planet_opposition: 'eventDetail.typeLabel.planet_opposition',
  planet_elongation: 'eventDetail.typeLabel.planet_elongation',
  equinox_solstice: 'eventDetail.typeLabel.equinox_solstice',
  comet: 'eventDetail.typeLabel.comet',
  asteroid: 'eventDetail.typeLabel.asteroid',
  supernova: 'eventDetail.typeLabel.supernova',
  aurora: 'eventDetail.typeLabel.aurora',
  other: 'eventDetail.typeLabel.other',
};

export function getEventIconComponent(type: string): ComponentType<{ className?: string }> {
  return EVENT_ICON_MAP[type] ?? Star;
}

export function getEventColorClass(type: string): string {
  return EVENT_COLOR_MAP[type] ?? 'text-muted-foreground bg-muted';
}

/** Returns the translation key for an event type label (falls back to `other`). */
export function getEventTypeLabelKey(type: string): string {
  return EVENT_TYPE_LABEL_KEYS[type] ?? 'eventDetail.typeLabel.other';
}

export function getEventIcon(type: string, className = 'h-4 w-4') {
  const Icon = getEventIconComponent(type);
  return <Icon className={className} />;
}
