import { Frame } from "../../types";
import { generateSpritesheetInWorker } from "./workerClient";

export type SpritesheetLayout = "grid" | "horizontal" | "vertical" | "packed";

export interface SpritesheetSettings {
  layout: SpritesheetLayout;
  padding: number;
  spacing: number;
  scale: number;
}

export interface SpritesheetResult {
  canvas: HTMLCanvasElement;
  frameRects: Array<{ x: number; y: number; w: number; h: number }>;
  sheetWidth: number;
  sheetHeight: number;
}

export function generateSpritesheet(
  frames: Frame[],
  canvasWidth: number,
  canvasHeight: number,
  settings: SpritesheetSettings
): SpritesheetResult {
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
        h: scaledHeight
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
        h: scaledHeight
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
        h: scaledHeight
      });
    }
  } else if (layout === "packed") {
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
        h: scaledHeight
      });
      cursorX += scaledWidth + spacing;
    }

    sheetWidth = maxWidth;
    sheetHeight = cursorY + rowHeight + padding;
  }

  const canvas = document.createElement("canvas");
  canvas.width = sheetWidth;
  canvas.height = sheetHeight;
  const ctx = canvas.getContext("2d")!;

  ctx.imageSmoothingEnabled = false;

  frames.forEach((frame, i) => {
    const rect = frameRects[i];

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvasWidth;
    tempCanvas.height = canvasHeight;
    const tempCtx = tempCanvas.getContext("2d")!;

    const imageData = new ImageData(
      new Uint8ClampedArray(frame.pixels),
      canvasWidth,
      canvasHeight
    );

    tempCtx.putImageData(imageData, 0, 0);

    ctx.drawImage(
      tempCanvas,
      0,
      0,
      canvasWidth,
      canvasHeight,
      rect.x,
      rect.y,
      rect.w,
      rect.h
    );
  });

  return {
    canvas,
    frameRects,
    sheetWidth,
    sheetHeight
  };
}

export async function generateSpritesheetAsync(
  frames: Frame[],
  canvasWidth: number,
  canvasHeight: number,
  settings: SpritesheetSettings
): Promise<SpritesheetResult> {
  return generateSpritesheetInWorker(frames, canvasWidth, canvasHeight, settings).catch(() =>
    generateSpritesheet(frames, canvasWidth, canvasHeight, settings)
  );
}

export function downloadCanvasAsPNG(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
