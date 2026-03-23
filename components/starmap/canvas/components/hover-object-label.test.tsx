/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { HoverObjectLabel } from './hover-object-label';

describe('HoverObjectLabel', () => {
  it('renders object name and hides wrapper from accessibility tree', () => {
    const { container } = render(<HoverObjectLabel name="M31" x={100} y={200} />);
    const wrapper = container.querySelector('div[aria-hidden]');

    expect(screen.getByText('M31')).toBeInTheDocument();
    expect(wrapper).toBeInTheDocument();
  });

  it('applies pointer offset and base non-interactive classes', () => {
    const { container } = render(<HoverObjectLabel name="Sirius" x={32} y={48} />);
    const wrapper = container.querySelector('div[aria-hidden]') as HTMLDivElement;

    expect(wrapper.style.left).toBe('44px');
    expect(wrapper.style.top).toBe('40px');
    expect(wrapper).toHaveClass('pointer-events-none', 'absolute', 'z-50');
  });

  it('merges custom className with default classes', () => {
    const { container } = render(
      <HoverObjectLabel name="Betelgeuse" x={0} y={0} className="custom-hover-label" />
    );
    const wrapper = container.querySelector('div[aria-hidden]') as HTMLDivElement;

    expect(wrapper).toHaveClass('custom-hover-label');
    expect(screen.getByText('Betelgeuse')).toBeInTheDocument();
  });
});
