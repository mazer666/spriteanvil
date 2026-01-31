/**
 * src/editor/tools/lasso.ts
 * -----------------------------------------------------------------------------
 * ## LASSO SELECTION (Noob Guide)
 * 
 * Lasso is a "Freehand" selection tool.
 * 
 * ## JARGON GLOSSARY
 * 1. PATH: The list of every mouse coordinate you touched while dragging.
 * 2. POLYGON: A shape made of many straight lines (or one freehand path).
 * 3. POINT-IN-POLYGON: The math that checks if a pixel is inside your 
 *    freehand loop.
 * 4. MASK: A 1-bit piece of data (0 or 1) per pixel that says it's selected.
 * 
 * ## VISUAL FLOW (Mermaid)
 * ```mermaid
 * graph TD
 *   A[Mouse Drag] --> B[Record Points]
 *   B --> C[Mouse Up]
 *   C --> D[Loop Entire Canvas]
 *   D --> E{Point in Polygon?}
 *   E -- Yes --> F[Set Mask Bit to 1]
 *   E -- No --> G[Set Mask Bit to 0]
 *   G --> H[Next Pixel]
 *   F --> H
 *   H --> D
 * ```
 */
/**
 * WHAT: Creates a "Selection Mask" based on a freehand loop drawn by the user.
 * WHY: To let users select irregular shapes (like a character's hair or a tree) that boxes can't handle.
 * HOW: It loops through every pixel on the canvas and asks: "Are you inside the loop?".
 * USE: Call this after the user releases the mouse with the Lasso Tool.
 * RATIONALE: We create a 1-bit mask (Uint8Array) because it's memory efficient and easy to check against during drawing operations.
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

/**
 * WHAT: The core math that decides if a pixel is "Inside" or "Outside" a loop.
 * WHY: Computers need a mathematical way to understand "Enclosed Areas".
 * HOW: It uses the "Ray Casting" algorithm. It draws an imaginary line to the right of the pixel. If that line crosses the polygon boundary an ODD number of times, the pixel is inside!
 * USE: Internal helper for selection tools.
 * 
 * ASCII VISUAL:
 * [P] --------> Cross (Inside!)
 * [ ] [Loop]
 * [ ] --------> No Cross (Outside!)
 */
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
