import '../test-utils';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeroSection } from '../hero-section';

function appendFeaturesTarget() {
  const target = document.createElement('div');
  target.id = 'features';
  target.scrollIntoView = jest.fn();
  document.body.appendChild(target);
  return target;
}

describe('HeroSection', () => {
  it('renders the hero copy, launch link and platform badges', () => {
    render(<HeroSection />);

    expect(screen.getByText('Cobalt Skymap')).toBeInTheDocument();
    expect(screen.getByText('hero.badge')).toBeInTheDocument();
    expect(screen.getByText('hero.tagline')).toBeInTheDocument();
    expect(screen.getByText('hero.description')).toBeInTheDocument();
    expect(screen.getByText('Windows')).toBeInTheDocument();
    expect(screen.getByText('macOS')).toBeInTheDocument();
    expect(screen.getByText('Linux')).toBeInTheDocument();
    expect(screen.getByText('hero.launchButton').closest('a')).toHaveAttribute('href', '/starmap');
  });

  it('smooth-scrolls to the features section from both CTA controls', async () => {
    const user = userEvent.setup();
    const target = appendFeaturesTarget();

    render(<HeroSection />);

    await user.click(screen.getByRole('button', { name: 'hero.learnMore' }));
    await user.click(screen.getByLabelText('hero.scrollToFeatures'));

    expect(target.scrollIntoView).toHaveBeenCalledTimes(2);
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });
});
