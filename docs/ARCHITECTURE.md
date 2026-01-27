# SpriteAnvil Architecture

This document describes **how SpriteAnvil is structured internally**, how **data flows** from user input to pixels on screen, and which **modules own which responsibilities**.

It is intentionally written to be **beginner-friendly** while still being a reliable “source of truth”.

---

## Goals of the architecture

1. **Separation of concerns**
   - UI components handle interaction + presentation.
   - Editor/tool modules handle pixel logic as **pure functions** where possible.
2. **Pixel-perfect + predictable**
   - Integer math for shapes
   - No accidental anti-aliasing
3. **Performance that scales**
   - Direct typed-array pixel buffers
   - Avoid unnecessary React re-renders for per-pixel operations
4. **Extensibility**
   - Tools are modular
   - Selection and history are reusable foundations for transforms, clipboard, filters, etc.
5. **Beginner friendly**
   - Clear naming
   - Explanatory comments (“why”, edge cases, performance notes)

---

## Current architecture at a glance

### High-level layers (conceptual)

- **UI Layer (`src/ui/`)**
  - Tool selection, panels, timeline UI
  - Pointer/keyboard events
  - Renders canvas + overlays (grid, previews, selection visualization)

- **Editor Core (`src/editor/`)**
  - Pixel buffer manipulation
  - Selection model & operations
  - Undo/redo history

- **Tool Modules (`src/editor/tools/`)**
  - Implement each tool as focused logic units:
    - fill (flood fill)
    - shapes (rectangle/circle/ellipse)
    - later: line, gradient, symmetry, transforms, etc.

- **Shared Types (`src/types.ts`)**
  - Tool IDs, editor state shapes, etc.

---

## File / folder map (current)

> This is a *logical* map based on the current repo layout described in docs.

src/
├── editor/
│   ├── pixels.ts           # Core pixel operations (setPixel, drawLine, etc.)
│   ├── history.ts          # Undo/redo stack and snapshot strategy
│   ├── selection.ts        # Selection masks & operations (union/intersection/subtract/etc.)
│   └── tools/
│       ├── fill.ts         # Flood fill algorithms
│       └── shapes.ts       # Rectangle / Circle / Ellipse algorithms
├── ui/
│   ├── CanvasStage.tsx     # Main canvas interaction + rendering (+ previews)
│   ├── ToolRail.tsx        # Tool selection UI
│   ├── RightPanel.tsx      # Tool settings / inspector panel
│   └── Timeline.tsx        # Frame timeline UI
├── types.ts                # TypeScript types (ToolId etc.)
└── App.tsx                 # Top-level composition and state wiring


---
## Core data flow (end-to-end)

This is the **main pipeline** for “user draws something”:

User Input (pointer/keyboard)
↓
UI: ToolRail (select tool) / CanvasStage (pointer events)
↓
App State: current tool + settings (colors, brush, etc.)
↓
CanvasStage: interprets event for current tool
↓
Editor/Tools: pure functions mutate pixel buffer (Uint8ClampedArray)
↓
Editor/History: commit undo snapshot when stroke completes
↓
Canvas rendering: draw pixel buffer to screen + overlays (preview/selection/grid)
↓
Visual output

---

### Why this works well

- Tool code stays testable: **no React inside tool algorithms**
- Rendering stays fast: pixel buffer mutations happen **outside React state** (via refs)
- Undo/redo stays consistent: tool commits funnel through a single history mechanism

---

## The pixel buffer (the “source of pixels”)

SpriteAnvil uses a **typed array pixel buffer**:

- `Uint8ClampedArray`
- Format: **RGBA** repeating
- Pixel index: `(y * width + x) * 4`

Example:

[R, G, B, A,  R, G, B, A,  R, G, B, A,  ...]
pixel 0       pixel 1       pixel 2


### Why typed arrays?

- **Fast** and predictable memory layout
- Works directly with Canvas APIs (`ImageData`)
- Easy to pass to algorithms (fill, shapes, etc.)

---

## Tool system (how tools are structured)

### Tool identity

Tools are represented as a `ToolId` union in `src/types.ts` (example):

- `"pen"`, `"eraser"`, `"fill"`
- `"line"`, `"rectangle"`, `"rectangleFilled"`
- `"circle"`, `"circleFilled"`
- `"selectRect"`, etc.

TypeScript ensures:
- UI can only select valid tools
- CanvasStage can switch on tools safely

### Tool modules

Tools live under:

- `src/editor/tools/`

The **rule**:
- Prefer **pure functions**: `(buffer, width, height, ...) -> mutated buffer / stats`
- Keep UI-only preview logic in `CanvasStage.tsx`

Examples already described in integration plan:

- `fill.ts` implements scanline flood fill
- `shapes.ts` implements pixel-perfect shapes (Bresenham/midpoint style algorithms)

---

## CanvasStage responsibilities (critical module)

`src/ui/CanvasStage.tsx` is the “bridge” between UI input and editor algorithms.

### Owns:

1. **Pointer lifecycle**
   - `beginStroke` (pointer down)
   - `moveStroke` (pointer move)
   - `endStroke` (pointer up/cancel)

2. **Tool dispatch**
   - If tool is immediate (e.g. fill): execute and end immediately
   - If tool is drag-based (shape tools): create/update preview, commit on release
   - If tool is continuous (pen/eraser): draw along pointer path

3. **Preview overlays**
   - Shape preview stored in React state (lightweight)
   - Rendered on top of the base pixels, without permanently changing the buffer

4. **Calling history commit**
   - On stroke end, if pixels changed: push an undo snapshot

### What should *not* live in CanvasStage

- Heavy algorithms (fill, selection ops, shape rasterization)
- Reusable editor logic that can be tested without UI

---

## Selection system (foundation for many features)

Selection is stored as a **mask**:

- `Uint8Array` (1 byte per pixel)
- Value `1` = selected, `0` = not selected

### Why a mask?

- Fast membership check: O(1)
- Memory predictable: width * height bytes
- Easy boolean ops (union, intersect, subtract) with simple loops

### Selection operations (current/defined)

- Create selections:
  - rectangle, ellipse/circle, magic wand (selection flood)
- Combine:
  - union, intersection, subtract, invert
- Utility:
  - bounds of selection rectangle

### How selection integrates

Selection is a shared foundation for:
- cut/copy/paste
- transforms (rotate/scale/flip)
- filters “apply to selection”
- AI inpainting “apply to selection”

---

## Undo/redo history (editor contract)

History lives in `src/editor/history.ts`.

### General contract (expected)

- Capture “before” state at stroke start (or first change)
- Apply tool mutations during stroke
- On stroke end:
  - if changed: push snapshot
  - else: do nothing

### Snapshot strategy (current vs planned)

- **Current (likely):** store full buffer snapshots for simplicity
- **Planned (from project plan):** delta compression / efficient undo snapshots

> Keep the first version beginner-friendly; optimize after correctness.

---

## Rendering pipeline (base + overlays)

Rendering is logically split into layers:

1. **Base pixels**
   - Convert pixel buffer → ImageData → draw to canvas
2. **Overlays**
   - Grid overlay (optional)
   - Selection outline (“marching ants”, later)
   - Shape previews (semi-transparent)
   - Cursor overlays / symmetry guides (later)

### Rule: overlays must not mutate the base buffer

Overlays should be drawn in canvas space, so previews don’t affect undo/redo and don’t corrupt pixel data.

---

## Performance principles (must-follow)

1. **Do not store full pixel buffers in React state**
   - Use refs for buffers, React state for small UI values only
2. **Avoid per-pointer-move React re-render storms**
   - Pen/eraser drawing should not cause full component re-render each pixel
3. **Batch drawing**
   - Prefer “draw once per frame” if needed (`requestAnimationFrame`)
4. **Algorithm choice matters**
   - Scanline fill > naive flood fill recursion (stack safe + faster)
   - Bresenham/midpoint integer math > floating math

---

## Planned architecture expansions (roadmap-aligned)

These are future modules planned in `PROJECT_PLAN.md` (not necessarily implemented yet):

### Layers
- New data model:
  - layers per frame
  - compositing pipeline before rendering
- Blend modes & opacity

### Animation engine
- Timeline virtualization for many frames
- Onion skin rendering with controlled alpha blending
- Playback engine with ms-accurate timing

### Import/export
- PNG sequence
- Spritesheet packers (grid/packed/row/column)
- Metadata formats (JSON primary)

### AI integration (multi-provider)
- Provider interface layer
- Secure key storage
- Generation queue + caching

### Persistence / cloud
- Project save/load
- Autosave
- Conflict resolution (later)
- Database tables & RLS (later)

---

## Architecture “definition of done” (for new features)

When adding a feature, verify:

- [ ] Tool logic is in `src/editor/` or `src/editor/tools/` (not embedded inside UI)
- [ ] UI code only orchestrates input, preview, and dispatch
- [ ] Undo/redo is correct: one committed history entry per completed user action
- [ ] Pixel-perfect behavior tested (no anti-aliasing surprises)
- [ ] Edge cases documented (bounds, empty selection, transparent pixels)
- [ ] Performance note added if the feature is algorithm-heavy

---

## Appendix: common diagrams

### Pixel index


index = (y * width + x) * 4
R = buf[index + 0]
G = buf[index + 1]
B = buf[index + 2]
A = buf[index + 3]

`

### Typical tool lifecycle

PointerDown  -> beginStroke()
PointerMove  -> moveStroke()
PointerUp    -> endStroke()
├─ commit pixels (if preview tool)
├─ push undo snapshot (if changed)
└─ redraw


