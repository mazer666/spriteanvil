# SpriteAnvil Documentation (`/docs`)

This folder contains **project plans** and **source-of-truth specifications** for SpriteAnvil.

- If you want the **big picture / roadmap** → start with `PROJECT_PLAN.md`
- If you want the **current implementation status + how features were wired** → `FEATURE_INTEGRATION_PLAN.md`
- If you want the **stable rules the code should follow** → the Core Specs below

---

## Read this first (recommended order)

1. **Roadmap & priorities** → [`PROJECT_PLAN.md`](./PROJECT_PLAN.md)  
2. **What is already built + integration notes** → [`FEATURE_INTEGRATION_PLAN.md`](./FEATURE_INTEGRATION_PLAN.md)  
3. **Architecture (system structure + data flow)** → [`ARCHITECTURE.md`](./ARCHITECTURE.md)  
4. **Module map (where code belongs)** → [`MODULE_GUIDE.md`](./MODULE_GUIDE.md)  
5. **Coding standards (naming, TS, JSDoc, perf rules)** → [`CODE_STYLE.md`](./CODE_STYLE.md)  
6. **How-to guides (beginner-safe step-by-step)** → [`COMMON_TASKS.md`](./COMMON_TASKS.md)  

---

## Core Specs (source of truth)

These documents define the **contracts** SpriteAnvil code should implement.

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)  
  System overview: UI ↔ editor ↔ tools, data flow, rendering layers, performance principles.

- [`MODULE_GUIDE.md`](./MODULE_GUIDE.md)  
  Practical map of `src/` + dependency rules (who may import whom).

- [`CODE_STYLE.md`](./CODE_STYLE.md)  
  “Documentation is a feature”: naming rules, file headers, JSDoc templates, error handling, perf rules.

- [`COMMON_TASKS.md`](./COMMON_TASKS.md)  
  Step-by-step guides: add a tool, add previews, selection ops, cut/copy/paste, shortcuts, overlays, history.

- [`EXPORT_FORMAT.md`](./EXPORT_FORMAT.md)  
  Export contract: spritesheet PNG + `*.spriteanvil.json` metadata (rects, durations, pivots, tags, trim semantics).

- [`SELECTION_MODEL.md`](./SELECTION_MODEL.md)  
  Selection contract: mask model (`Uint8Array`), boolean ops, bounds, visualization rules, clipboard + transform integration.

---

## File naming convention in `/docs`

To keep things consistent in this repo:

- Planning documents: already use `UPPER_SNAKE_CASE.md` (e.g. `PROJECT_PLAN.md`)
- Core specs: also use `UPPER_SNAKE_CASE.md` (e.g. `ARCHITECTURE.md`)
- If we add many future feature specs, we can group them later under `docs/specs/` (optional)

---

## Contribution rule for docs

When you add or change any of these:
- architecture boundaries
- module responsibilities
- export fields / semantics
- selection behavior

…update the matching doc **and** keep this `docs/README.md` index in sync.

---

## Next docs to create (recommended)

After the current core specs, the next high-value docs are:

1. `TIMELINE_GUIDE.md` (frames, durationMs, playback, onion skin, tags UI, virtualization rules)  
2. `GODOT_INTEGRATION.md` (how to map export JSON → AtlasTexture/AnimatedSprite, recommended import settings)  
3. `PALETTE_AND_COLOR.md` (palette formats, color math, replace/tolerance, dithering rules)
