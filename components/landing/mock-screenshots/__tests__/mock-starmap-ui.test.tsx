import '../../test-utils';

import { render, screen } from '@testing-library/react';
import { MockStarmapUI } from '../mock-starmap-ui';

describe('MockStarmapUI', () => {
  it('renders a shared carousel for multiple celestial object info cards', () => {
    render(<MockStarmapUI />);

    expect(screen.getByText('M31 - Andromeda Galaxy')).toBeInTheDocument();
    expect(screen.getByText('M42 - Orion Nebula')).toBeInTheDocument();
    expect(screen.getByText('Mars - Planet')).toBeInTheDocument();
    expect(screen.getByText('RA: 00h 42m 44s')).toBeInTheDocument();
    expect(screen.getByText('Mag: 3.4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous slide' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next slide' })).toBeInTheDocument();
  });
});
