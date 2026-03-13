import { getScrollAnimationProps } from '../scroll-animation';

describe('scroll-animation', () => {
  it('returns hidden styles when the section is not in view', () => {
    expect(getScrollAnimationProps(false, 2)).toEqual({
      className: 'opacity-0',
      style: undefined,
    });
  });

  it('returns fade-in classes and the default staggered delay when in view', () => {
    expect(getScrollAnimationProps(true, 3)).toEqual({
      className: 'opacity-0 animate-fade-in',
      style: {
        animationDelay: '0.30000000000000004s',
        animationFillMode: 'forwards',
      },
    });
  });

  it('supports a custom base delay', () => {
    expect(getScrollAnimationProps(true, 4, 0.15)).toEqual({
      className: 'opacity-0 animate-fade-in',
      style: {
        animationDelay: '0.6s',
        animationFillMode: 'forwards',
      },
    });
  });
});
