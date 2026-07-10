/**
 * About Dialog - Static Data Constants
 *
 * Application metadata, licenses, dependencies, and data credits
 * displayed in the About dialog.
 */

import type { AppInfo, LicenseInfo, DependencyInfo, DataCreditInfo } from '@/types/about';
import type { DependencyGroup } from '@/types/about';
import { EXTERNAL_LINKS } from './external-links';
import { ABOUT_DEPENDENCIES } from './generated/about-dependencies';

// ============================================================================
// Application Info
// ============================================================================

export const APP_INFO: AppInfo = {
  name: 'Cobalt Skymap',
  version: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
  repository: EXTERNAL_LINKS.repository,
  author: 'AstroAir Team',
};

// ============================================================================
// Licenses
// ============================================================================

export const LICENSES: LicenseInfo[] = [
  {
    name: 'Stellarium Web Engine',
    license: 'GPL-3.0',
    url: 'https://github.com/Stellarium/stellarium-web-engine',
    descriptionKey: 'about.licenseDesc.stellarium',
  },
  {
    name: 'Next.js',
    license: 'MIT',
    url: 'https://nextjs.org',
    descriptionKey: 'about.licenseDesc.nextjs',
  },
  {
    name: 'React',
    license: 'MIT',
    url: 'https://react.dev',
    descriptionKey: 'about.licenseDesc.react',
  },
  {
    name: 'Tailwind CSS',
    license: 'MIT',
    url: 'https://tailwindcss.com',
    descriptionKey: 'about.licenseDesc.tailwind',
  },
  {
    name: 'shadcn/ui',
    license: 'MIT',
    url: 'https://ui.shadcn.com',
    descriptionKey: 'about.licenseDesc.shadcn',
  },
  {
    name: 'Zustand',
    license: 'MIT',
    url: 'https://zustand-demo.pmnd.rs',
    descriptionKey: 'about.licenseDesc.zustand',
  },
  {
    name: 'next-intl',
    license: 'MIT',
    url: 'https://next-intl-docs.vercel.app',
    descriptionKey: 'about.licenseDesc.nextIntl',
  },
  {
    name: 'Lucide React',
    license: 'ISC',
    url: 'https://lucide.dev',
    descriptionKey: 'about.licenseDesc.lucide',
  },
];

// ============================================================================
// Dependencies
// ============================================================================

const DEPENDENCY_RUNTIME_ORDER = ['shared', 'desktop'] as const;

export const DEPENDENCIES: DependencyInfo[] = ABOUT_DEPENDENCIES;

export function getVisibleDependencies(isTauriRuntime: boolean): DependencyInfo[] {
  return DEPENDENCIES.filter((dependency) => isTauriRuntime || dependency.runtime === 'shared');
}

export function getDependencyGroups(isTauriRuntime: boolean): DependencyGroup[] {
  const visibleDependencies = getVisibleDependencies(isTauriRuntime);

  return DEPENDENCY_RUNTIME_ORDER.map((runtime) => ({
    runtime,
    items: visibleDependencies.filter((dependency) => dependency.runtime === runtime),
  })).filter((group) => group.items.length > 0);
}

// ============================================================================
// Data Credits
// ============================================================================

export const DATA_CREDITS: DataCreditInfo[] = [
  { nameKey: 'about.credit.hipsSurveys', source: 'CDS, Strasbourg', url: 'https://aladin.cds.unistra.fr/hips/' },
  { nameKey: 'about.credit.starCatalog', source: 'Hipparcos/Tycho', url: 'https://www.cosmos.esa.int/web/hipparcos' },
  { nameKey: 'about.credit.deepSkyObjects', source: 'OpenNGC', url: 'https://github.com/mattiaverga/OpenNGC' },
  { nameKey: 'about.credit.constellationData', source: 'IAU', url: 'https://www.iau.org/public/themes/constellations/' },
  { nameKey: 'about.credit.planetTextures', source: 'NASA/JPL', url: 'https://www.jpl.nasa.gov/' },
];
