# SpriteAnvil Implementation Checklist
## Related docs

- Docs index: [`/docs/README.md`](./README.md)
- Current status: [`/STATUS_UPDATE.md`](../STATUS_UPDATE.md)
- Implementation snapshot: [`/IMPLEMENTATION_COMPLETE.md`](../IMPLEMENTATION_COMPLETE.md)

---


Bridge between roadmap and coding.

---

## Non-negotiable rules

- Pixel buffers (`Uint8ClampedArray`) must **not** live in React state.
- One undo entry per completed action (not per pointer move).
- Tool algorithms live in `src/editor/` or `src/editor/tools/`.
- UI orchestrates input + previews + dispatch (`CanvasStage` is the bridge).
- Follow `CODE_STYLE.md`.

---

## Recommended next implementation sequence

### 1) Tool integrations (gradient, lasso, magic wand)

Deliverables:
- gradient tool renders and applies on drag
- lasso selection creates a custom mask
- magic wand selects by tolerance

Docs (source of truth):
- `UI_SPEC.md`
- `SELECTION_MODEL.md`

Likely files:
- `src/ui/CanvasStage.tsx`
- `src/editor/tools/gradient.ts`
- `src/editor/tools/lasso.ts`

### 2) Selection operations & constraints

Deliverables:
- boolean selection operations (union/subtract/intersect)
- selection constraints for drawing
- feather operation wiring

Docs:
- `SELECTION_MODEL.md`

Likely files:
- `src/editor/selection.ts`
- `src/ui/CanvasStage.tsx`
- `src/App.tsx`

### 3) Export & transform polish

Deliverables:
- export format selector (PNG/JSON/GIF)
- JSON/GIF wiring in `ExportPanel`
- transform scale apply action

Docs:
- `EXPORT_FORMAT.md`

Likely files:
- `src/ui/ExportPanel.tsx`
- `src/lib/export/*`
- `src/ui/TransformPanel.tsx`

---

## PR checklist (copy/paste)

- [ ] Matches source-of-truth docs (link doc in PR)
- [ ] No pixel buffers in React state
- [ ] One history entry per action
- [ ] Tool logic not embedded in UI
- [ ] JSDoc for exported functions
- [ ] Edge cases documented
- [ ] Manual test steps included
