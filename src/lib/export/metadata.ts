import { Frame } from "../../types";
import { SpritesheetLayout } from "./spritesheet";

export interface ExportMetadata {
  format: string;
  formatVersion: number;
  generatedBy: {
    app: string;
    appVersion: string;
  };
  canvas: {
    width: number;
    height: number;
  };
  spritesheet: {
    image: string;
    layout: SpritesheetLayout;
    width: number;
    height: number;
    padding: number;
    spacing: number;
  };
  frames: Array<{
    id: string;
    index: number;
    rect: { x: number; y: number; w: number; h: number };
    durationMs: number;
    pivot: { x: number; y: number };
    trimmed: boolean;
    sourceRect: { x: number; y: number; w: number; h: number };
    offset: { x: number; y: number };
  }>;
  tags: Array<{
    name: string;
    from: number;
    to: number;
    direction: "forward" | "reverse" | "pingpong";
  }>;
}

export function generateMetadata(
  frames: Frame[],
  canvasWidth: number,
  canvasHeight: number,
  frameRects: Array<{ x: number; y: number; w: number; h: number }>,
  sheetWidth: number,
  sheetHeight: number,
  layout: SpritesheetLayout,
  padding: number,
  spacing: number,
  imageName: string
): ExportMetadata {
  const pivotX = Math.floor(canvasWidth / 2);
  const pivotY = canvasHeight - 1;

  return {
    format: "spriteanvil",
    formatVersion: 1,
    generatedBy: {
      app: "SpriteAnvil",
      appVersion: "0.1.0"
    },
    canvas: {
      width: canvasWidth,
      height: canvasHeight
    },
    spritesheet: {
      image: imageName,
      layout,
      width: sheetWidth,
      height: sheetHeight,
      padding,
      spacing
    },
    frames: frames.map((frame, index) => ({
      id: `frame_${String(index).padStart(3, "0")}`,
      index,
      rect: frameRects[index],
      durationMs: frame.durationMs,
      pivot: { x: pivotX, y: pivotY },
      trimmed: false,
      sourceRect: { x: 0, y: 0, w: canvasWidth, h: canvasHeight },
      offset: { x: 0, y: 0 }
    })),
    tags: []
  };
}

export function downloadJSON(data: ExportMetadata, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
