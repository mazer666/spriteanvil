import { RGBA, setPixel } from "./pixels";

export type SymmetryMode = "none" | "horizontal" | "vertical" | "both" | "radial4" | "radial8";

export function getSymmetryPoints(
  width: number,
  height: number,
  x: number,
  y: number,
  mode: SymmetryMode,
  centerX?: number,
  centerY?: number
): { x: number; y: number }[] {
  const cx = centerX ?? Math.floor(width / 2);
  const cy = centerY ?? Math.floor(height / 2);

  const points = new Map<string, { x: number; y: number }>();

  function addPoint(px: number, py: number) {
    if (px < 0 || py < 0 || px >= width || py >= height) return;
    points.set(`${px},${py}`, { x: px, y: py });
  }

  addPoint(x, y);

  if (mode === "horizontal" || mode === "both") {
    addPoint(2 * cx - x, y);
  }

  if (mode === "vertical" || mode === "both") {
    addPoint(x, 2 * cy - y);
  }

  if (mode === "both") {
    addPoint(2 * cx - x, 2 * cy - y);
  }

  if (mode === "radial4" || mode === "radial8") {
    const dx = x - cx;
    const dy = y - cy;

    addPoint(cx - dy, cy + dx);
    addPoint(cx - dx, cy - dy);
    addPoint(cx + dy, cy - dx);

    if (mode === "radial8") {
      addPoint(cx + dy, cy + dx);
      addPoint(cx - dy, cy - dx);
      addPoint(cx - dx, cy + dy);
      addPoint(cx + dx, cy - dy);
    }
  }

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
  centerX?: number,
  centerY?: number
): boolean {
  let changed = false;
  const points = getSymmetryPoints(width, height, x, y, mode, centerX, centerY);
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
