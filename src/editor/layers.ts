import { BlendMode, LayerData } from "../types";

type LayerCompositeInput = Pick<LayerData, "opacity" | "blend_mode" | "is_visible" | "pixels">;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

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

  return merged;
}

/**
 * Merge the layer at `index` into the layer directly below it.
 *
 * We walk the pixel buffer as a flat RGBA byte array:
 * - Each pixel takes 4 bytes (R, G, B, A) in sequence.
 * - Pixel N starts at byte index `N * 4`.
 * This byte-level layout is why you see `idx = p * 4` in the merge loop.
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
 * Flatten all visible layers into a single RGBA pixel buffer.
 *
 * Each layer's opacity and blend mode are applied while combining into the
 * final Uint8ClampedArray, preserving the expected compositing results.
 */
export function flattenImage(
  layers: LayerData[],
  width: number,
  height: number
): Uint8ClampedArray {
  return compositeLayers(layers, width, height);
}
