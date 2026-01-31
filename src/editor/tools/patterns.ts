/**
 * src/editor/tools/patterns.ts
 * -----------------------------------------------------------------------------
 * ## PATTERNS & NOISE (Noob Guide)
 * 
 * Patterns let you fill areas with "Repeating Textures" instead of flat color.
 * 
 * 1. CHECKER: Alternates pixels like a chessboard. Classic for transparency.
 * 2. DITHER: Uses a "Bayer Matrix" (a fixed grid of numbers) to decide 
 *    which pixels to color. It creates a smooth-looking fade with only 
 *    two colors.
 * 3. NOISE: Uses "Random Math" (Hashing) to scatter pixels randomly, 
 *    making things look grainy or like sand.
 */
import { RGBA } from "../pixels";

export type PatternId = "checker" | "dither" | "noise";

export type PatternFill = {
  pattern: PatternId;
  primary: RGBA;
  secondary: RGBA;
  seed?: number;
};

const bayer8x8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

function noiseHash(x: number, y: number, seed = 0) {
  const n = x * 374761393 + y * 668265263 + seed * 1446647;
  const hashed = (n ^ (n >> 13)) * 1274126177;
  return ((hashed ^ (hashed >> 16)) >>> 0) / 0xffffffff;
}

export function getPatternMask(pattern: PatternId, x: number, y: number, seed = 0): boolean {
  const px = ((x % 8) + 8) % 8;
  const py = ((y % 8) + 8) % 8;
  switch (pattern) {
    case "checker":
      return (px + py) % 2 === 0;
    case "dither":
      return bayer8x8[py][px] < 32;
    case "noise":
      return noiseHash(px, py, seed) > 0.5;
    default:
      return true;
  }
}

export function getPatternColor(patternFill: PatternFill, x: number, y: number): RGBA {
  const { pattern, primary, secondary, seed = 0 } = patternFill;
  return getPatternMask(pattern, x, y, seed) ? primary : secondary;
}
