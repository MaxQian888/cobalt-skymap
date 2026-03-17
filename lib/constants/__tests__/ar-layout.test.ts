import { getARSurfaceLayoutTokens } from '@/lib/constants/ar-layout';

describe('ar-layout', () => {
  it('returns bounded floating-card tokens for assistant surfaces', () => {
    const tokens = getARSurfaceLayoutTokens('assistant', 'floating-card');

    expect(tokens.align).toBe('center');
    expect(tokens.maxWidthRem).toBe(40);
    expect(tokens.topOffsetRem).toBe(0.5);
    expect(tokens.stickyActions).toBe(false);
  });

  it('returns compact-strip tokens for recovery surfaces', () => {
    const tokens = getARSurfaceLayoutTokens('recovery', 'compact-strip');

    expect(tokens.align).toBe('stretch');
    expect(tokens.maxWidthRem).toBe(28);
    expect(tokens.topOffsetRem).toBe(0.5);
    expect(tokens.stickyActions).toBe(true);
  });

  it('returns tighter camera-control tokens for compact-strip mode', () => {
    const tokens = getARSurfaceLayoutTokens('camera-controls', 'compact-strip');

    expect(tokens.sideInsetRem).toBe(0.5);
    expect(tokens.topOffsetRem).toBe(3);
    expect(tokens.gapRem).toBeCloseTo(0.375, 3);
  });
});
