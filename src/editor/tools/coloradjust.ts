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
