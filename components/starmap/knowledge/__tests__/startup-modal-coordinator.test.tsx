/**
 * @jest-environment jsdom
 */

import React from 'react';
import { act, render } from '@testing-library/react';
import { StartupModalCoordinator } from '../startup-modal-coordinator';

const mockOpenDialog = jest.fn();
const mockShouldAutoShowToday = jest.fn(() => false);

function getHydrationCallbacks(): Array<() => void> {
  const scope = globalThis as typeof globalThis & {
    __dailyKnowledgeHydrationCallbacks?: Array<() => void>;
  };
  if (!scope.__dailyKnowledgeHydrationCallbacks) {
    scope.__dailyKnowledgeHydrationCallbacks = [];
  }
  return scope.__dailyKnowledgeHydrationCallbacks;
}

function getMockPersistApi() {
  const scope = globalThis as typeof globalThis & {
    __dailyKnowledgePersistApi?: {
      hasHydrated: jest.Mock<boolean, []>;
      onFinishHydration: jest.Mock<() => void, [() => void]>;
    };
  };

  if (!scope.__dailyKnowledgePersistApi) {
    scope.__dailyKnowledgePersistApi = {
      hasHydrated: jest.fn(() => true),
      onFinishHydration: jest.fn((callback: () => void) => {
        const hydrationCallbacks = getHydrationCallbacks();
        hydrationCallbacks.push(callback);
        return () => {
          const index = hydrationCallbacks.indexOf(callback);
          if (index >= 0) {
            hydrationCallbacks.splice(index, 1);
          }
        };
      }),
    };
  }

  return scope.__dailyKnowledgePersistApi;
}

function setMockPersistApi(persistApi: unknown): void {
  const mockedStores = jest.requireMock('@/lib/stores') as {
    useDailyKnowledgeStore: { persist?: unknown };
  };
  mockedStores.useDailyKnowledgeStore.persist = persistApi;
}

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const mockDailyKnowledgeState = {
  shouldAutoShowToday: mockShouldAutoShowToday,
  openDialog: mockOpenDialog,
  open: false,
  currentItem: null,
  items: [],
  loading: false,
  error: null,
  favorites: [],
  history: [],
  filters: { query: '', category: 'all', source: 'all', favoritesOnly: false },
  closeDialog: jest.fn(),
  loadDaily: jest.fn(),
  next: jest.fn(),
  prev: jest.fn(),
  random: jest.fn(),
  toggleFavorite: jest.fn(),
  setFilters: jest.fn(),
  setCurrentItemById: jest.fn(),
  markDontShowToday: jest.fn(),
  goToRelatedObject: jest.fn(),
  recordHistory: jest.fn(),
};

const mockBridgeState = { openDailyKnowledgeRequestId: 0 };

const mockOnboardingState = {
  hasCompletedOnboarding: true,
  showOnNextVisit: false,
  isSetupOpen: false,
  isTourActive: false,
  phase: 'idle' as string,
};

const mockSettingsState = { preferences: { dailyKnowledgeEnabled: false } };

jest.mock('@/lib/stores', () => ({
  useDailyKnowledgeStore: Object.assign(
    jest.fn((selector: (s: typeof mockDailyKnowledgeState) => unknown) =>
      selector(mockDailyKnowledgeState),
    ),
    { persist: getMockPersistApi() }
  ),
  useOnboardingBridgeStore: jest.fn((selector: (s: typeof mockBridgeState) => unknown) =>
    selector(mockBridgeState),
  ),
  useOnboardingStore: jest.fn((selector: (s: typeof mockOnboardingState) => unknown) =>
    selector(mockOnboardingState),
  ),
  useSettingsStore: jest.fn((selector: (s: typeof mockSettingsState) => unknown) =>
    selector(mockSettingsState),
  ),
}));

jest.mock('../daily-knowledge-dialog', () => ({
  DailyKnowledgeDialog: () => <div data-testid="daily-knowledge-dialog" />,
}));

describe('StartupModalCoordinator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getHydrationCallbacks().length = 0;
    mockBridgeState.openDailyKnowledgeRequestId = 0;
    mockOnboardingState.hasCompletedOnboarding = true;
    mockOnboardingState.showOnNextVisit = false;
    mockOnboardingState.isSetupOpen = false;
    mockOnboardingState.isTourActive = false;
    mockOnboardingState.phase = 'idle';
    mockSettingsState.preferences.dailyKnowledgeEnabled = false;
    mockShouldAutoShowToday.mockReturnValue(false);
    const persistApi = getMockPersistApi();
    persistApi.hasHydrated.mockReturnValue(true);
    setMockPersistApi(persistApi);
  });

  it('renders DailyKnowledgeDialog', () => {
    const { getByTestId } = render(<StartupModalCoordinator showSplash={false} />);
    expect(getByTestId('daily-knowledge-dialog')).toBeInTheDocument();
  });

  it('does not auto-open dialog when splash is showing', () => {
    mockSettingsState.preferences.dailyKnowledgeEnabled = true;
    mockShouldAutoShowToday.mockReturnValue(true);
    render(<StartupModalCoordinator showSplash={true} />);
    expect(mockOpenDialog).not.toHaveBeenCalled();
  });

  it('does not auto-open dialog when dailyKnowledge is disabled', () => {
    render(<StartupModalCoordinator showSplash={false} />);
    expect(mockOpenDialog).not.toHaveBeenCalled();
  });

  it('auto-opens dialog when all conditions are met', () => {
    mockSettingsState.preferences.dailyKnowledgeEnabled = true;
    mockShouldAutoShowToday.mockReturnValue(true);
    render(<StartupModalCoordinator showSplash={false} />);
    expect(mockOpenDialog).toHaveBeenCalledWith('auto');
  });

  it('triggers openDialog via bridge store request', () => {
    mockBridgeState.openDailyKnowledgeRequestId = 1;
    render(<StartupModalCoordinator showSplash={false} />);
    expect(mockOpenDialog).toHaveBeenCalledWith('manual');
  });

  it('does not auto-open when onboarding setup is open', () => {
    mockSettingsState.preferences.dailyKnowledgeEnabled = true;
    mockShouldAutoShowToday.mockReturnValue(true);
    mockOnboardingState.isSetupOpen = true;
    render(<StartupModalCoordinator showSplash={false} />);
    expect(mockOpenDialog).not.toHaveBeenCalledWith('auto');
  });

  it('does not auto-open when tour is active', () => {
    mockSettingsState.preferences.dailyKnowledgeEnabled = true;
    mockShouldAutoShowToday.mockReturnValue(true);
    mockOnboardingState.isTourActive = true;
    render(<StartupModalCoordinator showSplash={false} />);
    expect(mockOpenDialog).not.toHaveBeenCalledWith('auto');
  });

  it('does not auto-open when phase is not idle', () => {
    mockSettingsState.preferences.dailyKnowledgeEnabled = true;
    mockShouldAutoShowToday.mockReturnValue(true);
    mockOnboardingState.phase = 'setup';
    render(<StartupModalCoordinator showSplash={false} />);
    expect(mockOpenDialog).not.toHaveBeenCalledWith('auto');
  });

  it('does not auto-open when onboarding not completed and showOnNextVisit is true', () => {
    mockSettingsState.preferences.dailyKnowledgeEnabled = true;
    mockShouldAutoShowToday.mockReturnValue(true);
    mockOnboardingState.hasCompletedOnboarding = false;
    mockOnboardingState.showOnNextVisit = true;
    render(<StartupModalCoordinator showSplash={false} />);
    expect(mockOpenDialog).not.toHaveBeenCalledWith('auto');
  });

  it('does not auto-open when shouldAutoShowToday returns false', () => {
    mockSettingsState.preferences.dailyKnowledgeEnabled = true;
    mockShouldAutoShowToday.mockReturnValue(false);
    render(<StartupModalCoordinator showSplash={false} />);
    expect(mockOpenDialog).not.toHaveBeenCalledWith('auto');
  });

  it('waits for daily knowledge hydration before auto-opening', async () => {
    mockSettingsState.preferences.dailyKnowledgeEnabled = true;
    mockShouldAutoShowToday.mockReturnValue(true);
    getMockPersistApi().hasHydrated.mockReturnValue(false);

    render(<StartupModalCoordinator showSplash={false} />);

    expect(mockOpenDialog).not.toHaveBeenCalledWith('auto');

    await act(async () => {
      getHydrationCallbacks().forEach((callback) => callback());
    });

    expect(mockOpenDialog).toHaveBeenCalledWith('auto');
  });

  it('skips hydration listener when persist api shape is unavailable', () => {
    mockSettingsState.preferences.dailyKnowledgeEnabled = true;
    mockShouldAutoShowToday.mockReturnValue(true);
    setMockPersistApi({});

    render(<StartupModalCoordinator showSplash={false} />);

    expect(mockOpenDialog).toHaveBeenCalledWith('auto');
  });

  it('queues microtask hydration update when hasHydrated flips during setup', async () => {
    mockSettingsState.preferences.dailyKnowledgeEnabled = true;
    mockShouldAutoShowToday.mockReturnValue(true);
    const persistApi = getMockPersistApi();
    persistApi.hasHydrated.mockReset();
    persistApi.hasHydrated.mockImplementationOnce(() => false).mockImplementation(() => true);
    setMockPersistApi(persistApi);

    render(<StartupModalCoordinator showSplash={false} />);
    expect(mockOpenDialog).not.toHaveBeenCalledWith('auto');

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockOpenDialog).toHaveBeenCalledWith('auto');
  });
});
