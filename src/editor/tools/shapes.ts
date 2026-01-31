/**
 * src/editor/tools/shapes.ts
 * -----------------------------------------------------------------------------
 * ## SHAPE TOOLS (Noob Guide)
 * 
 * Shape tools help you draw perfect Boxes, Circles, and Ovals.
 * 
 * ## JARGON GLOSSARY
 * 1. BRESENHAM: A clever algorithm that draws curves using only simple 
 *    math, keeping them smooth at any zoom.
 * 2. OCTANT: 1/8th of a circle. We calculate one and flip it 7 times!
 * 3. MIDPOINT: The "Decision Point" that tells us if the next pixel 
 *    should be closer to the center or further away.
 * 
 *   F --> G[Full Smooth Circle]
 * ```
 * 
 * ## TECHNICAL SPECS
 * - No anti-aliasing - every pixel is either fully on or fully off.
 */

import { RGBA, setPixel, drawLine } from "../pixels"

/**
 * WHAT: Draws the outline of a box.
 * WHY: Perfect for UI borders, platforms in games, or house outlines.
 * HOW: It calls `drawLine` four times (once for each side: top, bottom, left, right).
 * USE: Call this when the user drags the mouse with the Rectangle Tool.
 * 
 * @param buffer - Pixel buffer (modified in place)
 * @param width - Buffer width
 * @param height - Buffer height
 * @param x - Top-left X coordinate
 * @param y - Top-left Y coordinate
 * @param w - Rectangle width
 * @param h - Rectangle height
 * @param color - Stroke color
 * @returns true if any pixels changed
 *
 * @example
 * // Draw a 10×10 rectangle at (5,5)
 * drawRectangle(buffer, 64, 64, 5, 5, 10, 10, { r: 255, g: 0, b: 0, a: 255 })
 */
export function drawRectangle(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: RGBA
): boolean {
  let changed = false

  // Top edge
  changed = drawLine(buffer, width, height, x, y, x + w - 1, y, color) || changed

  // Right edge
  changed = drawLine(buffer, width, height, x + w - 1, y, x + w - 1, y + h - 1, color) || changed

  // Bottom edge
  changed = drawLine(buffer, width, height, x + w - 1, y + h - 1, x, y + h - 1, color) || changed

  // Left edge
  changed = drawLine(buffer, width, height, x, y + h - 1, x, y, color) || changed

  return changed
}

/**
 * WHAT: Fills a solid box with color.
 * WHY: Much faster than drawing an outline and then using the Bucket Tool.
 * HOW: It loops through every X and Y coordinate inside the box and calls `setPixel`.
 * USE: Use this for backgrounds or solid game objects.
 * RATIONALE: A nested loop is the most efficient way to fill a simple geometric area.
 * 
 * @param buffer - Pixel buffer (modified in place)
 * @param width - Buffer width
 * @param height - Buffer height
 * @param x - Top-left X coordinate
 * @param y - Top-left Y coordinate
 * @param w - Rectangle width
 * @param h - Rectangle height
 * @param color - Fill color
 * @returns true if any pixels changed
 * 
 * @example
 * // Draw a filled 10×10 square
 * fillRectangle(buffer, 64, 64, 5, 5, 10, 10, { r: 255, g: 0, b: 0, a: 255 })
 * 
 * 🛠️ NOOB CHALLENGE: Can you modify this to draw a "checkerboard" pattern instead of a solid color? 
 * (Hint: use `(row + col) % 2 === 0`).
 */
export function fillRectangle(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: RGBA
): boolean {
  let changed = false

  // Fill row by row
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      if (setPixel(buffer, width, height, col, row, color)) {
        changed = true
      }
    }
  }

  return changed
}

/**
 * WHAT: Draws a pixel-perfect circle outline.
 * WHY: Drawing circles by hand is very hard. This ensures they look "Spherical" even at 10x10 pixels.
 * HOW: Use Bresenham's Circle Algorithm. It calculates one "slice" (octant) of the circle and mirrors it to the other 7 slices.
 * USE: Call this for round objects like balls, eyes, or gems.
 * RATIONALE: Mirroring math is much faster than calculating sines and cosines for every pixel.
 * 
 * ## TECHNICAL DETAILS
 * This is the standard algorithm for drawing pixel-perfect circles.
 * It uses only integer arithmetic and draws 8 points per iteration
 * by exploiting circle symmetry.
 *
 * ASCII VISUAL (8-Way Symmetry):
 *     (x,y)   (y,x)
 *   ●-----------●
 *   | \       / |
 *   |   \   /   |
 * (-y,x) -●- (y,-x)
 */
export function drawCircle(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  color: RGBA
): boolean {
  let changed = false

  // Start at top of circle
  let x = 0
  let y = radius

  // Initial decision parameter
  let d = 3 - 2 * radius

  // Helper to draw 8 symmetric points
  const drawSymmetricPoints = (px: number, py: number) => {
    // Draw all 8 octants
    changed = setPixel(buffer, width, height, cx + px, cy + py, color) || changed
    changed = setPixel(buffer, width, height, cx - px, cy + py, color) || changed
    changed = setPixel(buffer, width, height, cx + px, cy - py, color) || changed
    changed = setPixel(buffer, width, height, cx - px, cy - py, color) || changed
    changed = setPixel(buffer, width, height, cx + py, cy + px, color) || changed
    changed = setPixel(buffer, width, height, cx - py, cy + px, color) || changed
    changed = setPixel(buffer, width, height, cx + py, cy - px, color) || changed
    changed = setPixel(buffer, width, height, cx - py, cy - px, color) || changed
  }

  // Draw initial points
  drawSymmetricPoints(x, y)

  // Calculate circle points
  while (y >= x) {
    x++

    // Update decision parameter
    if (d > 0) {
      y--
      d = d + 4 * (x - y) + 10
    } else {
      d = d + 4 * x + 6
    }

    drawSymmetricPoints(x, y)
  }

  return changed
}

/**
 * WHAT: Fills a circular area with solid color.
 * WHY: Much cleaner than filling an outline with the bucket tool.
 * HOW: It loops through the circle's bounding box and uses the Distance Formula (x² + y² <= r²) to decide if a pixel is inside.
 * USE: Use this for solid round objects.
 * 
 * @param buffer - Pixel buffer (modified in place)
 * @param width - Buffer width
 * @param height - Buffer height
 * @param cx - Center X coordinate
 * @param cy - Center Y coordinate
 * @param radius - Circle radius in pixels
 * @param color - Fill color
 * @returns true if any pixels changed
 *
 * @example
 * // Draw a filled circle
 * fillCircle(buffer, 64, 64, 32, 32, 10, { r: 255, g: 0, b: 0, a: 255 })
 * 
 * ⚠️ WATCH OUT: For very large circles, this is slightly slower than a scanline-based fill.
 */
export function fillCircle(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  color: RGBA
): boolean {
  let changed = false

  // Simple approach: check each pixel in bounding box
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      // Check if point is inside circle using distance formula
      if (x * x + y * y <= radius * radius) {
        if (setPixel(buffer, width, height, cx + x, cy + y, color)) {
          changed = true
        }
      }
    }
  }

  return changed
}

/**
 * WHAT: Draws an oval (Ellipse) outline.
 * WHY: For heads, eggs, or stretched round shapes.
 * HOW: Midpoint Ellipse Algorithm. It handles different x and y radii and splits the 
 *      curve into two "Regions": Region 1 (Steep) and Region 2 (Flat).
 * USE: Call this when the user drags with the Ellipse tool.
 * 
 * @param buffer - Pixel buffer (modified in place)
 * @param width - Buffer width
 * @param height - Buffer height
 * @param cx - Center X coordinate
 * @param cy - Center Y coordinate
 * @param rx - X radius
 * @param ry - Y radius
 * @param color - Stroke color
 * @returns true if any pixels changed
 *
 * @example
 * // Draw an ellipse with rx=15, ry=10
 * drawEllipse(buffer, 64, 64, 32, 32, 15, 10, { r: 255, g: 0, b: 0, a: 255 })
 */
export function drawEllipse(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: RGBA
): boolean {
  let changed = false

  // Helper to draw 4 symmetric points
  const drawSymmetricPoints = (x: number, y: number) => {
    changed = setPixel(buffer, width, height, cx + x, cy + y, color) || changed
    changed = setPixel(buffer, width, height, cx - x, cy + y, color) || changed
    changed = setPixel(buffer, width, height, cx + x, cy - y, color) || changed
    changed = setPixel(buffer, width, height, cx - x, cy - y, color) || changed
  }

  // Region 1
  let x = 0
  let y = ry

  let rx2 = rx * rx
  let ry2 = ry * ry
  let twoRx2 = 2 * rx2
  let twoRy2 = 2 * ry2

  let px = 0
  let py = twoRx2 * y

  // Region 1 decision parameter
  let p = Math.round(ry2 - rx2 * ry + 0.25 * rx2)

  drawSymmetricPoints(x, y)

  // Region 1
  while (px < py) {
    x++
    px += twoRy2

    if (p < 0) {
      p += ry2 + px
    } else {
      y--
      py -= twoRx2
      p += ry2 + px - py
    }

    drawSymmetricPoints(x, y)
  }

  // Region 2 decision parameter
  p = Math.round(ry2 * (x + 0.5) * (x + 0.5) + rx2 * (y - 1) * (y - 1) - rx2 * ry2)

  // Region 2
  while (y > 0) {
    y--
    py -= twoRx2

    if (p > 0) {
      p += rx2 - py
    } else {
      x++
      px += twoRy2
      p += rx2 - py + px
    }

    drawSymmetricPoints(x, y)
  }

  return changed
}

/**
 * WHAT: Fills an oval area with solid color.
 * WHY: Much cleaner than filling an ellipse outline manually.
 * HOW: It uses the Ellipse Equation: (x/rx)² + (y/ry)² <= 1.
 * USE: Use this for solid oval shapes.
 * RATIONALE: This "Region Check" is simpler to understand for beginners than scanline algorithms.
 * 
 * @param buffer - Pixel buffer (modified in place)
 * @param width - Buffer width
 * @param height - Buffer height
 * @param cx - Center X coordinate
 * @param cy - Center Y coordinate
 * @param rx - X radius
 * @param ry - Y radius
 * @param color - Fill color
 * @returns true if any pixels changed
 *
 * @example
 * // Draw a filled ellipse
 * fillEllipse(buffer, 64, 64, 32, 32, 15, 10, { r: 255, g: 0, b: 0, a: 255 })
 * 
 * 🛠️ NOOB CHALLENGE: Can you rewrite this to draw ONLY a "Donut" (Hollow circle) by checking if the distance is BETWEEN two values?
 */
export function fillEllipse(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: RGBA
): boolean {
  let changed = false

  // Simple approach: check each pixel in bounding box
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      // Check if point is inside ellipse using ellipse equation
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) {
        if (setPixel(buffer, width, height, cx + x, cy + y, color)) {
          changed = true
        }
      }
    }
  }

  return changed
}
