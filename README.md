# SpriteAnvil — Forge sprites. Shape motion.

SpriteAnvil is a **pixel-art sprite & animation builder** focused on a clean workflow:
draw frames, reuse modular parts, rig with anchors, and export to **Godot 4.5** (and generic formats).

> Status: Early development (v0.1). UI shell with dock panels is in place. Editor tools come next.

---

## Goals

- **Pixel-first**: crisp pixels, nearest-neighbor, grid-friendly.
- **Hybrid workflow**: modular parts + rigging **and** per-frame pixel overrides.
- **Beginner-friendly UX**: clean layout, helpful tools (loop checks, diff views, markers).
- **Exports that work**: spritesheets + JSON metadata + Godot-friendly import.

---

## Key Features (planned)

### Core (Animation / D1-first)
- Frames, timeline, playback (FPS + per-frame duration)
- Onion skin (prev/next range + intensity)
- Markers: **Contact / Impact / Hold**
- Diff view (frame-to-frame **and** **first ↔ last** for loop checking)
- Auto-trim export with correct offsets

### Drawing Tools
- Pen / Eraser / Fill
- Selection (rect + lasso) + Move/Transform (flip/rotate/scale NN)
- Eyedropper
- Magic Wand selection (tolerance)
- **Brush Stabilizer** (toggle on/off)
- Symmetry / Mirror draw
- Replace Color (with tolerance)
- Outline tool (1px / 2px)
- **Gradient tool with Dither settings** (ordered/noise/clustered)

### Modular + Rig (E3 / Hybrid)
- Parts Library (reusable hands, heads, weapons, etc.)
- Rig/Armature with **Anchors**
- Pixel-snapped transforms (optional subpixel preview)
- Per-frame pixel overrides (non-destructive)

### Palette (L1 + customization)
- Curated palette presets
- User-customizable palettes
- Palette swap / replace color
- Ramp builder (optional)

### Clipboard Workflow
- Paste images **1:1** (no resampling)  
- Paste images **Fit to Canvas** (nearest-neighbor)  
- Copy selection/frame to clipboard (where supported)

### Export
- Spritesheet PNG + JSON metadata (rects, durations, pivot/origin, offsets, tags)
- Individual frame PNGs + JSON
- Godot 4.5-friendly export + import helper script (planned)

---

## UI Layout (Dock Panels)

- **Top Bar**: project + view + export + zoom slider + stabilizer toggle
- **Left Tool Rail**: drawing/selection tools
- **Center Canvas**: zoomable stage with configurable background (checkerboard/solid/greenscreen/bluescreen)
- **Right Panel (tabs)**: Animation / Layers / Rig / Palette / Export
- **Bottom Timeline**: frames, durations, markers, diff

Panel sizes persist via localStorage.

---

## Development Setup

### Recommended workflow in restricted networks
If GitHub is blocked in your network, you can still work via **VS Code Remote Repositories**:

1. Install the VS Code extension **Remote Repositories** (Microsoft).
2. Sign in to GitHub in VS Code.
3. `Remote Repositories: Open Remote Repository...`
4. Select `mazer666/spriteanvil`
5. Create & publish a branch (recommended: `dev`)

> Note: Remote Repositories is great for editing and committing.  
> If you need a full local runtime (`npm run dev`), use an environment that can install Node dependencies (e.g. a network/machine that allows it).

### Local development (when available)
Prerequisites:
- Node.js 20+

Install and run:
```bash
npm install
npm run dev
````

Build:

```bash
npm run build
npm run preview
```

---

## Branching & Releases

* `main` = stable, deploys to GitHub Pages
* `dev` = active development

Suggested flow:

1. Work on feature branches (or directly on `dev`)
2. Merge to `main` when stable
3. GitHub Pages deploy runs on push to `main`

---

## GitHub Pages Deployment

This repo is configured to deploy automatically via GitHub Actions when `main` is updated.

The Vite base path is configured for:

* `/spriteanvil/`

If you rename the repository, update:

* `vite.config.ts` → `base: "/<new-repo-name>/"`

---

## Roadmap (high level)

* v0.1: Dock UI shell + basic settings
* v0.1.1: Real canvas + pixel grid + pen/eraser + undo/redo
* v0.2: Frames + playback + onion skin + export basics
* v0.3: Selection/transform + fill + wand + clipboard
* v0.4: Palette presets + swap + ramps
* v0.5: Parts library + anchors + rig (no IK)
* v0.6: Godot import helper + advanced export presets

---

## License

Choose a license that fits your goals (MIT recommended for tooling).
See `LICENSE` if included.

---

## Contributing

This is currently a solo project. If you want to contribute later:

* open an issue with a clear description
* keep changes modular and well-commented
* prioritize UX clarity and pixel correctness

---

## Name

**SpriteAnvil**
“Forge sprites. Shape motion.”