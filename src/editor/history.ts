/**
 * src/editor/history.ts
 * -----------------------------------------------------------------------------
 * Simple Undo/Redo history for pixel buffers.
 *
 * We store full snapshots (Uint8ClampedArray) because our pixel canvases are small
 * (typical pixel art sizes). This is the easiest and most reliable approach.
 *
 * Later we could optimize using diffs, but for v0.1 this is perfect.
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
