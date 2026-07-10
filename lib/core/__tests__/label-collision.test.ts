import { computeVisibleLabels, estimateLabelWidth, type LabelEntry } from '../label-collision';

const entry = (overrides: Partial<LabelEntry> & { id: string }): LabelEntry => ({
  x: 0,
  y: 0,
  text: 'Marker',
  fontSize: 12,
  iconSize: 20,
  priority: 0,
  ...overrides,
});

describe('estimateLabelWidth', () => {
  it('weights CJK glyphs as a full em and latin as 0.6em', () => {
    expect(estimateLabelWidth('AB', 10)).toBeCloseTo(12);
    expect(estimateLabelWidth('星标', 10)).toBeCloseTo(20);
    expect(estimateLabelWidth('A星', 10)).toBeCloseTo(16);
  });
});

describe('computeVisibleLabels', () => {
  it('keeps all labels when they do not overlap', () => {
    const visible = computeVisibleLabels([
      entry({ id: 'a', x: 0, y: 0 }),
      entry({ id: 'b', x: 300, y: 0 }),
      entry({ id: 'c', x: 0, y: 300 }),
    ]);
    expect(visible).toEqual(new Set(['a', 'b', 'c']));
  });

  it('hides the lower-priority label of an overlapping pair', () => {
    const visible = computeVisibleLabels([
      entry({ id: 'low', x: 100, y: 100, priority: 1 }),
      entry({ id: 'high', x: 105, y: 102, priority: 10 }),
    ]);
    expect(visible.has('high')).toBe(true);
    expect(visible.has('low')).toBe(false);
  });

  it('always places the active (Infinity-priority) label first', () => {
    const visible = computeVisibleLabels([
      entry({ id: 'recent', x: 100, y: 100, priority: 999999 }),
      entry({ id: 'active', x: 103, y: 100, priority: Number.POSITIVE_INFINITY }),
    ]);
    expect(visible.has('active')).toBe(true);
    expect(visible.has('recent')).toBe(false);
  });

  it('is deterministic for equal priorities (id tiebreak)', () => {
    const entries = [
      entry({ id: 'b', x: 100, y: 100, priority: 5 }),
      entry({ id: 'a', x: 104, y: 100, priority: 5 }),
    ];
    const first = computeVisibleLabels(entries);
    const second = computeVisibleLabels([...entries].reverse());
    expect(first).toEqual(second);
    expect(first.has('a')).toBe(true);
  });

  it('handles vertical stacking — separated rows both show', () => {
    const visible = computeVisibleLabels([
      entry({ id: 'top', x: 100, y: 100 }),
      entry({ id: 'bottom', x: 100, y: 100 + 20 }),
    ]);
    expect(visible.size).toBe(2);
  });

  it('stays fast and bounded for 500 clustered markers', () => {
    const entries = Array.from({ length: 500 }, (_, i) =>
      entry({
        id: `m${i}`,
        x: (i % 25) * 12,
        y: Math.floor(i / 25) * 6,
        priority: i,
      }),
    );

    const start = performance.now();
    const visible = computeVisibleLabels(entries);
    const elapsed = performance.now() - start;

    expect(visible.size).toBeGreaterThan(0);
    expect(visible.size).toBeLessThan(500);
    // Generous bound for CI machines — the real budget is ~0.5ms.
    expect(elapsed).toBeLessThan(50);
  });

  it('returns an empty set for empty input', () => {
    expect(computeVisibleLabels([]).size).toBe(0);
  });
});
