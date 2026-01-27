import { RGBA, setPixel, getPixel } from "../pixels";

export function flipHorizontal(
  buffer: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(buffer.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = (y * width + (width - 1 - x)) * 4;
      result[dstIdx + 0] = buffer[srcIdx + 0];
      result[dstIdx + 1] = buffer[srcIdx + 1];
      result[dstIdx + 2] = buffer[srcIdx + 2];
      result[dstIdx + 3] = buffer[srcIdx + 3];
    }
  }

  return result;
}

export function flipVertical(
  buffer: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(buffer.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = ((height - 1 - y) * width + x) * 4;
      result[dstIdx + 0] = buffer[srcIdx + 0];
      result[dstIdx + 1] = buffer[srcIdx + 1];
      result[dstIdx + 2] = buffer[srcIdx + 2];
      result[dstIdx + 3] = buffer[srcIdx + 3];
    }
  }

  return result;
}

export function rotate90CW(
  buffer: Uint8ClampedArray,
  width: number,
  height: number
): { buffer: Uint8ClampedArray; width: number; height: number } {
  const newWidth = height;
  const newHeight = width;
  const result = new Uint8ClampedArray(newWidth * newHeight * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const newX = height - 1 - y;
      const newY = x;
      const dstIdx = (newY * newWidth + newX) * 4;
      result[dstIdx + 0] = buffer[srcIdx + 0];
      result[dstIdx + 1] = buffer[srcIdx + 1];
      result[dstIdx + 2] = buffer[srcIdx + 2];
      result[dstIdx + 3] = buffer[srcIdx + 3];
    }
  }

  return { buffer: result, width: newWidth, height: newHeight };
}

export function rotate90CCW(
  buffer: Uint8ClampedArray,
  width: number,
  height: number
): { buffer: Uint8ClampedArray; width: number; height: number } {
  const newWidth = height;
  const newHeight = width;
  const result = new Uint8ClampedArray(newWidth * newHeight * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const newX = y;
      const newY = width - 1 - x;
      const dstIdx = (newY * newWidth + newX) * 4;
      result[dstIdx + 0] = buffer[srcIdx + 0];
      result[dstIdx + 1] = buffer[srcIdx + 1];
      result[dstIdx + 2] = buffer[srcIdx + 2];
      result[dstIdx + 3] = buffer[srcIdx + 3];
    }
  }

  return { buffer: result, width: newWidth, height: newHeight };
}

export function rotate180(
  buffer: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(buffer.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = ((height - 1 - y) * width + (width - 1 - x)) * 4;
      result[dstIdx + 0] = buffer[srcIdx + 0];
      result[dstIdx + 1] = buffer[srcIdx + 1];
      result[dstIdx + 2] = buffer[srcIdx + 2];
      result[dstIdx + 3] = buffer[srcIdx + 3];
    }
  }

  return result;
}

export function scaleNearest(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  scaleX: number,
  scaleY: number
): { buffer: Uint8ClampedArray; width: number; height: number } {
  const newWidth = Math.floor(width * scaleX);
  const newHeight = Math.floor(height * scaleY);
  const result = new Uint8ClampedArray(newWidth * newHeight * 4);

  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      const srcX = Math.floor(x / scaleX);
      const srcY = Math.floor(y / scaleY);
      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (y * newWidth + x) * 4;
      result[dstIdx + 0] = buffer[srcIdx + 0];
      result[dstIdx + 1] = buffer[srcIdx + 1];
      result[dstIdx + 2] = buffer[srcIdx + 2];
      result[dstIdx + 3] = buffer[srcIdx + 3];
    }
  }

  return { buffer: result, width: newWidth, height: newHeight };
}

export function translatePixels(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  dx: number,
  dy: number,
  wrap: boolean = false
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(buffer.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let srcX = x - dx;
      let srcY = y - dy;

      if (wrap) {
        srcX = ((srcX % width) + width) % width;
        srcY = ((srcY % height) + height) % height;
      } else {
        if (srcX < 0 || srcX >= width || srcY < 0 || srcY >= height) {
          continue;
        }
      }

      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (y * width + x) * 4;
      result[dstIdx + 0] = buffer[srcIdx + 0];
      result[dstIdx + 1] = buffer[srcIdx + 1];
      result[dstIdx + 2] = buffer[srcIdx + 2];
      result[dstIdx + 3] = buffer[srcIdx + 3];
    }
  }

  return result;
}
