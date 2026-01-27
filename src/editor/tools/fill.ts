/**
 * Fill Tool (Flood Fill / Bucket Fill)
 *
 * This module implements the classic flood fill algorithm used in paint programs.
 * When you click on a pixel, all connected pixels of the same color are filled
 * with the new color.
 *
 * ## How Flood Fill Works:
 *
 * 1. Start at the clicked pixel
 * 2. Remember what color we're replacing (target color)
 * 3. Fill this pixel with the new color
 * 4. Check all 4 neighbors (up, down, left, right)
 * 5. For each neighbor that matches the target color, repeat from step 3
 *
 * We use a "scanline" approach which is more efficient than naive recursive fill:
 * - Instead of filling one pixel at a time, we fill entire horizontal lines
 * - This reduces the number of pixels we need to check
 * - Much faster for large filled areas
 *
 * ## Visual Example:
 *
 * ```
 * Before:          After (clicked X):
 * . . . # # #      ■ ■ ■ # # #
 * . . . # # #      ■ ■ ■ # # #
 * . X . . # #  →   ■ ■ ■ ■ # #
 * . . . . . #      ■ ■ ■ ■ ■ #
 * # # # # # #      # # # # # #
 * ```
 *
 * @module editor/tools/fill
 */

import { RGBA, setPixel } from "../pixels"
import { colorsEqual } from "../../utils/colors"

/**
 * Gets the color of a pixel in the buffer
 *
 * @param buffer - Pixel buffer
 * @param width - Buffer width
 * @param height - Buffer height
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns RGBA color, or null if out of bounds
 */
function getPixelColor(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number
): RGBA | null {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return null
  }

  const index = (y * width + x) * 4
  return {
    r: buffer[index + 0],
    g: buffer[index + 1],
    b: buffer[index + 2],
    a: buffer[index + 3]
  }
}

/**
 * Flood fill algorithm using scanline method
 *
 * This fills all pixels connected to the start pixel that have the same
 * color as the start pixel.
 *
 * ## Algorithm Steps:
 *
 * 1. Get target color (color being replaced) at start position
 * 2. If target color equals fill color, do nothing (already filled)
 * 3. Create a queue of pixels to process
 * 4. For each pixel in queue:
 *    a. Extend left and right to fill entire scanline
 *    b. Check pixels above and below scanline
 *    c. Add matching pixels to queue
 * 5. Repeat until queue is empty
 *
 * ## Performance:
 *
 * - Time complexity: O(n) where n = number of pixels filled
 * - Space complexity: O(w) where w = width of canvas (scanline buffer)
 * - Much faster than recursive approach for large areas
 *
 * @param buffer - Pixel buffer (modified in place)
 * @param width - Buffer width
 * @param height - Buffer height
 * @param startX - Starting X coordinate
 * @param startY - Starting Y coordinate
 * @param fillColor - Color to fill with
 * @returns Number of pixels changed
 *
 * @example
 * // Fill area starting at (10, 20) with red
 * const pixelsChanged = floodFill(
 *   buffer,
 *   64,
 *   64,
 *   10,
 *   20,
 *   { r: 255, g: 0, b: 0, a: 255 }
 * )
 * console.log(`Filled ${pixelsChanged} pixels`)
 */
export function floodFill(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  fillColor: RGBA
): number {
  // Validate starting position
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) {
    return 0
  }

  // Get the target color (color we're replacing)
  const targetColor = getPixelColor(buffer, width, height, startX, startY)
  if (!targetColor) {
    return 0
  }

  // If target and fill colors are the same, nothing to do
  if (colorsEqual(targetColor, fillColor)) {
    return 0
  }

  let pixelsChanged = 0

  // Queue of pixels to process
  // Each entry is a point {x, y} that needs to be checked
  const queue: Array<{ x: number; y: number }> = []
  queue.push({ x: startX, y: startY })

  // Track which pixels we've already added to queue to avoid duplicates
  const visited = new Set<number>()
  visited.add(startY * width + startX)

  // Process queue until empty
  while (queue.length > 0) {
    const point = queue.shift()!
    let { x, y } = point

    // Check if this pixel still matches target color
    // (it might have been filled by a previous scanline)
    const currentColor = getPixelColor(buffer, width, height, x, y)
    if (!currentColor || !colorsEqual(currentColor, targetColor)) {
      continue
    }

    // Extend left to find start of scanline
    let leftX = x
    while (leftX > 0) {
      const leftColor = getPixelColor(buffer, width, height, leftX - 1, y)
      if (!leftColor || !colorsEqual(leftColor, targetColor)) {
        break
      }
      leftX--
    }

    // Extend right to find end of scanline
    let rightX = x
    while (rightX < width - 1) {
      const rightColor = getPixelColor(buffer, width, height, rightX + 1, y)
      if (!rightColor || !colorsEqual(rightColor, targetColor)) {
        break
      }
      rightX++
    }

    // Fill the entire scanline
    for (let fillX = leftX; fillX <= rightX; fillX++) {
      if (setPixel(buffer, width, height, fillX, y, fillColor)) {
        pixelsChanged++
      }
    }

    // Check pixels above and below the scanline
    // Add any matching pixels to the queue
    for (let fillX = leftX; fillX <= rightX; fillX++) {
      // Check pixel above
      if (y > 0) {
        const upColor = getPixelColor(buffer, width, height, fillX, y - 1)
        if (upColor && colorsEqual(upColor, targetColor)) {
          const key = (y - 1) * width + fillX
          if (!visited.has(key)) {
            visited.add(key)
            queue.push({ x: fillX, y: y - 1 })
          }
        }
      }

      // Check pixel below
      if (y < height - 1) {
        const downColor = getPixelColor(buffer, width, height, fillX, y + 1)
        if (downColor && colorsEqual(downColor, targetColor)) {
          const key = (y + 1) * width + fillX
          if (!visited.has(key)) {
            visited.add(key)
            queue.push({ x: fillX, y: y + 1 })
          }
        }
      }
    }
  }

  return pixelsChanged
}

/**
 * Flood fill with tolerance
 *
 * Similar to regular flood fill, but allows filling colors that are "close"
 * to the target color. Useful for anti-aliased images or gradients.
 *
 * @param buffer - Pixel buffer (modified in place)
 * @param width - Buffer width
 * @param height - Buffer height
 * @param startX - Starting X coordinate
 * @param startY - Starting Y coordinate
 * @param fillColor - Color to fill with
 * @param tolerance - How different colors can be (0-255, default: 0)
 * @returns Number of pixels changed
 *
 * @example
 * // Fill area with tolerance of 30 (will fill similar colors)
 * floodFillWithTolerance(buffer, 64, 64, 10, 20, red, 30)
 */
export function floodFillWithTolerance(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  fillColor: RGBA,
  tolerance: number
): number {
  // Validate starting position
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) {
    return 0
  }

  // Get the target color
  const targetColor = getPixelColor(buffer, width, height, startX, startY)
  if (!targetColor) {
    return 0
  }

  // Helper to check if color is within tolerance
  const colorMatches = (c: RGBA): boolean => {
    const dr = Math.abs(c.r - targetColor.r)
    const dg = Math.abs(c.g - targetColor.g)
    const db = Math.abs(c.b - targetColor.b)
    const da = Math.abs(c.a - targetColor.a)

    // Sum of differences must be within tolerance
    return dr + dg + db + da <= tolerance * 4
  }

  // If fill color matches target (within tolerance), nothing to do
  if (colorMatches(fillColor)) {
    return 0
  }

  let pixelsChanged = 0
  const queue: Array<{ x: number; y: number }> = []
  queue.push({ x: startX, y: startY })

  const visited = new Set<number>()
  visited.add(startY * width + startX)

  while (queue.length > 0) {
    const point = queue.shift()!
    let { x, y } = point

    const currentColor = getPixelColor(buffer, width, height, x, y)
    if (!currentColor || !colorMatches(currentColor)) {
      continue
    }

    // Extend left
    let leftX = x
    while (leftX > 0) {
      const leftColor = getPixelColor(buffer, width, height, leftX - 1, y)
      if (!leftColor || !colorMatches(leftColor)) {
        break
      }
      leftX--
    }

    // Extend right
    let rightX = x
    while (rightX < width - 1) {
      const rightColor = getPixelColor(buffer, width, height, rightX + 1, y)
      if (!rightColor || !colorMatches(rightColor)) {
        break
      }
      rightX++
    }

    // Fill scanline
    for (let fillX = leftX; fillX <= rightX; fillX++) {
      if (setPixel(buffer, width, height, fillX, y, fillColor)) {
        pixelsChanged++
      }
    }

    // Check neighbors
    for (let fillX = leftX; fillX <= rightX; fillX++) {
      if (y > 0) {
        const upColor = getPixelColor(buffer, width, height, fillX, y - 1)
        if (upColor && colorMatches(upColor)) {
          const key = (y - 1) * width + fillX
          if (!visited.has(key)) {
            visited.add(key)
            queue.push({ x: fillX, y: y - 1 })
          }
        }
      }

      if (y < height - 1) {
        const downColor = getPixelColor(buffer, width, height, fillX, y + 1)
        if (downColor && colorMatches(downColor)) {
          const key = (y + 1) * width + fillX
          if (!visited.has(key)) {
            visited.add(key)
            queue.push({ x: fillX, y: y + 1 })
          }
        }
      }
    }
  }

  return pixelsChanged
}
