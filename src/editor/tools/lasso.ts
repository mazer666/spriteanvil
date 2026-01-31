/**
 * src/editor/tools/lasso.ts
 * -----------------------------------------------------------------------------
 * ## LASSO SELECTION (Noob Guide)
 * 
 * Lasso is a "Freehand" selection tool.
 * 
 * 1. THE PATH: As you move the mouse, we record every point you touch.
 * 2. THE POLYGON: Once you let go, we connect the start and end to create 
 *     a closed shape (a polygon).
 * 3. THE MASK: We check every pixel on the canvas to see if it's "Inside" 
 *    or "Outside" that polygon. If it's inside, it becomes selected!
 */
export function createLassoSelection(
  width: number,
  height: number,
  points: { x: number; y: number }[]
): Uint8Array {
  const selection = new Uint8Array(width * height);

  if (points.length < 3) return selection;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isPointInPolygon(x, y, points)) {
        selection[y * width + x] = 1;
      }
    }
  }

  return selection;
}

function isPointInPolygon(x: number, y: number, polygon: { x: number; y: number }[]): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

export function smoothLassoPoints(
  points: { x: number; y: number }[],
  windowSize: number = 5
): { x: number; y: number }[] {
  if (points.length < windowSize) return points;

  const smoothed: { x: number; y: number }[] = [];

  for (let i = 0; i < points.length; i++) {
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    const halfWindow = Math.floor(windowSize / 2);

    for (let j = -halfWindow; j <= halfWindow; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < points.length) {
        sumX += points[idx].x;
        sumY += points[idx].y;
        count++;
      }
    }

    smoothed.push({
      x: Math.round(sumX / count),
      y: Math.round(sumY / count),
    });
  }

  return smoothed;
}
