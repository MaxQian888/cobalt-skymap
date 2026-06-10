import type {
  CapabilityStep,
  StepSkipReason,
  TourContext,
  TourDefinition,
  TourId,
  TourStep,
} from '@/types/starmap/onboarding';

interface ResolveTourStepsResult {
  steps: TourStep[];
  skipped: Array<{
    tourId: TourId;
    capabilityId: string;
    reason: StepSkipReason;
  }>;
}

const DEFAULT_TARGET_SELECTOR = '[data-tour-id="canvas"]';

export const TOUR_DEFINITIONS: TourDefinition[] = [
  {
    id: 'first-run-core',
    titleKey: 'onboarding.tours.first-run-core.title',
    descriptionKey: 'onboarding.tours.first-run-core.description',
    capabilityIds: [
      'welcome',
      'search',
      'navigation',
      'zoom',
      'settings',
      'tonight',
      'daily-knowledge',
      'session-planner',
      'fov',
      'shotlist',
      'complete',
    ],
    order: 0,
    isCore: true,
  },
  {
    id: 'module-discovery',
    titleKey: 'onboarding.tours.module-discovery.title',
    descriptionKey: 'onboarding.tours.module-discovery.description',
    capabilityIds: [
      'search',
      'tonight',
      'daily-knowledge',
      'sky-atlas',
      'quick-actions',
      'navigation-history',
      'view-bookmarks',
    ],
    order: 1,
  },
  {
    id: 'module-planning',
    titleKey: 'onboarding.tours.module-planning.title',
    descriptionKey: 'onboarding.tours.module-planning.description',
    capabilityIds: [
      'session-planner',
      'astro-events',
      'astro-calculator',
      'observation-log',
      'markers',
      'location',
    ],
    order: 2,
  },
  {
    id: 'module-imaging',
    titleKey: 'onboarding.tours.module-imaging.title',
    descriptionKey: 'onboarding.tours.module-imaging.description',
    capabilityIds: [
      'fov',
      'exposure',
      'shotlist',
      'equipment-manager',
      'plate-solver',
      'ocular',
    ],
    order: 3,
  },
  {
    id: 'module-controls',
    titleKey: 'onboarding.tours.module-controls.title',
    descriptionKey: 'onboarding.tours.module-controls.description',
    capabilityIds: [
      'zoom',
      'location',
      'satellite',
      'mount',
      'theme',
      'language',
      'night-mode',
    ],
    order: 4,
  },
  {
    id: 'module-settings-help',
    titleKey: 'onboarding.tours.module-settings-help.title',
    descriptionKey: 'onboarding.tours.module-settings-help.description',
    capabilityIds: ['settings', 'keyboard-shortcuts', 'about'],
    order: 5,
  },
  {
    id: 'module-advanced',
    titleKey: 'onboarding.tours.module-advanced.title',
    descriptionKey: 'onboarding.tours.module-advanced.description',
    capabilityIds: ['plate-solver', 'satellite', 'mount', 'ocular', 'astro-calculator'],
    order: 6,
  },
];

const CAPABILITY_REGISTRY: Record<string, Omit<CapabilityStep, 'tourId'>> = {
  welcome: {
    capabilityId: 'welcome',
    selectors: {
      desktop: DEFAULT_TARGET_SELECTOR,
      mobile: DEFAULT_TARGET_SELECTOR,
    },
    titleKey: 'onboarding.steps.welcome.title',
    descriptionKey: 'onboarding.steps.welcome.description',
    placement: 'center',
    showSkip: true,
    fallbackMode: 'center',
  },
  complete: {
    capabilityId: 'complete',
    selectors: {
      desktop: DEFAULT_TARGET_SELECTOR,
      mobile: DEFAULT_TARGET_SELECTOR,
    },
    titleKey: 'onboarding.steps.complete.title',
    descriptionKey: 'onboarding.steps.complete.description',
    placement: 'center',
    showSkip: false,
    fallbackMode: 'center',
  },
  navigation: {
    capabilityId: 'navigation',
    selectors: {
      desktop: DEFAULT_TARGET_SELECTOR,
      mobile: DEFAULT_TARGET_SELECTOR,
    },
    titleKey: 'onboarding.steps.navigation.title',
    descriptionKey: 'onboarding.steps.navigation.description',
    placement: 'center',
    fallbackMode: 'center',
  },
  search: {
    capabilityId: 'search',
    selectors: {
      desktop: '[data-tour-id="search"], [data-tour-id="search-button"]',
      mobile: '[data-tour-id="search"], [data-tour-id="search-button"]',
    },
    titleKey: 'onboarding.steps.search.title',
    descriptionKey: 'onboarding.steps.search.description',
    placement: 'bottom',
    highlightPadding: 8,
    action: 'click',
    beforeEnterAction: { type: 'closeTransientPanels' },
    fallbackMode: 'center',
  },
  tonight: {
    capabilityId: 'tonight',
    selectors: {
      desktop: '[data-tour-id="tonight"], [data-tour-id="tonight-button"]',
      mobile: '[data-tour-id="tonight"]',
    },
    titleKey: 'onboarding.steps.tonight.title',
    descriptionKey: 'onboarding.steps.tonight.description',
    placement: 'bottom',
    highlightPadding: 8,
    fallbackMode: 'center',
  },
  'daily-knowledge': {
    capabilityId: 'daily-knowledge',
    selectors: {
      desktop: '[data-tour-id="daily-knowledge"]',
      mobile: '[data-tour-id="daily-knowledge"]',
    },
    titleKey: 'onboarding.steps.daily-knowledge.title',
    descriptionKey: 'onboarding.steps.daily-knowledge.description',
    placement: 'bottom',
    highlightPadding: 8,
    beforeEnterAction: { type: 'openDailyKnowledge' },
    fallbackMode: 'center',
  },
  'sky-atlas': {
    capabilityId: 'sky-atlas',
    selectors: {
      desktop: '[data-tour-id="sky-atlas"]',
      mobile: '[data-tour-id="sky-atlas"]',
    },
    titleKey: 'onboarding.steps.sky-atlas.title',
    descriptionKey: 'onboarding.steps.sky-atlas.description',
    placement: 'bottom',
    fallbackMode: 'skip',
  },
  'quick-actions': {
    capabilityId: 'quick-actions',
    selectors: {
      desktop: '[data-tour-id="quick-actions"]',
      mobile: '[data-tour-id="quick-actions"]',
    },
    titleKey: 'onboarding.steps.quick-actions.title',
    descriptionKey: 'onboarding.steps.quick-actions.description',
    placement: 'bottom',
    fallbackMode: 'skip',
  },
  'navigation-history': {
    capabilityId: 'navigation-history',
    selectors: {
      desktop: '[data-tour-id="navigation-history"]',
      mobile: '[data-tour-id="navigation-history"]',
    },
    titleKey: 'onboarding.steps.navigation-history.title',
    descriptionKey: 'onboarding.steps.navigation-history.description',
    placement: 'bottom',
    fallbackMode: 'skip',
  },
  'view-bookmarks': {
    capabilityId: 'view-bookmarks',
    selectors: {
      desktop: '[data-tour-id="view-bookmarks"]',
      mobile: '[data-tour-id="view-bookmarks"]',
    },
    titleKey: 'onboarding.steps.view-bookmarks.title',
    descriptionKey: 'onboarding.steps.view-bookmarks.description',
    placement: 'bottom',
    fallbackMode: 'skip',
  },
  settings: {
    capabilityId: 'settings',
    selectors: {
      desktop: '[data-tour-id="settings"], [data-tour-id="settings-button"]',
      mobile: '[data-tour-id="settings"]',
    },
    titleKey: 'onboarding.steps.settings.title',
    descriptionKey: 'onboarding.steps.settings.description',
    placement: 'bottom',
    beforeEnterAction: [
      { type: 'openMobileDrawer', section: 'settings' },
      { type: 'openSettingsDrawer', tab: 'display' },
    ],
    fallbackMode: 'center',
  },
  'equipment-manager': {
    capabilityId: 'equipment-manager',
    selectors: {
      desktop: '[data-tour-id="equipment-manager"]',
      mobile: '[data-tour-id="equipment-manager"]',
    },
    titleKey: 'onboarding.steps.equipment-manager.title',
    descriptionKey: 'onboarding.steps.equipment-manager.description',
    placement: 'bottom',
    beforeEnterAction: [
      { type: 'openMobileDrawer', section: 'equipment-manager' },
      { type: 'openSettingsDrawer', tab: 'equipment' },
    ],
    fallbackMode: 'skip',
  },
  zoom: {
    capabilityId: 'zoom',
    selectors: {
      desktop: '[data-tour-id="zoom"], [data-tour-id="zoom-controls"]',
      mobile: '[data-tour-id="zoom"], [data-tour-id="zoom-controls"]',
    },
    titleKey: 'onboarding.steps.zoom.title',
    descriptionKey: 'onboarding.steps.zoom.description',
    placement: 'left',
    highlightPadding: 8,
    beforeEnterAction: { type: 'expandRightPanel' },
    fallbackMode: 'center',
  },
  fov: {
    capabilityId: 'fov',
    selectors: {
      desktop: '[data-tour-id="fov"], [data-tour-id="fov-button"]',
      mobile: '[data-tour-id="fov"], [data-tour-id="fov-button"]',
    },
    titleKey: 'onboarding.steps.fov.title',
    descriptionKey: 'onboarding.steps.fov.description',
    placement: 'left',
    highlightPadding: 8,
    beforeEnterAction: { type: 'expandRightPanel' },
    fallbackMode: 'center',
  },
  exposure: {
    capabilityId: 'exposure',
    selectors: {
      desktop: '[data-tour-id="exposure"]',
      mobile: '[data-tour-id="exposure"]',
    },
    titleKey: 'onboarding.steps.exposure.title',
    descriptionKey: 'onboarding.steps.exposure.description',
    placement: 'left',
    beforeEnterAction: { type: 'expandRightPanel' },
    fallbackMode: 'skip',
  },
  shotlist: {
    capabilityId: 'shotlist',
    selectors: {
      desktop: '[data-tour-id="shotlist"], [data-tour-id="shotlist-button"]',
      mobile: '[data-tour-id="shotlist"], [data-tour-id="shotlist-button"]',
    },
    titleKey: 'onboarding.steps.shotlist.title',
    descriptionKey: 'onboarding.steps.shotlist.description',
    placement: 'left',
    highlightPadding: 8,
    beforeEnterAction: { type: 'expandRightPanel' },
    fallbackMode: 'center',
  },
  'observation-log': {
    capabilityId: 'observation-log',
    selectors: {
      desktop: '[data-tour-id="observation-log"]',
      mobile: '[data-tour-id="observation-log"]',
    },
    titleKey: 'onboarding.steps.observation-log.title',
    descriptionKey: 'onboarding.steps.observation-log.description',
    placement: 'left',
    beforeEnterAction: { type: 'expandRightPanel' },
    fallbackMode: 'skip',
  },
  'session-planner': {
    capabilityId: 'session-planner',
    selectors: {
      desktop: '[data-tour-id="session-planner"]',
      mobile: '[data-tour-id="session-planner"]',
    },
    titleKey: 'onboarding.steps.session-planner.title',
    descriptionKey: 'onboarding.steps.session-planner.description',
    placement: 'bottom',
    beforeEnterAction: { type: 'openToolbarOverflow' },
    fallbackMode: 'center',
  },
  'astro-events': {
    capabilityId: 'astro-events',
    selectors: {
      desktop: '[data-tour-id="astro-events"]',
      mobile: '[data-tour-id="astro-events"]',
    },
    titleKey: 'onboarding.steps.astro-events.title',
    descriptionKey: 'onboarding.steps.astro-events.description',
    placement: 'bottom',
    beforeEnterAction: { type: 'openToolbarOverflow' },
    fallbackMode: 'skip',
  },
  'astro-calculator': {
    capabilityId: 'astro-calculator',
    selectors: {
      desktop: '[data-tour-id="astro-calculator"]',
      mobile: '[data-tour-id="astro-calculator"]',
    },
    titleKey: 'onboarding.steps.astro-calculator.title',
    descriptionKey: 'onboarding.steps.astro-calculator.description',
    placement: 'bottom',
    beforeEnterAction: { type: 'openToolbarOverflow' },
    fallbackMode: 'skip',
  },
  markers: {
    capabilityId: 'markers',
    selectors: {
      desktop: '[data-tour-id="markers"]',
      mobile: '[data-tour-id="markers"]',
    },
    titleKey: 'onboarding.steps.markers.title',
    descriptionKey: 'onboarding.steps.markers.description',
    placement: 'left',
    beforeEnterAction: { type: 'expandRightPanel' },
    fallbackMode: 'skip',
  },
  location: {
    capabilityId: 'location',
    selectors: {
      desktop: '[data-tour-id="location"]',
      mobile: '[data-tour-id="location"]',
    },
    titleKey: 'onboarding.steps.location.title',
    descriptionKey: 'onboarding.steps.location.description',
    placement: 'left',
    beforeEnterAction: { type: 'expandRightPanel' },
    fallbackMode: 'skip',
  },
  satellite: {
    capabilityId: 'satellite',
    selectors: {
      desktop: '[data-tour-id="satellite"]',
      mobile: '[data-tour-id="satellite"]',
    },
    titleKey: 'onboarding.steps.satellite.title',
    descriptionKey: 'onboarding.steps.satellite.description',
    placement: 'bottom',
    beforeEnterAction: [
      { type: 'openMobileDrawer', section: 'satellite' },
      { type: 'openToolbarOverflow' },
    ],
    fallbackMode: 'skip',
  },
  ocular: {
    capabilityId: 'ocular',
    selectors: {
      desktop: '[data-tour-id="ocular"]',
      mobile: '[data-tour-id="ocular"]',
    },
    titleKey: 'onboarding.steps.ocular.title',
    descriptionKey: 'onboarding.steps.ocular.description',
    placement: 'bottom',
    beforeEnterAction: [
      { type: 'openMobileDrawer', section: 'ocular' },
      { type: 'openToolbarOverflow' },
    ],
    fallbackMode: 'skip',
  },
  'plate-solver': {
    capabilityId: 'plate-solver',
    selectors: {
      desktop: '[data-tour-id="plate-solver"]',
      mobile: '[data-tour-id="plate-solver"]',
    },
    titleKey: 'onboarding.steps.plate-solver.title',
    descriptionKey: 'onboarding.steps.plate-solver.description',
    placement: 'bottom',
    beforeEnterAction: [
      { type: 'openMobileDrawer', section: 'plate-solver' },
      { type: 'openToolbarOverflow' },
    ],
    availability: (context) => context.isTauri,
    fallbackMode: 'skip',
  },
  mount: {
    capabilityId: 'mount',
    selectors: {
      desktop: '[data-tour-id="mount"]',
      mobile: '[data-tour-id="mount"]',
    },
    titleKey: 'onboarding.steps.mount.title',
    descriptionKey: 'onboarding.steps.mount.description',
    placement: 'left',
    beforeEnterAction: { type: 'expandRightPanel' },
    availability: (context) =>
      context.skyEngine === 'stellarium' && context.stelAvailable,
    fallbackMode: 'skip',
  },
  theme: {
    capabilityId: 'theme',
    selectors: {
      desktop: '[data-tour-id="theme"]',
      mobile: '[data-tour-id="theme"]',
    },
    titleKey: 'onboarding.steps.theme.title',
    descriptionKey: 'onboarding.steps.theme.description',
    placement: 'bottom',
    beforeEnterAction: [
      { type: 'openMobileDrawer', section: 'theme' },
      { type: 'openToolbarOverflow' },
    ],
    fallbackMode: 'skip',
  },
  language: {
    capabilityId: 'language',
    selectors: {
      desktop: '[data-tour-id="language"]',
      mobile: '[data-tour-id="language"]',
    },
    titleKey: 'onboarding.steps.language.title',
    descriptionKey: 'onboarding.steps.language.description',
    placement: 'bottom',
    beforeEnterAction: [
      { type: 'openMobileDrawer', section: 'language' },
      { type: 'openToolbarOverflow' },
    ],
    fallbackMode: 'skip',
  },
  'night-mode': {
    capabilityId: 'night-mode',
    selectors: {
      desktop: '[data-tour-id="night-mode"]',
      mobile: '[data-tour-id="night-mode"]',
    },
    titleKey: 'onboarding.steps.night-mode.title',
    descriptionKey: 'onboarding.steps.night-mode.description',
    placement: 'bottom',
    beforeEnterAction: [
      { type: 'openMobileDrawer', section: 'night-mode' },
      { type: 'openToolbarOverflow' },
    ],
    fallbackMode: 'skip',
  },
  'keyboard-shortcuts': {
    capabilityId: 'keyboard-shortcuts',
    selectors: {
      desktop: '[data-tour-id="keyboard-shortcuts"]',
      mobile: '[data-tour-id="keyboard-shortcuts"]',
    },
    titleKey: 'onboarding.steps.keyboard-shortcuts.title',
    descriptionKey: 'onboarding.steps.keyboard-shortcuts.description',
    placement: 'bottom',
    beforeEnterAction: { type: 'openMobileDrawer', section: 'keyboard-shortcuts' },
    fallbackMode: 'skip',
  },
  about: {
    capabilityId: 'about',
    selectors: {
      desktop: '[data-tour-id="about"]',
      mobile: '[data-tour-id="about"]',
    },
    titleKey: 'onboarding.steps.about.title',
    descriptionKey: 'onboarding.steps.about.description',
    placement: 'bottom',
    beforeEnterAction: { type: 'openMobileDrawer', section: 'about' },
    fallbackMode: 'skip',
  },
};

export function getTourDefinition(tourId: TourId): TourDefinition | undefined {
  return TOUR_DEFINITIONS.find((tour) => tour.id === tourId);
}

function getSkipReason(
  capabilityId: string,
  code: StepSkipReason['code'],
  details?: string,
): StepSkipReason {
  return {
    code,
    details,
    messageKey: `onboarding.skipReasons.${code}`,
  };
}

function pickSelector(
  selectors: CapabilityStep['selectors'],
  isMobile: boolean,
): string | null {
  if (isMobile) return selectors.mobile ?? selectors.desktop ?? null;
  return selectors.desktop ?? selectors.mobile ?? null;
}

export function resolveTourSteps(
  context: TourContext,
  tourId: TourId,
): ResolveTourStepsResult {
  const tour = getTourDefinition(tourId);
  if (!tour) {
    return { steps: [], skipped: [] };
  }

  const steps: TourStep[] = [];
  const skipped: ResolveTourStepsResult['skipped'] = [];

  for (const capabilityId of tour.capabilityIds) {
    const capability = CAPABILITY_REGISTRY[capabilityId];
    if (!capability) {
      skipped.push({
        tourId,
        capabilityId,
        reason: getSkipReason(capabilityId, 'missing-selector', 'capability-not-found'),
      });
      continue;
    }

    if (context.featureVisibility?.[capabilityId] === false) {
      skipped.push({
        tourId,
        capabilityId,
        reason: getSkipReason(capabilityId, 'hidden-by-platform'),
      });
      continue;
    }

    if (capability.availability && !capability.availability(context)) {
      skipped.push({
        tourId,
        capabilityId,
        reason: getSkipReason(capabilityId, 'unavailable'),
      });
      continue;
    }

    const selector = pickSelector(capability.selectors, context.isMobile);
    if (!selector && capability.fallbackMode !== 'center') {
      skipped.push({
        tourId,
        capabilityId,
        reason: getSkipReason(capabilityId, 'missing-selector'),
      });
      continue;
    }

    const targetSelector = selector ?? DEFAULT_TARGET_SELECTOR;
    steps.push({
      id:
        tourId === 'first-run-core'
          ? capability.capabilityId
          : `${tourId}-${capability.capabilityId}`,
      capabilityId: capability.capabilityId,
      tourId,
      targetSelector,
      selectors: capability.selectors,
      titleKey: capability.titleKey,
      descriptionKey: capability.descriptionKey,
      placement: selector ? capability.placement : 'center',
      highlightPadding: capability.highlightPadding,
      action: capability.action,
      nextOnAction: capability.nextOnAction,
      showSkip: capability.showSkip,
      spotlightRadius: capability.spotlightRadius,
      availability: capability.availability,
      beforeEnterAction: capability.beforeEnterAction,
      fallbackMode: capability.fallbackMode ?? 'center',
    });
  }

  return { steps, skipped };
}

export function getCapabilityRegistry(): Record<
  string,
  Omit<CapabilityStep, 'tourId'>
> {
  return CAPABILITY_REGISTRY;
}
