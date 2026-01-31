/**
 * src/editor/pixels.ts
 * -----------------------------------------------------------------------------
 * ## PIXEL BUFFERS (Noob Guide)
 * 
 * We use a "Uint8ClampedArray". Think of this as a giant list of numbers from 0 to 255.
 * Every pixel on the screen is made of 4 numbers in this list:
 * [Red, Green, Blue, Alpha (transparency)]
 * 
 * ## JARGON GLOSSARY
 * 1. BUFFER: A chunk of memory (the list of numbers) used to store image data.
 * 2. RGBA: Red, Green, Blue, and Alpha. The 4 channels for any color.
 * 3. INDEX: The position in our list. Since we have 4 numbers per pixel, 
 *    the index is always (y * width + x) * 4.
 * 4. CLAMPED: If you try to save 300, it "clamps" it to 255. 
 *    If you try -50, it clamps to 0. It stays within the 0-255 range.
 * 
 * ## TECHNICAL SPECS
 * - Format: Uint8ClampedArray [R,G,B,A, R,G,B,A, ...]
 * - Matches ImageData's internal format to avoid endianness issues.
 * - Optimized for direct browser canvas manipulation.
 * 
 * ## VAR TRACE
 * ...
 */

export type RGBA = { r: number; g: number; b: number; a: number };

/**
 * WHAT: Creates a new, blank pixel buffer (a chunk of memory).
 * WHY: We need a fresh "canvas" whenever we start a new project or create a new layer.
 * HOW: It calculates W * H * 4 (Bytes) and loops through every 4-byte chunk to set the initial color.
 * USE: Call this when initializing the app or adding a layer.
 * RATIONALE: We use Uint8ClampedArray because it's the fastest way for the browser to handle image data.
 */
export function createBuffer(width: number, height: number, fill: RGBA): Uint8ClampedArray {
  // ORIGIN: CanvasSpec. USAGE: Sets array length (W * H * 4). PURPOSE: Allocates memory for the image.
  const buf = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    buf[o + 0] = fill.r;
    buf[o + 1] = fill.g;
    buf[o + 2] = fill.b;
    buf[o + 3] = fill.a;
  }
  return buf;
}

/**
 * WHAT: Makes an exact copy of an existing pixel buffer.
 * WHY: When we "Undo," we need to keep the old version of the image before we change it.
 * HOW: It simply creates a new array and copies every number from the old one into it.
 * USE: Call this before starting a new drawing stroke to save the current state.
 * RATIONALE: Direct copying is memory-intensive but necessary for instant Undo/Redo.
 */
export function cloneBuffer(buf: Uint8ClampedArray): Uint8ClampedArray {
  return new Uint8ClampedArray(buf);
}

/**
 * WHAT: Converts a CSS Hex string (#FF0000) into 3 numbers (255, 0, 0).
 * WHY: Humans like Hex, but our pixel buffer only understands single numbers (Bytes).
 * HOW: It slices the string and uses "parseInt" with "base 16" to convert letters to numbers.
 * USE: Use this when the user picks a color from the UI Palette.
 * RATIONALE: Regex validation ensures we don't crash if the user somehow provides a broken color string.
 * 
 * 🛠️ NOOB CHALLENGE: Try extending this to support 3-digit hex codes (like #F00).
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Accepts "#RRGGBB" only (we keep it simple and predictable).
  const h = hex.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(h)) return { r: 255, g: 255, b: 255 };
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return { r, g, b };
}

/**
 * WHAT: Grabs the RGBA color of specified coordinates (X, Y).
 * WHY: Needed for things like the "Eye Dropper" tool or checking a pixel's color before filling.
 * HOW: It uses the index formula (Y * Width + X) * 4 to find the exact 4 numbers in the big list.
 * USE: Call this whenever you need to know "What color is here?".
 * 
 * ⚠️ WATCH OUT: If X or Y are outside the canvas, this returns `null`. Always check for null!
 */
export function getPixel(
  buf: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number
): RGBA | null {
  if (x < 0 || y < 0 || x >= width || y >= height) return null;
  // Index math: jump to 'y' rows down, add 'x' pixels across, then multiply by 4 (RGBA)
  const i = (y * width + x) * 4;
  return {
    r: buf[i + 0],
    g: buf[i + 1],
    b: buf[i + 2],
    a: buf[i + 3]
  };
}

/**
 * WHAT: Changes the color of a single pixel at (X, Y).
 * WHY: This is the fundamental building block of EVERY drawing tool.
 * HOW: It finds the index and overwrites the 4 numbers (Red, Green, Blue, Alpha).
 * USE: Use this in brushes, fills, and shape tools.
 * RATIONALE: Returns a `boolean`. This tells the history system "Hey, something actually changed!" so we don't save useless Undo steps.
 * 
 * @returns true if at least one pixel changed.
 */
export function setPixel(
  buf: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  rgba: RGBA
): boolean {
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  // ORIGIN: Pointer events -> (x, y). USAGE: Multiplied to find start byte. PURPOSE: Bridges 2D space to 1D data.
  const i = (y * width + x) * 4;

  // Only mark changed if pixel actually differs (helps avoid false history commits).
  const changed =
    buf[i + 0] !== rgba.r || buf[i + 1] !== rgba.g || buf[i + 2] !== rgba.b || buf[i + 3] !== rgba.a;

  buf[i + 0] = rgba.r;
  buf[i + 1] = rgba.g;
  buf[i + 2] = rgba.b;
  buf[i + 3] = rgba.a;

  return changed;
}

/**
 * WHAT: Draws a straight line between two points.
 * WHY: Necessary for drawing lines with a Pen or creating the borders of shapes.
 * HOW: Uses the Bresenham algorithm (integer math) to decide which pixels to light up.
 * USE: Call this in the Pen/Brush tool as the mouse moves.
 * RATIONALE: We avoid floating-point math (decimals) because it's slow and makes blurry lines.
 * 
 * ASCII VISUAL:
 * [ ][ ][X]  <-- The 'error' value tells us
 * [ ][X][ ]      when to move up a row.
 * [X][ ][ ]
 */
export function drawLine(
  buf: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgba: RGBA
): boolean {
  let changedAny = false;

  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);

  // sx/sy tell us which direction we are moving (+1 or -1)
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;

  // The 'error' determines when we need to move in the 'minor' axis
  let err = dx - dy;

  while (true) {
    if (setPixel(buf, width, height, x0, y0, rgba)) changedAny = true;
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
 * WHAT: Changes the size of the whole image (Nearest Neighbor).
 * WHY: When you resize your project, we need to map the old pixels to the new space.
 * HOW: "Nearest Neighbor" logic. If the new image is 2x bigger, we just repeat every pixel twice.
 * USE: Call this in the Project Settings when changing dimensions.
 * RATIONALE: We use Nearest Neighbor instead of Bilinear because it keeps pixel art "crisp" and "crunchy" instead of blurry.
 * 
 * 🛠️ NOOB CHALLENGE: Look at `src/utils/math.ts`. Could you rewrite this to use a matrix transform?
 */
export function resizeBuffer(
  src: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  destW: number,
  destH: number
): Uint8ClampedArray {
  const dest = new Uint8ClampedArray(destW * destH * 4);
  const ratioX = srcW / destW;
  const ratioY = srcH / destH;

  for (let y = 0; y < destH; y++) {
    const sy = Math.floor(y * ratioY);
    for (let x = 0; x < destW; x++) {
      const sx = Math.floor(x * ratioX);
      const srcIdx = (sy * srcW + sx) * 4;
      const destIdx = (y * destW + x) * 4;
      dest[destIdx + 0] = src[srcIdx + 0];
      dest[destIdx + 1] = src[srcIdx + 1];
      dest[destIdx + 2] = src[srcIdx + 2];
      dest[destIdx + 3] = src[srcIdx + 3];
    }
  }
  return dest;
}
