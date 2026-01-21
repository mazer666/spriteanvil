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

export class HistoryStack {
  private undoStack: Uint8ClampedArray[] = [];
  private redoStack: Uint8ClampedArray[] = [];

  /**
   * Commit a "before" snapshot to the undo stack.
   * Call this when a stroke completes (and actually changed pixels).
   */
  commit(before: Uint8ClampedArray) {
    this.undoStack.push(cloneBuffer(before));
    this.redoStack = [];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(current: Uint8ClampedArray): Uint8ClampedArray {
    if (!this.canUndo()) return current;

    const previous = this.undoStack.pop()!;
    this.redoStack.push(cloneBuffer(current));
    return previous;
  }

  redo(current: Uint8ClampedArray): Uint8ClampedArray {
    if (!this.canRedo()) return current;

    const next = this.redoStack.pop()!;
    this.undoStack.push(cloneBuffer(current));
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
