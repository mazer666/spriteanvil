/**
 * src/editor/history.ts
 * -----------------------------------------------------------------------------
 * ## THE HISTORY SYSTEM (Noob Guide)
 * 
 * Think of this as your "Time Machine" or a "Stack of Photos".
 * 
 * 1. UNDO: You take the photo at the top of the stack and put it back on the 
 *    canvas.
 * 2. REDO: If you undo by mistake, you can grab the photo you just took off 
 *    the stack and put it back.
 * 
 * ## VISUAL FLOW (Mermaid)
 * ```mermaid
 * graph TD
 *   A[User Action] --> B{Canvas Changed?}
 *   B -- Yes --> C[Commit Snapshot to Undo Stack]
 *   C --> D[Clear Redo Stack]
 *   E[Undo Command] --> F[Pop from Undo Stack]
 *   F --> G[Apply to Canvas]
 *   G --> H[Push current to Redo Stack]
 * ```
 * 
 * ## VAR TRACE
 * ...
 */

import type { LayerData } from "../types";

type FrameLayersSnapshot = Record<string, LayerData[]>;

type HistoryEntry =
  | { kind: "buffer"; snapshot: Uint8ClampedArray }
  | { kind: "layers"; snapshot: FrameLayersSnapshot };

export class HistoryStack {
  // ORIGIN: Internal state. USAGE: Stores past "Photos" of the canvas. PURPOSE: To go back in time.
  private undoStack: HistoryEntry[] = [];
  // ORIGIN: Internal state. USAGE: Stores "Future" photos after an Undo. PURPOSE: To go forward again.
  private redoStack: HistoryEntry[] = [];

  /**
   * Commit a "before" snapshot to the undo stack.
   * Call this when a stroke completes (and actually changed pixels).
   */
  commit(before: Uint8ClampedArray) {
    // ORIGIN: App.tsx (the current pixel array). USAGE: Pushed onto the Undo stack.
    this.undoStack.push({ kind: "buffer", snapshot: cloneBuffer(before) });
    this.redoStack = [];
  }

  commitLayers(before: FrameLayersSnapshot) {
    this.undoStack.push({ kind: "layers", snapshot: cloneFrameLayers(before) });
    this.redoStack = [];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(
    currentBuffer: Uint8ClampedArray,
    currentLayers: FrameLayersSnapshot
  ): HistoryEntry | null {
    if (!this.canUndo()) return null;

    const previous = this.undoStack.pop()!;
    if (previous.kind === "buffer") {
      this.redoStack.push({ kind: "buffer", snapshot: cloneBuffer(currentBuffer) });
    } else {
      this.redoStack.push({ kind: "layers", snapshot: cloneFrameLayers(currentLayers) });
    }
    return previous;
  }

  redo(
    currentBuffer: Uint8ClampedArray,
    currentLayers: FrameLayersSnapshot
  ): HistoryEntry | null {
    if (!this.canRedo()) return null;

    const next = this.redoStack.pop()!;
    if (next.kind === "buffer") {
      this.undoStack.push({ kind: "buffer", snapshot: cloneBuffer(currentBuffer) });
    } else {
      this.undoStack.push({ kind: "layers", snapshot: cloneFrameLayers(currentLayers) });
    }
    return next;
  }

  /**
   * Useful for "New Project" later.
   */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

function cloneBuffer(buf: Uint8ClampedArray): Uint8ClampedArray {
  return new Uint8ClampedArray(buf);
}

function cloneFrameLayers(source: FrameLayersSnapshot): FrameLayersSnapshot {
  const next: FrameLayersSnapshot = {};
  Object.entries(source).forEach(([frameId, layers]) => {
    next[frameId] = layers.map((layer) => ({
      ...layer,
      pixels: layer.pixels ? new Uint8ClampedArray(layer.pixels) : layer.pixels,
    }));
  });
  return next;
}
