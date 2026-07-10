import '../test-utils';

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Navbar } from '../navbar';
import { EXTERNAL_LINKS } from '@/lib/constants/external-links';

function appendSection(id: string, top: number, bottom: number) {
  const section = document.createElement('section');
  section.id = id;
  section.scrollIntoView = jest.fn();
  section.getBoundingClientRect = jest.fn(() => ({
    top,
    bottom,
    left: 0,
    right: 0,
    width: 0,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON: () => ({}),
  }));
  document.body.appendChild(section);
  return section;
}

describe('Navbar', () => {
  it('renders navigation items, controls and external links', () => {
    render(<Navbar />);

    expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Main navigation');
    expect(screen.getByText('Cobalt Skymap')).toBeInTheDocument();
    expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'nav.github' })[0]).toHaveAttribute('href', EXTERNAL_LINKS.repository);
    expect(screen.getAllByText('nav.launchApp').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText('Open menu')).toBeInTheDocument();
  });

  it('smooth-scrolls when clicking a hash navigation item', async () => {
    const user = userEvent.setup();
    const features = appendSection('features', 140, 540);

    render(<Navbar />);

    await user.click(screen.getAllByRole('link', { name: 'nav.features' })[0]);

    expect(features.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('updates the navbar state after scrolling into a tracked section', async () => {
    appendSection('features', 100, 600);
    appendSection('screenshots', 700, 1200);
    appendSection('tech', 1300, 1800);

    render(<Navbar />);

    const nav = screen.getByRole('navigation');
    expect(nav.className).toContain('bg-transparent');

    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 120,
      writable: true,
    });

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    await waitFor(() => {
      expect(nav.className).toContain('glass');
      expect(screen.getAllByRole('link', { name: 'nav.features' })[0]).toHaveClass('font-medium');
    });
  });

  it('opens the mobile sheet and closes it after selecting a mobile link', async () => {
    const user = userEvent.setup();
    appendSection('features', 140, 540);

    render(<Navbar />);

    await user.click(screen.getByLabelText('Open menu'));

    const sheet = screen.getByTestId('sheet-content');
    expect(sheet).toBeInTheDocument();

    await user.click(within(sheet).getByRole('link', { name: 'nav.features' }));

    expect(screen.queryByTestId('sheet-content')).not.toBeInTheDocument();
  });
});
