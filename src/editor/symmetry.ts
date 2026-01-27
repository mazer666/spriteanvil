import { RGBA, setPixel } from "./pixels";

export type SymmetryMode = "none" | "horizontal" | "vertical" | "both" | "radial4" | "radial8";

export function applySymmetry(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  color: RGBA,
  mode: SymmetryMode,
  centerX?: number,
  centerY?: number
): boolean {
  let changed = false;
  const cx = centerX ?? Math.floor(width / 2);
  const cy = centerY ?? Math.floor(height / 2);

  changed = setPixel(buffer, width, height, x, y, color) || changed;

  if (mode === "horizontal" || mode === "both") {
    const mirrorX = 2 * cx - x;
    changed = setPixel(buffer, width, height, mirrorX, y, color) || changed;
  }

  if (mode === "vertical" || mode === "both") {
    const mirrorY = 2 * cy - y;
    changed = setPixel(buffer, width, height, x, mirrorY, color) || changed;
  }

  if (mode === "both") {
    const mirrorX = 2 * cx - x;
    const mirrorY = 2 * cy - y;
    changed = setPixel(buffer, width, height, mirrorX, mirrorY, color) || changed;
  }

  if (mode === "radial4") {
    const dx = x - cx;
    const dy = y - cy;

    changed = setPixel(buffer, width, height, cx - dy, cy + dx, color) || changed;
    changed = setPixel(buffer, width, height, cx - dx, cy - dy, color) || changed;
    changed = setPixel(buffer, width, height, cx + dy, cy - dx, color) || changed;
  }

  if (mode === "radial8") {
    const dx = x - cx;
    const dy = y - cy;

    changed = setPixel(buffer, width, height, cx + dy, cy + dx, color) || changed;
    changed = setPixel(buffer, width, height, cx - dy, cy + dx, color) || changed;
    changed = setPixel(buffer, width, height, cx + dy, cy - dx, color) || changed;
    changed = setPixel(buffer, width, height, cx - dy, cy - dx, color) || changed;
    changed = setPixel(buffer, width, height, cx - dx, cy + dy, color) || changed;
    changed = setPixel(buffer, width, height, cx - dx, cy - dy, color) || changed;
    changed = setPixel(buffer, width, height, cx + dx, cy - dy, color) || changed;
  }

  return changed;
}

export function drawSymmetryGuides(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mode: SymmetryMode,
  zoom: number,
  centerX?: number,
  centerY?: number
) {
  if (mode === "none") return;

  const cx = (centerX ?? Math.floor(width / 2)) * zoom;
  const cy = (centerY ?? Math.floor(height / 2)) * zoom;

  ctx.save();
  ctx.strokeStyle = "rgba(255, 0, 255, 0.5)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  if (mode === "horizontal" || mode === "both") {
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, height * zoom);
    ctx.stroke();
  }

  if (mode === "vertical" || mode === "both") {
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(width * zoom, cy);
    ctx.stroke();
  }

  if (mode === "radial4" || mode === "radial8") {
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, height * zoom);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(width * zoom, cy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width * zoom, height * zoom);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(width * zoom, 0);
    ctx.lineTo(0, height * zoom);
    ctx.stroke();

    const radius = Math.min(width, height) * zoom / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
