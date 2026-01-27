# SpriteAnvil Common Tasks

This document contains **step-by-step guides** for the most common changes in SpriteAnvil.
It is written so that a beginner can follow it safely without breaking the architecture.

---

## Quick index

1. [Add a new tool end-to-end](#1-add-a-new-tool-end-to-end)
2. [Add a tool setting to the RightPanel](#2-add-a-tool-setting-to-the-rightpanel)
3. [Add a new shape tool with drag preview](#3-add-a-new-shape-tool-with-drag-preview)
4. [Add a selection operation (union/intersection/etc.)](#4-add-a-selection-operation-unionintersectionetc)
5. [Add cut/copy/paste using the selection mask](#5-add-cutcopypaste-using-the-selection-mask)
6. [Add a keyboard shortcut for a tool](#6-add-a-keyboard-shortcut-for-a-tool)
7. [Add a new overlay (grid/selection outline/preview layer)](#7-add-a-new-overlay-gridselection-outlinepreview-layer)
8. [Add a new history action (undo/redo)](#8-add-a-new-history-action-undoredo)
9. [Performance checklist before merging](#9-performance-checklist-before-merging)

---

## Before you start (safety checks)

- [ ] You understand the module boundaries from `ARCHITECTURE.md` and `MODULE_GUIDE.md`
- [ ] You will not store pixel buffers in React state
- [ ] You will commit **one undo entry** per completed user action (not per pointer move)
- [ ] You will add beginner-friendly names and comments

---

## 1) Add a new tool end-to-end

This is the most common workflow.

### Example tool name: `gradient`

#### Step 1 — Add the ToolId
**File:** `src/types.ts`

- Add `"gradient"` to the `ToolId` union.

> Why: TypeScript must know the tool exists across the app.

#### Step 2 — Create the tool algorithm module
**File:** `src/editor/tools/gradient.ts` (new)

- Implement the tool as a focused module.
- Prefer a pure function signature that works on the buffer.

Recommended shape:

```ts
/**
 * Applies a gradient fill inside the selected region (or entire canvas if no selection).
 *
 * Returns changedPixelCount so CanvasStage can decide whether to commit history.
 */
export function applyGradient(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  options: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    startColorRgba: [number, number, number, number];
    endColorRgba: [number, number, number, number];
    selectionMask?: Uint8Array | null;
  }
): number {
  // TODO: implement
  return 0;
}
```

Rules:
- Do bounds checks.
- Use integer math where possible.
- Add comments explaining “why”.

#### Step 3 — Add the tool button
**File:** `src/ui/ToolRail.tsx`

- Add a new button for `"gradient"`.
- Use the existing button helper (if present).
- Add a tooltip and shortcut hint.

#### Step 4 — Dispatch the tool from CanvasStage
**File:** `src/ui/CanvasStage.tsx`

- Identify how tools are handled:
  - immediate tools (execute on click)
  - drag tools (preview)
  - continuous tools (pen/eraser)

For a gradient tool you typically want drag behavior:
- pointer down sets start point
- pointer move updates preview
- pointer up commits changes via `applyGradient(...)`

#### Step 5 — Commit history once
**File:** `src/ui/CanvasStage.tsx` (stroke end)

- Only commit history on stroke end **if changedPixelCount > 0**.
- Never create undo entries on every move.

#### Step 6 — Add settings (optional)
If your tool needs settings (angle, mode, dithering):
- add them to the global editor settings state (where current settings live)
- expose controls in RightPanel (see Task #2)

#### Step 7 — Manual test checklist
- [ ] tool is selectable
- [ ] tool changes pixels
- [ ] undo reverts once per action
- [ ] redo reapplies
- [ ] performance: no stutter on drag
- [ ] out-of-bounds clicks do not crash

---

## 2) Add a tool setting to the RightPanel

### Example: `fillTolerance` for the fill tool

#### Step 1 — Add the setting to your settings type/state
Common pattern:
- settings stored in App-level state and passed down
- keep it serializable (numbers/booleans/strings)

Add:
- `fillTolerance: number`

#### Step 2 — Add the UI control
**File:** `src/ui/RightPanel.tsx`

- Add a slider or number input.
- Ensure it calls `onChange` callbacks (controlled input).

Checklist:
- min/max/step are documented
- label includes units (e.g. 0–255)

#### Step 3 — Use it in the tool dispatch
**File:** `src/ui/CanvasStage.tsx`

- When calling `floodFillWithTolerance(...)`, pass `fillTolerance`.

---

## 3) Add a new shape tool with drag preview

Shape tools follow a common pattern:
- preview while dragging
- commit to buffer on release

### Example: `ellipseFilled`

#### Step 1 — Ensure ToolId exists
**File:** `src/types.ts`

Add `"ellipseFilled"`.

#### Step 2 — Implement in shapes module
**File:** `src/editor/tools/shapes.ts`

Add:
- `fillEllipse(...)`

Rules:
- integer-only math
- explicit bounds checks
- document algorithm choice

#### Step 3 — Add button
**File:** `src/ui/ToolRail.tsx`

Add tool button + tooltip.

#### Step 4 — Preview state
**File:** `src/ui/CanvasStage.tsx`

Maintain a small preview object:
- startX/startY
- endX/endY

On pointer move, update preview state.
On draw, render preview overlay (semi-transparent).
On pointer up, call the shape algorithm to commit to buffer.

#### Step 5 — Commit history once
Same as Task #1.

---

## 4) Add a selection operation (union/intersection/etc.)

Selection should stay editor-owned.

### Example: add `selectionXor`

#### Step 1 — Implement op in selection module
**File:** `src/editor/selection.ts`

- Add:
  - `selectionXor(maskA, maskB)`

Implementation approach:
- masks are same size (width*height)
- XOR: selected if exactly one mask selects pixel

#### Step 2 — Add tests (recommended)
- Create small toy masks (e.g. 4x4) and verify XOR result.

#### Step 3 — UI integration
Wherever selection controls live (menu, hotkeys, RightPanel):
- call `selectionXor(...)` and set the new selection mask in editor state.

---

## 5) Add cut/copy/paste using the selection mask

This is foundational for real editor workflows.

### Cut/Copy

- Use selection bounds to limit scanning area.
- Copy selected pixels into a clipboard buffer object:
  - width/height of the copied region
  - RGBA data
  - offset/pivot info if needed

### Paste

- On paste:
  - compute destination bounds
  - write pixels into canvas buffer
  - optionally paste as new layer later (roadmap)

Rules:
- Always treat alpha=0 correctly (transparent pixels)
- Pasting should be one history action

---

## 6) Add a keyboard shortcut for a tool

### Example: `G` for gradient

**Where:** depends on existing shortcut handling.
Common options:
- global key handler in `App.tsx`
- canvas-focused handler in `CanvasStage.tsx`

Rules:
- Don’t steal browser-native shortcuts (Cmd+L, Cmd+R, etc.)
- Only apply if user is not typing in an input field
- Add tooltip hint in ToolRail

---

## 7) Add a new overlay (grid/selection outline/preview layer)

Overlays must not mutate the base buffer.

### Typical overlays

- grid overlay (toggle)
- selection outline (“marching ants”)
- symmetry axis guides
- shape preview

Where:
- overlay rendering usually belongs in `CanvasStage.tsx` draw routine

Rules:
- draw overlay after base pixels
- restore canvas context state (alpha, composite mode)

---

## 8) Add a new history action (undo/redo)

History should:
- create one entry per user action
- allow Ctrl/Cmd+Z undo, Shift+Z redo (or Cmd+Shift+Z)

Rules:
- commit snapshots only if something changed
- avoid excessive memory usage (optimize later)

---

## 9) Performance checklist before merging

- [ ] no pixel buffer in React state
- [ ] no `setState` on every pixel while painting
- [ ] tool algorithms avoid recursion on large regions
- [ ] bounds checks prevent exceptions
- [ ] undo entries are not created on every move
- [ ] overlays do not require heavy recomputation per frame

---

## Next planned tasks for this document

As SpriteAnvil evolves, add step-by-step guides for:

- export spritesheet + JSON metadata
- onion skin rendering + toggles
- timeline virtualization
- selection visualization (“marching ants”)
- palette import/export
