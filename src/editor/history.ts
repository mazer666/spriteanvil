/**
 * src/editor/history.ts
 * -----------------------------------------------------------------------------
 * Simple Undo/Redo history for pixel buffers.
 *
 * We store full snapshots (PixelBuffer) because pixel art canvases are small.
 * This is the most reliable approach for v0.1.
 */

import { PixelBuffer, cloneBuffer } from "./pixels";

export class HistoryStack {
  private undoStack: PixelBuffer[] = [];
  private redoStack: PixelBuffer[] = [];

  commit(before: PixelBuffer) {
    this.undoStack.push(cloneBuffer(before));
    this.redoStack = [];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(current: PixelBuffer): PixelBuffer {
    if (!this.canUndo()) return current;

    const previous = this.undoStack.pop()!;
    this.redoStack.push(cloneBuffer(current));
    return previous;
  }

  redo(current: PixelBuffer): PixelBuffer {
    if (!this.canRedo()) return current;

    const next = this.redoStack.pop()!;
    this.undoStack.push(cloneBuffer(current));
    return next;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
