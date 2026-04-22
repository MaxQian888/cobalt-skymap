/**
 * @jest-environment jsdom
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

jest.mock('zustand/middleware', () => ({
  persist: (config: unknown) => config,
}));

jest.mock('@/lib/storage', () => ({
  getZustandStorage: () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  }),
}));

const mockSetTheme = jest.fn();
const mockBuildSettingsProfile = jest.fn(({ domains }) => ({
  version: 6,
  exportedAt: '2026-01-01T00:00:00.000Z',
  metadata: { schemaVersion: 6, domains },
})) as jest.Mock<{ version: number; exportedAt: string; metadata: { schemaVersion: number; domains: unknown } }, [unknown]>;
const mockSaveSettingsProfileFile = jest.fn<Promise<void>, [unknown]>(() => Promise.resolve());
const mockOpenSettingsProfileFile = jest.fn<Promise<string | null>, []>();
const mockParseSettingsProfile = jest.fn<unknown, [unknown]>();
const mockApplySettingsProfileImport = jest.fn<{ success: boolean }, [unknown, unknown]>(() => ({ success: true }));
const mockRestoreLastSettingsImport = jest.fn<{ success: boolean }, [unknown]>(() => ({ success: true }));

jest.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'dark',
    setTheme: mockSetTheme,
  }),
}));

const tauriFlag = { current: false };
jest.mock('@/lib/storage/platform', () => ({
  isTauri: jest.fn(() => tauriFlag.current),
}));

jest.mock('@/lib/settings/settings-profile', () => ({
  SETTINGS_PROFILE_DOMAINS: [
    'settings',
    'theme',
    'keybindings',
    'globalShortcuts',
    'equipment',
    'location',
    'eventSources',
    'dailyKnowledge',
  ],
  buildSettingsProfile: (options: unknown) => mockBuildSettingsProfile(options),
  parseSettingsProfile: (value: unknown) => mockParseSettingsProfile(value),
}));

jest.mock('@/lib/settings/settings-profile-io', () => ({
  saveSettingsProfileFile: (profile: unknown) => mockSaveSettingsProfileFile(profile),
  openSettingsProfileFile: () => mockOpenSettingsProfileFile(),
}));

jest.mock('@/lib/settings/settings-profile-transaction', () => ({
  applySettingsProfileImport: (profile: unknown, options: unknown) => mockApplySettingsProfileImport(profile, options),
  restoreLastSettingsImport: (options: unknown) => mockRestoreLastSettingsImport(options),
}));

jest.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => open ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogAction: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

import { useSettingsImportRestoreStore } from '@/lib/stores/settings-import-restore-store';
import { SettingsExportImport } from '../settings-export-import';

describe('SettingsExportImport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tauriFlag.current = false;
    useSettingsImportRestoreStore.getState().clearRestorePoint();
    mockParseSettingsProfile.mockReturnValue({
      ok: true,
      data: {
        version: 6,
        exportedAt: '2026-01-01T00:00:00.000Z',
        metadata: { schemaVersion: 6, domains: ['theme', 'keybindings'] },
        themeMode: 'dark',
        theme: { radius: 0.8 },
        keybindings: { TOGGLE_GRID: { key: 'g' } },
      },
      importableDomains: ['theme', 'keybindings'],
      skippedDomains: [{ domain: 'equipment', reason: 'invalidDomainPayload' }],
      warnings: [{ domain: 'eventSources', code: 'secretsNotIncluded' }],
    });
  });

  it('exports only the selected domains', async () => {
    render(<SettingsExportImport />);

    fireEvent.click(screen.getByLabelText('settingsNew.exportImport.domains.settings'));
    await act(async () => {
      fireEvent.click(screen.getByText('settingsNew.exportImport.export'));
    });

    await waitFor(() => {
      expect(mockBuildSettingsProfile).toHaveBeenCalledWith(expect.objectContaining({
        domains: expect.not.arrayContaining(['settings']),
        themeMode: 'dark',
      }));
      expect(mockSaveSettingsProfileFile).toHaveBeenCalledWith(expect.objectContaining({
        metadata: expect.objectContaining({
          domains: expect.not.arrayContaining(['settings']),
        }),
      }));
    });
  });

  it('shows an import preview and applies only checked domains', async () => {
    tauriFlag.current = true;
    mockOpenSettingsProfileFile.mockResolvedValue('{"version":6}');

    render(<SettingsExportImport />);
    await act(async () => {
      fireEvent.click(screen.getByText('settingsNew.exportImport.import'));
    });

    expect(await screen.findByText('settingsNew.exportImport.previewTitle')).toBeInTheDocument();
    expect(screen.getByText('settingsNew.exportImport.skippedDomains')).toBeInTheDocument();
    expect(screen.getByText('settingsNew.exportImport.warnings')).toBeInTheDocument();

    fireEvent.click(within(screen.getByTestId('alert-dialog')).getByLabelText('settingsNew.exportImport.domains.theme'));
    await act(async () => {
      fireEvent.click(screen.getByText('settingsNew.exportImport.confirmImport'));
    });

    await waitFor(() => {
      expect(mockApplySettingsProfileImport).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: expect.any(Object) }),
        expect.objectContaining({
          domains: ['keybindings'],
          applyThemeMode: mockSetTheme,
        })
      );
    });
  });

  it('shows and triggers restore for the last import snapshot', async () => {
    useSettingsImportRestoreStore.getState().setRestorePoint({
      createdAt: '2026-01-01T00:00:00.000Z',
      domains: ['theme'],
      profile: {
        version: 6,
        exportedAt: '2026-01-01T00:00:00.000Z',
        metadata: { schemaVersion: 6, domains: ['theme'] },
        theme: { radius: 0.5 },
        themeMode: 'dark',
      },
    });

    render(<SettingsExportImport />);

    await act(async () => {
      fireEvent.click(screen.getByText('settingsNew.exportImport.restoreLastImport'));
    });
    expect(mockRestoreLastSettingsImport).toHaveBeenCalledWith({ applyThemeMode: mockSetTheme });
  });
});
