/**
 * Type definitions for unified onboarding system
 * Combines setup wizard + feature tour into a single flow
 */

import type { StellariumSettings } from '@/lib/core/types';

// ============================================================================
// Onboarding Phase
// ============================================================================

export type OnboardingPhase = 'idle' | 'setup' | 'tour';

export type OnboardingEntrySurface =
  | 'welcome'
  | 'setup'
  | 'tour-hub'
  | 'resume-tour'
  | 'idle';

export interface OnboardingResumeCheckpoint {
  phase: OnboardingPhase;
  setupStep: SetupWizardStep | null;
  activeTourId: TourId | null;
  currentStepIndex: number;
  updatedAt: string | null;
}

export type TourId =
  | 'first-run-core'
  | 'module-discovery'
  | 'module-planning'
  | 'module-imaging'
  | 'module-controls'
  | 'module-settings-help'
  | 'module-advanced';

export type StepFallbackMode = 'center' | 'skip';

export type TourBeforeEnterActionType =
  | 'expandRightPanel'
  | 'openSettingsDrawer'
  | 'openSearch'
  | 'openMobileDrawer'
  | 'openDailyKnowledge'
  | 'openToolbarOverflow'
  | 'closeTransientPanels';

export interface TourBeforeEnterAction {
  type: TourBeforeEnterActionType;
  tab?: string;
  section?: string;
}

export type StepSkipCode =
  | 'unavailable'
  | 'missing-selector'
  | 'hidden-by-platform'
  | 'unsupported-engine';

export interface StepSkipReason {
  code: StepSkipCode;
  messageKey: string;
  details?: string;
}

export interface TourContext {
  isMobile: boolean;
  isTauri: boolean;
  skyEngine: string;
  stelAvailable: boolean;
  featureVisibility?: Record<string, boolean>;
}

export interface TourSelectors {
  desktop?: string;
  mobile?: string;
}

// ============================================================================
// Setup Wizard Step (used in setup phase)
// ============================================================================

export type SetupWizardStep =
  | 'welcome'
  | 'location'
  | 'equipment'
  | 'preferences'
  | 'complete';

export interface SetupWizardSetupData {
  locationConfigured: boolean;
  equipmentConfigured: boolean;
  preferencesConfigured: boolean;
}

export interface SetupWizardMetadata {
  location: 'configured' | 'skipped';
  equipment: 'configured' | 'skipped';
  preferences: 'configured' | 'skipped';
  skipReasons: Partial<Record<'location' | 'equipment' | 'preferences', string>>;
  completedAt: string | null;
}

// ============================================================================
// TourStep (used in tour phase)
// ============================================================================

export interface TourStep {
  id: string;
  targetSelector: string;
  titleKey: string;
  descriptionKey: string;
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  highlightPadding?: number;
  action?: 'click' | 'hover' | 'none';
  nextOnAction?: boolean;
  showSkip?: boolean;
  spotlightRadius?: number;
  tourId?: TourId;
  capabilityId?: string;
  selectors?: TourSelectors;
  availability?: (context: TourContext) => boolean;
  beforeEnterAction?: TourBeforeEnterAction | TourBeforeEnterAction[];
  fallbackMode?: StepFallbackMode;
  skipReason?: StepSkipReason;
}

export interface CapabilityStep {
  capabilityId: string;
  tourId: TourId;
  selectors: TourSelectors;
  titleKey: string;
  descriptionKey: string;
  placement: TourStep['placement'];
  highlightPadding?: number;
  action?: TourStep['action'];
  nextOnAction?: boolean;
  showSkip?: boolean;
  spotlightRadius?: number;
  availability?: (context: TourContext) => boolean;
  beforeEnterAction?: TourBeforeEnterAction | TourBeforeEnterAction[];
  fallbackMode?: StepFallbackMode;
}

export interface TourDefinition {
  id: TourId;
  titleKey: string;
  descriptionKey: string;
  capabilityIds: string[];
  order: number;
  isCore?: boolean;
}

export interface TourProgress {
  currentStepIndex: number;
  totalSteps: number;
  completedStepIds: string[];
  completed: boolean;
  updatedAt: string | null;
}

// ============================================================================
// OnboardingTour
// ============================================================================

export interface OnboardingTourProps {
  onTourStart?: () => void;
  onTourEnd?: () => void;
  onStepChange?: (stepIndex: number) => void;
  onTourCompleted?: (tourId: TourId) => void;
}

// ============================================================================
// TourSpotlight
// ============================================================================

export interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface TourSpotlightProps {
  targetSelector: string;
  padding?: number;
  isActive: boolean;
  spotlightRadius?: number;
  className?: string;
}

// ============================================================================
// TourTooltip
// ============================================================================

export interface TooltipPosition {
  top: number;
  left: number;
  arrowPosition: 'top' | 'bottom' | 'left' | 'right' | 'none';
  arrowOffset: number;
}

export interface TourTooltipProps {
  step: TourStep;
  currentIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onClose: () => void;
  isFirst: boolean;
  isLast: boolean;
}

// ============================================================================
// WelcomeDialog
// ============================================================================

export interface WelcomeDialogProps {
  onStartTour?: () => void;
  onSkip?: () => void;
}

// ============================================================================
// WelcomeFeature
// ============================================================================

export interface WelcomeFeature {
  icon: React.ElementType;
  key: string;
}

// ============================================================================
// ObserverLocation (used by location-step)
// ============================================================================

export interface ObserverLocation {
  latitude: number;
  longitude: number;
  altitude: number;
}

// ============================================================================
// PreferenceOption (used by preferences-step)
// ============================================================================

export interface PreferenceOption {
  id: string;
  icon: React.ElementType;
  titleKey: string;
  descKey: string;
  settingKey: keyof StellariumSettings;
}

// ============================================================================
// Unified Onboarding Props
// ============================================================================

export interface UnifiedOnboardingProps {
  onComplete?: () => void;
  initialTourId?: TourId;
  onTourCompleted?: (tourId: TourId) => void;
}

export interface OnboardingRestartButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}
