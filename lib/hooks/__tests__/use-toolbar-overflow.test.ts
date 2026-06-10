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
