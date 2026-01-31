/**
 * src/editor/pixels.ts
 * -----------------------------------------------------------------------------
 * ## PIXEL BUFFERS (Noob Guide)
 * 
 * We use a "Uint8ClampedArray". Think of this as a giant list of numbers from 0 to 255.
 * Every pixel on the screen is made of 4 numbers in this list:
 * [Red, Green, Blue, Alpha (transparency)]
 *
 * ## THE MATH
 * index = (y * width + x) * 4
 *
 * ## VAR TRACE
 * - `buf`: (Origin: CanvasState) The current raw byte array of pixels.
 * - `width/height`: (Origin: CanvasSpec) The fixed dimensions of our image.
 * - `rgba`: (Origin: PalettePanel) The color we want to paint with.
 */

export type RGBA = { r: number; g: number; b: number; a: number };

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

export function cloneBuffer(buf: Uint8ClampedArray): Uint8ClampedArray {
  return new Uint8ClampedArray(buf);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Accepts "#RRGGBB" only (we keep it simple and predictable).
  const h = hex.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(h)) return { r: 255, g: 255, b: 255 };
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return { r, g, b };
}

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
 * Draw a line using Bresenham (pixel-perfect, no blur).
 * 
 * --- NOOB GUIDE: WHY BRESENHAM? ---
 * In pixel art, we don't want "blurry" lines. If you use standard math,
 * you get half-pixels which looks bad. Bresenham is a classic "integer only"
 * algorithm that decides exactly which pixel to color to make the straightest
 * line possible with zero blur.
 * 
 * It's like walking on a grid: "Do I go right, or right AND up?"
 * We keep track of an "error" (how far we are from the 'real' line) 
 * to decide when to jump.
 * 
 * Returns true if at least one pixel changed.
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
