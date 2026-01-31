/**
 * src/utils/canvas.ts
 * -----------------------------------------------------------------------------
 * ## CANVAS UTILITIES (Noob Guide)
 * 
 * This file is the "Art Studio Assistant". It helps translate the 
 * raw numbers (bytes) into actual pictures on your screen using the 
 * browser's "Canvas API".
 * 
 * 1. THE BRIDGE: Computers store images as long lists of numbers. 
 *    These functions help "Draw" those numbers onto a Canvas element.
 * 2. OFFSCREEN: Sometimes we draw things "in our head" (Offscreen) 
 *    before showing them to the user to keep things smooth.
 * 3. GRID & CHECKER: These helpers draw the patterns behind your art 
 *    so you can see transparency and individual pixels.
 * 
 * ## VAR TRACE
 * - `buffer`: (Origin: App.tsx -> CanvasStage) The raw RGBA byte array.
 * - `ctx`: (Origin: Canvas element) The "Pen" used to draw on the canvas.
 * - `scale`: (Origin: settings.zoom) How big to draw each pixel.
 */

import { RGBA } from "../editor/pixels"

/**
 * Creates an offscreen canvas element
 *
 * Offscreen canvases are useful for:
 * - Pre-rendering complex graphics
 * - Creating temporary buffers for transformations
 * - Exporting images
 *
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 * @returns Offscreen canvas element
 *
 * @example
 * const canvas = createOffscreenCanvas(64, 64)
 * const ctx = canvas.getContext('2d')!
 * // ... draw on canvas ...
 * const dataUrl = canvas.toDataURL('image/png')
 */
export function createOffscreenCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  return canvas
}

/**
 * Converts a pixel buffer to ImageData
 *
 * ImageData is the browser's native format for pixel data.
 * This function creates an ImageData object from our buffer.
 *
 * @param buffer - Pixel buffer (RGBA format)
 * @param width - Width in pixels
 * @param height - Height in pixels
 * @returns ImageData object
 *
 * @example
 * const imageData = bufferToImageData(pixelBuffer, 64, 64)
 * ctx.putImageData(imageData, 0, 0)
 */
export function bufferToImageData(
  buffer: Uint8ClampedArray,
  width: number,
  height: number
): ImageData {
  return new ImageData(new Uint8ClampedArray(buffer), width, height)
}

/**
 * Converts ImageData to a pixel buffer
 *
 * @param imageData - ImageData from canvas
 * @returns Pixel buffer (RGBA format)
 *
 * @example
 * const imageData = ctx.getImageData(0, 0, 64, 64)
 * const buffer = imageDataToBuffer(imageData)
 */
export function imageDataToBuffer(imageData: ImageData): Uint8ClampedArray {
  return new Uint8ClampedArray(imageData.data)
}

/**
 * Draws a pixel buffer to a canvas
 *
 * This is the main function for rendering our pixel data to the screen.
 * It handles scaling and positioning.
 *
 * @param ctx - Canvas 2D rendering context
 * @param buffer - Pixel buffer to draw
 * @param bufferWidth - Width of the buffer in pixels
 * @param bufferHeight - Height of the buffer in pixels
 * @param x - X position on canvas
 * @param y - Y position on canvas
 * @param scale - Scaling factor (1 = actual size, 2 = 2x, etc.)
 *
 * @example
 * // Draw at 8x zoom, centered
 * drawBufferToCanvas(ctx, buffer, 64, 64, 256, 256, 8)
 */
export function drawBufferToCanvas(
  ctx: CanvasRenderingContext2D,
  buffer: Uint8ClampedArray,
  bufferWidth: number,
  bufferHeight: number,
  x: number,
  y: number,
  scale: number
): void {
  // Disable image smoothing for pixel-perfect rendering
  ctx.imageSmoothingEnabled = false

  // Create ImageData from buffer
  const imageData = bufferToImageData(buffer, bufferWidth, bufferHeight)

  // Draw to an offscreen canvas at native size
  const tempCanvas = createOffscreenCanvas(bufferWidth, bufferHeight)
  const tempCtx = tempCanvas.getContext("2d")!
  tempCtx.putImageData(imageData, 0, 0)

  // Draw the scaled image to the target canvas
  ctx.drawImage(tempCanvas, x, y, bufferWidth * scale, bufferHeight * scale)
}

/**
 * Draws a checkerboard pattern (for transparency visualization)
 *
 * The classic alternating squares pattern used to show transparency
 * in most image editors.
 *
 * @param ctx - Canvas 2D rendering context
 * @param x - X position
 * @param y - Y position
 * @param width - Width in pixels
 * @param height - Height in pixels
 * @param squareSize - Size of each square (default: 8)
 * @param color1 - First color (default: light gray)
 * @param color2 - Second color (default: white)
 *
 * @example
 * // Draw checkerboard behind sprite
 * drawCheckerboard(ctx, 0, 0, 512, 512, 16)
 */
export function drawCheckerboard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  squareSize = 8,
  color1 = "#CCCCCC",
  color2 = "#FFFFFF"
): void {
  ctx.fillStyle = color2
  ctx.fillRect(x, y, width, height)

  ctx.fillStyle = color1
  for (let row = 0; row < Math.ceil(height / squareSize); row++) {
    for (let col = 0; col < Math.ceil(width / squareSize); col++) {
      // Alternate pattern
      if ((row + col) % 2 === 0) {
        ctx.fillRect(x + col * squareSize, y + row * squareSize, squareSize, squareSize)
      }
    }
  }
}

/**
 * Draws a pixel grid overlay
 *
 * Shows lines between pixels, useful when zoomed in.
 *
 * @param ctx - Canvas 2D rendering context
 * @param x - X position
 * @param y - Y position
 * @param width - Width in pixels
 * @param height - Height in pixels
 * @param zoom - Zoom level (pixels will be zoom×zoom size)
 * @param gridSize - Grid spacing in pixels (default: 1 = every pixel)
 * @param color - Grid line color
 * @param lineWidth - Grid line width (default: 1)
 *
 * @example
 * // Draw 1px grid at 8x zoom
 * drawPixelGrid(ctx, 0, 0, 64, 64, 8, 1, 'rgba(0,0,0,0.2)')
 */
export function drawPixelGrid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  zoom: number,
  gridSize = 1,
  color = "rgba(0,0,0,0.15)",
  lineWidth = 1
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth

  const scaledWidth = width * zoom
  const scaledHeight = height * zoom
  const step = gridSize * zoom

  ctx.beginPath()

  // Vertical lines
  for (let col = 0; col <= width; col += gridSize) {
    const lineX = x + col * zoom
    ctx.moveTo(lineX, y)
    ctx.lineTo(lineX, y + scaledHeight)
  }

  // Horizontal lines
  for (let row = 0; row <= height; row += gridSize) {
    const lineY = y + row * zoom
    ctx.moveTo(x, lineY)
    ctx.lineTo(x + scaledWidth, lineY)
  }

  ctx.stroke()
}

/**
 * Exports canvas to a data URL
 *
 * @param canvas - Canvas element
 * @param mimeType - Image MIME type (default: 'image/png')
 * @param quality - JPEG quality 0-1 (only for image/jpeg)
 * @returns Data URL string
 *
 * @example
 * const dataUrl = canvasToDataURL(canvas)
 * downloadImage(dataUrl, 'my-sprite.png')
 */
export function canvasToDataURL(
  canvas: HTMLCanvasElement,
  mimeType = "image/png",
  quality = 1.0
): string {
  return canvas.toDataURL(mimeType, quality)
}

/**
 * Exports canvas to a Blob
 *
 * Blobs are better than data URLs for large images because they're more
 * memory-efficient and easier to upload to servers.
 *
 * @param canvas - Canvas element
 * @param mimeType - Image MIME type (default: 'image/png')
 * @param quality - JPEG quality 0-1 (only for image/jpeg)
 * @returns Promise resolving to Blob
 *
 * @example
 * const blob = await canvasToBlob(canvas)
 * await uploadBlob(blob)
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType = "image/png",
  quality = 1.0
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality)
  })
}

/**
 * Downloads a data URL as a file
 *
 * Creates a temporary link element and clicks it to trigger download.
 *
 * @param dataUrl - Data URL to download
 * @param filename - Filename to save as
 *
 * @example
 * const dataUrl = canvas.toDataURL('image/png')
 * downloadDataURL(dataUrl, 'my-sprite.png')
 */
export function downloadDataURL(dataUrl: string, filename: string): void {
  const link = document.createElement("a")
  link.href = dataUrl
  link.download = filename
  link.click()
}

/**
 * Gets pixel color from canvas at specific coordinates
 *
 * @param ctx - Canvas 2D rendering context
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns RGBA color
 *
 * @example
 * const color = getPixelFromCanvas(ctx, 10, 20)
 * console.log(`Color at (10,20): rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`)
 */
export function getPixelFromCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
): RGBA {
  const imageData = ctx.getImageData(x, y, 1, 1)
  const data = imageData.data
  return {
    r: data[0],
    g: data[1],
    b: data[2],
    a: data[3]
  }
}

/**
 * Fills entire canvas with a solid color
 *
 * @param ctx - Canvas 2D rendering context
 * @param color - Fill color (CSS color string)
 *
 * @example
 * fillCanvas(ctx, '#FF0000') // Fill with red
 * fillCanvas(ctx, 'transparent') // Clear canvas
 */
export function fillCanvas(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.fillStyle = color
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
}

/**
 * Clears entire canvas (makes transparent)
 *
 * @param ctx - Canvas 2D rendering context
 */
export function clearCanvas(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
}

/**
 * Copies pixels from one buffer to another
 *
 * @param source - Source buffer
 * @param dest - Destination buffer (modified in place)
 * @param sourceWidth - Source width in pixels
 * @param destWidth - Destination width in pixels
 * @param srcX - Source X position
 * @param srcY - Source Y position
 * @param destX - Destination X position
 * @param destY - Destination Y position
 * @param width - Width to copy
 * @param height - Height to copy
 *
 * @example
 * // Copy 16×16 region from (0,0) to (32,32)
 * copyBuffer(source, dest, 64, 64, 0, 0, 32, 32, 16, 16)
 */
export function copyBuffer(
  source: Uint8ClampedArray,
  dest: Uint8ClampedArray,
  sourceWidth: number,
  destWidth: number,
  srcX: number,
  srcY: number,
  destX: number,
  destY: number,
  width: number,
  height: number
): void {
  for (let y = 0; y < height; y++) {
    const srcRow = srcY + y
    const destRow = destY + y

    const srcOffset = (srcRow * sourceWidth + srcX) * 4
    const destOffset = (destRow * destWidth + destX) * 4

    // Copy entire row at once (4 bytes per pixel)
    for (let x = 0; x < width * 4; x++) {
      dest[destOffset + x] = source[srcOffset + x]
    }
  }
}
