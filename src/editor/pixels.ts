/**
 * src/editor/pixels.ts
 * -----------------------------------------------------------------------------
 * Pixel buffer utilities (RGBA).
 *
 * We store pixels in a Uint8ClampedArray: [R,G,B,A, R,G,B,A, ...]
 * This matches ImageData's internal format and avoids endianness issues.
 */

export type RGBA = { r: number; g: number; b: number; a: number };

export function createBuffer(width: number, height: number, fill: RGBA): Uint8ClampedArray {
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

export function setPixel(
  buf: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  rgba: RGBA
): boolean {
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
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

  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;

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
