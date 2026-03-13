/**
 * @jest-environment node
 */

import type { CalculationMeta } from '../types';
import { createCalculationMeta, withCacheState } from '../meta';

describe('createCalculationMeta', () => {
  it('fills default metadata from the backend', () => {
    const meta = createCalculationMeta('fallback', 'astronomy-engine');

    expect(meta).toMatchObject({
      backend: 'fallback',
      model: 'astronomy-engine',
      source: 'fallback',
      degraded: true,
      cache: 'miss',
      warnings: [],
    });
    expect(new Date(meta.computedAt).toISOString()).toBe(meta.computedAt);
  });

  it('honors overrides and clones warning arrays', () => {
    const warnings = ['tauri_primary_failed'];
    const computedAt = '2026-03-01T12:34:56.000Z';

    const meta = createCalculationMeta('tauri', 'sw-engine', {
      source: 'fallback',
      degraded: true,
      computedAt,
      cache: 'hit',
      warnings,
    });

    warnings.push('should_not_leak');

    expect(meta).toEqual({
      backend: 'tauri',
      model: 'sw-engine',
      source: 'fallback',
      degraded: true,
      computedAt,
      cache: 'hit',
      warnings: ['tauri_primary_failed'],
    });
  });
});

describe('withCacheState', () => {
  it('returns a new value with updated cache state and cloned warnings', () => {
    const original: { payload: string; meta: CalculationMeta } = {
      payload: 'ok',
      meta: {
        backend: 'fallback',
        model: 'test-model',
        source: 'fallback',
        degraded: true,
        computedAt: '2026-03-01T00:00:00.000Z',
        cache: 'miss',
        warnings: ['stale_context'],
      },
    };

    const updated = withCacheState(original, 'hit');
    updated.meta.warnings?.push('new-warning');

    expect(updated).not.toBe(original);
    expect(updated.meta).not.toBe(original.meta);
    expect(updated.meta.cache).toBe('hit');
    expect(updated.payload).toBe('ok');
    expect(original.meta.cache).toBe('miss');
    expect(original.meta.warnings).toEqual(['stale_context']);
    expect(updated.meta.warnings).toEqual(['stale_context', 'new-warning']);
  });
});
