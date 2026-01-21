/**
 * src/editor/selection.ts
 * -----------------------------------------------------------------------------
 * Selection utilities for SpriteAnvil.
 *
 * We represent a selection as a boolean mask (Uint8Array):
 * - 0 = not selected
 * - 1 = selected
 *
 * For Magic Wand:
 * - We perform a flood fill style region grow based on color similarity
 * - Only connected pixels (4-way) are included
 */

import { RGBA, colorsMatch, getPixel } from "./pixels";

export type SelectionMask = Uint8Array;

/**
 * Create an empty selection mask.
 */
export function createEmptySelection(width: number, height: number): SelectionMask {
  return new Uint8Array(width * height);
}

/**
 * Magic Wand selection:
 * - Click at (x0, y0)
 * - Select connected pixels whose color matches the start pixel within tolerance
 */
export function magicWandSelect(
  buf: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  tolerance: number
): SelectionMask {
  const start = getPixel(buf, width, height, x0, y0);
  if (!start) return createEmptySelection(width, height);

  const sel = createEmptySelection(width, height);
  const visited = new Uint8Array(width * height);
  const stack: number[] = [y0 * width + x0];

  while (stack.length > 0) {
    const idx = stack.pop()!;
    if (visited[idx]) continue;
    visited[idx] = 1;

    const x = idx % width;
    const y = Math.floor(idx / width);

    const cur = getPixel(buf, width, height, x, y);
    if (!cur) continue;

    if (!colorsMatch(cur, start, tolerance)) continue;

    sel[idx] = 1;

    // 4-way neighbors
    if (x > 0) stack.push(idx - 1);
    if (x < width - 1) stack.push(idx + 1);
    if (y > 0) stack.push(idx - width);
    if (y < height - 1) stack.push(idx + width);
  }

  return sel;
}

/**
 * Compute an outline mask for the current selection.
 * The outline contains all selected pixels that have at least one non-selected neighbor.
 */
export function selectionOutline(width: number, height: number, sel: SelectionMask): SelectionMask {
  const out = createEmptySelection(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!sel[idx]) continue;

      const left = x > 0 ? sel[idx - 1] : 0;
      const right = x < width - 1 ? sel[idx + 1] : 0;
      const up = y > 0 ? sel[idx - width] : 0;
      const down = y < height - 1 ? sel[idx + width] : 0;

      if (!left || !right || !up || !down) out[idx] = 1;
    }
  }

  return out;
}

/**
 * Convenience helper: checks if selection has any selected pixel.
 */
export function selectionHasAny(sel: SelectionMask): boolean {
  for (let i = 0; i < sel.length; i++) {
    if (sel[i]) return true;
  }
  return false;
}

/**
 * Optional helper: clear selection
 */
export function clearSelection(sel: SelectionMask) {
  sel.fill(0);
}

/**
 * Convert a selection mask to a list of selected indices (useful later for copy/cut/paste).
 */
export function selectionToIndices(sel: SelectionMask): number[] {
  const out: number[] = [];
  for (let i = 0; i < sel.length; i++) if (sel[i]) out.push(i);
  return out;
}
