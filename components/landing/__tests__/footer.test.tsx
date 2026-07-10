import '../test-utils';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Footer } from '../footer';
import { EXTERNAL_LINKS } from '@/lib/constants/external-links';

describe('Footer', () => {
  it('renders brand copy, footer links and credits', () => {
    render(<Footer />);

    expect(screen.getByText('Cobalt Skymap')).toBeInTheDocument();
    expect(screen.getByText('description')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Footer links' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Community links' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'starmap' })).toHaveAttribute('href', '/starmap');
    expect(screen.getByRole('link', { name: 'github' })).toHaveAttribute('href', EXTERNAL_LINKS.repository);
    expect(screen.getByRole('link', { name: 'discussions' })).toHaveAttribute('href', EXTERNAL_LINKS.discussions);
    expect(screen.getByRole('link', { name: 'reportIssue' })).toHaveAttribute('href', EXTERNAL_LINKS.newIssueUrl());
    expect(screen.getByText('stellariumEngine')).toBeInTheDocument();
    expect(screen.getByText('gaiaData')).toBeInTheDocument();
    expect(screen.getByText('dssImages')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(String(new Date().getFullYear())))).toBeInTheDocument();
  });

  it('scrolls back to the top when the floating action is clicked', async () => {
    const user = userEvent.setup();

    render(<Footer />);

    await user.click(screen.getByLabelText('backToTop'));

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
