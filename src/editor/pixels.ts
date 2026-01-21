/**
 * src/editor/pixels.ts
 * -----------------------------------------------------------------------------
 * Pixel buffer utilities (RGBA).
 *
 * IMPORTANT (TypeScript DOM typing):
 * ImageData expects a Uint8ClampedArray backed by an ArrayBuffer (not "ArrayBufferLike").
 * So we define PixelBuffer as Uint8ClampedArray<ArrayBuffer> and create buffers accordingly.
 */

export type RGBA = { r: number; g: number; b: number; a: number };

/**
 * A pixel buffer that is guaranteed to be backed by a real ArrayBuffer.
 * This avoids TypeScript errors when calling `new ImageData(data, w, h)`.
 */
export type PixelBuffer = Uint8ClampedArray<ArrayBuffer>;

export function createBuffer(width: number, height: number, fill: RGBA): PixelBuffer {
  const ab = new ArrayBuffer(width * height * 4);
  const buf = new Uint8ClampedArray(ab) as PixelBuffer;

  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    buf[o + 0] = fill.r;
    buf[o + 1] = fill.g;
    buf[o + 2] = fill.b;
    buf[o + 3] = fill.a;
  }
  return buf;
}

export function cloneBuffer(buf: Uint8ClampedArray): PixelBuffer {
  const ab = new ArrayBuffer(buf.byteLength);
  const copy = new Uint8ClampedArray(ab) as PixelBuffer;

  // Copy bytes (handles any TypedArray view)
  copy.set(new Uint8ClampedArray(buf.buffer as ArrayBuffer, buf.byteOffset, buf.byteLength));
  return copy;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
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

  const changed =
    buf[i + 0] !== rgba.r || buf[i + 1] !== rgba.g || buf[i + 2] !== rgba.b || buf[i + 3] !== rgba.a;

  buf[i + 0] = rgba.r;
  buf[i + 1] = rgba.g;
  buf[i + 2] = rgba.b;
  buf[i + 3] = rgba.a;

  return changed;
}

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
