import { edgeIndicatorPosition, selectIndicators } from '../offscreen-indicator';

describe('edgeIndicatorPosition', () => {
  const W = 800;
  const H = 600;
  const INSET = 28;

  it('places cardinal directions on the inset rectangle', () => {
    // Right
    expect(edgeIndicatorPosition(1, 0, W, H, INSET)).toEqual({
      x: W - INSET,
      y: H / 2,
      angleDeg: 90,
    });
    // Left
    expect(edgeIndicatorPosition(-1, 0, W, H, INSET)).toEqual({
      x: INSET,
      y: H / 2,
      angleDeg: 270,
    });
    // Down (screen y grows downward)
    expect(edgeIndicatorPosition(0, 1, W, H, INSET)).toEqual({
      x: W / 2,
      y: H - INSET,
      angleDeg: 180,
    });
    // Up
    expect(edgeIndicatorPosition(0, -1, W, H, INSET)).toEqual({
      x: W / 2,
      y: INSET,
      angleDeg: 0,
    });
  });

  it('clamps diagonal directions to the nearer inset edge', () => {
    const placement = edgeIndicatorPosition(1, 1, W, H, INSET)!;
    // 45° diagonal hits the horizontal band first (height < width).
    expect(placement.y).toBeCloseTo(H - INSET, 6);
    expect(placement.x).toBeLessThanOrEqual(W - INSET + 1e-6);
    expect(placement.angleDeg).toBeCloseTo(135, 6);
  });

  it('stays within the inset rectangle for arbitrary directions', () => {
    for (let angle = 0; angle < 360; angle += 15) {
      const rad = (angle * Math.PI) / 180;
      const placement = edgeIndicatorPosition(Math.cos(rad), Math.sin(rad), W, H, INSET);
      expect(placement).not.toBeNull();
      expect(placement!.x).toBeGreaterThanOrEqual(INSET - 1e-6);
      expect(placement!.x).toBeLessThanOrEqual(W - INSET + 1e-6);
      expect(placement!.y).toBeGreaterThanOrEqual(INSET - 1e-6);
      expect(placement!.y).toBeLessThanOrEqual(H - INSET + 1e-6);
    }
  });

  it('normalizes non-unit direction vectors', () => {
    expect(edgeIndicatorPosition(10, 0, W, H, INSET)).toEqual(
      edgeIndicatorPosition(1, 0, W, H, INSET),
    );
  });

  it('returns null for a degenerate direction', () => {
    expect(edgeIndicatorPosition(0, 0, W, H, INSET)).toBeNull();
    expect(edgeIndicatorPosition(Number.NaN, 1, W, H, INSET)).toBeNull();
  });
});

describe('selectIndicators', () => {
  const candidate = (id: number, angDist: number) => ({
    item: { id },
    dir: { dx: 1, dy: 0, angDist },
  });

  it('keeps the angularly-nearest candidates up to the cap', () => {
    const candidates = Array.from({ length: 12 }, (_, i) => candidate(i, 12 - i));
    const selected = selectIndicators(candidates, 8);
    expect(selected).toHaveLength(8);
    // Nearest first
    expect(selected[0].item.id).toBe(11);
    expect(selected.map((c) => c.dir.angDist)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('returns all candidates when below the cap', () => {
    expect(selectIndicators([candidate(1, 0.5)], 8)).toHaveLength(1);
  });

  it('does not mutate the input', () => {
    const input = [candidate(1, 2), candidate(2, 1)];
    selectIndicators(input, 8);
    expect(input[0].item.id).toBe(1);
  });
});
