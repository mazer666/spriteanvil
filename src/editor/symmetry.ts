/**
 * src/editor/symmetry.ts
 * -----------------------------------------------------------------------------
 * ## SYMMETRY (Noob Guide)
 * 
 * Symmetry is like drawing with a "Mirror".
 * 
 * 1. MIRRORING: If you draw a pixel on the Left, the computer automatically
 *    draws the exact same pixel on the Right (Horizontal) or Bottom (Vertical).
 * 
 * 2. RADIAL: This is like a kaleidoscope! It takes your one pixel and 
 *    rotates it around the center to create 4, 8, or even 32 copies at once.
 * 
 * 3. MATH: We use "Reflection Matrices" and "Rotation Math" (Sines and Cosines)
 *    to calculate where these extra pixels should go.
 */
import { RGBA, setPixel } from "./pixels";
import type { SymmetryMode } from "../types";

const DEG_TO_RAD = Math.PI / 180;

function rotatePoint(x: number, y: number, angleRad: number): { x: number; y: number } {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

/**
 * Reflect a point across an axis that passes through the center.
 *
 * Math note:
 * 1) Translate the point so the center is at the origin.
 * 2) Rotate the coordinate system by -θ so the axis aligns with the X axis.
 * 3) Reflect across the X axis (y -> -y).
 * 4) Rotate back by +θ and translate to the original center.
 */
function reflectAcrossAxis(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  axisAngleRad: number
): { x: number; y: number } {
  const dx = x - centerX;
  const dy = y - centerY;
  const cos = Math.cos(axisAngleRad);
  const sin = Math.sin(axisAngleRad);

  const rx = dx * cos + dy * sin;
  const ry = -dx * sin + dy * cos;

  const reflectedY = -ry;

  const ox = rx * cos - reflectedY * sin;
  const oy = rx * sin + reflectedY * cos;

  return { x: Math.round(centerX + ox), y: Math.round(centerY + oy) };
}

/**
 * Build symmetry transforms for mirror and radial modes.
 *
 * Radial math note:
 * A radial symmetry with N segments is equivalent to rotating a point around
 * the center by angles θ = k · (2π / N), for k ∈ [0, N-1]. Each rotation
 * produces a new symmetric point on the circle. We round to integer pixels to
 * keep the result pixel-art-safe (no sub-pixel sampling).
 */
export function getSymmetryTransforms(
  width: number,
  height: number,
  mode: SymmetryMode,
  axisAngleDeg: number,
  segments: number,
  centerX?: number,
  centerY?: number
): Array<(x: number, y: number) => { x: number; y: number }> {
  const cx = centerX ?? Math.floor(width / 2);
  const cy = centerY ?? Math.floor(height / 2);
  const transforms: Array<(x: number, y: number) => { x: number; y: number }> = [];
  const seen = new Set<string>();

  function addTransform(fn: (x: number, y: number) => { x: number; y: number }) {
    const sampleA = fn(0, 0);
    const sampleB = fn(1, 0);
    const key = `${sampleA.x},${sampleA.y}|${sampleB.x},${sampleB.y}`;
    if (seen.has(key)) return;
    seen.add(key);
    transforms.push(fn);
  }

  addTransform((x, y) => ({ x, y }));

  const axisAngleRad = axisAngleDeg * DEG_TO_RAD;
  const axisAngles: number[] = [];

  if (mode === "horizontal") {
    axisAngles.push(Math.PI / 2 + axisAngleRad);
  }
  if (mode === "vertical") {
    axisAngles.push(axisAngleRad);
  }
  if (mode === "both") {
    axisAngles.push(axisAngleRad);
    axisAngles.push(axisAngleRad + Math.PI / 2);
  }

  axisAngles.forEach((angle) => {
    addTransform((x, y) => reflectAcrossAxis(x, y, cx, cy, angle));
  });

  if (mode === "radial") {
    const count = Math.min(32, Math.max(2, Math.round(segments))); // safety clamp
    for (let i = 1; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      addTransform((x, y) => {
        const dx = x - cx;
        const dy = y - cy;
        const rotated = rotatePoint(dx, dy, angle);
        return { x: Math.round(cx + rotated.x), y: Math.round(cy + rotated.y) };
      });
    }
  }

  return transforms;
}

export function getSymmetryPoints(
  width: number,
  height: number,
  x: number,
  y: number,
  mode: SymmetryMode,
  axisAngleDeg: number,
  segments: number,
  centerX?: number,
  centerY?: number
): { x: number; y: number }[] {
  const transforms = getSymmetryTransforms(width, height, mode, axisAngleDeg, segments, centerX, centerY);
  const points = new Map<string, { x: number; y: number }>();

  transforms.forEach((transform) => {
    const point = transform(x, y);
    if (point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) return;
    points.set(`${point.x},${point.y}`, point);
  });

  return Array.from(points.values());
}

export function applySymmetry(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  color: RGBA,
  mode: SymmetryMode,
  axisAngleDeg: number,
  segments: number,
  centerX?: number,
  centerY?: number
): boolean {
  let changed = false;
  const points = getSymmetryPoints(width, height, x, y, mode, axisAngleDeg, segments, centerX, centerY);
  points.forEach((point) => {
    changed = setPixel(buffer, width, height, point.x, point.y, color) || changed;
  });
  return changed;
}

export function drawSymmetryGuides(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mode: SymmetryMode,
  zoom: number,
  axisAngleDeg: number,
  segments: number,
  centerX?: number,
  centerY?: number
) {
  if (mode === "none") return;

  const cx = (centerX ?? Math.floor(width / 2)) * zoom;
  const cy = (centerY ?? Math.floor(height / 2)) * zoom;
  const axisAngleRad = axisAngleDeg * DEG_TO_RAD;

  ctx.save();
  ctx.strokeStyle = "rgba(255, 0, 255, 0.45)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  function drawAxis(angleRad: number) {
    const dir = rotatePoint(1, 0, angleRad);
    const len = Math.max(width, height) * zoom;
    ctx.beginPath();
    ctx.moveTo(cx - dir.x * len, cy - dir.y * len);
    ctx.lineTo(cx + dir.x * len, cy + dir.y * len);
    ctx.stroke();
  }

  if (mode === "horizontal") {
    drawAxis(Math.PI / 2 + axisAngleRad);
  }
  if (mode === "vertical") {
    drawAxis(axisAngleRad);
  }
  if (mode === "both") {
    drawAxis(axisAngleRad);
    drawAxis(axisAngleRad + Math.PI / 2);
  }

  if (mode === "radial") {
    const count = Math.min(32, Math.max(2, Math.round(segments)));
    for (let i = 0; i < count; i++) {
      drawAxis(axisAngleRad + (Math.PI * 2 * i) / count);
    }
    const radius = Math.min(width, height) * zoom / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
