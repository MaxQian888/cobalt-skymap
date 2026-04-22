/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';

// Mock UI components
jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: { value: number }) => (
    <div data-testid="progress" data-value={value} role="progressbar" aria-valuenow={value}>
      {value}%
    </div>
  ),
}));

// Mock reduced motion hook — default to no reduced motion
let mockReducedMotion = false;
jest.mock('@/lib/hooks/use-prefers-reduced-motion', () => ({
  usePrefersReducedMotion: () => mockReducedMotion,
}));

import { SplashScreen } from '../splash-screen';

describe('SplashScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReducedMotion = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders with correct accessibility attributes', () => {
    render(<SplashScreen />);
    const splash = screen.getByTestId('splash-screen');
    expect(splash).toBeInTheDocument();
    expect(splash).toHaveAttribute('role', 'status');
    expect(splash).toHaveAttribute('aria-live', 'polite');
    expect(splash).toHaveAttribute('aria-busy', 'true');
  });

  it('calls onComplete after animation completes', async () => {
    const onComplete = jest.fn();
    render(<SplashScreen onComplete={onComplete} minDuration={100} />);
    
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    }, { timeout: 100 });
  });

  it('respects custom minDuration', () => {
    const onComplete = jest.fn();
    render(<SplashScreen onComplete={onComplete} minDuration={5000} />);
    
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('shows progress bar during loading phase', () => {
    render(<SplashScreen />);
    
    act(() => {
      jest.advanceTimersByTime(1600);
    });
    
    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('can be skipped by clicking', () => {
    const onComplete = jest.fn();
    render(<SplashScreen onComplete={onComplete} minDuration={5000} />);
    
    const splash = screen.getByTestId('splash-screen');
    fireEvent.click(splash);
    
    // After fade-out delay (400ms)
    act(() => {
      jest.advanceTimersByTime(500);
    });
    
    expect(onComplete).toHaveBeenCalled();
  });

  it('can be skipped by pressing Escape', () => {
    const onComplete = jest.fn();
    render(<SplashScreen onComplete={onComplete} minDuration={5000} />);
    
    fireEvent.keyDown(window, { key: 'Escape' });
    
    act(() => {
      jest.advanceTimersByTime(500);
    });
    
    expect(onComplete).toHaveBeenCalled();
  });

  it('completes faster with reduced motion preference', () => {
    mockReducedMotion = true;
    const onComplete = jest.fn();
    render(<SplashScreen onComplete={onComplete} minDuration={2500} />);
    
    // Should complete within 1000ms (capped) for reduced motion
    act(() => {
      jest.advanceTimersByTime(1100);
    });
    
    expect(onComplete).toHaveBeenCalled();
  });

  it('can be skipped by pressing Enter', () => {
    const onComplete = jest.fn();
    render(<SplashScreen onComplete={onComplete} minDuration={5000} />);

    fireEvent.keyDown(window, { key: 'Enter' });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(onComplete).toHaveBeenCalled();
  });

  it('can be skipped by pressing Space', () => {
    const onComplete = jest.fn();
    render(<SplashScreen onComplete={onComplete} minDuration={5000} />);

    fireEvent.keyDown(window, { key: ' ' });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(onComplete).toHaveBeenCalled();
  });

  it('does not skip when pressing unrelated keys', () => {
    const onComplete = jest.fn();
    render(<SplashScreen onComplete={onComplete} minDuration={5000} />);

    fireEvent.keyDown(window, { key: 'Tab' });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('triggers early completion when isReady becomes true', () => {
    const onComplete = jest.fn();

    // Mock requestAnimationFrame to invoke callback synchronously
    const rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    const { rerender } = render(
      <SplashScreen onComplete={onComplete} minDuration={5000} isReady={false} />
    );

    // Advance past init phase so phase !== 'fadeout'
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(onComplete).not.toHaveBeenCalled();

    // Set isReady to true — should trigger handleSkip
    rerender(
      <SplashScreen onComplete={onComplete} minDuration={5000} isReady={true} />
    );

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(onComplete).toHaveBeenCalled();

    rafSpy.mockRestore();
  });

  it('does not re-trigger handleSkip if already in fadeout phase', () => {
    const onComplete = jest.fn();

    const rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    const { rerender } = render(
      <SplashScreen onComplete={onComplete} minDuration={5000} isReady={false} />
    );

    // Advance past all phase-setting timers (init→stars→logo→loading)
    act(() => {
      jest.advanceTimersByTime(1500);
    });

    // Click to trigger fadeout — phase will stay 'fadeout' since no more phase timers pending
    const splash = screen.getByTestId('splash-screen');
    fireEvent.click(splash);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    const callCount = onComplete.mock.calls.length;
    expect(callCount).toBeGreaterThanOrEqual(1);

    // Now set isReady — should NOT call onComplete again since phase is 'fadeout'
    rerender(
      <SplashScreen onComplete={onComplete} minDuration={5000} isReady={true} />
    );

    act(() => {
      jest.advanceTimersByTime(100);
    });

    // onComplete should not have been called additional times by the isReady effect
    expect(onComplete.mock.calls.length).toBe(callCount);

    rafSpy.mockRestore();
  });

  it('cycles through loading messages during loading phase', () => {
    render(<SplashScreen minDuration={5000} />);

    // Advance to loading phase
    act(() => {
      jest.advanceTimersByTime(1500);
    });

    // The loading message should be one of the translation keys
    const srText = screen.getByText(
      (content) =>
        content === 'splash.loading' ||
        content === 'splash.loadingStars' ||
        content === 'splash.loadingEngine',
      { selector: '.sr-only' }
    );
    expect(srText).toBeInTheDocument();

    // Advance to cycle messages
    act(() => {
      jest.advanceTimersByTime(1200);
    });

    // Still renders a valid message
    const srText2 = screen.getByText(
      (content) =>
        content === 'splash.loading' ||
        content === 'splash.loadingStars' ||
        content === 'splash.loadingEngine',
      { selector: '.sr-only' }
    );
    expect(srText2).toBeInTheDocument();
  });

  it('updates accessibility state when entering fadeout phase', () => {
    render(<SplashScreen minDuration={5000} />);

    const splash = screen.getByTestId('splash-screen');
    fireEvent.click(splash);

    expect(splash).toHaveAttribute('aria-busy', 'false');
    expect(splash).not.toHaveAttribute('aria-label');
    expect(screen.getByText('splash.tagline', { selector: '.sr-only' })).toBeInTheDocument();
  });

  it('renders a non-blocking completion hint before dismissing', () => {
    render(
      <SplashScreen
        minDuration={5000}
        isReady={true}
        completionHint="Cache warmup will continue in the background"
      />
    );

    expect(screen.getByTestId('splash-completion-hint')).toHaveTextContent(
      'Cache warmup will continue in the background'
    );
  });
});
