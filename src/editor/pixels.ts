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

export function getPixel(
  buf: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number
): RGBA | null {
  if (x < 0 || y < 0 || x >= width || y >= height) return null;
  const i = (y * width + x) * 4;
  return { r: buf[i + 0], g: buf[i + 1], b: buf[i + 2], a: buf[i + 3] };
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

/**
 * Compare two colors with a simple per-channel tolerance.
 * tolerance = 0 => exact match
 * tolerance = 255 => everything matches (not useful, but allowed)
 */
export function colorsMatch(a: RGBA, b: RGBA, tolerance: number): boolean {
  const t = Math.max(0, Math.min(255, Math.floor(tolerance)));
  return (
    Math.abs(a.r - b.r) <= t &&
    Math.abs(a.g - b.g) <= t &&
    Math.abs(a.b - b.b) <= t &&
    Math.abs(a.a - b.a) <= t
  );
}

/**
 * Flood fill (Fill Tool).
 *
 * - Fills the connected region starting at (x0, y0)
 * - Region is defined by "matches target color within tolerance"
 * - Writes replacement color into matching pixels
 *
 * Returns true if at least one pixel changed.
 */
export function floodFill(
  buf: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  replacement: RGBA,
  tolerance: number
): boolean {
  const start = getPixel(buf, width, height, x0, y0);
  if (!start) return false;

  // If the start pixel is already the replacement color (exactly), there's nothing to do.
  if (
    start.r === replacement.r &&
    start.g === replacement.g &&
    start.b === replacement.b &&
    start.a === replacement.a
  ) {
    return false;
  }

  const visited = new Uint8Array(width * height); // 0 = not visited, 1 = visited
  const stack: number[] = [y0 * width + x0];

  let changedAny = false;

  while (stack.length > 0) {
    const idx = stack.pop()!;
    if (visited[idx]) continue;
    visited[idx] = 1;

    const x = idx % width;
    const y = Math.floor(idx / width);

    const i = idx * 4;
    const cur: RGBA = {
      r: buf[i + 0],
      g: buf[i + 1],
      b: buf[i + 2],
      a: buf[i + 3]
    };

    if (!colorsMatch(cur, start, tolerance)) continue;

    // Replace pixel
    buf[i + 0] = replacement.r;
    buf[i + 1] = replacement.g;
    buf[i + 2] = replacement.b;
    buf[i + 3] = replacement.a;
    changedAny = true;

    // Neighbors (4-way connectivity)
    if (x > 0) stack.push(idx - 1);
    if (x < width - 1) stack.push(idx + 1);
    if (y > 0) stack.push(idx - width);
    if (y < height - 1) stack.push(idx + width);
  }

  return changedAny;
}
