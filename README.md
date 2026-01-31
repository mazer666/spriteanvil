# SpriteAnvil

**Forge sprites. Shape motion.**  
SpriteAnvil is an in-browser **pixel-art sprite + animation editor** focused on a clean workflow and a beginner-friendly, well-documented codebase.

> Status: Phase 9 (UI Overhaul) Complete. Professional floating UI, Zen Mode, and modern aesthetics integrated. Core features production-ready.

---

## Why SpriteAnvil?

The world doesn't need another generic image editor. It needs a **sanctuary for the craft.**

SpriteAnvil exists to preserve the art of the pixel by providing a tool that is:

- **Transparent**: No black-box algorithms. Every pixel mutation is explainable.
- **Accessible**: Runs in any modern browser, anywhere, for free.
- **Hackable**: A beginner-friendly codebase designed to be taken apart and rebuilt.

Our mission is to make pixel-art creation as tactile and rewarding as working at a physical anvil.

---

## Live demo

- GitHub Pages: `https://mazer666.github.io/spriteanvil/`

---

## What exists today (high level)

- Canvas-based pixel editing with a typed-array pixel buffer
- **New Floating UI**: Desktop-class floating panels, draggable and resizable, with a "BG3-like" premium dark theme
- Tool system wiring (ToolRail → CanvasStage → editor tools)
- Early tool set (pen/eraser + more tools being integrated per plan)
- Adaptive docking UI with collapsible panels, **Zen Mode** (Tab), and responsive topbar menus
- Apple Pencil pressure support with configurable smoothing + palm rejection on touch devices
- Undo/redo foundation
- Selection model foundation (mask-based), with UI wiring evolving
- Realtime collaboration scaffolding (presence + live cursors + pixel patch sync)
- AI inpainting/image-to-image payload prep with OpenRouter listed as a provider
- Physics/animation guides (arc, gravity, motion trails) and edge snapping helpers

For implementation details, see `/docs/FEATURE_INTEGRATION_PLAN.md`.

---

## Project goals

- **Best-in-class parity first**, then innovations (AI assistance, advanced symmetry, better UX, collaboration)
- **Pixel-perfect algorithms** (integer math, nearest-neighbor)
- **Performance-first rendering** (avoid React state for pixel buffers, keep canvas hot path lean)
- **Beginner-friendly code** (clear names, JSDoc, “why” comments)

The full roadmap lives in `/docs/PROJECT_PLAN.md`.

---

## Documentation

Start here:

- Docs index: [`/docs/README.md`](./docs/README.md)
- UI target vision: [`/docs/UI_SPEC.md`](./docs/UI_SPEC.md)
- Improvements + asset checklist: [`/docs/IMPROVEMENTS_AND_ASSETS.md`](./docs/IMPROVEMENTS_AND_ASSETS.md)
- Roadmap: [`/docs/PROJECT_PLAN.md`](./docs/PROJECT_PLAN.md)
- AI Development: [`/docs/AI_DEVELOPMENT_GUIDE.md`](./docs/AI_DEVELOPMENT_GUIDE.md)
- AI Prompting: [`/docs/AI_PROMPT_GALLERY.md`](./docs/AI_PROMPT_GALLERY.md)
- Current integration notes: [`/docs/FEATURE_INTEGRATION_PLAN.md`](./docs/FEATURE_INTEGRATION_PLAN.md)
- Current status update: [`/STATUS_UPDATE.md`](./STATUS_UPDATE.md)
- Implementation milestone snapshot: [`/IMPLEMENTATION_COMPLETE.md`](./IMPLEMENTATION_COMPLETE.md)

---

## Development setup

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

> Node.js 20+ recommended.

---

## Repo structure (short)

- `src/ui/` → React UI (panels, ToolRail, CanvasStage, Timeline)
- `src/editor/` → editor core (pixels, selection, history)
- `src/editor/tools/` → tool algorithms (fill, shapes, …)
- `docs/` → plans + source-of-truth specs

---

## Contributing

This repo aims to be friendly to new contributors.

- Read `/docs/CODE_STYLE.md` first
- Follow `/docs/COMMON_TASKS.md` for safe step-by-step changes
- Keep module boundaries intact (`/docs/MODULE_GUIDE.md`)

---

## License

MIT
