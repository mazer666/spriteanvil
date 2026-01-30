/**
 * Selection System
 *
 * This module implements selections - the ability to select a region of pixels
 * and perform operations on just that region (cut, copy, paste, transform, etc.)
 *
 * ## Selection Representation:
 *
 * Selections are stored as a boolean mask (Uint8Array):
 * - 1 byte per pixel (not 4 like RGBA)
 * - Value of 1 = pixel is selected
 * - Value of 0 = pixel is not selected
 *
 * This is much more memory-efficient than storing a list of selected pixels,
 * and makes selection operations very fast.
 *
 * ## Selection Operations:
 *
 * - Rectangle selection - Select a rectangular region
 * - Ellipse selection - Select an elliptical region
 * - Magic wand - Select connected pixels of similar color
 * - Lasso - Freehand selection
 * - Boolean operations - Combine selections (union, intersect, subtract)
 *
 * @module editor/selection
 */

import { RGBA } from "./pixels"
import { Rect, pointInCircle } from "../utils/math"

/**
 * Selection mask
 * - 1 byte per pixel
 * - 0 = not selected, 1 = selected
 */
export type SelectionMask = Uint8Array

/**
 * Creates an empty selection (nothing selected)
 *
 * @param width - Canvas width
 * @param height - Canvas height
 * @returns Empty selection mask
 */
export function createEmptySelection(width: number, height: number): SelectionMask {
  return new Uint8Array(width * height)
}

/**
 * Creates a full selection (everything selected)
 *
 * @param width - Canvas width
 * @param height - Canvas height
 * @returns Full selection mask
 */
export function createFullSelection(width: number, height: number): SelectionMask {
  const mask = new Uint8Array(width * height)
  mask.fill(1)
  return mask
}

/**
 * Checks if a selection is empty (nothing selected)
 *
 * @param mask - Selection mask
 * @returns true if no pixels are selected
 */
export function isSelectionEmpty(mask: SelectionMask): boolean {
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] !== 0) return false
  }
  return true
}

/**
 * Counts number of selected pixels
 *
 * @param mask - Selection mask
 * @returns Number of selected pixels
 */
export function countSelectedPixels(mask: SelectionMask): number {
  let count = 0
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] !== 0) count++
  }
  return count
}

/**
 * Clears selection (deselects all pixels)
 *
 * @param mask - Selection mask (modified in place)
 */
export function clearSelection(mask: SelectionMask): void {
  mask.fill(0)
}

/**
 * Inverts selection (selected becomes unselected and vice versa)
 *
 * @param mask - Selection mask (modified in place)
 */
export function invertSelection(mask: SelectionMask): void {
  for (let i = 0; i < mask.length; i++) {
    mask[i] = mask[i] === 0 ? 1 : 0
  }
}

/**
 * Creates a rectangular selection
 *
 * @param width - Canvas width
 * @param height - Canvas height
 * @param rect - Rectangle to select
 * @returns Selection mask
 *
 * @example
 * // Select a 10×10 rectangle at (5,5)
 * const mask = selectRectangle(64, 64, { x: 5, y: 5, width: 10, height: 10 })
 */
export function selectRectangle(width: number, height: number, rect: Rect): SelectionMask {
  const mask = createEmptySelection(width, height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height) {
        mask[y * width + x] = 1
      }
    }
  }

  return mask
}

/**
 * Creates an ellipse selection
 *
 * @param width - Canvas width
 * @param height - Canvas height
 * @param cx - Center X
 * @param cy - Center Y
 * @param rx - X radius
 * @param ry - Y radius
 * @returns Selection mask
 *
 * @example
 * // Select an ellipse with radii 15×10 at center (32,32)
 * const mask = selectEllipse(64, 64, 32, 32, 15, 10)
 */
export function selectEllipse(
  width: number,
  height: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number
): SelectionMask {
  const mask = createEmptySelection(width, height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Check if point is inside ellipse using ellipse equation
      const dx = x - cx
      const dy = y - cy
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
        mask[y * width + x] = 1
      }
    }
  }

  return mask
}

/**
 * Selects a connected opaque region starting at (x, y).
 *
 * This is useful for lightweight object detection without ML dependencies.
 * We treat any pixel with alpha > 0 as part of the object and flood-fill
 * 4-directionally to avoid diagonal leaks between separate shapes.
 */
export function selectConnectedOpaque(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number
): SelectionMask {
  const mask = createEmptySelection(width, height)
  if (x < 0 || y < 0 || x >= width || y >= height) return mask
  const startIdx = (y * width + x) * 4
  if (pixels[startIdx + 3] === 0) return mask

  const queue: Array<{ x: number; y: number }> = [{ x, y }]
  mask[y * width + x] = 1

  while (queue.length) {
    const { x: cx, y: cy } = queue.shift()!
    const neighbors = [
      { x: cx - 1, y: cy },
      { x: cx + 1, y: cy },
      { x: cx, y: cy - 1 },
      { x: cx, y: cy + 1 }
    ]
    neighbors.forEach((n) => {
      if (n.x < 0 || n.y < 0 || n.x >= width || n.y >= height) return
      const idx = n.y * width + n.x
      if (mask[idx]) return
      const pixelIdx = idx * 4
      if (pixels[pixelIdx + 3] === 0) return
      mask[idx] = 1
      queue.push(n)
    })
  }

  return mask
}

/**
 * Creates a circular selection
 *
 * @param width - Canvas width
 * @param height - Canvas height
 * @param cx - Center X
 * @param cy - Center Y
 * @param radius - Circle radius
 * @returns Selection mask
 */
export function selectCircle(
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number
): SelectionMask {
  const mask = createEmptySelection(width, height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pointInCircle(x, y, cx, cy, radius)) {
        mask[y * width + x] = 1
      }
    }
  }

  return mask
}

/**
 * Magic wand selection - selects connected pixels of similar color
 *
 * Similar to flood fill, but instead of filling with a color, we're
 * marking pixels as selected.
 *
 * @param buffer - Pixel buffer
 * @param width - Buffer width
 * @param height - Buffer height
 * @param startX - Starting X coordinate
 * @param startY - Starting Y coordinate
 * @param tolerance - Color tolerance (0-255)
 * @returns Selection mask
 *
 * @example
 * // Select all connected red pixels (with tolerance of 20)
 * const mask = selectMagicWand(buffer, 64, 64, 10, 10, 20)
 */
export function selectMagicWand(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  tolerance: number
): SelectionMask {
  const mask = createEmptySelection(width, height)

  // Validate starting position
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) {
    return mask
  }

  // Get target color
  const startIndex = (startY * width + startX) * 4
  const targetColor: RGBA = {
    r: buffer[startIndex + 0],
    g: buffer[startIndex + 1],
    b: buffer[startIndex + 2],
    a: buffer[startIndex + 3]
  }

  // Helper to check if color matches within tolerance
  const colorMatches = (x: number, y: number): boolean => {
    const index = (y * width + x) * 4
    const dr = Math.abs(buffer[index + 0] - targetColor.r)
    const dg = Math.abs(buffer[index + 1] - targetColor.g)
    const db = Math.abs(buffer[index + 2] - targetColor.b)
    const da = Math.abs(buffer[index + 3] - targetColor.a)
    return dr + dg + db + da <= tolerance * 4
  }

  // Flood fill algorithm
  const queue: Array<{ x: number; y: number }> = []
  queue.push({ x: startX, y: startY })
  mask[startY * width + startX] = 1

  while (queue.length > 0) {
    const { x, y } = queue.shift()!

    // Check all 4 neighbors
    const neighbors = [
      { x: x - 1, y },
      { x: x + 1, y },
      { x, y: y - 1 },
      { x, y: y + 1 }
    ]

    for (const neighbor of neighbors) {
      const { x: nx, y: ny } = neighbor

      // Check bounds
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue

      // Check if already selected
      if (mask[ny * width + nx] !== 0) continue

      // Check if color matches
      if (colorMatches(nx, ny)) {
        mask[ny * width + nx] = 1
        queue.push({ x: nx, y: ny })
      }
    }
  }

  return mask
}

/**
 * Boolean operation: Union (A + B)
 *
 * Adds selection B to selection A.
 * Result contains pixels selected in A OR B.
 *
 * @param maskA - First selection mask (modified in place)
 * @param maskB - Second selection mask
 */
export function selectionUnion(maskA: SelectionMask, maskB: SelectionMask): void {
  for (let i = 0; i < maskA.length; i++) {
    if (maskB[i] !== 0) {
      maskA[i] = 1
    }
  }
}

/**
 * Boolean operation: Intersection (A ∩ B)
 *
 * Keeps only pixels selected in both A AND B.
 *
 * @param maskA - First selection mask (modified in place)
 * @param maskB - Second selection mask
 */
export function selectionIntersection(maskA: SelectionMask, maskB: SelectionMask): void {
  for (let i = 0; i < maskA.length; i++) {
    if (maskA[i] !== 0 && maskB[i] === 0) {
      maskA[i] = 0
    }
  }
}

/**
 * Boolean operation: Subtraction (A - B)
 *
 * Removes selection B from selection A.
 * Result contains pixels selected in A but NOT in B.
 *
 * @param maskA - First selection mask (modified in place)
 * @param maskB - Second selection mask
 */
export function selectionSubtract(maskA: SelectionMask, maskB: SelectionMask): void {
  for (let i = 0; i < maskA.length; i++) {
    if (maskB[i] !== 0) {
      maskA[i] = 0
    }
  }
}

/**
 * Gets the bounding rectangle of a selection
 *
 * Finds the smallest rectangle that contains all selected pixels.
 *
 * @param mask - Selection mask
 * @param width - Canvas width
 * @param height - Canvas height
 * @returns Bounding rectangle, or null if selection is empty
 *
 * @example
 * const bounds = getSelectionBounds(mask, 64, 64)
 * if (bounds) {
 *   console.log(`Selection: ${bounds.width}×${bounds.height} at (${bounds.x},${bounds.y})`)
 * }
 */
export function getSelectionBounds(
  mask: SelectionMask,
  width: number,
  height: number
): Rect | null {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] !== 0) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }

  if (maxX === -1) {
    return null // Empty selection
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  }
}

/**
 * Checks if a pixel is selected
 *
 * @param mask - Selection mask
 * @param width - Canvas width
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns true if pixel is selected
 */
export function isPixelSelected(mask: SelectionMask, width: number, x: number, y: number): boolean {
  return mask[y * width + x] !== 0
}

/**
 * Selects a single pixel
 *
 * @param mask - Selection mask (modified in place)
 * @param width - Canvas width
 * @param x - X coordinate
 * @param y - Y coordinate
 */
export function selectPixel(mask: SelectionMask, width: number, x: number, y: number): void {
  mask[y * width + x] = 1
}

/**
 * Deselects a single pixel
 *
 * @param mask - Selection mask (modified in place)
 * @param width - Canvas width
 * @param x - X coordinate
 * @param y - Y coordinate
 */
export function deselectPixel(mask: SelectionMask, width: number, x: number, y: number): void {
  mask[y * width + x] = 0
}
