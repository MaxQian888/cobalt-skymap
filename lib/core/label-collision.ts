/**
 * Greedy, measurement-free label anti-collision for the sky-marker overlay.
 *
 * Runs on every projection update (per-frame during pans), so it must stay
 * cheap for hundreds of markers: label widths are estimated from character
 * counts (no DOM measurement) and overlap checks go through a spatial hash so
 * each label only tests its own neighborhood.
 */

export interface LabelEntry {
  id: string;
  /** Marker center in screen px. */
  x: number;
  y: number;
  text: string;
  fontSize: number;
  iconSize: number;
  /** Higher wins (active marker = Infinity, else recency). */
  priority: number;
}

interface LabelBox {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Estimated pixel width: CJK glyphs ≈ 1 em, everything else ≈ 0.6 em. */
export function estimateLabelWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const char of text) {
    width += (char.codePointAt(0) ?? 0) > 0x2e80 ? fontSize : fontSize * 0.6;
  }
  return width;
}

function labelBox(entry: LabelEntry): LabelBox {
  const height = entry.fontSize + 2;
  // Matches the render: label sits right of the icon, vertically centered.
  const left = entry.x + entry.iconSize / 2 + 4;
  return {
    id: entry.id,
    left,
    top: entry.y - height / 2,
    right: left + estimateLabelWidth(entry.text, entry.fontSize),
    bottom: entry.y + height / 2,
  };
}

const boxesOverlap = (a: LabelBox, b: LabelBox): boolean =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/**
 * Decide which labels stay visible: place by priority (desc), hide any label
 * whose estimated box overlaps an already-placed one. Deterministic for equal
 * priorities via id tiebreak.
 */
export function computeVisibleLabels(entries: LabelEntry[]): Set<string> {
  const visible = new Set<string>();
  if (entries.length === 0) return visible;

  const sorted = [...entries].sort(
    (a, b) => b.priority - a.priority || a.id.localeCompare(b.id),
  );

  const maxHeight = sorted.reduce((max, e) => Math.max(max, e.fontSize + 2), 1);
  const cellSize = Math.max(1, maxHeight * 2);
  const grid = new Map<string, LabelBox[]>();

  const cellsFor = (box: LabelBox): string[] => {
    const keys: string[] = [];
    const minCx = Math.floor(box.left / cellSize);
    const maxCx = Math.floor(box.right / cellSize);
    const minCy = Math.floor(box.top / cellSize);
    const maxCy = Math.floor(box.bottom / cellSize);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        keys.push(`${cx}:${cy}`);
      }
    }
    return keys;
  };

  for (const entry of sorted) {
    const box = labelBox(entry);
    const cells = cellsFor(box);

    let collides = false;
    for (const key of cells) {
      const bucket = grid.get(key);
      if (!bucket) continue;
      if (bucket.some((placed) => boxesOverlap(box, placed))) {
        collides = true;
        break;
      }
    }
    if (collides) continue;

    visible.add(entry.id);
    for (const key of cells) {
      const bucket = grid.get(key);
      if (bucket) bucket.push(box);
      else grid.set(key, [box]);
    }
  }

  return visible;
}
