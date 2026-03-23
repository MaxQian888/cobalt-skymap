/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

const mockSetPreference = jest.fn();
const mockOpenDailyKnowledge = jest.fn();

const mockAutostartState = {
  supported: false,
  loading: false,
  actualEnabled: false,
  error: null as string | null,
};

const mockSettingsDraftModel = {
  preferences: {
    locale: 'en' as const,
    timeFormat: '24h' as const,
    dateFormat: 'iso' as const,
    coordinateFormat: 'dms' as const,
    distanceUnit: 'metric' as const,
    temperatureUnit: 'celsius' as const,
    startupView: 'last' as const,
    launchOnStartup: false,
    showSplash: true,
    autoConnectBackend: true,
    dailyKnowledgeEnabled: true,
    dailyKnowledgeAutoShow: true,
    dailyKnowledgeOnlineEnhancement: true,
    skipCloseConfirmation: false,
  },
  setPreference: mockSetPreference,
};

const mockTranslate = (key: string, values?: Record<string, unknown>) =>
  values ? `${key}:${JSON.stringify(values)}` : key;

jest.mock('next-intl', () => ({
  useTranslations: () => mockTranslate,
}));

jest.mock('@/lib/stores', () => ({
  useDailyKnowledgeStore: (selector: (state: { openDialog: typeof mockOpenDailyKnowledge }) => unknown) =>
    selector({ openDialog: mockOpenDailyKnowledge }),
  useAutostartStore: (selector: (state: typeof mockAutostartState) => unknown) => selector(mockAutostartState),
}));

jest.mock('@/lib/hooks/use-settings-draft', () => ({
  usePreferencesDraftModel: () => mockSettingsDraftModel,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <div>
      <button
        type="button"
        data-testid={`select-${value}`}
        onClick={() => onValueChange?.(value === 'en' ? 'zh' : 'en')}
      >
        select-{value}
      </button>
      {children}
    </div>
  ),
  SelectContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SelectItem: ({ children }: React.PropsWithChildren<{ value: string }>) => <div>{children}</div>,
  SelectTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SelectValue: () => <span>value</span>,
}));

jest.mock('../settings-shared', () => ({
  SettingsSection: ({
    children,
    title,
  }: React.PropsWithChildren<{ title: string }>) => (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  ),
  ToggleItem: ({
    id,
    label,
    description,
    checked,
    onCheckedChange,
  }: {
    id: string;
    label: string;
    description?: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <div data-testid={`toggle-${id}`}>
      <span>{label}</span>
      {description ? <span>{description}</span> : null}
      <button type="button" data-testid={`toggle-btn-${id}`} onClick={() => onCheckedChange(!checked)}>
        {checked ? 'on' : 'off'}
      </button>
    </div>
  ),
}));

import { GeneralSettings } from '../general-settings';

describe('GeneralSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAutostartState.supported = false;
    mockAutostartState.loading = false;
    mockAutostartState.actualEnabled = false;
    mockAutostartState.error = null;
    mockSettingsDraftModel.preferences.locale = 'en';
    mockSettingsDraftModel.preferences.launchOnStartup = false;
    mockSettingsDraftModel.preferences.dailyKnowledgeEnabled = true;
  });

  it('renders the main sections and opens daily knowledge on demand', () => {
    render(<GeneralSettings />);

    expect(screen.getByText('settingsNew.general.language')).toBeInTheDocument();
    expect(screen.getByText('settingsNew.general.startup')).toBeInTheDocument();
    expect(screen.queryByTestId('toggle-launch-on-startup')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'settingsNew.general.openDailyKnowledgeNow' }));

    expect(mockOpenDailyKnowledge).toHaveBeenCalledWith('manual');
  });

  it('updates only the draft locale when the language changes', () => {
    render(<GeneralSettings />);

    fireEvent.click(screen.getByTestId('select-en'));

    expect(mockSetPreference).toHaveBeenCalledWith('locale', 'zh');
  });

  it('renders the autostart toggle with the runtime error description when supported', () => {
    mockAutostartState.supported = true;
    mockAutostartState.error = 'permission denied';

    render(<GeneralSettings />);

    expect(screen.getByTestId('toggle-launch-on-startup')).toBeInTheDocument();
    expect(screen.getByText('settingsNew.general.launchOnStartup')).toBeInTheDocument();
    expect(
      screen.getByText('settingsNew.general.launchOnStartupError:{"message":"permission denied"}')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('toggle-btn-launch-on-startup'));

    expect(mockSetPreference).toHaveBeenCalledWith('launchOnStartup', true);
  });

  it('disables opening daily knowledge immediately when the feature is turned off', () => {
    mockSettingsDraftModel.preferences.dailyKnowledgeEnabled = false;

    render(<GeneralSettings />);

    expect(
      screen.getByRole('button', { name: 'settingsNew.general.openDailyKnowledgeNow' })
    ).toBeDisabled();
  });
});
