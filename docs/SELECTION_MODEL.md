# SpriteAnvil Selection Model

This document defines the **selection data model** and its **core operations** in SpriteAnvil.

Selection is a foundational subsystem used by:
- cut / copy / paste
- transforms (rotate/scale/flip)
- filters & effects (apply to selection only)
- AI inpainting (apply to selection only)
- timeline workflows (optional copy across frames)

> The goal is: a selection behaves predictably, is fast, and is easy to integrate everywhere.

---

## 1) Core idea: a selection is a mask

A selection is represented as a **mask** (typed array) with one entry per pixel:

- Type: `Uint8Array`
- Length: `width * height`
- Values:
  - `1` = selected
  - `0` = not selected

This is intentionally simple and fast.

### 1.1 Why a mask?

- O(1) membership test: “is pixel selected?”
- Boolean operations become simple loops:
  - union/intersection/subtract/invert
- Predictable memory:
  - `width * height` bytes (1 byte per pixel)

---

## 2) Coordinate system

Selections follow the same pixel coordinate conventions as the canvas:

- origin (0,0) = top-left
- x increases right
- y increases down

Index rule:

```text
index = y * width + x
```

---

## 3) Data structures (recommended)

### 3.1 Basic types (conceptual)

```ts
export type SelectionMask = Uint8Array;

export interface SelectionState {
  mask: SelectionMask | null;     // null means "no active selection"
  width: number;                  // canvas width
  height: number;                 // canvas height
}
```

### 3.2 Bounds rectangle

Many operations are faster if we know the selection bounds:

```ts
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
```

Bounds define the smallest axis-aligned rectangle that contains all selected pixels.

---

## 4) Creating selections

Selection creation produces a mask of the same size as the canvas.

### 4.1 Rectangle selection

Inputs:
- startX/startY, endX/endY
- inclusive pixels (pixel-perfect)

Rules:
- Support dragging in any direction.
- Bounds must clamp to canvas.

### 4.2 Ellipse / circle selection

Rules:
- Uses integer math.
- Circle is a constrained ellipse.
- Pixels are selected if they lie within the ellipse equation (or midpoint algorithm style rasterization).

### 4.3 Magic wand selection (future-ready)

This works like flood fill, but instead of painting pixels it marks them selected.

Inputs:
- startX/startY
- tolerance
- contiguous flag (contiguous vs “select all matching colors”)

Output:
- a selection mask

---

## 5) Boolean operations (core)

All boolean operations require both masks to be:
- non-null
- same length

### 5.1 Union (A ∪ B)

Selected if either A or B selects the pixel.

```text
out[i] = (A[i] | B[i])
```

### 5.2 Intersection (A ∩ B)

Selected only if both select the pixel.

```text
out[i] = (A[i] & B[i])
```

### 5.3 Subtract (A - B)

Keep A selection except where B is selected.

```text
out[i] = (A[i] & (1 - B[i]))
```

### 5.4 Invert (~A)

Selected becomes unselected and vice versa.

```text
out[i] = 1 - A[i]
```

### 5.5 Clear selection

The “no selection” state is represented by:

- `mask = null`

Why `null` instead of an all-zero mask?
- easier “no selection” checks
- avoids scanning work in most cases
- avoids allocating large arrays unnecessarily

---

## 6) Bounds computation (required utility)

### 6.1 `getSelectionBounds(mask)`

Returns `null` if:
- mask is null
- or selection is empty (no selected pixels)

Otherwise returns:

```json
{ "x": 4, "y": 2, "w": 6, "h": 10 }
```

Bounds algorithm:
- scan mask once
- track minX, minY, maxX, maxY
- return w/h as inclusive range:

```text
w = maxX - minX + 1
h = maxY - minY + 1
```

> Bounds are used to reduce work for copy/paste/transforms, so this helper is essential.

---

## 7) Integration rules (how selection affects tools)

### 7.1 “No selection” means “whole canvas”
Most drawing tools should behave as:
- if selection exists → only affect selected pixels
- else → affect everything

This applies to:
- fills
- filters
- transforms

But for tools like Pen/Eraser, you may choose:
- “clip to selection” (common in editors)
- or “ignore selection” (less common)

**Recommended default:** clip pen/eraser to selection when selection exists.

### 7.2 Selection must not affect overlay rendering performance
Selection visualization should:
- avoid scanning full mask every frame
- rely on cached bounds and edge maps (when implemented)

---

## 8) Selection visualization (UI behavior)

Selection visualization is a UI overlay, not a buffer mutation.

### 8.1 Minimum viable visualization (v1)

- draw a simple outline rectangle around bounds
- OR draw a 1px outline around selected pixels

### 8.2 Marching ants (classic)

Marching ants is an animated dashed line around the selection boundary.

Implementation idea (later):
- compute boundary pixels (edge detection on mask)
- draw a dashed stroke with changing dash offset over time

Performance note:
- boundary computation should be cached until mask changes

---

## 9) Clipboard workflows (selection-dependent)

### 9.1 Copy

Copy should export:
- the minimal bounding rect of the selection
- the pixel data of that rect
- the selection mask of that rect (optional, for non-rectangular selections)
- metadata:
  - original canvas size
  - pivot/anchor (future)

### 9.2 Cut

Cut is:
- copy
- then clear pixels inside selection (set alpha=0)
- commit as one history action

### 9.3 Paste

Paste should:
- create a “paste preview” overlay
- allow placement (move) before commit
- commit to buffer on confirm (mouse up or enter)
- become one history entry

---

## 10) Transform workflows (selection-dependent)

Transforms operate on:
- selected pixels only (if selection exists)
- otherwise on whole canvas

Common transforms:
- flip horizontal / vertical
- rotate 90/180
- scale (nearest-neighbor, integer factors preferred)

Rules:
- transparent pixels remain transparent
- out-of-bounds pixels are discarded or clipped
- transformations should preserve pixel-perfect crispness

---

## 11) History rules (selection changes are undoable)

Selection changes should be undoable:

- Creating a selection
- Modifying selection via boolean ops
- Clearing selection

Approach options:
1) store selection mask snapshots in history entries
2) store selection operations (more complex)

**Recommended v1:** store selection mask snapshot (simple & correct).

---

## 12) Validation & invariants

Whenever a selection mask exists:
- it must have length `width * height`
- it must only contain `0` or `1`

If invalid:
- fail with clear error (dev mode)
- auto-clear selection in production if necessary (safe fallback)

---

## 13) Suggested file locations in code

A good structure is:

- `src/editor/selection.ts`  
  selection creation + boolean ops + bounds + validation helpers

- `src/ui/CanvasStage.tsx`  
  selection overlay rendering + selection tool interaction

- `src/editor/history.ts`  
  stores selection snapshots as part of undo/redo state (when selection is integrated)

---

## 14) “Definition of Done” for selection features

Before merging any selection-related change:

- [ ] selection stored as mask (`Uint8Array`)
- [ ] boolean ops correct on small toy examples
- [ ] bounds helper works and returns null on empty selection
- [ ] selection changes undo/redo correctly
- [ ] drawing tools respect selection (document exceptions)
- [ ] visualization does not mutate pixel buffer
- [ ] performance: no full-mask scan per animation frame unless cached

---

## Appendix A: Example mask indexing (4×3)

Canvas: width=4, height=3

Coordinates:
- (0,0) index 0
- (1,0) index 1
- (0,1) index 4

Mask layout:

```text
y=0: [0,1,2,3]
y=1: [4,5,6,7]
y=2: [8,9,10,11]
```

---

## Appendix B: Example boolean ops

A pixel is selected if mask entry is 1:

```text
A: 1 0 0 1
B: 1 1 0 0

Union:        1 1 0 1
Intersection: 1 0 0 0
Subtract A-B: 0 0 0 1
Invert(A):    0 1 1 0
```
