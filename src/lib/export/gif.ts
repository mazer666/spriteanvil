/**
 * src/lib/export/gif.ts
 * -----------------------------------------------------------------------------
 * ## GIF EXPORT (Noob Guide)
 * 
 * A GIF is like a "Flipbook". We take each frame of your animation and stick
 * them together into one file that plays on a loop.
 * 
 * ## JARGON GLOSSARY
 * 1. QUANTIZATION: The process of shrinking a photo with millions of colors down
 *    to only 256 colors (or fewer).
 * 2. DITHERING: Mixing pixels of two colors to "Trick" the eye into seeing
 *    a third color.
 * 3. DELAY: How long (in milliseconds) a frame stays on screen.
 * 
 * ## VISUAL FLOW (Mermaid)
 * ```mermaid
 * graph TD
 *   Start[Start Export] --> Loop[For Each Frame]
 *   Loop --> Quant[Quantize Palette]
 *   Quant --> Dither[Apply Dithering]
 *   Dither --> Add[Add to GIF Stack]
 *   Add --> Loop
 *   Loop -- Done --> Final[Render & Download]
 * ```
 */
import { Frame } from "../../types";
import { reducePaletteInWorker } from "./workerClient";

export type GIFExportOptions = {
  width: number;
  height: number;
  frames: Frame[];
  loop: boolean;
  quality: number;
  paletteSize: number;
  dither: boolean;
};

export async function exportToGIF(options: GIFExportOptions): Promise<Blob> {
  const { width, height, frames, loop, quality, paletteSize, dither } = options;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Cannot get canvas context");

  const GIF = (window as any).GIF;
  if (!GIF) {
    throw new Error("GIF.js library not loaded. Add <script src='https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js'></script> to your HTML.");
  }

  const gif = new GIF({
    workers: 2,
    quality,
    width,
    height,
    repeat: loop ? 0 : -1,
  });

  for (const frame of frames) {
    const imageData = ctx.createImageData(width, height);
    const reduced = await reduceToPaletteAsync(frame.pixels, width, height, paletteSize, dither);
    imageData.data.set(reduced);
    ctx.putImageData(imageData, 0, 0);

    gif.addFrame(canvas, { delay: frame.durationMs, copy: true });
  }

  return new Promise((resolve, reject) => {
    gif.on("finished", (blob: Blob) => {
      resolve(blob);
    });

    gif.on("error", (error: Error) => {
      reject(error);
    });

    gif.render();
  });
}

export function downloadGIF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type RGB = { r: number; g: number; b: number };

function reduceToPalette(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  paletteSize: number,
  dither: boolean
): Uint8ClampedArray {
  const palette = buildQuantizedPalette(pixels, paletteSize);
  if (palette.length === 0) return new Uint8ClampedArray(pixels);
  return dither
    ? ditherFloydSteinberg(pixels, width, height, palette)
    : mapToPalette(pixels, palette);
}

async function reduceToPaletteAsync(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  paletteSize: number,
  dither: boolean
): Promise<Uint8ClampedArray> {
  if (!dither) {
    return reduceToPalette(pixels, width, height, paletteSize, false);
  }

  return reducePaletteInWorker(pixels, width, height, paletteSize, dither).catch(() =>
    reduceToPalette(pixels, width, height, paletteSize, dither)
  );
}

function buildQuantizedPalette(pixels: Uint8ClampedArray, paletteSize: number): RGB[] {
  const pixelCount = pixels.length / 4;
  const buckets = new Map<string, number>();
  const levels = Math.max(2, Math.ceil(Math.cbrt(paletteSize)));
  const step = 255 / (levels - 1);

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const alpha = pixels[idx + 3];
    if (alpha === 0) continue;
    const r = Math.round(pixels[idx] / step) * step;
    const g = Math.round(pixels[idx + 1] / step) * step;
    const b = Math.round(pixels[idx + 2] / step) * step;
    const key = `${r},${g},${b}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return Array.from(buckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, paletteSize)
    .map(([key]) => {
      const [r, g, b] = key.split(",").map(Number);
      return { r, g, b };
    });
}

function mapToPalette(pixels: Uint8ClampedArray, palette: RGB[]): Uint8ClampedArray {
  const result = new Uint8ClampedArray(pixels);
  const pixelCount = pixels.length / 4;

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const alpha = pixels[idx + 3];
    if (alpha === 0) continue;
    const { r, g, b } = nearestPaletteColor(pixels[idx], pixels[idx + 1], pixels[idx + 2], palette);
    result[idx] = r;
    result[idx + 1] = g;
    result[idx + 2] = b;
  }

  return result;
}

function ditherFloydSteinberg(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  palette: RGB[]
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(pixels);
  const error = new Float32Array(width * height * 3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = result[idx + 3];
      if (alpha === 0) continue;

      const errIdx = (y * width + x) * 3;
      const r = clampChannel(result[idx] + error[errIdx]);
      const g = clampChannel(result[idx + 1] + error[errIdx + 1]);
      const b = clampChannel(result[idx + 2] + error[errIdx + 2]);

      const nearest = nearestPaletteColor(r, g, b, palette);
      result[idx] = nearest.r;
      result[idx + 1] = nearest.g;
      result[idx + 2] = nearest.b;

      const errR = r - nearest.r;
      const errG = g - nearest.g;
      const errB = b - nearest.b;

      distributeError(error, width, height, x + 1, y, errR, errG, errB, 7 / 16);
      distributeError(error, width, height, x - 1, y + 1, errR, errG, errB, 3 / 16);
      distributeError(error, width, height, x, y + 1, errR, errG, errB, 5 / 16);
      distributeError(error, width, height, x + 1, y + 1, errR, errG, errB, 1 / 16);
    }
  }

  return result;
}

function distributeError(
  buffer: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  errR: number,
  errG: number,
  errB: number,
  factor: number
) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const idx = (y * width + x) * 3;
  buffer[idx] += errR * factor;
  buffer[idx + 1] += errG * factor;
  buffer[idx + 2] += errB * factor;
}

function nearestPaletteColor(r: number, g: number, b: number, palette: RGB[]): RGB {
  let best = palette[0];
  let bestDist = Infinity;
  for (const color of palette) {
    const dr = r - color.r;
    const dg = g - color.g;
    const db = b - color.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = color;
    }
  }
  return best;
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
