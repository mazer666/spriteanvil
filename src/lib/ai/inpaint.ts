import type { CanvasSpec } from "../../types";

export type InpaintPayload = {
  prompt: string;
  baseImage: string;
  maskImage: string;
  denoiseStrength: number;
  promptInfluence: number;
};

function bufferToDataUrl(buffer: Uint8ClampedArray, width: number, height: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = new ImageData(new Uint8ClampedArray(buffer), width, height);
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

export function selectionMaskToBase64Png(
  mask: Uint8Array,
  width: number,
  height: number
): string {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < mask.length; i++) {
    const alpha = mask[i] ? 255 : 0;
    const idx = i * 4;
    pixels[idx + 0] = 0;
    pixels[idx + 1] = 0;
    pixels[idx + 2] = 0;
    pixels[idx + 3] = alpha;
  }
  return bufferToDataUrl(pixels, width, height);
}

export function layerToBase64Png(pixels: Uint8ClampedArray, canvas: CanvasSpec): string {
  return bufferToDataUrl(pixels, canvas.width, canvas.height);
}

export function buildInpaintPayload(
  prompt: string,
  canvas: CanvasSpec,
  layerPixels: Uint8ClampedArray,
  selectionMask: Uint8Array,
  denoiseStrength: number,
  promptInfluence: number
): InpaintPayload {
  return {
    prompt,
    baseImage: layerToBase64Png(layerPixels, canvas),
    maskImage: selectionMaskToBase64Png(selectionMask, canvas.width, canvas.height),
    denoiseStrength,
    promptInfluence,
  };
}
