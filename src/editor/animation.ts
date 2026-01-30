import { Frame } from "../types";

export type EasingCurve = "linear" | "easeInQuad" | "easeOutQuad" | "elastic";

export type TweenFrameData = {
  pixels: Uint8ClampedArray;
  durationMs: number;
  pivot?: { x: number; y: number };
};

/**
 * Pixel-art-safe easing functions.
 *
 * These curves operate on a normalized time value t ∈ [0, 1] and return a
 * normalized progress value also in [0, 1]. We intentionally avoid any
 * sub-pixel resampling: the easing only affects the interpolation weight and
 * we round channel values to integers, preserving crisp pixel edges.
 *
 * Math notes:
 * - Linear: f(t) = t
 * - EaseInQuad: f(t) = t^2 (accelerates from rest)
 * - EaseOutQuad: f(t) = t(2 - t) (decelerates into rest)
 * - Elastic: f(t) = sin(-13π/2 (t + 1)) · 2^{-10t} + 1
 *   This combines a damped exponential with a sine wave to overshoot and
 *   oscillate while still landing exactly at 1.
 */
export function applyEasing(t: number, curve: EasingCurve): number {
  const clamped = Math.min(1, Math.max(0, t));
  switch (curve) {
    case "easeInQuad":
      return clamped * clamped;
    case "easeOutQuad":
      return clamped * (2 - clamped);
    case "elastic":
      if (clamped === 0 || clamped === 1) return clamped;
      return Math.sin(-13 * Math.PI * 0.5 * (clamped + 1)) * Math.pow(2, -10 * clamped) + 1;
    case "linear":
    default:
      return clamped;
  }
}

function interpolateChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

export function interpolatePixelBuffers(
  start: Uint8ClampedArray,
  end: Uint8ClampedArray,
  width: number,
  height: number,
  count: number,
  curve: EasingCurve
): Uint8ClampedArray[] {
  if (count <= 0) return [];
  const totalPixels = width * height * 4;
  const results: Uint8ClampedArray[] = [];

  for (let i = 1; i <= count; i++) {
    const t = applyEasing(i / (count + 1), curve);
    const next = new Uint8ClampedArray(totalPixels);

    for (let p = 0; p < totalPixels; p += 4) {
      next[p + 0] = interpolateChannel(start[p + 0], end[p + 0], t);
      next[p + 1] = interpolateChannel(start[p + 1], end[p + 1], t);
      next[p + 2] = interpolateChannel(start[p + 2], end[p + 2], t);
      next[p + 3] = interpolateChannel(start[p + 3], end[p + 3], t);
    }

    results.push(next);
  }

  return results;
}

export function generateTweenFrames(
  start: Frame,
  end: Frame,
  width: number,
  height: number,
  count: number,
  curve: EasingCurve,
  fallbackPivot: { x: number; y: number }
): TweenFrameData[] {
  if (count <= 0) return [];

  const buffers = interpolatePixelBuffers(start.pixels, end.pixels, width, height, count, curve);
  const startPivot = start.pivot ?? fallbackPivot;
  const endPivot = end.pivot ?? fallbackPivot;

  return buffers.map((pixels, index) => {
    const t = applyEasing((index + 1) / (count + 1), curve);
    const durationMs = Math.round(start.durationMs + (end.durationMs - start.durationMs) * t);
    const pivot = {
      x: Math.round(startPivot.x + (endPivot.x - startPivot.x) * t),
      y: Math.round(startPivot.y + (endPivot.y - startPivot.y) * t),
    };
    return { pixels, durationMs, pivot };
  });
}
