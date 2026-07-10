import React from 'react';

type MockTheme = 'dark' | 'light';
type CarouselEvent = 'select' | 'reInit';
type ClickableElementProps = {
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
};
type MockCarouselApi = {
  scrollTo: jest.Mock;
  selectedScrollSnap: jest.Mock<number, []>;
  on: jest.Mock<MockCarouselApi, [CarouselEvent, () => void]>;
  off: jest.Mock<MockCarouselApi, [CarouselEvent, () => void]>;
};

let mockResolvedTheme: MockTheme = 'dark';
let mockIsInView = true;
let mockRafTimestamp = 0;

const mockCarouselHandlers: Partial<Record<CarouselEvent, () => void>> = {};

export const mockUseStarField = jest.fn();

export const mockCarouselApi: MockCarouselApi = {
  scrollTo: jest.fn(),
  selectedScrollSnap: jest.fn(() => 0),
  on: jest.fn(),
  off: jest.fn(),
};

mockCarouselApi.on.mockImplementation((event: CarouselEvent, handler: () => void) => {
    mockCarouselHandlers[event] = handler;
    return mockCarouselApi;
  });

mockCarouselApi.off.mockImplementation((event: CarouselEvent, handler: () => void) => {
    if (mockCarouselHandlers[event] === handler) {
      delete mockCarouselHandlers[event];
    }
    return mockCarouselApi;
  });

export function setMockTheme(theme: MockTheme) {
  mockResolvedTheme = theme;
}

export function setMockInView(value: boolean) {
  mockIsInView = value;
}

export function setCarouselIndex(index: number) {
  mockCarouselApi.selectedScrollSnap.mockReturnValue(index);
}

export function triggerCarouselEvent(event: CarouselEvent) {
  mockCarouselHandlers[event]?.();
}

function resetCarouselHandlers() {
  delete mockCarouselHandlers.select;
  delete mockCarouselHandlers.reInit;
}

jest.mock('next-themes', () => ({
  useTheme: () => ({
    resolvedTheme: mockResolvedTheme,
    setTheme: jest.fn(),
  }),
}));

jest.mock('@/lib/hooks/use-star-field', () => ({
  useStarField: (...args: unknown[]) => mockUseStarField(...args),
}));

jest.mock('@/lib/hooks/use-in-view', () => ({
  useInView: () => ({
    ref: { current: null },
    isInView: mockIsInView,
  }),
}));

jest.mock('@/components/common/language-switcher', () => ({
  LanguageSwitcher: () => React.createElement('div', { 'data-testid': 'language-switcher' }),
}));

jest.mock('@/components/common/theme-toggle', () => ({
  ThemeToggle: () => React.createElement('div', { 'data-testid': 'theme-toggle' }),
}));

jest.mock('@/components/icons', () => {
  const MockIcon = ({ className }: { className?: string }) =>
    React.createElement('svg', { className, 'data-testid': 'mock-icon' });

  return {
    CobaltSkymapLogo: MockIcon,
    GitHubIcon: MockIcon,
    WindowsIcon: MockIcon,
    AppleIcon: MockIcon,
    LinuxIcon: MockIcon,
    StellariumIcon: MockIcon,
    techBrandIconMap: new Proxy(
      {},
      {
        get: () => MockIcon,
      }
    ),
  };
});

jest.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  Tooltip: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  TooltipContent: () => null,
}));

jest.mock('@/components/ui/carousel', () => ({
  Carousel: ({
    children,
    className,
    setApi,
  }: {
    children: React.ReactNode;
    className?: string;
    setApi?: (api: typeof mockCarouselApi) => void;
  }) => {
    React.useEffect(() => {
      setApi?.(mockCarouselApi);
    }, [setApi]);

    return React.createElement('div', { className, 'data-testid': 'carousel' }, children);
  },
  CarouselContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'carousel-content' }, children),
  CarouselItem: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', props, children),
  CarouselPrevious: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    React.createElement('button', { ...props, 'aria-label': 'Previous slide', type: 'button' }),
  CarouselNext: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    React.createElement('button', { ...props, 'aria-label': 'Next slide', type: 'button' }),
}));

jest.mock('@/components/ui/sheet', () => {
  const SheetContext = React.createContext<{
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  }>({ open: false });

  const chainHandlers = (
    original?: (event: React.MouseEvent<HTMLElement>) => void,
    next?: (event: React.MouseEvent<HTMLElement>) => void
  ) => {
    return (event: React.MouseEvent<HTMLElement>) => {
      original?.(event);
      next?.(event);
    };
  };

  return {
    Sheet: ({
      children,
      open,
      onOpenChange,
    }: {
      children: React.ReactNode;
      open: boolean;
      onOpenChange?: (open: boolean) => void;
    }) =>
      React.createElement(
        SheetContext.Provider,
        { value: { open, onOpenChange } },
        children
      ),
    SheetTrigger: ({
      children,
      asChild,
    }: {
      children: React.ReactElement<ClickableElementProps>;
      asChild?: boolean;
    }) => {
      const context = React.useContext(SheetContext);

      if (asChild && React.isValidElement<ClickableElementProps>(children)) {
        return React.cloneElement(children, {
          onClick: chainHandlers(
            children.props.onClick,
            () => context.onOpenChange?.(true)
          ),
        });
      }

      return React.createElement(
        'button',
        { onClick: () => context.onOpenChange?.(true), type: 'button' },
        children
      );
    },
    SheetContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
      const context = React.useContext(SheetContext);
      if (!context.open) return null;

      return React.createElement('div', { ...props, 'data-testid': 'sheet-content' }, children);
    },
    SheetHeader: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', null, children),
    SheetTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) =>
      React.createElement('h2', props, children),
  };
});

beforeEach(() => {
  mockResolvedTheme = 'dark';
  mockIsInView = true;
  mockRafTimestamp = 0;

  mockUseStarField.mockClear();

  mockCarouselApi.scrollTo.mockClear();
  mockCarouselApi.selectedScrollSnap.mockReset();
  mockCarouselApi.selectedScrollSnap.mockReturnValue(0);
  mockCarouselApi.on.mockClear();
  mockCarouselApi.off.mockClear();
  resetCarouselHandlers();

  window.scrollTo = jest.fn();
  global.requestAnimationFrame = jest.fn((callback: FrameRequestCallback) => {
    mockRafTimestamp += 1500;
    callback(mockRafTimestamp);
    return mockRafTimestamp;
  }) as unknown as typeof requestAnimationFrame;
  global.cancelAnimationFrame = jest.fn();
});

afterEach(() => {
  document.body.innerHTML = '';
});
