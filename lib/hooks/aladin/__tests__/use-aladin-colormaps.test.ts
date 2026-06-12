/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useStellariumStore } from '@/lib/stores/stellarium-store';
import { useAladinColormaps } from '../use-aladin-colormaps';

describe('useAladinColormaps', () => {
  beforeEach(() => {
    useStellariumStore.setState({ aladin: null });
  });

  it('returns a non-empty fallback list when no aladin instance is available', () => {
    const { result } = renderHook(() => useAladinColormaps());
    expect(result.current).toContain('native');
    expect(result.current).toContain('viridis');
  });

  it('uses the live engine list via getListOfColormaps (native first)', async () => {
    useStellariumStore.setState({
      aladin: { getListOfColormaps: () => ['viridis', 'native', 'magma'] } as never,
    });
    const { result } = renderHook(() => useAladinColormaps());
    await waitFor(() => expect(result.current[0]).toBe('native'));
    expect(result.current).toEqual(['native', 'viridis', 'magma']);
  });

  it('falls back to getAvailableListOfColormaps when getListOfColormaps is absent', async () => {
    useStellariumStore.setState({
      aladin: { getAvailableListOfColormaps: () => ['magma', 'native'] } as never,
    });
    const { result } = renderHook(() => useAladinColormaps());
    await waitFor(() => expect(result.current).toEqual(['native', 'magma']));
  });
});
