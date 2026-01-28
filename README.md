# SpriteAnvil

**Forge sprites. Shape motion.**  
SpriteAnvil is an in-browser **pixel-art sprite + animation editor** focused on a clean workflow and a beginner-friendly, well-documented codebase.

> Status: early development. The UI shell + core editor foundations exist; more tools and workflows are being integrated incrementally.

---

## Live demo

- GitHub Pages: `https://mazer666.github.io/spriteanvil/`

---

## What exists today (high level)

- Canvas-based pixel editing with a typed-array pixel buffer
- Tool system wiring (ToolRail → CanvasStage → editor tools)
- Early tool set (pen/eraser + more tools being integrated per plan)
- Undo/redo foundation
- Selection model foundation (mask-based), with UI wiring evolving

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
- Roadmap: [`/docs/PROJECT_PLAN.md`](./docs/PROJECT_PLAN.md)
- Current integration notes: [`/docs/FEATURE_INTEGRATION_PLAN.md`](./docs/FEATURE_INTEGRATION_PLAN.md)

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
