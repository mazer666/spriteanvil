# SpriteAnvil Implementation Checklist

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

### 1) Selection UI wiring + clipboard MVP

Deliverables:
- rectangle select tool works end-to-end
- selection overlay (MVP)
- copy / cut / paste with paste preview + single history commit

Docs (source of truth):
- `SELECTION_MODEL.md`
- `COMMON_TASKS.md`

Likely files:
- `src/editor/selection.ts`
- `src/ui/CanvasStage.tsx`
- `src/editor/history.ts`
- `src/types.ts`
- `src/ui/ToolRail.tsx`

### 2) Timeline correctness + playback + onion skin toggle

Deliverables:
- insert/duplicate/delete
- playback uses `durationMs`
- tag playback direction
- onion skin toggle + before/after counts

Docs:
- `TIMELINE_GUIDE.md`

Likely files:
- `src/ui/Timeline.tsx`
- `src/ui/CanvasStage.tsx`
- `src/types.ts`

### 3) Export pipeline MVP (spritesheet PNG + JSON)

Deliverables:
- grid spritesheet export
- `*.spriteanvil.json` metadata per spec

Docs:
- `EXPORT_FORMAT.md`

Likely files:
- `src/lib/export/*` (recommended)
- export button UI (top bar or right panel)

---

## PR checklist (copy/paste)

- [ ] Matches source-of-truth docs (link doc in PR)
- [ ] No pixel buffers in React state
- [ ] One history entry per action
- [ ] Tool logic not embedded in UI
- [ ] JSDoc for exported functions
- [ ] Edge cases documented
- [ ] Manual test steps included
