# SpriteAnvil Code Style Guide
## Related docs

- Docs index: [`/docs/README.md`](./README.md)
- Current status: [`/STATUS_UPDATE.md`](../STATUS_UPDATE.md)
- Implementation snapshot: [`/IMPLEMENTATION_COMPLETE.md`](../IMPLEMENTATION_COMPLETE.md)

---


This document defines the **coding standards** for SpriteAnvil.  
It exists for two reasons:

1. **Consistency**: the codebase should read like it was written by one person.
2. **Beginner-friendly professionalism**: newcomers should understand the “why” behind decisions.

> The rules here apply to **all phases** of the project.

---

## 1) Core principles

### 1.1 Documentation is a feature
- Every non-trivial function must be explainable to a beginner.
- Prefer a slightly longer, clearer implementation over a clever one-liner.

### 1.2 Separation of concerns
- **UI** orchestrates interactions and rendering.
- **Editor / tools** implement reusable logic and algorithms.

### 1.3 Pixel-perfect by default
- Integer math for rasterization.
- Never introduce accidental anti-aliasing.
- Always document rounding behavior.

### 1.4 Predictable performance
- Avoid React state for large/rapidly-changing data (pixel buffers).
- Note algorithm complexity when it matters.

---

## 2) File headers (mandatory for complex files)

Any file with algorithmic or architectural weight should start with:

- What the file does
- Why it exists
- Who depends on it
- Key invariants (pixel-perfect rules, buffer formats, etc.)

### Header template

```ts
/**
 * src/editor/tools/fill.ts
 * -----------------------------------------------------------------------------
 * Purpose:
 *   Implements scanline flood fill on the RGBA pixel buffer.
 *
 * Why this file exists:
 *   Flood fill is performance-critical and should remain UI-agnostic and testable.
 *
 * Key invariants:
 *   - Buffer is Uint8ClampedArray in RGBA order.
 *   - Index formula: (y * width + x) * 4
 *   - No recursion (stack safe).
 *
 * Used by:
 *   - src/ui/CanvasStage.tsx (tool dispatch)
 */
```

---

## 3) Naming conventions

### 3.1 No abbreviations (beginner-friendly)
Bad:
- `fpd`, `ctx2`, `calcZoom`, `tmp`

Good:
- `framePixelData`
- `canvasContext2D`
- `calculateZoomToFitCanvas`
- `temporarySelectionMask`

### 3.2 Functions describe *exact purpose*
Prefer:
- `calculateScreenToPixelCoordinates()`
over:
- `convertCoords()`

### 3.3 Types and interfaces
- `PascalCase` for types: `ToolId`, `Frame`, `SelectionMask`
- `camelCase` for values: `currentTool`, `activeFrameIndex`

### 3.4 Booleans: name as a question
- `isDragging`, `hasSelection`, `shouldSnapToGrid`

### 3.5 Constants
- `UPPER_SNAKE_CASE` for module-level constants:
  - `DEFAULT_BRUSH_SIZE`
  - `MAX_ONION_SKIN_FRAMES`

---

## 4) TypeScript rules

### 4.1 Strict mode
- Keep TypeScript in **strict** mode.
- Avoid `any`. If necessary, use `unknown` and narrow via type guards.

### 4.2 Prefer explicit return types for public functions
Especially for tool algorithms and editor core utilities.

Good:
```ts
export function floodFill(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  fillColorRgba: [number, number, number, number]
): number {
  // returns changedPixelCount
}
```

### 4.3 Type guards for safety
When reading from unknown sources (imports, storage, network):

```ts
export function isToolId(value: unknown): value is ToolId {
  return typeof value === "string" && ALL_TOOL_IDS.includes(value as ToolId);
}
```

---

## 5) JSDoc standards

### 5.1 When to use JSDoc
- Any exported function
- Any complex internal function
- Any algorithmic section

### 5.2 JSDoc template

```ts
/**
 * Flood-fills all connected pixels starting at (startX, startY).
 *
 * @param buffer RGBA pixel buffer (Uint8ClampedArray), modified in place.
 * @param width Canvas width in pixels.
 * @param height Canvas height in pixels.
 * @param startX Start pixel x.
 * @param startY Start pixel y.
 * @param fillColorRgba Fill color as [r,g,b,a].
 * @returns Number of pixels changed (useful for undo/redo commit decision).
 *
 * @example
 * const changed = floodFill(buffer, w, h, 10, 12, [255,0,0,255]);
 * if (changed > 0) commitHistory();
 */
```

---

## 6) Comments: “why” beats “what”

### 6.1 What to comment
- Intent: why we chose this approach
- Edge cases
- Performance-sensitive loops
- Rounding rules

### 6.2 Avoid obvious comments
Bad:
```ts
// Increment x
x++;
```

Good:
```ts
// We step horizontally because scanline fill avoids deep recursion and is faster on large regions.
x++;
```

---

## 7) Error handling

### 7.1 Fail loudly in dev
- Use clear error messages.
- Prefer `throw new Error("...")` for invariant violations.

### 7.2 Guard inputs at boundaries
- UI-to-editor boundaries
- import/export boundaries
- storage boundaries

Example:
```ts
if (width <= 0 || height <= 0) {
  throw new Error("Canvas dimensions must be positive.");
}
```

---

## 8) Performance rules (must-follow)

### 8.1 No pixel buffers in React state
- Use `useRef` for `Uint8ClampedArray` and mutate in place.
- React state should hold:
  - tool selection
  - numeric settings
  - panel UI state
  - small “preview config” objects

### 8.2 Avoid re-render loops during drawing
- Do not call `setState` on every pointer move for pen strokes.
- Render pixels via canvas draw calls, not via React DOM.

### 8.3 Algorithm notes
For anything heavier than O(n) over pixels, add:

- Big-O note
- Why it’s acceptable
- Any optimizations (early exit, bounds checks, caching)

---

## 9) Formatting and linting

### 9.1 Formatting
- Use consistent formatting (prefer Prettier defaults).
- Keep lines readable (avoid 200-char lines).

### 9.2 Imports
- Group imports:
  1) external libs
  2) internal modules
  3) types

Example:
```ts
import React from "react";

import { floodFill } from "../editor/tools/fill";
import type { ToolId } from "../types";
```

### 9.3 File organization
Within a file:
1) constants
2) types (if local)
3) helpers (private)
4) public exported functions/classes

---

## 10) Testing expectations (lightweight but real)

Even early, try to keep code testable:

- Tools should be pure-ish:
  - given a buffer and params, mutate predictably
- Prefer small deterministic helpers (easy unit tests)

Minimum expectations:
- Flood fill correctness on small test buffers
- Shape algorithms produce expected outlines/fills
- Selection boolean ops correct on toy masks

---

## 11) “Definition of Done” for new code

Before merging:

- [ ] Naming follows “no abbreviations”
- [ ] Types are explicit; no new `any`
- [ ] JSDoc added for exported functions
- [ ] Edge cases noted (bounds, empty selection, alpha=0)
- [ ] Performance considerations documented if relevant
- [ ] UI does not contain heavy algorithm logic
- [ ] Undo/redo contract respected (one commit per action)

---

## 12) Examples of good style (mini)

### Example: clear helper naming

Bad:
```ts
function calc(x: number) { return x * 2; }
```

Good:
```ts
function calculateNearestNeighborScaleFactor(scale: number): number {
  // Pixel art should scale in integer steps for crisp results.
  return Math.max(1, Math.round(scale));
}
```
