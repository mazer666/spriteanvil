import { RGBA } from "../pixels";

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    if (max === r) {
      h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / delta + 2) / 6;
    } else {
      h = ((r - g) / delta + 4) / 6;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = h / 360;
  s = s / 100;
  l = l / 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

export function adjustHue(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  hueShift: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(buffer);

  for (let i = 0; i < buffer.length; i += 4) {
    const a = buffer[i + 3];
    if (a === 0) continue;

    const hsl = rgbToHsl(buffer[i], buffer[i + 1], buffer[i + 2]);
    hsl.h = (hsl.h + hueShift) % 360;
    if (hsl.h < 0) hsl.h += 360;

    const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    result[i] = rgb.r;
    result[i + 1] = rgb.g;
    result[i + 2] = rgb.b;
  }

  return result;
}

export function adjustSaturation(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  saturationDelta: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(buffer);

  for (let i = 0; i < buffer.length; i += 4) {
    const a = buffer[i + 3];
    if (a === 0) continue;

    const hsl = rgbToHsl(buffer[i], buffer[i + 1], buffer[i + 2]);
    hsl.s = Math.max(0, Math.min(100, hsl.s + saturationDelta));

    const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    result[i] = rgb.r;
    result[i + 1] = rgb.g;
    result[i + 2] = rgb.b;
  }

  return result;
}

export function adjustBrightness(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  brightnessDelta: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(buffer);

  for (let i = 0; i < buffer.length; i += 4) {
    const a = buffer[i + 3];
    if (a === 0) continue;

    const hsl = rgbToHsl(buffer[i], buffer[i + 1], buffer[i + 2]);
    hsl.l = Math.max(0, Math.min(100, hsl.l + brightnessDelta));

    const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    result[i] = rgb.r;
    result[i + 1] = rgb.g;
    result[i + 2] = rgb.b;
  }

  return result;
}

export function invertColors(
  buffer: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(buffer);

  for (let i = 0; i < buffer.length; i += 4) {
    const a = buffer[i + 3];
    if (a === 0) continue;

    result[i] = 255 - buffer[i];
    result[i + 1] = 255 - buffer[i + 1];
    result[i + 2] = 255 - buffer[i + 2];
  }

  return result;
}

export function desaturate(
  buffer: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(buffer);

  for (let i = 0; i < buffer.length; i += 4) {
    const a = buffer[i + 3];
    if (a === 0) continue;

    const gray = Math.round(0.299 * buffer[i] + 0.587 * buffer[i + 1] + 0.114 * buffer[i + 2]);
    result[i] = gray;
    result[i + 1] = gray;
    result[i + 2] = gray;
  }

  return result;
}

export function posterize(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  levels: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(buffer);
  const step = 255 / (levels - 1);

  for (let i = 0; i < buffer.length; i += 4) {
    const a = buffer[i + 3];
    if (a === 0) continue;

    result[i] = Math.round(Math.round(buffer[i] / step) * step);
    result[i + 1] = Math.round(Math.round(buffer[i + 1] / step) * step);
    result[i + 2] = Math.round(Math.round(buffer[i + 2] / step) * step);
  }

  return result;
}

export function replaceColor(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  fromColor: RGBA,
  toColor: RGBA,
  tolerance: number = 0
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(buffer);

  for (let i = 0; i < buffer.length; i += 4) {
    const r = buffer[i];
    const g = buffer[i + 1];
    const b = buffer[i + 2];
    const a = buffer[i + 3];

    const dr = Math.abs(r - fromColor.r);
    const dg = Math.abs(g - fromColor.g);
    const db = Math.abs(b - fromColor.b);
    const da = Math.abs(a - fromColor.a);

    if (dr <= tolerance && dg <= tolerance && db <= tolerance && da <= tolerance) {
      result[i] = toColor.r;
      result[i + 1] = toColor.g;
      result[i + 2] = toColor.b;
      result[i + 3] = toColor.a;
    }
  }

  return result;
}

/**
 * WHAT: Adjusts the brightness, contrast, and midtones (Gamma) of an image.
 * WHY: To make shadows darker, highlights brighter, or fix a "Washed out" look.
 * HOW: It creates a "LUT" (Look-Up Table). It calculates the result for every possible input (0-255) first, then just "looks up" the answer for every pixel.
 * USE: Call this for professional color grading.
 * RATIONALE: Using a LUT is thousands of times faster than running the full Math.pow(gamma) calculation for every single pixel.
 * 
 * 🛠️ NOOB CHALLENGE: Can you explain why we use `1 / gamma` instead of just `gamma`?
 */
export function applyLevels(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  inputBlack: number,
  inputWhite: number,
  gamma: number,
  outputBlack: number,
  outputWhite: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(buffer);
  const inBlack = Math.max(0, Math.min(255, inputBlack));
  const inWhite = Math.max(inBlack + 1, Math.min(255, inputWhite));
  const outBlack = Math.max(0, Math.min(255, outputBlack));
  const outWhite = Math.max(outBlack, Math.min(255, outputWhite));
  const invGamma = 1 / Math.max(0.01, gamma);
  const scale = 1 / (inWhite - inBlack);

  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    const normalized = Math.max(0, Math.min(1, (i - inBlack) * scale));
    const corrected = Math.pow(normalized, invGamma);
    lut[i] = Math.round(outBlack + (outWhite - outBlack) * corrected);
  }

  for (let i = 0; i < buffer.length; i += 4) {
    const a = buffer[i + 3];
    if (a === 0) continue;
    result[i] = lut[buffer[i]];
    result[i + 1] = lut[buffer[i + 1]];
    result[i + 2] = lut[buffer[i + 2]];
  }

  return result;
}

export function applyCurves(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  points: Array<{ x: number; y: number }>
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(buffer);
  const lut = buildCurveLUT(points);

  for (let i = 0; i < buffer.length; i += 4) {
    const a = buffer[i + 3];
    if (a === 0) continue;
    result[i] = lut[buffer[i]];
    result[i + 1] = lut[buffer[i + 1]];
    result[i + 2] = lut[buffer[i + 2]];
  }

  return result;
}

function buildCurveLUT(points: Array<{ x: number; y: number }>): Uint8Array {
  const lut = new Uint8Array(256);
  if (points.length === 0) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }

  const sorted = [...points]
    .map((p) => ({ x: Math.max(0, Math.min(255, p.x)), y: Math.max(0, Math.min(255, p.y)) }))
    .sort((a, b) => a.x - b.x);

  let idx = 0;
  for (let x = 0; x < 256; x++) {
    while (idx < sorted.length - 1 && x > sorted[idx + 1].x) {
      idx++;
    }
    const p0 = sorted[idx];
    const p1 = sorted[Math.min(idx + 1, sorted.length - 1)];
    if (p0.x === p1.x) {
      lut[x] = p0.y;
      continue;
    }
    const t = (x - p0.x) / (p1.x - p0.x);
    lut[x] = Math.round(p0.y + (p1.y - p0.y) * t);
  }
  return lut;
}

export function applyAtkinsonDither(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  palette: RGBA[]
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(buffer);
  const errorBuffer = new Float32Array(width * height * 3);

  const findClosest = (r: number, g: number, b: number) => {
    let minDist = Infinity;
    let closest = palette[0];
    for (const color of palette) {
      const dr = r - color.r;
      const dg = g - color.g;
      const db = b - color.b;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < minDist) {
        minDist = dist;
        closest = color;
      }
    }
    return closest;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const errIdx = (y * width + x) * 3;
      const oldR = result[idx] + errorBuffer[errIdx];
      const oldG = result[idx + 1] + errorBuffer[errIdx + 1];
      const oldB = result[idx + 2] + errorBuffer[errIdx + 2];
      const newColor = findClosest(oldR, oldG, oldB);

      result[idx] = newColor.r;
      result[idx + 1] = newColor.g;
      result[idx + 2] = newColor.b;

      const errR = (oldR - newColor.r) / 8;
      const errG = (oldG - newColor.g) / 8;
      const errB = (oldB - newColor.b) / 8;

      spreadAtkinsonError(errorBuffer, width, height, x + 1, y, errR, errG, errB);
      spreadAtkinsonError(errorBuffer, width, height, x + 2, y, errR, errG, errB);
      spreadAtkinsonError(errorBuffer, width, height, x - 1, y + 1, errR, errG, errB);
      spreadAtkinsonError(errorBuffer, width, height, x, y + 1, errR, errG, errB);
      spreadAtkinsonError(errorBuffer, width, height, x + 1, y + 1, errR, errG, errB);
      spreadAtkinsonError(errorBuffer, width, height, x, y + 2, errR, errG, errB);
    }
  }

  return result;
}

export function applyFloydSteinbergDither(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  palette: RGBA[]
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(buffer);
  const errorBuffer = new Float32Array(width * height * 3);

  const findClosest = (r: number, g: number, b: number) => {
    let minDist = Infinity;
    let closest = palette[0];
    for (const color of palette) {
      const dr = r - color.r;
      const dg = g - color.g;
      const db = b - color.b;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < minDist) {
        minDist = dist;
        closest = color;
      }
    }
    return closest;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const errIdx = (y * width + x) * 3;
      const oldR = result[idx] + errorBuffer[errIdx];
      const oldG = result[idx + 1] + errorBuffer[errIdx + 1];
      const oldB = result[idx + 2] + errorBuffer[errIdx + 2];
      const newColor = findClosest(oldR, oldG, oldB);

      result[idx] = newColor.r;
      result[idx + 1] = newColor.g;
      result[idx + 2] = newColor.b;

      const errR = oldR - newColor.r;
      const errG = oldG - newColor.g;
      const errB = oldB - newColor.b;

      spreadError(errorBuffer, width, height, x + 1, y, errR, errG, errB, 7 / 16);
      spreadError(errorBuffer, width, height, x - 1, y + 1, errR, errG, errB, 3 / 16);
      spreadError(errorBuffer, width, height, x, y + 1, errR, errG, errB, 5 / 16);
      spreadError(errorBuffer, width, height, x + 1, y + 1, errR, errG, errB, 1 / 16);
    }
  }

  return result;
}

function spreadError(
  buffer: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  errR: number,
  errG: number,
  errB: number,
  factor: number
) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const idx = (y * width + x) * 3;
  buffer[idx] += errR * factor;
  buffer[idx + 1] += errG * factor;
  buffer[idx + 2] += errB * factor;
}

function spreadAtkinsonError(
  buffer: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  errR: number,
  errG: number,
  errB: number
) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const idx = (y * width + x) * 3;
  buffer[idx] += errR;
  buffer[idx + 1] += errG;
  buffer[idx + 2] += errB;
}
