/**
 * src/utils/colors.ts
 * -----------------------------------------------------------------------------
 * ## COLOR UTILITIES (Noob Guide)
 * 
 * This file is the "Color Palette Decoder".
 * 
 * ## JARGON GLOSSARY
 * 1. HEX: A color code starting with # (e.g., #FF0000).
 * 2. LUMA: Perceived brightness. Some colors (like Yellow) look 
 *    brighter than others (like Blue) even if they have the same numbers.
 * 3. LERP: Linear Interpolation. Picking a color halfway between two others.
 * 4. ALPHA: Transparency. 0 is clear, 1.0 (or 255) is solid.
 * 
 * ## VISUAL FLOW (Mermaid)
 * ```mermaid
 * graph LR
 *   H[Hex String #FF0000] --> P[Parse 2-char Chunks]
 *   P --> R[Convert Hex to Int]
 *   R --> O[RGBA Object {255, 0, 0, 255}]
 * ```
 * 
 * ## VAR TRACE
 * - `hex`: (Origin: PalettePanel / ColorPicker) The string starting with '#'.
 * - `rgba`: (Origin: pixels.ts / buffers) A storage-ready color object.
 * - `l` (Lightness): (Origin: ColorAdjustPanel) Used to check if color is light/dark.
 */

import { RGBA } from "../editor/pixels"

/**
 * RGB color (no alpha channel)
 */
export interface RGB {
  r: number // 0-255
  g: number // 0-255
  b: number // 0-255
}

/**
 * HSL color representation
 * - Hue: Color wheel position (0-360 degrees)
 * - Saturation: Color intensity (0-100%)
 * - Lightness: Brightness (0-100%)
 */
export interface HSL {
  h: number // 0-360
  s: number // 0-100
  l: number // 0-100
}

/**
 * HSV color representation (similar to HSL but different lightness model)
 * - Hue: Color wheel position (0-360 degrees)
 * - Saturation: Color intensity (0-100%)
 * - Value: Brightness (0-100%)
 */
export interface HSV {
  h: number // 0-360
  s: number // 0-100
  v: number // 0-100
}

/**
 * Converts hex color string to RGB
 *
 * @param hex - Hex color string (e.g., "#FF0000" or "#F00")
 * @returns RGB object, or null if invalid
 *
 * @example
 * hexToRgb("#FF0000") // { r: 255, g: 0, b: 0 }
 * hexToRgb("#F00")    // { r: 255, g: 0, b: 0 }
 * hexToRgb("invalid") // null
 */
export function hexToRgb(hex: string): RGB | null {
  const h = hex.trim()

  // Support both #RGB and #RRGGBB formats
  if (/^#[0-9a-fA-F]{3}$/.test(h)) {
    // Short format: #RGB -> #RRGGBB
    const r = parseInt(h[1] + h[1], 16)
    const g = parseInt(h[2] + h[2], 16)
    const b = parseInt(h[3] + h[3], 16)
    return { r, g, b }
  }

  if (/^#[0-9a-fA-F]{6}$/.test(h)) {
    // Full format: #RRGGBB
    const r = parseInt(h.slice(1, 3), 16)
    const g = parseInt(h.slice(3, 5), 16)
    const b = parseInt(h.slice(5, 7), 16)
    return { r, g, b }
  }

  return null
}

/**
 * Converts RGB to hex color string
 *
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns Hex color string (e.g., "#FF0000")
 *
 * @example
 * rgbToHex(255, 0, 0)    // "#FF0000"
 * rgbToHex(0, 255, 0)    // "#00FF00"
 * rgbToHex(128, 128, 128) // "#808080"
 */
export function rgbToHex(r: number, g: number, b: number): string {
  // Clamp values to 0-255 and convert to hex
  const rr = clampByte(r).toString(16).padStart(2, "0")
  const gg = clampByte(g).toString(16).padStart(2, "0")
  const bb = clampByte(b).toString(16).padStart(2, "0")
  return `#${rr}${gg}${bb}`.toUpperCase()
}

/**
 * Converts RGBA to hex with alpha
 *
 * @param rgba - RGBA color object
 * @returns Hex color string with alpha (e.g., "#FF0000FF")
 *
 * @example
 * rgbaToHex({ r: 255, g: 0, b: 0, a: 255 })  // "#FF0000FF"
 * rgbaToHex({ r: 255, g: 0, b: 0, a: 128 })  // "#FF000080"
 */
export function rgbaToHex(rgba: RGBA): string {
  const hex = rgbToHex(rgba.r, rgba.g, rgba.b)
  const aa = clampByte(rgba.a).toString(16).padStart(2, "0")
  return `${hex}${aa}`.toUpperCase()
}

/**
 * Converts RGB to HSL
 *
 * HSL is useful for color pickers because:
 * - Hue represents the actual color (red, blue, green, etc.)
 * - Saturation controls how vivid the color is
 * - Lightness controls how bright/dark it is
 *
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns HSL object
 *
 * @example
 * rgbToHsl(255, 0, 0) // { h: 0, s: 100, l: 50 } (pure red)
 * rgbToHsl(128, 128, 128) // { h: 0, s: 0, l: 50 } (gray)
 */
export function rgbToHsl(r: number, g: number, b: number): HSL {
  // Normalize RGB values to 0-1 range
  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255

  const max = Math.max(rNorm, gNorm, bNorm)
  const min = Math.min(rNorm, gNorm, bNorm)
  const delta = max - min

  // Calculate lightness (average of max and min)
  let l = (max + min) / 2

  // Calculate saturation
  let s = 0
  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  }

  // Calculate hue
  let h = 0
  if (delta !== 0) {
    if (max === rNorm) {
      h = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)) / 6
    } else if (max === gNorm) {
      h = ((bNorm - rNorm) / delta + 2) / 6
    } else {
      h = ((rNorm - gNorm) / delta + 4) / 6
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

/**
 * Converts HSL to RGB
 *
 * @param h - Hue (0-360)
 * @param s - Saturation (0-100)
 * @param l - Lightness (0-100)
 * @returns RGB object
 *
 * @example
 * hslToRgb(0, 100, 50)   // { r: 255, g: 0, b: 0 } (red)
 * hslToRgb(120, 100, 50) // { r: 0, g: 255, b: 0 } (green)
 */
export function hslToRgb(h: number, s: number, l: number): RGB {
  // Normalize values
  h = h % 360
  s = Math.max(0, Math.min(100, s)) / 100
  l = Math.max(0, Math.min(100, l)) / 100

  // Helper function for hue to RGB conversion
  const hueToRgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  let r: number, g: number, b: number

  if (s === 0) {
    // Grayscale
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    const hNorm = h / 360

    r = hueToRgb(p, q, hNorm + 1 / 3)
    g = hueToRgb(p, q, hNorm)
    b = hueToRgb(p, q, hNorm - 1 / 3)
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  }
}

/**
 * Blends two colors using alpha compositing
 *
 * This is the standard "over" blend mode used in most graphics software.
 * The foreground color is placed "over" the background color, with alpha
 * determining how much of each shows through.
 *
 * @param fg - Foreground color (drawn on top)
 * @param bg - Background color (drawn underneath)
 * @returns Blended RGBA color
 *
 * @example
 * // Semi-transparent red over white
 * blendColors(
 *   { r: 255, g: 0, b: 0, a: 128 },
 *   { r: 255, g: 255, b: 255, a: 255 }
 * ) // Results in pink
 */
export function blendColors(fg: RGBA, bg: RGBA): RGBA {
  // Normalize alpha to 0-1 range
  const fgAlpha = fg.a / 255
  const bgAlpha = bg.a / 255

  // Calculate output alpha using "over" operator
  const outAlpha = fgAlpha + bgAlpha * (1 - fgAlpha)

  // Avoid division by zero
  if (outAlpha === 0) {
    return { r: 0, g: 0, b: 0, a: 0 }
  }

  // Blend each color channel
  const r = (fg.r * fgAlpha + bg.r * bgAlpha * (1 - fgAlpha)) / outAlpha
  const g = (fg.g * fgAlpha + bg.g * bgAlpha * (1 - fgAlpha)) / outAlpha
  const b = (fg.b * fgAlpha + bg.b * bgAlpha * (1 - fgAlpha)) / outAlpha

  return {
    r: Math.round(r),
    g: Math.round(g),
    b: Math.round(b),
    a: Math.round(outAlpha * 255)
  }
}

/**
 * Calculates perceived brightness of a color
 *
 * Uses the relative luminance formula from WCAG (Web Content Accessibility Guidelines).
 * This gives a better approximation of how humans perceive brightness than
 * simple averaging, because our eyes are more sensitive to green than red or blue.
 *
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns Brightness value (0-255)
 *
 * @example
 * getBrightness(255, 255, 0)   // ~237 (yellow is bright)
 * getBrightness(0, 0, 255)     // ~29 (blue is dark to our eyes)
 */
export function getBrightness(r: number, g: number, b: number): number {
  // Relative luminance formula (ITU-R BT.709)
  // Human eyes are most sensitive to green, then red, then blue
  return r * 0.299 + g * 0.587 + b * 0.114
}

/**
 * Determines if a color is "light" or "dark"
 *
 * Useful for deciding whether to use black or white text on a colored background.
 *
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @param threshold - Brightness threshold (default: 128)
 * @returns true if color is light, false if dark
 *
 * @example
 * isLightColor(255, 255, 255) // true (white)
 * isLightColor(0, 0, 0)       // false (black)
 * isLightColor(255, 255, 0)   // true (yellow)
 */
export function isLightColor(r: number, g: number, b: number, threshold = 128): boolean {
  return getBrightness(r, g, b) > threshold
}

/**
 * Inverts a color (negative)
 *
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns Inverted RGB color
 *
 * @example
 * invertColor(255, 0, 0) // { r: 0, g: 255, b: 255 } (red -> cyan)
 * invertColor(0, 0, 0)   // { r: 255, g: 255, b: 255 } (black -> white)
 */
export function invertColor(r: number, g: number, b: number): RGB {
  return {
    r: 255 - r,
    g: 255 - g,
    b: 255 - b
  }
}

/**
 * Clamps a value to byte range (0-255)
 *
 * @param value - Value to clamp
 * @returns Clamped value
 */
function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

/**
 * Compares two RGBA colors for equality
 *
 * @param a - First color
 * @param b - Second color
 * @returns true if colors are identical
 *
 * @example
 * colorsEqual({ r: 255, g: 0, b: 0, a: 255 }, { r: 255, g: 0, b: 0, a: 255 }) // true
 * colorsEqual({ r: 255, g: 0, b: 0, a: 255 }, { r: 255, g: 0, b: 0, a: 128 }) // false
 */
export function colorsEqual(a: RGBA, b: RGBA): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a
}

/**
 * Creates an RGBA color from individual components
 *
 * @param r - Red (0-255)
 * @param g - Green (0-255)
 * @param b - Blue (0-255)
 * @param a - Alpha (0-255), default 255 (opaque)
 * @returns RGBA object
 */
export function rgba(r: number, g: number, b: number, a = 255): RGBA {
  return {
    r: clampByte(r),
    g: clampByte(g),
    b: clampByte(b),
    a: clampByte(a)
  }
}
