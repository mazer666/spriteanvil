# SpriteAnvil State Model
## Related docs

- Docs index: [`/docs/README.md`](./README.md)
- Current status: [`/STATUS_UPDATE.md`](../STATUS_UPDATE.md)
- Implementation snapshot: [`/IMPLEMENTATION_COMPLETE.md`](../IMPLEMENTATION_COMPLETE.md)

---


Defines where state should live (React state vs refs vs editor-owned state).

---

## Key rule

**Never store pixel buffers in React state.** Use refs and draw explicitly.

---

## React state (small, serializable)

- current tool
- active frame index
- tool settings (colors, brush size, tolerance)
- UI toggles (grid, onion skin)
- small preview objects (shape preview, paste preview)

---

## Refs / editor-owned state (large, hot path)

- frame pixel buffers (`Uint8ClampedArray`)
- selection mask (`Uint8Array | null`)
- undo/redo stacks
- caches (thumbnails, onion skin ImageData, selection bounds)

---

## Recommended approach

Start simple:
- metadata in React state
- buffers + history in refs

Scale later:
- move buffers/history/selection into a dedicated editor store module

---

## Definition of Done

- [ ] buffers never moved into React state
- [ ] drawing remains responsive
- [ ] undo/redo remains predictable
