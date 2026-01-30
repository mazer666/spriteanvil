import { Frame } from "../../types";
import { SpritesheetLayout } from "./spritesheet";

let worker: Worker | null = null;
let requestId = 0;
const pending = new Map<number, (value: any) => void>();

function getWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (!worker) {
    worker = new Worker(new URL("../../workers/exportWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event) => {
      const { id, payload } = event.data as { id: number; payload: any };
      const resolver = pending.get(id);
      if (resolver) {
        pending.delete(id);
        resolver(payload);
      }
    };
  }
  return worker;
}

function postWorkerMessage<T>(payload: any): Promise<T> {
  const instance = getWorker();
  if (!instance) {
    return Promise.reject(new Error("Worker not available"));
  }

  return new Promise((resolve) => {
    const id = requestId++;
    pending.set(id, resolve);
    instance.postMessage({ id, payload });
  });
}

export async function generateSpritesheetInWorker(
  frames: Frame[],
  canvasWidth: number,
  canvasHeight: number,
  settings: { layout: SpritesheetLayout; padding: number; spacing: number; scale: number }
) {
  const payload = {
    type: "spritesheet",
    frames: frames.map((frame) => ({ pixels: frame.pixels })),
    width: canvasWidth,
    height: canvasHeight,
    settings,
  };

  const response = await postWorkerMessage<{
    type: "spritesheet";
    frameRects: Array<{ x: number; y: number; w: number; h: number }>;
    sheetWidth: number;
    sheetHeight: number;
    pixels: Uint8ClampedArray;
  }>(payload);

  const canvas = document.createElement("canvas");
  canvas.width = response.sheetWidth;
  canvas.height = response.sheetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Cannot render spritesheet");
  const imageData = new ImageData(
    new Uint8ClampedArray(response.pixels),
    response.sheetWidth,
    response.sheetHeight
  );
  ctx.putImageData(imageData, 0, 0);

  return {
    canvas,
    frameRects: response.frameRects,
    sheetWidth: response.sheetWidth,
    sheetHeight: response.sheetHeight,
  };
}

export async function reducePaletteInWorker(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  paletteSize: number,
  dither: boolean
): Promise<Uint8ClampedArray> {
  const payload = {
    type: "dither",
    pixels,
    width,
    height,
    paletteSize,
    dither,
  };

  const response = await postWorkerMessage<{ type: "dither"; pixels: Uint8ClampedArray }>(payload);

  return response.pixels;
}
