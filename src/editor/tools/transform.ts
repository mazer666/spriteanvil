/**
 * src/editor/tools/transform.ts
 * -----------------------------------------------------------------------------
 * ## TRANSFORMS (Noob Guide)
 * 
 * Transforms are how you Move, Rotate, or Flip your drawing.
 * 
 * ## JARGON GLOSSARY
 * 1. AFFINE: A type of transform that keeps parallel lines parallel (like 
 *    Rotation, Translation, and Scaling).
 * 2. PIVOT: The center point that we rotate around.
 * 3. MATRIX: A 2x3 grid of numbers that describes the whole transform. 
 *    X_new = a*X + c*Y + e.
 * 4. NEAREST NEIGHBOR: A simple way to resize where we just grab the 
 *    color of the closest pixel, keeping it "pixelated" instead of blurry.
 * 
 * ## VISUAL FLOW (Mermaid)
 * ```mermaid
 * graph TD
 *   A[Input: Selection] --> B[Calculate New Bounding Box]
 *   B --> C[Create Result Buffer]
 *   C --> D[Invert Matrix]
 *   D --> E[Loop Result Pixels]
 *   E --> F[Map to Source Pixel via Inv-Matrix]
 *   F --> G[Sample Source Color]
 *   G --> H[Write to Result]
 *   H --> I[Output: Transformed Selection]
 * ```
 */
import { cloneBuffer } from "../pixels";
import { getSelectionBounds } from "../selection";
import { FloatingSelection } from "../../types";

/**
 * WHAT: Flips the image like a mirror (Left becomes Right).
 * WHY: Useful for making a character face the opposite direction.
 * HOW: It loops through the pixels and swaps the X-coordinates: `newX = width - 1 - oldX`.
 * USE: Call this when the user clicks the "Mirror Horizontal" button.
 */
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

/**
 * WHAT: Flips the image upside down (Top becomes Bottom).
 * WHY: Useful for reflections or symmetry.
 * HOW: It loops through the pixels and swaps the Y-coordinates: `newY = height - 1 - oldY`.
 */
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

/**
 * WHAT: Rotates the image 90 degrees Clockwise.
 * WHY: To re-orient a sprite.
 * HOW: It swaps the Width and Height, then maps `newX = height - 1 - oldY` and `newY = oldX`.
 * USE: Call this when the user clicks "Rotate 90 CW".
 * RATIONALE: This function returns a NEW width and height because 90-degree rotations change the shape of the canvas!
 */
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

/**
 * WHAT: Rotates the image 90 degrees Counter-Clockwise.
 * HOW: Maps `newX = oldY` and `newY = width - 1 - oldX`.
 */
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

/**
 * WHAT: Rotates the image 180 degrees (Upside down and Backward).
 * WHY: Same as flipping Horizontal + Vertical.
 */
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

/**
 * WHAT: Slides the pixels by (dx, dy).
 * WHY: Useful for "Panning" a layer or creating seamless textures.
 * HOW: It calculates the source pixel by subtracting the offset: `srcX = x - dx`.
 * USE: Call this when the user drags a layer with the Move Tool.
 * 
 * 🛠️ NOOB CHALLENGE: Can you modify this to "Wrap" around the edges? 
 * (Hint: use `% width` on the `srcX` and `srcY`).
 */
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

export type TransformMatrix = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

export function liftSelection(
  buffer: Uint8ClampedArray,
  selection: Uint8Array,
  canvasWidth: number,
  canvasHeight: number
): { floating: FloatingSelection | null; cleared: Uint8ClampedArray } {
  const bounds = getSelectionBounds(selection, canvasWidth, canvasHeight);
  const cleared = cloneBuffer(buffer);
  if (!bounds) {
    return { floating: null, cleared };
  }

  const floatingPixels = new Uint8ClampedArray(bounds.width * bounds.height * 4);

  for (let y = 0; y < bounds.height; y++) {
    for (let x = 0; x < bounds.width; x++) {
      const srcX = bounds.x + x;
      const srcY = bounds.y + y;
      const selIdx = srcY * canvasWidth + srcX;
      if (!selection[selIdx]) continue;

      const srcIdx = (srcY * canvasWidth + srcX) * 4;
      const dstIdx = (y * bounds.width + x) * 4;

      floatingPixels[dstIdx] = buffer[srcIdx];
      floatingPixels[dstIdx + 1] = buffer[srcIdx + 1];
      floatingPixels[dstIdx + 2] = buffer[srcIdx + 2];
      floatingPixels[dstIdx + 3] = buffer[srcIdx + 3];

      cleared[srcIdx] = 0;
      cleared[srcIdx + 1] = 0;
      cleared[srcIdx + 2] = 0;
      cleared[srcIdx + 3] = 0;
    }
  }

  return {
    floating: {
      pixels: floatingPixels,
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
    },
    cleared,
  };
}

/**
 * WHAT: The "Master function" that applies any combination of Move, Rotate, and Scale.
 * WHY: To allow users to free-transform a selection (like in Photoshop).
 * HOW: It takes an "Affine Matrix", INVERTS it, and pulls pixels from the source to the destination.
 * USE: Call this during a "Free Transform" session.
 * RATIONALE: We use the "Inverse Matrix" trick. Instead of pushing source pixels (which leaves gaps), we loop through every destination pixel and ask "Where did you come from in the source?". This guarantees no gaps!
 * 
 * 🛠️ NOOB CHALLENGE: Look at `invA, invB, invC, invD`. This is the math for inverting a 2x2 matrix. Can you find the formula online and verify it?
 */
export function applyTransform(
  floating: FloatingSelection,
  matrix: TransformMatrix,
  interpolation: "nearest" = "nearest"
): FloatingSelection {
  const { pixels, width, height, x, y } = floating;

  // --- Matrix primer (beginner-friendly) ------------------------------------
  // We represent 2D transforms with a 2×3 matrix:
  //   [ a c e ]
  //   [ b d f ]
  //
  // A source pixel at (sx, sy) is transformed into destination space like this:
  //   dx = a*sx + c*sy + e
  //   dy = b*sx + d*sy + f
  //
  // The "a,b,c,d" portion rotates/scales/shears, while "e,f" is translation.
  // For pixel art we only use nearest-neighbor sampling: each output pixel
  // copies the closest source pixel to preserve crisp edges.
  //
  // Step 1: Transform the four corners so we know the output bounding box.
  // Step 2: Invert the matrix so we can map output pixels back to sources.
  // Step 3: For each output pixel, sample the nearest source pixel.
  // -------------------------------------------------------------------------

  const corners = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: 0, y: height - 1 },
    { x: width - 1, y: height - 1 },
  ];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const corner of corners) {
    const dx = matrix.a * corner.x + matrix.c * corner.y + matrix.e;
    const dy = matrix.b * corner.x + matrix.d * corner.y + matrix.f;
    minX = Math.min(minX, dx);
    minY = Math.min(minY, dy);
    maxX = Math.max(maxX, dx);
    maxY = Math.max(maxY, dy);
  }

  const newWidth = Math.max(1, Math.ceil(maxX - minX + 1));
  const newHeight = Math.max(1, Math.ceil(maxY - minY + 1));
  const result = new Uint8ClampedArray(newWidth * newHeight * 4);

  const det = matrix.a * matrix.d - matrix.b * matrix.c;
  if (det === 0) {
    return floating;
  }

  const invA = matrix.d / det;
  const invB = -matrix.b / det;
  const invC = -matrix.c / det;
  const invD = matrix.a / det;

  for (let dy = 0; dy < newHeight; dy++) {
    for (let dx = 0; dx < newWidth; dx++) {
      // Re-base into transformed space by adding the minimum corner offset.
      const tx = dx + minX;
      const ty = dy + minY;

      // Apply the inverse matrix to find the source coordinate.
      const srcX = invA * (tx - matrix.e) + invC * (ty - matrix.f);
      const srcY = invB * (tx - matrix.e) + invD * (ty - matrix.f);

      if (interpolation === "nearest") {
        const sx = Math.round(srcX);
        const sy = Math.round(srcY);
        if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;

        const srcIdx = (sy * width + sx) * 4;
        const dstIdx = (dy * newWidth + dx) * 4;
        result[dstIdx] = pixels[srcIdx];
        result[dstIdx + 1] = pixels[srcIdx + 1];
        result[dstIdx + 2] = pixels[srcIdx + 2];
        result[dstIdx + 3] = pixels[srcIdx + 3];
      }
    }
  }

  return {
    pixels: result,
    width: newWidth,
    height: newHeight,
    x: x + Math.round(minX),
    y: y + Math.round(minY),
  };
}
