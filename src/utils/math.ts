/**
 * src/utils/math.ts
 * -----------------------------------------------------------------------------
 * ## MATH UTILITIES (Noob Guide)
 * 
 * This is the "Geometry Teacher". It handles the calculations 
 * for shapes, distances, and angles.
 * 
 * 1. CLAMPING: Keeps numbers within bounds (e.g., "Don't go past 100%").
 * 2. LERP: Short for "Linear Interpolation". It finds the point 
 *    exactly "between" two other points.
 * 3. DISTANCE: Real-world geometry (A² + B² = C²) used to check 
 *    if your mouse is inside a circle or near a line.
 * 
 * ## VAR TRACE
 * - `t`: (Origin: Animation tweening) A value from 0 to 1 representing time.
 * - `angleDegrees`: (Origin: Symmetry settings) How much to rotate a point.
 * - `rect`: (Origin: Selection bounds) A box defined by X, Y, Width, Height.
 */

/**
 * 2D point or vector
 */
export interface Point {
  x: number
  y: number
}

/**
 * Rectangle defined by top-left corner and dimensions
 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Clamps a number to a range
 *
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 *
 * @example
 * clamp(150, 0, 100) // 100
 * clamp(50, 0, 100)  // 50
 * clamp(-10, 0, 100) // 0
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Linear interpolation between two values
 *
 * @param a - Start value
 * @param b - End value
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated value
 *
 * @example
 * lerp(0, 100, 0.5)  // 50
 * lerp(0, 100, 0.25) // 25
 * lerp(0, 100, 0)    // 0
 * lerp(0, 100, 1)    // 100
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Calculates distance between two points
 *
 * Uses the Pythagorean theorem: distance = √(dx² + dy²)
 *
 * @param x1 - First point X
 * @param y1 - First point Y
 * @param x2 - Second point X
 * @param y2 - Second point Y
 * @returns Distance between points
 *
 * @example
 * distance(0, 0, 3, 4) // 5
 * distance(0, 0, 0, 5) // 5
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculates squared distance (faster than distance)
 *
 * Use this when you only need to compare distances, not the actual value.
 * Avoids expensive Math.sqrt() call.
 *
 * @param x1 - First point X
 * @param y1 - First point Y
 * @param x2 - Second point X
 * @param y2 - Second point Y
 * @returns Squared distance
 *
 * @example
 * distanceSquared(0, 0, 3, 4) // 25 (instead of 5)
 */
export function distanceSquared(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  return dx * dx + dy * dy
}

/**
 * Checks if a point is inside a rectangle
 *
 * @param px - Point X
 * @param py - Point Y
 * @param rect - Rectangle to test
 * @returns true if point is inside rectangle
 *
 * @example
 * pointInRect(5, 5, { x: 0, y: 0, width: 10, height: 10 }) // true
 * pointInRect(15, 5, { x: 0, y: 0, width: 10, height: 10 }) // false
 */
export function pointInRect(px: number, py: number, rect: Rect): boolean {
  return px >= rect.x && px < rect.x + rect.width && py >= rect.y && py < rect.y + rect.height
}

/**
 * Checks if a point is inside a circle
 *
 * @param px - Point X
 * @param py - Point Y
 * @param cx - Circle center X
 * @param cy - Circle center Y
 * @param radius - Circle radius
 * @returns true if point is inside circle
 *
 * @example
 * pointInCircle(3, 4, 0, 0, 5) // true (distance is 5, on the edge)
 * pointInCircle(3, 4, 0, 0, 3) // false (distance is 5, outside)
 */
export function pointInCircle(
  px: number,
  py: number,
  cx: number,
  cy: number,
  radius: number
): boolean {
  return distanceSquared(px, py, cx, cy) <= radius * radius
}

/**
 * Normalizes an angle to 0-360 range
 *
 * @param degrees - Angle in degrees
 * @returns Normalized angle (0-360)
 *
 * @example
 * normalizeAngle(370) // 10
 * normalizeAngle(-10) // 350
 */
export function normalizeAngle(degrees: number): number {
  degrees = degrees % 360
  if (degrees < 0) degrees += 360
  return degrees
}

/**
 * Converts degrees to radians
 *
 * @param degrees - Angle in degrees
 * @returns Angle in radians
 */
export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Converts radians to degrees
 *
 * @param radians - Angle in radians
 * @returns Angle in degrees
 */
export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI
}

/**
 * Snaps a value to the nearest multiple of step
 *
 * Useful for grid snapping, angle snapping, etc.
 *
 * @param value - Value to snap
 * @param step - Step size
 * @returns Snapped value
 *
 * @example
 * snapToGrid(23, 8)  // 24
 * snapToGrid(23, 16) // 16
 * snapToGrid(45, 15) // 45 (already on grid)
 */
export function snapToGrid(value: number, step: number): number {
  return Math.round(value / step) * step
}

/**
 * Checks if two rectangles intersect
 *
 * @param a - First rectangle
 * @param b - Second rectangle
 * @returns true if rectangles overlap
 */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  )
}

/**
 * Gets the intersection of two rectangles
 *
 * @param a - First rectangle
 * @param b - Second rectangle
 * @returns Intersection rectangle, or null if no intersection
 */
export function rectIntersection(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)

  const width = right - x
  const height = bottom - y

  if (width <= 0 || height <= 0) {
    return null
  }

  return { x, y, width, height }
}

/**
 * Calculates bounding box for a set of points
 *
 * @param points - Array of points
 * @returns Bounding rectangle, or null if no points
 *
 * @example
 * getBoundingBox([
 *   { x: 0, y: 0 },
 *   { x: 10, y: 5 },
 *   { x: 5, y: 10 }
 * ]) // { x: 0, y: 0, width: 10, height: 10 }
 */
export function getBoundingBox(points: Point[]): Rect | null {
  if (points.length === 0) return null

  let minX = points[0].x
  let minY = points[0].y
  let maxX = points[0].x
  let maxY = points[0].y

  for (let i = 1; i < points.length; i++) {
    const p = points[i]
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

/**
 * Rotates a point around another point
 *
 * @param px - Point X to rotate
 * @param py - Point Y to rotate
 * @param cx - Center X
 * @param cy - Center Y
 * @param angleDegrees - Rotation angle in degrees
 * @returns Rotated point
 *
 * @example
 * rotatePoint(10, 0, 0, 0, 90) // { x: 0, y: 10 }
 */
export function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  angleDegrees: number
): Point {
  const angleRad = degToRad(angleDegrees)
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)

  // Translate point to origin
  const translatedX = px - cx
  const translatedY = py - cy

  // Rotate
  const rotatedX = translatedX * cos - translatedY * sin
  const rotatedY = translatedX * sin + translatedY * cos

  // Translate back
  return {
    x: rotatedX + cx,
    y: rotatedY + cy
  }
}

/**
 * Generates a random integer in range [min, max] (inclusive)
 *
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Random integer
 *
 * @example
 * randomInt(1, 6) // Like rolling a die: 1, 2, 3, 4, 5, or 6
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Generates a random float in range [min, max)
 *
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Random float
 */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min
}
