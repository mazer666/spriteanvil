/**
 * src/editor/tools/smudge.ts
 * -----------------------------------------------------------------------------
 * ## SMUDGE TOOL (Noob Guide)
 * 
 * Smudging is like "Rubbing wet paint with your finger".
 * 
 * ## JARGON GLOSSARY
 * 1. BLEED: How much color "flows" from the starting point as you smudge.
 * 2. STRENGTH: The mix ratio. 0.1 is subtle, 0.9 is heavy smearing.
 * 3. LERP: Mixing the "Finger Color" with the "Canvas Color".
 * 
 * ## VISUAL FLOW (Mermaid)
 * ```mermaid
 * graph LR
 *   A[Mouse Move: A to B] --> B[Sample Color at A]
 *   B --> C[Mix with color at B]
 *   C --> D[Write blended color to B]
 *   D --> E[Move Cursor to B]
 *   E --> A
 * ```
 */
import { getPixel, setPixel } from "../pixels";
import { getPatternMask, PatternId } from "./patterns";

type RGBA = { r: number; g: number; b: number; a: number };

/**
 * WHAT: Mathematically mixes two colors based on a "Strength" percentage.
 * WHY: This is the secret sauce of the smudge tool. It makes the "Finger" pick up paint and smear it.
 * HOW: Color = (Dest * (1 - strength)) + (Src * strength).
 */
function blendColor(src: RGBA, dest: RGBA, strength: number): RGBA {
  const inv = 1 - strength;
  return {
    r: Math.round(dest.r * inv + src.r * strength),
    g: Math.round(dest.g * inv + src.g * strength),
    b: Math.round(dest.b * inv + src.b * strength),
    a: Math.round(dest.a * inv + src.a * strength),
  };
}

/**
 * WHAT: Performs a single "Rub" of the smudge tool at a specific coordinate.
 * WHY: To move color from one pixel to its neighbor.
 * HOW: It grabs the color from the "Old" position (Where your finger was) and mixes it into the "New" position (Where your finger is now).
 * USE: Call this as the user moves the mouse.
 */
function smudgeStamp(
  buf: Uint8ClampedArray,
  width: number,
  height: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  brushSize: number,
  strength: number,
  selection?: Uint8Array,
  texture: PatternId | "none" = "none"
): boolean {
  const radius = Math.max(0, Math.floor(brushSize / 2));
  const r2 = radius * radius;
  let changed = false;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const sx = fromX + dx;
      const sy = fromY + dy;
      const tx = toX + dx;
      const ty = toY + dy;
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
      if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
      if (selection && !selection[ty * width + tx]) continue;
      if (texture !== "none" && !getPatternMask(texture, tx, ty)) continue;
      const src = getPixel(buf, width, height, sx, sy);
      const dest = getPixel(buf, width, height, tx, ty);
      if (!src || !dest) continue;
      const blended = blendColor(src, dest, strength);
      if (setPixel(buf, width, height, tx, ty, blended)) changed = true;
    }
  }

  return changed;
}

/**
 * WHAT: Smoothes out the smudge "Flick" by connecting gaps between points.
 * WHY: Just like the brush tool, if you move the mouse fast, we need to fill in the path.
 * HOW: It uses the Bresenham line algorithm to find every step and calls `smudgeStamp` for each one.
 * 
 * 🛠️ NOOB CHALLENGE: Can you change `blendColor` so it only smudges color if the source alpha (Transparency) is greater than 0?
 */
export function smudgeLine(
  buf: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  brushSize: number,
  strength: number,
  selection?: Uint8Array,
  texture: PatternId | "none" = "none"
): boolean {
  let changedAny = false;

  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);

  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;

  let err = dx - dy;

  let prevX = x0;
  let prevY = y0;

  while (true) {
    if (smudgeStamp(buf, width, height, prevX, prevY, x0, y0, brushSize, strength, selection, texture)) {
      changedAny = true;
    }
    if (x0 === x1 && y0 === y1) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
    prevX = x0 - sx;
    prevY = y0 - sy;
  }

  return changedAny;
}
