/**
 * src/editor/tools/gradient.ts
 * -----------------------------------------------------------------------------
 * ## GRADIENTS & DITHERING (Noob Guide)
 * 
 * A Gradient is a "Smooth Fade" from one color to another.
 * 
 * ## JARGON GLOSSARY
 * 1. INTERPOLATION: Calculating the "In-Between" colors.
 * 2. LERP: Linear Interpolation. The math of finding values on a line.
 * 3. BAYER MATRIX: A grid of numbers used to decide where to put dots 
 *    for retro dithering.
 * 4. ERROR DIFFUSION: Taking the "mistake" (color difference) from one 
 *    pixel and spreading it to its neighbors (Floyd-Steinberg).
 * 
 * ## VISUAL FLOW (Mermaid)
 * ```mermaid
 * graph TD
 *   A[Pixel X,Y] --> B[Calculate Distance T]
 *   B --> C[Mix Start/End Colors by T]
 *   C --> D{Dithering On?}
 *   D -- Yes --> E[Compare vs Bayer/Error Matrix]
 *   E --> F[Pick Closest Palette Color]
 *   D -- No --> G[Write True Color]
 *   F --> H[Pixel Painted]
 *   G --> H
 * ```
 */
import { RGBA, setPixel } from "../pixels";

export type GradientType = "linear" | "radial" | "angle" | "reflected" | "diamond";
export type DitherType = "none" | "bayer" | "floyd-steinberg";

/**
 * WHAT: Paints a smooth transition between two colors across the whole canvas.
 * WHY: Creating gradients by hand in pixel art is tedious. This automates the math.
 * HOW: It loops through every pixel, calculates its "Distance" (T) along the gradient line, and mixes the Start/End colors based on that T.
 * USE: Call this when the user drags the mouse with the Gradient Tool.
 * RATIONALE: We support multiple types (Linear, Radial, Diamond) to give artists more creative control.
 * 
 * 🛠️ NOOB CHALLENGE: Can you add a "Square" gradient type? 
 * (Hint: use `Math.max(Math.abs(distX), Math.abs(distY))`).
 */
export function drawGradient(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  startColor: RGBA,
  endColor: RGBA,
  type: GradientType = "linear",
  ditherType: DitherType = "none"
): boolean {
  let changed = false;

  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) return false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let t = 0;

      if (type === "linear") {
        const dotProduct = (x - startX) * dx + (y - startY) * dy;
        t = Math.max(0, Math.min(1, dotProduct / (length * length)));
      } else if (type === "radial") {
        const distX = x - startX;
        const distY = y - startY;
        const dist = Math.sqrt(distX * distX + distY * distY);
        t = Math.max(0, Math.min(1, dist / length));
      } else if (type === "angle") {
        const angle = Math.atan2(y - startY, x - startX);
        t = (angle + Math.PI) / (2 * Math.PI);
      } else if (type === "reflected") {
        const dotProduct = (x - startX) * dx + (y - startY) * dy;
        const rawT = dotProduct / (length * length);
        t = Math.abs(rawT - Math.floor(rawT + 0.5)) * 2;
      } else if (type === "diamond") {
        const distX = Math.abs(x - startX);
        const distY = Math.abs(y - startY);
        const dist = distX + distY;
        t = Math.max(0, Math.min(1, dist / (Math.abs(dx) + Math.abs(dy))));
      }

      if (ditherType === "bayer") {
        const bayerMatrix = [
          [0, 8, 2, 10],
          [12, 4, 14, 6],
          [3, 11, 1, 9],
          [15, 7, 13, 5],
        ];
        const threshold = bayerMatrix[y % 4][x % 4] / 16;
        t = t < threshold ? 0 : 1;
      }

      const r = Math.round(startColor.r + (endColor.r - startColor.r) * t);
      const g = Math.round(startColor.g + (endColor.g - startColor.g) * t);
      const b = Math.round(startColor.b + (endColor.b - startColor.b) * t);
      const a = Math.round(startColor.a + (endColor.a - startColor.a) * t);

      if (setPixel(buffer, width, height, x, y, { r, g, b, a })) {
        changed = true;
      }
    }
  }

  return changed;
}

/**
 * WHAT: Applies a "Retro" textured fade (Dithering) to the image.
 * WHY: Classic games often had limited colors. Dithering makes it look like there are more colors by mixing dots of two different colors.
 * HOW: It uses the Floyd-Steinberg algorithm. It "pushes" the color error of one pixel to its neighbors.
 * USE: Use this to give your art a retro Gameboy or 16-bit look.
 * RATIONALE: Floyd-Steinberg is a standard in the industry for high-quality color reduction.
 * 
 * ASCII VISUAL (Error Diffusion):
 * [Pixel X] --7/16--> [Right Neighbor]
 *     | \
 *  5/16  1/16
 *    |    \
 * [Down] [Down-Right]
 */
export function applyFloydSteinbergDither(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  palette: RGBA[]
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(buffer);
  const errorBuffer = new Float32Array(width * height * 3);

  /**
   * Internal helper to find which color in our palette is "closest" to the target.
   */
  function findClosestColor(r: number, g: number, b: number): RGBA {
    let minDist = Infinity;
    let closest = palette[0];

    for (const color of palette) {
      const dr = r - color.r;
      const dg = g - color.g;
      const db = b - color.b;
      const dist = dr * dr + dg * dg + db * db;

      if (dist < minDist) {
        minDist = dist;
        closest = color;
      }
    }

    return closest;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const errIdx = (y * width + x) * 3;

      const oldR = result[idx] + errorBuffer[errIdx];
      const oldG = result[idx + 1] + errorBuffer[errIdx + 1];
      const oldB = result[idx + 2] + errorBuffer[errIdx + 2];

      const newColor = findClosestColor(oldR, oldG, oldB);

      result[idx] = newColor.r;
      result[idx + 1] = newColor.g;
      result[idx + 2] = newColor.b;

      const errR = oldR - newColor.r;
      const errG = oldG - newColor.g;
      const errB = oldB - newColor.b;

      if (x + 1 < width) {
        const rightIdx = (y * width + (x + 1)) * 3;
        errorBuffer[rightIdx] += errR * 7 / 16;
        errorBuffer[rightIdx + 1] += errG * 7 / 16;
        errorBuffer[rightIdx + 2] += errB * 7 / 16;
      }

      if (y + 1 < height) {
        if (x > 0) {
          const bottomLeftIdx = ((y + 1) * width + (x - 1)) * 3;
          errorBuffer[bottomLeftIdx] += errR * 3 / 16;
          errorBuffer[bottomLeftIdx + 1] += errG * 3 / 16;
          errorBuffer[bottomLeftIdx + 2] += errB * 3 / 16;
        }

        const bottomIdx = ((y + 1) * width + x) * 3;
        errorBuffer[bottomIdx] += errR * 5 / 16;
        errorBuffer[bottomIdx + 1] += errG * 5 / 16;
        errorBuffer[bottomIdx + 2] += errB * 5 / 16;

        if (x + 1 < width) {
          const bottomRightIdx = ((y + 1) * width + (x + 1)) * 3;
          errorBuffer[bottomRightIdx] += errR * 1 / 16;
          errorBuffer[bottomRightIdx + 1] += errG * 1 / 16;
          errorBuffer[bottomRightIdx + 2] += errB * 1 / 16;
        }
      }
    }
  }

  return result;
}
