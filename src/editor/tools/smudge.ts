/**
 * src/editor/tools/smudge.ts
 * -----------------------------------------------------------------------------
 * ## SMUDGE TOOL (Noob Guide)
 * 
 * Smudging is like "Rubbing wet paint with your finger".
 * 
 * 1. THE MIX: When you drag from Pixel A to Pixel B, we take some of the 
 *    color from A and mix it into B.
 * 2. THE STRENGTH: The more "Strength" you have, the more of the original 
 *    color is carried along as you drag.
 * 3. THE EFFECT: It's great for blurring edges or creating smooth 
 *    painterly transitions without using a gradient tool.
 */
import { getPixel, setPixel } from "../pixels";
import { getPatternMask, PatternId } from "./patterns";

type RGBA = { r: number; g: number; b: number; a: number };

function blendColor(src: RGBA, dest: RGBA, strength: number): RGBA {
  const inv = 1 - strength;
  return {
    r: Math.round(dest.r * inv + src.r * strength),
    g: Math.round(dest.g * inv + src.g * strength),
    b: Math.round(dest.b * inv + src.b * strength),
    a: Math.round(dest.a * inv + src.a * strength),
  };
}

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
