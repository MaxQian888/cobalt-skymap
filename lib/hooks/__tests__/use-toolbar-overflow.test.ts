import { computeToolbarOverflow, type ToolbarOverflowGroup } from '../use-toolbar-overflow';

// Fold order (lower priority folds first): Preferences -> Display -> Instruments -> Planning.
const GROUPS: ToolbarOverflowGroup[] = [
  { id: 'planning', priority: 4 },
  { id: 'instruments', priority: 3 },
  { id: 'display', priority: 2 },
  { id: 'preferences', priority: 1 },
];
const WIDTHS = new Map<string, number>([
  ['planning', 120],
  ['instruments', 120],
  ['display', 150],
  ['preferences', 90],
]);
const BASE = 600; // non-foldable content (left cluster + clock + View/Help + Window + gaps)
const MORE = 44;

describe('computeToolbarOverflow', () => {
  it('folds nothing when everything fits', () => {
    expect(computeToolbarOverflow(2000, WIDTHS, GROUPS, BASE, MORE)).toEqual(new Set());
  });

  it('folds the lowest-priority group first', () => {
    // all inline = 600 + 480 = 1080 > 1040 => overflow; +MORE = 1124;
    // fold preferences(-90) => 1034 <= 1040 => stop.
    expect(computeToolbarOverflow(1040, WIDTHS, GROUPS, BASE, MORE)).toEqual(new Set(['preferences']));
  });

  it('folds in priority order until it fits', () => {
    // available 900: 1124 -> -90(pref)=1034 -> -150(display)=884 <= 900 => stop.
    expect(computeToolbarOverflow(900, WIDTHS, GROUPS, BASE, MORE)).toEqual(
      new Set(['preferences', 'display']),
    );
  });

  it('can fold every foldable group when very narrow', () => {
    expect(computeToolbarOverflow(650, WIDTHS, GROUPS, BASE, MORE)).toEqual(
      new Set(['preferences', 'display', 'instruments', 'planning']),
    );
  });

  it('is exactly-fits stable (no fold when total === available)', () => {
    expect(computeToolbarOverflow(1080, WIDTHS, GROUPS, BASE, MORE)).toEqual(new Set());
  });

  it('treats unknown group widths as 0 (defensive, never throws)', () => {
    const partial = new Map<string, number>([['preferences', 90]]);
    // total = 600 + 90 = 690 <= 700 => nothing folds even though others are unmeasured
    expect(computeToolbarOverflow(700, partial, GROUPS, BASE, MORE)).toEqual(new Set());
  });
});

// Full six-group set as wired in top-toolbar.tsx: the right cluster (priority
// 1-4) folds before the left cluster (Navigation 5, Discovery 6), so the
// headline "what to observe" entries stay inline longest. This mirrors the
// Tauri-only residual-overflow path the browser e2e can't reach (no desktop
// shell below the 900px mobile threshold).
const SIX_GROUPS: ToolbarOverflowGroup[] = [
  { id: 'preferences', priority: 1 },
  { id: 'display', priority: 2 },
  { id: 'instruments', priority: 3 },
  { id: 'planning', priority: 4 },
  { id: 'navigation', priority: 5 },
  { id: 'discovery', priority: 6 },
];
const SIX_WIDTHS = new Map<string, number>([
  ['preferences', 90],
  ['display', 150],
  ['instruments', 120],
  ['planning', 120],
  ['navigation', 130],
  ['discovery', 140],
]);
// Non-foldable base: search + clock + Config + View/Help + Window + gaps.
const SIX_BASE = 500;

describe('computeToolbarOverflow — left cluster folds after the right cluster', () => {
  it('folds the whole right cluster before touching the left cluster', () => {
    // all inline = 500 + 750 = 1250. Pick a width where folding the four right
    // groups (-480 -> 770, +MORE) fits, so the left cluster stays inline.
    const overflow = computeToolbarOverflow(820, SIX_WIDTHS, SIX_GROUPS, SIX_BASE, MORE);
    expect(overflow).toEqual(new Set(['preferences', 'display', 'instruments', 'planning']));
    expect(overflow.has('navigation')).toBe(false);
    expect(overflow.has('discovery')).toBe(false);
  });

  it('folds Navigation before Discovery once the right cluster is exhausted', () => {
    // Tighter: after the right four fold (770 + MORE = 814), still > 700, so the
    // left cluster folds in priority order — Navigation(5) first, Discovery(6) last.
    const overflow = computeToolbarOverflow(700, SIX_WIDTHS, SIX_GROUPS, SIX_BASE, MORE);
    expect(overflow.has('navigation')).toBe(true);
    expect(overflow.has('discovery')).toBe(false);
  });

  it('folds every group, Discovery last, under extreme pressure', () => {
    const overflow = computeToolbarOverflow(400, SIX_WIDTHS, SIX_GROUPS, SIX_BASE, MORE);
    expect(overflow).toEqual(
      new Set(['preferences', 'display', 'instruments', 'planning', 'navigation', 'discovery']),
    );
  });
});
