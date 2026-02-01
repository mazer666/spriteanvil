/**
 * src/editor/layers.ts
 * -----------------------------------------------------------------------------
 * ## LAYER COMPOSITING (Noob Guide)
 * 
 * Think of layers like "Clear Plastic Sheets".
 * 
 * ## JARGON GLOSSARY
 * 1. ALPHA: Transparency. 0 is clear, 255 is solid.
 * 2. BLEND MODE: The math rule that picks how two colors mix (e.g., Multiply).
 * 3. COMPOSITE: The final image made by combining all layers from bottom to top.
 * 4. OPACITY: How "thick" the sheet is. 1.0 is normal, 0.5 is semi-see-through.
 * 
 * ## VISUAL FLOW (Mermaid)
 * ```mermaid
 * graph BT
 *   L1[Bottom Layer] --> L2[Middle Layer]
 *   L2 --> L3[Top Layer]
 *   L3 --> OUT[Final Composite Pixel]
 *   style OUT fill:#f9f,stroke:#333
 * ```
 */
import { BlendMode, LayerData } from "../types";
import { createBuffer } from "./pixels";

export function createLayer(width: number, height: number, name: string, pixels?: Uint8ClampedArray): LayerData & { pixels: Uint8ClampedArray } {
  return {
    id: crypto.randomUUID(),
    name,
    opacity: 1,
    blend_mode: "normal",
    is_visible: true,
    is_locked: false,
    pixels: pixels ?? createBuffer(width, height, { r: 0, g: 0, b: 0, a: 0 }),
  };
}

type LayerCompositeInput = Pick<LayerData, "opacity" | "blend_mode" | "is_visible" | "pixels">;

/**
 * WHAT: Forces a number to stay between 0.0 and 1.0.
 * WHY: Alpha (transparency) and colors are often calculated as percentages. 1.1 doesn't exist in math!
 * HOW: Use Math.min and Math.max to "sandwich" the value between 0 and 1.
 * USE: Call this before passing an opacity value to a blending function.
 * RATIONALE: Simple, fast, and prevents "over-bright" pixel errors.
 */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * WHAT: The core "Math Rule" for mixing two individual color numbers.
 * WHY: Different "Blend Modes" (Multiply, Screen, etc.) use different formulas to create visual effects.
 * HOW: A big Switch statement that applies a specific formula based on the `mode`.
 * USE: Internal helper for `compositePixel`.
 * RATIONALE: Separating channel math from alpha math makes the code easier to read and debug.
 * 
 * 🛠️ NOOB CHALLENGE: Can you add a "Subtract" mode? 
 * (Hint: result = base - top, but don't forget to use `clamp01`!)
 */
function blendChannel(base: number, top: number, mode: BlendMode): number {
  switch (mode) {
    case "multiply":
      return base * top;
    case "screen":
      return 1 - (1 - base) * (1 - top);
    case "overlay":
      return base < 0.5 ? 2 * base * top : 1 - 2 * (1 - base) * (1 - top);
    case "add":
      return clamp01(base + top);
    case "subtract":
      return clamp01(base - top);
    case "darken":
      return Math.min(base, top);
    case "lighten":
      return Math.max(base, top);
    case "difference":
      return Math.abs(base - top);
    case "exclusion":
      return base + top - 2 * base * top;
    case "normal":
    default:
      return top;
  }
}

/**
 * WHAT: Calculates the final color of ONE pixel by stacking two colors on top of each other.
 * WHY: This is how we handle transparency. If the top pixel is 50% clear, we need to show some of the bottom pixel.
 * HOW: It converts 0-255 bytes to 0.0-1.0 decimals, applies the Porter-Duff alpha composition formula, and converts back to bytes.
 * USE: Internal helper for the layer looping functions.
 * RATIONALE: Doing math on 0.0-1.0 is much more accurate than using integers, which avoids "rounding artifacts".
 * 
 * ⚠️ WATCH OUT: Floating point math can be slow. We only call this when a pixel actually has transparency.
 */
function compositePixel(
  baseR: number,
  baseG: number,
  baseB: number,
  baseA: number,
  topR: number,
  topG: number,
  topB: number,
  topA: number,
  mode: BlendMode
): [number, number, number, number] {
  if (topA <= 0) {
    return [baseR, baseG, baseB, baseA];
  }

  const baseAlpha = baseA / 255;
  const topAlpha = topA / 255;
  const outAlpha = topAlpha + baseAlpha * (1 - topAlpha);

  if (outAlpha <= 0) {
    return [0, 0, 0, 0];
  }

  const baseRNorm = baseR / 255;
  const baseGNorm = baseG / 255;
  const baseBNorm = baseB / 255;
  const topRNorm = topR / 255;
  const topGNorm = topG / 255;
  const topBNorm = topB / 255;

  const blendedR = blendChannel(baseRNorm, topRNorm, mode);
  const blendedG = blendChannel(baseGNorm, topGNorm, mode);
  const blendedB = blendChannel(baseBNorm, topBNorm, mode);

  const outR =
    (blendedR * topAlpha + baseRNorm * baseAlpha * (1 - topAlpha)) / outAlpha;
  const outG =
    (blendedG * topAlpha + baseGNorm * baseAlpha * (1 - topAlpha)) / outAlpha;
  const outB =
    (blendedB * topAlpha + baseBNorm * baseAlpha * (1 - topAlpha)) / outAlpha;

  return [
    Math.round(outR * 255),
    Math.round(outG * 255),
    Math.round(outB * 255),
    Math.round(outAlpha * 255),
  ];
}

/**
 * WHAT: Squashes an array of layers into a single image.
 * WHY: We need to see the result of all our layers combined to show it on the screen.
 * HOW: It loops through the layers from BOTTOM to TOP, updating a "running result" buffer.
 * USE: Call this inside the main render loop (CanvasStage).
 * RATIONALE: We start from the bottom so that the top-most layers correctly overwrite or blend with the ones below.
 * 
 * ASCII VISUAL:
 * [Layer 3 (Top)]    ---Blend--> [ Result ]
 * [Layer 2 (Mid)]    ---Blend--> [ Result ]
 * [Layer 1 (Bottom)] ----------- [ Result ]
 */
export function compositeLayers(
  layers: LayerCompositeInput[],
  width: number,
  height: number
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(width * height * 4);

  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (!layer.is_visible || !layer.pixels) continue;

    const layerOpacity = clamp01(layer.opacity);
    if (layerOpacity <= 0) continue;

    const pixels = layer.pixels;
    const mode = layer.blend_mode;

    for (let p = 0; p < width * height; p++) {
      const idx = p * 4;

      const topA = Math.round(pixels[idx + 3] * layerOpacity);
      if (topA <= 0) continue;

      const topR = pixels[idx + 0];
      const topG = pixels[idx + 1];
      const topB = pixels[idx + 2];

      const baseR = output[idx + 0];
      const baseG = output[idx + 1];
      const baseB = output[idx + 2];
      const baseA = output[idx + 3];

      const [outR, outG, outB, outA] = compositePixel(
        baseR,
        baseG,
        baseB,
        baseA,
        topR,
        topG,
        topB,
        topA,
        mode
      );

      output[idx + 0] = outR;
      output[idx + 1] = outG;
      output[idx + 2] = outB;
      output[idx + 3] = outA;
    }
  }

  return output;
}

/**
 * WHAT: Mixes exactly two layers into one.
 * WHY: Used for "Merging Down" or flattening a small selection.
 * HOW: Same as `compositeLayers`, but specifically only for two buffers.
 * USE: Internal helper for `mergeDown`.
 * RATIONALE: Optimized to avoid looping through the whole layer stack.
 */
export function mergeLayerIntoBelow(
  below: LayerCompositeInput,
  above: LayerCompositeInput,
  width: number,
  height: number
): Uint8ClampedArray {
  if (!below.pixels || !above.pixels) {
    return new Uint8ClampedArray(width * height * 4);
  }

  const merged = new Uint8ClampedArray(below.pixels);
  const opacity = clamp01(above.opacity);
  if (opacity <= 0) return merged;

  const abovePixels = above.pixels;
  const mode = above.blend_mode;

  for (let p = 0; p < width * height; p++) {
    const idx = p * 4;

    const topA = Math.round(abovePixels[idx + 3] * opacity);
    if (topA <= 0) continue;

    const topR = abovePixels[idx + 0];
    const topG = abovePixels[idx + 1];
    const topB = abovePixels[idx + 2];

    const baseR = merged[idx + 0];
    const baseG = merged[idx + 1];
    const baseB = merged[idx + 2];
    const baseA = merged[idx + 3];

    const [outR, outG, outB, outA] = compositePixel(
      baseR,
      baseG,
      baseB,
      baseA,
      topR,
      topG,
      topB,
      topA,
      mode
    );

    merged[idx + 0] = outR;
    merged[idx + 1] = outG;
    merged[idx + 2] = outB;
    merged[idx + 3] = outA;
  }

  // This byte-level layout is why you see `idx = p * 4` in the merge loop.
  return merged;
}

/**
 * WHAT: Removes one layer and bakes its pixels into the one below it.
 * WHY: To simplify a project if you have too many layers.
 * HOW: It finds the two layers in the list, merges their pixels, removes the old one, and updates the list.
 * USE: Call this when the user clicks the "Merge Down" button in the Layer Panel.
 */
export function mergeDown(
  layers: LayerData[],
  index: number,
  width: number,
  height: number
): LayerData[] {
  if (index < 0 || index >= layers.length - 1) return layers;
  const above = layers[index];
  const below = layers[index + 1];
  if (!above || !below) return layers;
  if (!above.pixels || !below.pixels) return layers;
  if (!above.is_visible) return layers;

  const mergedPixels = mergeLayerIntoBelow(below, above, width, height);
  const updated = [...layers];
  updated.splice(index, 1);
  updated[index] = { ...below, pixels: mergedPixels };
  return updated;
}

/**
 * WHAT: Turns a complex multi-layer project into a single "flat" image.
 * WHY: Useful for exporting to PNG or final saving.
 * HOW: It's just a shortcut that calls `compositeLayers`.
 * USE: Call this during project export.
 * 
 * RATIONALE: Each layer's opacity and blend mode are applied while 
 * combining into the final Uint8ClampedArray, preserving the 
 * expected compositing results.
 */
export function flattenImage(
  layers: LayerData[],
  width: number,
  height: number
): Uint8ClampedArray {
  return compositeLayers(layers, width, height);
}
