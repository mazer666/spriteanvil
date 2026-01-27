# SpriteAnvil Palette and Color Guide

This document defines how SpriteAnvil should handle:
- palettes
- color picking and replacement
- tolerance-based matching
- dithering rules
- color conversions (RGB ↔ HSL)

It is a **source-of-truth spec** to keep behavior consistent across tools.

---

## 1) Core color representation

### 1.1 Internal pixel format
SpriteAnvil uses an RGBA buffer:

- `Uint8ClampedArray`
- channels: R, G, B, A
- 0..255 each

### 1.2 Color type (recommended)

```ts
export type Rgba = [number, number, number, number]; // [r,g,b,a]
```

Rules:
- Values must be integers 0..255
- Alpha=0 means fully transparent

---

## 2) Palette model

### 2.1 Palette entry

```ts
export interface PaletteColor {
  name?: string;        // optional label
  rgba: Rgba;
  tags?: string[];      // optional grouping
}
```

### 2.2 Palette

```ts
export interface Palette {
  id: string;
  name: string;
  colors: PaletteColor[];
}
```

---

## 3) Color picking (eyedropper)

Rules:
- Eyedropper reads the exact pixel RGBA under the cursor.
- If the pixel is transparent (`a = 0`), UI should still show RGBA and allow picking it (useful for eraser-like workflows).
- Optional UX: show “Transparent” label when `a = 0`.

---

## 4) Color replacement

### 4.1 Exact replacement (default)
Replace all pixels where RGBA exactly matches `fromColor`:

```text
match if r==r0 && g==g0 && b==b0 && a==a0
```

### 4.2 Tolerance-based replacement (optional)
Replace pixels if “distance” is within tolerance.

Recommended simple metric (fast):
- Manhattan distance in RGBA:

```text
dist = |r-r0| + |g-g0| + |b-b0| + |a-a0|
match if dist <= tolerance * 4
```

Where:
- `tolerance` is 0..255

> This matches what the integration plan described for tolerance fill.

---

## 5) Palette import/export formats (future-ready)

Planned support:
- Aseprite `.ase` (if accessible)
- GIMP `.gpl`
- `.pal` variants

Minimum safe plan:
- start with `.gpl` and simple JSON palette exports
- document format parsing carefully and validate input

---

## 6) Dithering rules

Dithering should be:
- deterministic (no flicker)
- pixel-perfect
- configurable

### 6.1 Supported dithering modes (recommended)

- Ordered dithering (Bayer matrix)
- Floyd–Steinberg error diffusion
- Atkinson
- Optional: clustered noise

### 6.2 Ordered dithering (Bayer)
Rules:
- Use fixed matrices (2×2, 4×4, 8×8)
- Apply threshold based on pixel position (x,y)

### 6.3 Error diffusion (Floyd–Steinberg)
Rules:
- Work left-to-right, top-to-bottom (or serpentine, but document it)
- Distribute quantization error to neighbors
- Keep it stable and documented

---

## 7) RGB ↔ HSL conversion (for UI sliders)

HSL is useful for:
- hue shift
- saturation/lightness controls
- palette generation and ramps

Rules:
- conversions should be deterministic and documented
- rounding back to RGB should clamp to 0..255

> When implemented, add unit tests for known conversion cases.

---

## 8) “Definition of Done” for color changes

- [ ] all RGBA values are clamped to 0..255
- [ ] exact matching is correct
- [ ] tolerance matching is documented and consistent across tools
- [ ] dithering is deterministic
- [ ] any new palette format parser validates input and fails safely
