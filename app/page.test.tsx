/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock next/dynamic to render children synchronously
jest.mock('next/dynamic', () => {
  return (_loader: () => Promise<{ default: React.ComponentType }>) => {
    // For tests, we just return a placeholder div with the component name
    const DynamicComponent = (props: Record<string, unknown>) => {
      return React.createElement('div', { 'data-testid': 'dynamic-component', ...props });
    };
    DynamicComponent.displayName = 'DynamicComponent';
    return DynamicComponent;
  };
});

// Mock landing components
jest.mock('@/components/landing', () => ({
  Navbar: () => React.createElement('nav', { 'data-testid': 'navbar' }, 'Navbar'),
  HeroSection: () => React.createElement('section', { 'data-testid': 'hero-section' }, 'Hero'),
}));

import Home from './page';

describe('Home Page', () => {
  it('renders main element', () => {
    render(React.createElement(Home));
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('renders Navbar and HeroSection', () => {
    render(React.createElement(Home));
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
  });

  it('renders JSON-LD structured data', () => {
    const { container } = render(React.createElement(Home));
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
    const data = JSON.parse(script!.textContent || '');
    expect(data['@type']).toBe('SoftwareApplication');
    expect(data.name).toBe('Cobalt Skymap');
    expect(data.applicationCategory).toBe('EducationalApplication');
  });

  it('renders dynamic below-the-fold components', () => {
    render(React.createElement(Home));
    const dynamicComponents = screen.getAllByTestId('dynamic-component');
    expect(dynamicComponents.length).toBe(8);
  });
});
