import { SelectionMask, getSelectionBounds } from "./selection";
import { cloneBuffer } from "./pixels";

export type ClipboardData = {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
};

export function copySelection(
  buffer: Uint8ClampedArray,
  selection: SelectionMask,
  canvasWidth: number,
  canvasHeight: number
): ClipboardData | null {
  const bounds = getSelectionBounds(selection, canvasWidth, canvasHeight);
  if (!bounds) return null;

  const clipWidth = bounds.width;
  const clipHeight = bounds.height;
  const clipData = new Uint8ClampedArray(clipWidth * clipHeight * 4);

  for (let y = 0; y < clipHeight; y++) {
    for (let x = 0; x < clipWidth; x++) {
      const srcX = bounds.x + x;
      const srcY = bounds.y + y;
      const srcIdx = (srcY * canvasWidth + srcX) * 4;
      const selIdx = srcY * canvasWidth + srcX;
      const dstIdx = (y * clipWidth + x) * 4;

      if (selection[selIdx]) {
        clipData[dstIdx] = buffer[srcIdx];
        clipData[dstIdx + 1] = buffer[srcIdx + 1];
        clipData[dstIdx + 2] = buffer[srcIdx + 2];
        clipData[dstIdx + 3] = buffer[srcIdx + 3];
      }
    }
  }

  return { pixels: clipData, width: clipWidth, height: clipHeight };
}

export function cutSelection(
  buffer: Uint8ClampedArray,
  selection: SelectionMask,
  canvasWidth: number,
  canvasHeight: number
): { clipboardData: ClipboardData | null; modifiedBuffer: Uint8ClampedArray } {
  const clipboardData = copySelection(buffer, selection, canvasWidth, canvasHeight);
  const modifiedBuffer = cloneBuffer(buffer);

  for (let i = 0; i < selection.length; i++) {
    if (selection[i]) {
      const idx = i * 4;
      modifiedBuffer[idx] = 0;
      modifiedBuffer[idx + 1] = 0;
      modifiedBuffer[idx + 2] = 0;
      modifiedBuffer[idx + 3] = 0;
    }
  }

  return { clipboardData, modifiedBuffer };
}

export function pasteClipboard(
  buffer: Uint8ClampedArray,
  clipboard: ClipboardData,
  canvasWidth: number,
  canvasHeight: number,
  pasteX: number = 0,
  pasteY: number = 0
): Uint8ClampedArray {
  const result = cloneBuffer(buffer);

  for (let y = 0; y < clipboard.height; y++) {
    for (let x = 0; x < clipboard.width; x++) {
      const dstX = pasteX + x;
      const dstY = pasteY + y;

      if (dstX >= 0 && dstX < canvasWidth && dstY >= 0 && dstY < canvasHeight) {
        const srcIdx = (y * clipboard.width + x) * 4;
        const dstIdx = (dstY * canvasWidth + dstX) * 4;

        const alpha = clipboard.pixels[srcIdx + 3];
        if (alpha > 0) {
          result[dstIdx] = clipboard.pixels[srcIdx];
          result[dstIdx + 1] = clipboard.pixels[srcIdx + 1];
          result[dstIdx + 2] = clipboard.pixels[srcIdx + 2];
          result[dstIdx + 3] = clipboard.pixels[srcIdx + 3];
        }
      }
    }
  }

  return result;
}
