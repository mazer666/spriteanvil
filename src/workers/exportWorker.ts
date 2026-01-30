/// <reference lib="webworker" />

export type SpritesheetLayout = "grid" | "horizontal" | "vertical" | "packed";

export type SpritesheetSettings = {
  layout: SpritesheetLayout;
  padding: number;
  spacing: number;
  scale: number;
};

type SpritesheetRequest = {
  type: "spritesheet";
  frames: Array<{ pixels: Uint8ClampedArray }>;
  width: number;
  height: number;
  settings: SpritesheetSettings;
};

type DitherRequest = {
  type: "dither";
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  paletteSize: number;
  dither: boolean;
};

type WorkerRequest = SpritesheetRequest | DitherRequest;

type SpritesheetResponse = {
  type: "spritesheet";
  frameRects: Array<{ x: number; y: number; w: number; h: number }>;
  sheetWidth: number;
  sheetHeight: number;
  pixels: Uint8ClampedArray;
};

type DitherResponse = {
  type: "dither";
  pixels: Uint8ClampedArray;
};

self.onmessage = (event: MessageEvent<{ id: number; payload: WorkerRequest }>) => {
  const { id, payload } = event.data;

  if (payload.type === "spritesheet") {
    const result = generateSpritesheet(payload.frames, payload.width, payload.height, payload.settings);
    (self as DedicatedWorkerGlobalScope).postMessage(
      {
        id,
        payload: {
          type: "spritesheet",
          frameRects: result.frameRects,
          sheetWidth: result.sheetWidth,
          sheetHeight: result.sheetHeight,
          pixels: result.pixels,
        } satisfies SpritesheetResponse,
      },
      [result.pixels.buffer]
    );
  }

  if (payload.type === "dither") {
    const reduced = reduceToPalette(payload.pixels, payload.width, payload.height, payload.paletteSize, payload.dither);
    (self as DedicatedWorkerGlobalScope).postMessage(
      { id, payload: { type: "dither", pixels: reduced } satisfies DitherResponse },
      [reduced.buffer]
    );
  }
};

function generateSpritesheet(
  frames: Array<{ pixels: Uint8ClampedArray }>,
  canvasWidth: number,
  canvasHeight: number,
  settings: SpritesheetSettings
) {
  const { layout, padding, spacing, scale } = settings;

  const scaledWidth = canvasWidth * scale;
  const scaledHeight = canvasHeight * scale;

  let sheetWidth = 0;
  let sheetHeight = 0;
  const frameRects: Array<{ x: number; y: number; w: number; h: number }> = [];

  if (layout === "grid") {
    const cols = Math.ceil(Math.sqrt(frames.length));
    const rows = Math.ceil(frames.length / cols);

    sheetWidth = padding * 2 + cols * scaledWidth + (cols - 1) * spacing;
    sheetHeight = padding * 2 + rows * scaledHeight + (rows - 1) * spacing;

    for (let i = 0; i < frames.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);

      frameRects.push({
        x: padding + col * (scaledWidth + spacing),
        y: padding + row * (scaledHeight + spacing),
        w: scaledWidth,
        h: scaledHeight,
      });
    }
  } else if (layout === "horizontal") {
    sheetWidth = padding * 2 + frames.length * scaledWidth + (frames.length - 1) * spacing;
    sheetHeight = padding * 2 + scaledHeight;

    for (let i = 0; i < frames.length; i++) {
      frameRects.push({
        x: padding + i * (scaledWidth + spacing),
        y: padding,
        w: scaledWidth,
        h: scaledHeight,
      });
    }
  } else if (layout === "vertical") {
    sheetWidth = padding * 2 + scaledWidth;
    sheetHeight = padding * 2 + frames.length * scaledHeight + (frames.length - 1) * spacing;

    for (let i = 0; i < frames.length; i++) {
      frameRects.push({
        x: padding,
        y: padding + i * (scaledHeight + spacing),
        w: scaledWidth,
        h: scaledHeight,
      });
    }
  } else {
    const maxCols = Math.ceil(Math.sqrt(frames.length));
    const maxWidth = padding * 2 + maxCols * scaledWidth + (maxCols - 1) * spacing;
    let cursorX = padding;
    let cursorY = padding;
    let rowHeight = scaledHeight;

    for (let i = 0; i < frames.length; i++) {
      if (cursorX + scaledWidth > maxWidth) {
        cursorX = padding;
        cursorY += rowHeight + spacing;
      }
      frameRects.push({
        x: cursorX,
        y: cursorY,
        w: scaledWidth,
        h: scaledHeight,
      });
      cursorX += scaledWidth + spacing;
    }

    sheetWidth = maxWidth;
    sheetHeight = cursorY + rowHeight + padding;
  }

  const canvas = new OffscreenCanvas(sheetWidth, sheetHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create OffscreenCanvas context");
  ctx.imageSmoothingEnabled = false;

  frames.forEach((frame, i) => {
    const rect = frameRects[i];
    const temp = new OffscreenCanvas(canvasWidth, canvasHeight);
    const tempCtx = temp.getContext("2d");
    if (!tempCtx) return;

    const imageData = new ImageData(new Uint8ClampedArray(frame.pixels), canvasWidth, canvasHeight);
    tempCtx.putImageData(imageData, 0, 0);

    ctx.drawImage(temp, 0, 0, canvasWidth, canvasHeight, rect.x, rect.y, rect.w, rect.h);
  });

  const imageData = ctx.getImageData(0, 0, sheetWidth, sheetHeight);
  return {
    frameRects,
    sheetWidth,
    sheetHeight,
    pixels: imageData.data,
  };
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
