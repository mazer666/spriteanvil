/**
 * Palette extraction utilities.
 */

/**
 * Extract a palette from a pixel buffer by counting unique RGB colors.
 * Fully transparent pixels are ignored.
 */
export function extractPaletteFromPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  maxColors: number = 256
): string[] {
  const counts = new Map<string, number>();
  const pixelCount = width * height;

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const alpha = pixels[idx + 3];
    if (alpha === 0) continue;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    const key = `${r},${g},${b}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const limited = sorted.slice(0, maxColors);

  return limited.map(([key]) => {
    const [r, g, b] = key.split(",").map(Number);
    return `#${r.toString(16).padStart(2, "0")}${g
      .toString(16)
      .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  });
}
