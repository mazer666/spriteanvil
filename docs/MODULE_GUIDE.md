# SpriteAnvil Module Guide

This document is a **practical map** of the codebase: what each module is responsible for, where it lives, and how modules depend on each other.

> Use this when you want to **find the right file quickly** or decide **where new code should go**.

---

## Guiding rule: clear module boundaries

SpriteAnvil follows a simple, scalable separation:

- **UI (`src/ui/`)**  
  React components + interaction orchestration + canvas rendering (including overlays & previews)

- **Editor core (`src/editor/`)**  
  Pixel buffer manipulation, selection model, undo/redo history (UI-agnostic)

- **Tools (`src/editor/tools/`)**  
  Tool algorithms as focused modules (prefer pure functions)

- **Types (`src/types.ts`)**  
  Shared TypeScript types (tool IDs, data structures)

This keeps algorithms testable, UI maintainable, and performance predictable.

---

## Current folder overview (high level)

```text
src/
├── editor/                 # "Business logic" for pixel editing (UI-agnostic)
│   ├── pixels.ts           # Low-level pixel ops and drawing primitives
│   ├── history.ts          # Undo/redo stack + snapshot/commit contract
│   ├── selection.ts        # Selection mask + selection boolean operations
│   └── tools/              # Tool algorithms (fill, shapes, ...)
│       ├── fill.ts
│       └── shapes.ts
├── ui/                     # React UI components
│   ├── CanvasStage.tsx     # Canvas interaction + rendering + tool dispatch + previews
│   ├── ToolRail.tsx        # Tool selector UI
│   ├── RightPanel.tsx      # Settings / inspector panel
│   └── Timeline.tsx        # Frame timeline UI
├── types.ts                # Shared TypeScript types
└── App.tsx                 # App composition + top-level state wiring
```

---

## Dependency directions (who may import whom)

**Preferred direction (keep it simple):**

```text
ui  ─────────────→ editor ─────────────→ tools
 │                   │
 └──────────────→ types ←───────────────┘
```

### Rules

- `src/ui/*` **may import** from:
  - `src/editor/*`
  - `src/editor/tools/*`
  - `src/types.ts`

- `src/editor/*` **may import** from:
  - `src/editor/tools/*`
  - `src/types.ts`

- `src/editor/tools/*` should ideally import:
  - only `src/types.ts` (and possibly a small subset of `editor/pixels.ts` utilities if needed)

- Tools **must not** import UI components.

This prevents circular dependencies and keeps algorithms UI-agnostic.

---

## Module breakdown (by responsibility)

### 1) `src/App.tsx` — Application composition

**Role**
- Top-level component that wires together UI panels and passes down state/handlers.

**Owns (typically)**
- Current tool selection (`ToolId`)
- Shared editor settings (primary color, brush size, etc.)
- High-level document state (canvas size, active frame, etc.)

**Should not own**
- Per-pixel state in React (pixel buffers should be refs, not state)

---

### 2) `src/types.ts` — Shared type definitions

**Role**
- Source of truth for TypeScript types used across UI and editor modules.

**Examples**
- `ToolId` union (e.g. `"pen" | "eraser" | "fill" | ...`)
- Editor settings types
- Frame metadata types (duration, etc.)

**Rule**
- Keep types stable and descriptive; avoid “any”.
- If you add a tool, update `ToolId` here first.

---

### 3) `src/ui/CanvasStage.tsx` — The “bridge” module

**Role**
- Orchestrates interaction and rendering:
  - pointer lifecycle (down/move/up)
  - dispatching tool logic
  - managing previews (shape preview overlays, selection overlays, etc.)
  - converting the pixel buffer into canvas output

**Why it exists**
- It’s the central place where *UI events* become *editor changes*.

**What belongs here**
- Pointer event handling (and mapping screen coords → pixel coords)
- Preview-only rendering (must not permanently mutate pixel data)
- Tool dispatch rules (immediate tools vs drag tools vs continuous tools)
- Calling history commits on stroke end

**What does NOT belong here**
- Heavy algorithms (fill, shape rasterization, selection boolean ops)
- Reusable pixel logic (belongs in `src/editor/`)

---

### 4) `src/ui/ToolRail.tsx` — Tool selection UI

**Role**
- Displays tool buttons and lets user choose the active tool.

**Typical responsibilities**
- Button layout and active state visuals
- Keyboard hints (e.g. F for fill)
- Emits tool changes upward (`onSelectTool(toolId)`)

**Rule**
- No tool algorithm logic here.

---

### 5) `src/ui/RightPanel.tsx` — Settings / inspector

**Role**
- Shows tool-specific settings and editor properties (e.g. color, tolerance, brush size).

**Typical responsibilities**
- Reads current settings from state
- Writes changes via callbacks (controlled inputs)

**Rule**
- Keep settings state as “simple serializable config” (numbers/booleans/strings).

---

### 6) `src/ui/Timeline.tsx` — Animation timeline UI

**Role**
- Displays frames as thumbnails and allows frame operations (select/duplicate/reorder) as they are implemented.

**Typical responsibilities**
- Frame list rendering
- Active frame highlight
- Emits actions upward (select frame, add frame)

**Note**
- Advanced features (virtualization, onion skin, tags) are planned in the roadmap.

---

## Editor core modules

### 7) `src/editor/pixels.ts` — Pixel primitives

**Role**
- The foundation: low-level pixel operations and drawing primitives.

**Examples of what belongs here**
- `setPixel`, `getPixel`
- `drawLine` (Bresenham)
- Helpers for bounds checking / clamping
- Utilities used by multiple tools

**Rule**
- Keep functions small and predictable.
- Prefer integer math and explicit bounds checks.

---

### 8) `src/editor/history.ts` — Undo/redo system

**Role**
- Tracks user actions and enables undo/redo.

**Expected contract**
- “Begin action” → record baseline
- “Apply changes” during stroke/tool use
- “Commit action” once, at the end (only if something changed)

**Rules**
- One history entry per *completed* user action (not per mouse move).
- Keep the first implementation simple and correct; optimize later (delta compression planned).

---

### 9) `src/editor/selection.ts` — Selection model

**Role**
- Stores and manipulates selections independently of tools.

**Core representation**
- `Uint8Array` mask: 1 byte per pixel (1 selected, 0 not selected)

**Examples of what belongs here**
- Creation helpers (rect/ellipse/circle, later lasso/magic wand)
- Boolean operations:
  - union / intersection / subtract / invert
- Utility:
  - selection bounds

**Why it matters**
- Selection is the foundation for cut/copy/paste, transforms, filters, and AI inpainting.

---

## Tool modules

### 10) `src/editor/tools/fill.ts` — Flood fill

**Role**
- Fill connected pixels with a chosen color.

**Key design**
- Scanline flood fill for performance and stack safety.
- Optional tolerance-based fill.

**Inputs (typical)**
- pixel buffer, width/height, start pixel, target color, fill color/tolerance

**Outputs**
- modifies buffer in place
- may return “changed pixel count” for history commit decisions

---

### 11) `src/editor/tools/shapes.ts` — Shape rasterization

**Role**
- Pixel-perfect shape drawing using integer algorithms.

**Examples**
- Rectangle outline + filled rectangle
- Circle outline + filled circle
- Ellipse outline + filled ellipse

**Design rules**
- No anti-aliasing
- Use symmetry to reduce computation (e.g. circles)
- Keep functions composable and testable

---

## Where to put new code (quick rules)

### Adding a new tool (example: “gradient”)

- **Tool algorithm:** `src/editor/tools/gradient.ts`
- **Type union:** add `"gradient"` to `ToolId` in `src/types.ts`
- **Tool button:** add in `src/ui/ToolRail.tsx`
- **Dispatch logic + previews:** integrate into `src/ui/CanvasStage.tsx`
- **Settings UI:** add controls in `src/ui/RightPanel.tsx` (if needed)
- **Undo/redo:** ensure CanvasStage commits exactly one history entry per action

> The detailed step-by-step checklist will live in `docs/COMMON_TASKS.md` (to be created).

### Adding reusable editor logic

If multiple tools will use it:
- put it in `src/editor/pixels.ts` (pixel primitives)
- or `src/editor/selection.ts` (selection-related)
- or a new focused file under `src/editor/` (e.g. `src/editor/transform.ts`)

### Adding UI components

Put new UI components under `src/ui/` and keep them:
- presentational (rendering + small interaction)
- thin wrappers that call editor logic rather than reimplementing it

---

## Planned modules (from roadmap)

The roadmap describes additional structure that may appear later, e.g.:

- `src/lib/` for higher-level business logic (AI, export/import, animation engine)
- `src/utils/` for generic helpers
- `src/constants.ts` for all “magic numbers”
- `src/config.ts` for documented configuration
- feature-specific guides in docs (`EXPORT_FORMAT.md`, timeline docs, etc.)

When these are added, update this guide to reflect the new module boundaries.

---

## Update checklist for this document

Whenever you:
- add a new folder under `src/`
- move files across modules
- introduce a new “core subsystem” (layers, export engine, AI providers)

…update `MODULE_GUIDE.md` so the codebase stays navigable.
