/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeIconToggle, ThemeToggle } from '../theme-toggle';
import { NextIntlClientProvider } from 'next-intl';
import { TooltipProvider } from '@/components/ui/tooltip';

// Mock next-themes
const mockSetTheme = jest.fn();
let mockTheme = 'light';
let mockResolvedTheme = 'light';
jest.mock('next-themes', () => ({
  useTheme: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
    resolvedTheme: mockResolvedTheme,
  }),
}));

const messages = {
  theme: {
    switchToLight: 'Switch to Light',
    switchToDark: 'Switch to Dark',
    switchTheme: 'Theme',
    system: 'System',
  },
  common: {
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
  },
};

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TooltipProvider>
        {ui}
      </TooltipProvider>
    </NextIntlClientProvider>
  );
};

describe('ThemeToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTheme = 'light';
    mockResolvedTheme = 'light';
  });

  it('renders dropdown variant by default', () => {
    renderWithProviders(<ThemeToggle />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders icon variant', () => {
    renderWithProviders(<ThemeToggle variant="icon" />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('renders ThemeIconToggle as an icon button wrapper', () => {
    renderWithProviders(<ThemeIconToggle className="custom-toggle" />);

    expect(screen.getByRole('button')).toHaveClass('custom-toggle');
  });

  it('toggles theme when icon variant is clicked', () => {
    mockResolvedTheme = 'light';
    renderWithProviders(<ThemeToggle variant="icon" />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(mockSetTheme).toHaveBeenCalledWith('dark');

    mockSetTheme.mockClear();
    mockResolvedTheme = 'dark';
    renderWithProviders(<ThemeToggle variant="icon" />);
    fireEvent.click(screen.getAllByRole('button')[1]); // Second render
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('shows dropdown menu items when clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle variant="dropdown" />);
    const trigger = screen.getByRole('button');
    await user.click(trigger);

    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(3);
    const texts = items.map(i => i.textContent);
    expect(texts).toContain('common.lightMode');
    expect(texts).toContain('common.darkMode');
    expect(texts).toContain('theme.system');
  });

  it('calls setTheme when dropdown items are clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle variant="dropdown" />);
    await user.click(screen.getByRole('button'));

    const items = screen.getAllByRole('menuitem');
    await user.click(items[0]); // Light mode
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('calls the dark and system menu actions and reflects the active state', async () => {
    const user = userEvent.setup();
    mockTheme = 'system';

    const { rerender } = renderWithProviders(<ThemeToggle variant="dropdown" />);
    await user.click(screen.getByRole('button'));

    let items = screen.getAllByRole('menuitem');
    expect(items[2]).toHaveClass('bg-accent');

    await user.click(items[1]);
    expect(mockSetTheme).toHaveBeenCalledWith('dark');

    await user.click(screen.getByRole('button'));
    items = screen.getAllByRole('menuitem');
    await user.click(items[2]);
    expect(mockSetTheme).toHaveBeenCalledWith('system');

    mockTheme = 'dark';
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <TooltipProvider>
          <ThemeToggle variant="dropdown" />
        </TooltipProvider>
      </NextIntlClientProvider>
    );

    await user.click(screen.getByRole('button'));
    items = screen.getAllByRole('menuitem');
    expect(items[1]).toHaveClass('bg-accent');
  });

  it('dropdown shows exactly 3 theme options', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle variant="dropdown" />);
    
    await user.click(screen.getByRole('button'));
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(3);
  });
});
