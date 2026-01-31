/**
 * src/editor/tools/brush.ts
 * -----------------------------------------------------------------------------
 * ## BRUSHES AND PENS (Noob Guide)
 * 
 * Drawing with a digital brush is like "Stamping".
 * 
 * ## JARGON GLOSSARY
 * 1. DDA: Digital Differential Analyzer. A simple way to find which pixels 
 *    sit on a straight line.
 * 2. STAMP: A single circle of pixels drawn at a specific coordinate.
 * 3. SPACING: How often we place a "Stamp" as you move your mouse.
 * 
 * ## VISUAL FLOW (Mermaid)
 * ```mermaid
 * graph TD
 *   A[Start Point] --> B[Calculate Bresenham Steps]
 *   B --> C{Step Taken?}
 *   C -- Yes --> D[Draw Stamp at current coord]
 *   D --> E{Reached End?}
 *   E -- No --> C
 *   E -- Yes --> F[Finished Line]
 * ```
 */
import { setPixel } from "../pixels";
import { getSymmetryTransforms } from "../symmetry";
import { UiSettings } from "../../types";
import { getPatternMask, PatternId } from "./patterns";

export type BrushTexture = "none" | PatternId;

type RGBA = { r: number; g: number; b: number; a: number };

/**
 * WHAT: Draws a single "Stamp" (a circle of pixels) at a specific coordinate.
 * WHY: This is the basic unit of drawing. When you move the mouse, we draw many of these stamps in a row to make a line.
 * HOW: It loops through a square box of pixels, checks if they fall inside the circle radius (using A² + B² = C²), and then calls `setPixel`.
 * USE: Call this if you want to place a single dot or a custom shape at a specific point.
 * RATIONALE: Using a loop with a radius check is much more flexible than drawing a hard-coded square of pixels.
 * 
 * ASCII VISUAL (Radius 1):
 * [ ][X][ ]
 * [X][X][X]
 * [ ][X][ ]
 */
export function drawBrushStamp(
  buf: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  rgba: RGBA,
  brushSize: number,
  selection?: Uint8Array,
  texture: BrushTexture = "none"
): boolean {
  const radius = Math.max(0, Math.floor(brushSize / 2));
  const r2 = radius * radius;
  let changedAny = false;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const px = x + dx;
      const py = y + dy;
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      if (selection && !selection[py * width + px]) continue;
      if (texture !== "none" && !getPatternMask(texture, px, py)) continue;
      if (setPixel(buf, width, height, px, py, rgba)) changedAny = true;
    }
  }

  return changedAny;
}

/**
 * WHAT: Connects two points with a continuous stroke of "Stamps".
 * WHY: When you move the mouse fast, the browser only sends points occasionally. We "fill the gaps" to make a smooth line.
 * HOW: It uses the Bresenham line algorithm to find every coordinate between Start and End, and draws a `brushStamp` at each one.
 * USE: This is the main function called by the engine during a "Mouse Drag" event.
 * RATIONALE: Reusing the Bresenham math ensures our lines are perfectly straight and consistent with the basic `drawLine`.
 * 
 * 🛠️ NOOB CHALLENGE: Try changing `drawBrushStamp` to `setPixel` here. What happens to the "thickness" of your brush?
 */
export function drawBrushLine(
  buf: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgba: RGBA,
  brushSize: number,
  selection?: Uint8Array,
  texture: BrushTexture = "none"
): boolean {
  let changedAny = false;

  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);

  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;

  let err = dx - dy;

  while (true) {
    if (drawBrushStamp(buf, width, height, x0, y0, rgba, brushSize, selection, texture)) changedAny = true;
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
  }

  return changedAny;
}

/**
 * WHAT: Draws a line while automatically mirroring or rotating it.
 * WHY: Used for "Symmetry Mode" (e.g., drawing one side of a face while the app draws the other).
 * HOW: It calculates "Mirrored" versions of your mouse coordinates and draws multiple `drawBrushLine` calls at once.
 * USE: Call this instead of `drawBrushLine` if symmetry is enabled in the UI settings.
 * 
 * ⚠️ WATCH OUT: Symmetry can draw many lines at once, which uses more CPU. Keep the `brushSize` small for best performance!
 */
export function drawBrushLineWithSymmetry(
  buf: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgba: RGBA,
  symmetryMode: UiSettings["symmetryMode"],
  symmetryAngle: UiSettings["symmetryAngle"],
  symmetrySegments: UiSettings["symmetrySegments"],
  brushSize: number,
  selection?: Uint8Array,
  texture: BrushTexture = "none"
): boolean {
  if (symmetryMode === "none") {
    return drawBrushLine(buf, width, height, x0, y0, x1, y1, rgba, brushSize, selection, texture);
  }

  let changedAny = false;
  const transforms = getSymmetryTransforms(width, height, symmetryMode, symmetryAngle, symmetrySegments);
  const seenLines = new Set<string>();

  transforms.forEach((transform) => {
    const start = transform(x0, y0);
    const end = transform(x1, y1);
    const key = `${start.x},${start.y},${end.x},${end.y}`;
    if (seenLines.has(key)) return;
    seenLines.add(key);

    const did = drawBrushLine(
      buf,
      width,
      height,
      start.x,
      start.y,
      end.x,
      end.y,
      rgba,
      brushSize,
      selection,
      texture
    );
    if (did) changedAny = true;
  });

  return changedAny;
}
