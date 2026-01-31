/**
 * src/editor/tools/shapes.ts
 * -----------------------------------------------------------------------------
 * ## SHAPE TOOLS (Noob Guide)
 * 
 * Shape tools help you draw perfect Boxes, Circles, and Ovals.
 * 
 * 1. THE MATH: Computers use geometry to decide which pixels to color. 
 *    For a box, it's easy: just color everything between X and Y.
 * 
 * 2. THE CIRCLE (Bresenham): Drawing circles is harder! We use a famous 
 *    algorithm that calculates 1/8th of the circle and then "mirrors" it 
 *    to finish the rest, ensuring it looks perfectly round.
 * 
 * 3. FILL vs OUTLINE: 
 *    - Outline: Only the border is painted.
 *    - Filled: Everything inside the border is also painted.
 */

import { RGBA, setPixel, drawLine } from "../pixels"

/**
 * Draws a rectangle outline
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
 * Draws a filled rectangle
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
 * Draws a circle outline using Bresenham's circle algorithm
 *
 * This is the standard algorithm for drawing pixel-perfect circles.
 * It uses only integer arithmetic and draws 8 points per iteration
 * by exploiting circle symmetry.
 *
 * ## How it works:
 *
 * A circle has 8-way symmetry:
 * ```
 *     (x,y)   (y,x)
 *   ●-----------●
 *   |           |
 *   |     ●     |  (circle center)
 *   |           |
 *   ●-----------●
 * (-y,x) (-x,y)
 * ```
 *
 * We only need to calculate 1/8th of the circle, then mirror it
 * to get all 8 octants.
 *
 * @param buffer - Pixel buffer (modified in place)
 * @param width - Buffer width
 * @param height - Buffer height
 * @param cx - Center X coordinate
 * @param cy - Center Y coordinate
 * @param radius - Circle radius in pixels
 * @param color - Stroke color
 * @returns true if any pixels changed
 *
 * @example
 * // Draw a circle with radius 10 at center (32,32)
 * drawCircle(buffer, 64, 64, 32, 32, 10, { r: 255, g: 0, b: 0, a: 255 })
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
 * Draws a filled circle
 *
 * Similar to circle outline but fills horizontal spans instead of
 * drawing individual points.
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
 * Draws an ellipse outline using midpoint ellipse algorithm
 *
 * Similar to circle algorithm but handles different x and y radii.
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
 * Draws a filled ellipse
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
