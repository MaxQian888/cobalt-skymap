/**
 * Bundled Stellarium sky cultures.
 *
 * Each id maps to a directory under `public/stellarium-data/skycultures/{id}/`
 * (index.json + description.md) registered with the engine via
 * `core.skycultures.addDataSource({ url, key: id })`. Switching is done by
 * setting `core.skycultures.current_id` to the id.
 */

export interface SkyCultureOption {
  id: string;
  /** i18n key for the display name. */
  labelKey: string;
}

export const SKY_CULTURES: SkyCultureOption[] = [
  { id: 'western', labelKey: 'settings.skyCultureWestern' },
  { id: 'chinese', labelKey: 'settings.skyCultureChinese' },
  { id: 'inuit', labelKey: 'settings.skyCultureInuit' },
  { id: 'maori', labelKey: 'settings.skyCultureMaori' },
  { id: 'egyptian', labelKey: 'settings.skyCultureEgyptian' },
  { id: 'norse', labelKey: 'settings.skyCultureNorse' },
];

export const DEFAULT_SKY_CULTURE = 'western';

/** Bundled culture ids other than the default, registered after first render. */
export const SECONDARY_SKY_CULTURE_IDS = SKY_CULTURES.map((c) => c.id).filter(
  (id) => id !== DEFAULT_SKY_CULTURE
);
