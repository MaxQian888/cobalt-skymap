import '../test-utils';

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScreenshotCarousel } from '../screenshot-carousel';
import {
  mockCarouselApi,
  setCarouselIndex,
  triggerCarouselEvent,
} from '../test-utils';

describe('ScreenshotCarousel', () => {
  it('renders the tablist, panels and carousel controls', () => {
    render(<ScreenshotCarousel />);

    expect(screen.getByRole('region', { name: 'title' })).toHaveAttribute('id', 'screenshots');
    expect(screen.getByRole('tablist', { name: 'Screenshot categories' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getAllByRole('tabpanel')).toHaveLength(4);
    expect(screen.getAllByRole('button', { name: 'Previous slide' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: 'Next slide' }).length).toBeGreaterThanOrEqual(1);
  });

  it('scrolls the carousel when a tab is clicked and reacts to selection events', async () => {
    const user = userEvent.setup();

    render(<ScreenshotCarousel />);

    await user.click(screen.getByRole('tab', { name: 'planning.label' }));
    expect(mockCarouselApi.scrollTo).toHaveBeenCalledWith(1);

    setCarouselIndex(2);
    act(() => {
      triggerCarouselEvent('select');
    });

    expect(screen.getByRole('tab', { name: 'fov.label' })).toHaveAttribute('aria-selected', 'true');
  });

  it('unsubscribes from carousel events on unmount', () => {
    const { unmount } = render(<ScreenshotCarousel />);

    unmount();

    expect(mockCarouselApi.off).toHaveBeenCalledWith('select', expect.any(Function));
    expect(mockCarouselApi.off).toHaveBeenCalledWith('reInit', expect.any(Function));
  });
});
