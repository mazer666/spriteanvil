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

### ✅ Completed (recent)

- Gradient tool renders and applies on drag
- Lasso selection creates a custom mask
- Magic wand selects by tolerance
- Boolean selection operations (union/subtract/intersect) via modifiers
- Selection constraints for drawing
- Export format selector (PNG/JSON/GIF) + wiring
- Transform scale apply action
- Move tool for selection translate

### 1) Selection transform & move tooling

Deliverables:
- selection bounds + handles (done)
- selection scale/rotate via transform panel (done)
- canvas pan (space + drag) (done)

Docs (source of truth):
- `UI_SPEC.md`
- `SELECTION_MODEL.md`

Likely files:
- `src/ui/CanvasStage.tsx`
- `src/ui/SelectionPanel.tsx`

### 2) Brush polish

Deliverables:
- stabilizer tuning + preview

Docs:
- `UI_SPEC.md`

Likely files:
- `src/ui/CanvasStage.tsx`

### 3) Layer operations + advanced export

Deliverables:
- flatten layer updates
- clipping masks + non-destructive effects
- export polish (PNG sequence / APNG)

Docs:
- `EXPORT_FORMAT.md`

Likely files:
- `src/editor/layers.ts`
- `src/ui/LayerPanel.tsx`
- `src/lib/export/*`

---

## PR checklist (copy/paste)

- [ ] Matches source-of-truth docs (link doc in PR)
- [ ] No pixel buffers in React state
- [ ] One history entry per action
- [ ] Tool logic not embedded in UI
- [ ] JSDoc for exported functions
- [ ] Edge cases documented
- [ ] Manual test steps included
