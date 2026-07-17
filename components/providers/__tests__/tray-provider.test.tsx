/**
 * @jest-environment jsdom
 */

import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { TrayProvider } from '../tray-provider';
import { useSettingsStore } from '@/lib/stores';
import { setCloseToTray, updateTrayMenu } from '@/lib/tauri/app-control-api';

jest.mock('next-intl', () => ({
  // Namespaced translator so assertions can see which keys were requested.
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

jest.mock('@/lib/tauri/app-control-api', () => ({
  updateTrayMenu: jest.fn(async () => undefined),
  setCloseToTray: jest.fn(async () => undefined),
}));

const mockUpdateTrayMenu = updateTrayMenu as jest.Mock;
const mockSetCloseToTray = setCloseToTray as jest.Mock;

describe('TrayProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      useSettingsStore.setState({
        preferences: {
          ...useSettingsStore.getState().preferences,
          closeToTray: false,
        },
      });
    });
  });

  it('pushes the localized tray menu labels on mount', async () => {
    render(<TrayProvider />);

    await waitFor(() => {
      expect(mockUpdateTrayMenu).toHaveBeenCalledWith({
        show: 'tray.show',
        starmap: 'tray.starmap',
        search: 'tray.search',
        settings: 'tray.settings',
        sessionPlanner: 'tray.sessionPlanner',
        plateSolver: 'tray.plateSolver',
        quit: 'tray.quit',
      });
    });
  });

  it('mirrors the closeToTray preference into the backend', async () => {
    render(<TrayProvider />);

    await waitFor(() => {
      expect(mockSetCloseToTray).toHaveBeenCalledWith(false);
    });

    act(() => {
      useSettingsStore.getState().setPreference('closeToTray', true);
    });

    await waitFor(() => {
      expect(mockSetCloseToTray).toHaveBeenLastCalledWith(true);
    });
  });
});
