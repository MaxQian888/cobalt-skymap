/**
 * Jest setup file
 * This file is executed before each test file
 */

import '@testing-library/jest-dom';
import React from 'react';
import { logManager } from '@/lib/logger';

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({
    priority: _priority,
    fill: _fill,
    unoptimized: _unoptimized,
    placeholder: _placeholder,
    blurDataURL: _blurDataURL,
    loader: _loader,
    quality: _quality,
    ...htmlProps
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    priority?: boolean;
    fill?: boolean;
    unoptimized?: boolean;
    placeholder?: string;
    blurDataURL?: string;
    loader?: unknown;
    quality?: number;
  }) => {
    return React.createElement('img', htmlProps);
  },
}));

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    };
  },
  usePathname() {
    return '/';
  },
  useSearchParams() {
    return new URLSearchParams();
  },
}));

// Mock next-intl
jest.mock('next-intl', () => {
  const mockT = (key: string) => key;
  mockT.rich = (key: string) => key;
  mockT.raw = (key: string) => key;
  mockT.markup = (key: string) => key;
  
  return {
    useTranslations: () => mockT,
    useLocale: () => 'en',
    useMessages: () => ({}),
    NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

// Mock TextEncoder/TextDecoder for Node.js test environment
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  root = null;
  rootMargin = '';
  thresholds = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
} as unknown as typeof IntersectionObserver;

// Only mock browser APIs when window is available (jsdom environment)
if (typeof window !== 'undefined') {
  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // Mock scrollTo
  window.scrollTo = jest.fn();

  // Mock localStorage
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });
}

// Keep logger-backed console transport disabled in Jest by default so
// expected error-path tests do not flood the output with transport noise.
logManager.initialize({
  enableConsole: false,
  enablePersistence: false,
});

