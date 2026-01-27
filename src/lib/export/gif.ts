import { Frame } from "../../types";

export type GIFExportOptions = {
  width: number;
  height: number;
  frames: Frame[];
  loop: boolean;
  quality: number;
};

export async function exportToGIF(options: GIFExportOptions): Promise<Blob> {
  const { width, height, frames, loop } = options;

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
    quality: 10,
    width,
    height,
    repeat: loop ? 0 : -1,
  });

  for (const frame of frames) {
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(frame.pixels);
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
