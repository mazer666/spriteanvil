import { RGBA, setPixel, getPixel, cloneBuffer } from "./pixels";

export type OutlineMode = "inside" | "outside" | "center";

function isOpaque(pixel: RGBA | null): boolean {
  return !!pixel && pixel.a > 0;
}

function hasNeighborWithState(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  predicate: (rgba: RGBA | null) => boolean
): boolean {
  const neighbors = [
    { x: x - 1, y },
    { x: x + 1, y },
    { x, y: y - 1 },
    { x, y: y + 1 },
  ];
  return neighbors.some((pos) => predicate(getPixel(buffer, width, height, pos.x, pos.y)));
}

/**
 * Smart outline generator.
 *
 * We detect edge pixels by checking 4-neighborhood connectivity to avoid
 * diagonal "halo" artifacts. The outline is applied by mode:
 * - inside: only recolor existing opaque edge pixels.
 * - outside: only paint transparent neighbors around opaque pixels.
 * - center: apply both inside and outside for a centered stroke.
 */
export function applySmartOutline(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  color: RGBA,
  mode: OutlineMode
): Uint8ClampedArray {
  const source = cloneBuffer(buffer);
  const result = cloneBuffer(buffer);
  const includeInside = mode === "inside" || mode === "center";
  const includeOutside = mode === "outside" || mode === "center";

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = getPixel(source, width, height, x, y);
      const opaque = isOpaque(pixel);

      if (includeInside && opaque) {
        const touchesTransparent = hasNeighborWithState(
          source,
          width,
          height,
          x,
          y,
          (rgba) => !isOpaque(rgba)
        );
        if (touchesTransparent) {
          setPixel(result, width, height, x, y, color);
        }
      }

      if (includeOutside && !opaque) {
        const touchesOpaque = hasNeighborWithState(
          source,
          width,
          height,
          x,
          y,
          (rgba) => isOpaque(rgba)
        );
        if (touchesOpaque) {
          setPixel(result, width, height, x, y, color);
        }
      }
    }
  }

  return result;
}
