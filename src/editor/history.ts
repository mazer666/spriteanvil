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
 * ## TECHNICAL RATIONALE
 * We store full snapshots (Uint8ClampedArray) because our pixel canvases 
 * are small (typical pixel art sizes). This is the easiest and most 
 * reliable approach.
 * 
 * Later we could optimize using diffs, but for v0.1 this is perfect.
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
 * WHAT: Saves a "Photo" (snapshot) of the current canvas to the Undo stack.
 * WHY: This is the trigger that makes the Undo button light up.
 * HOW: It makes a copy of the pixel buffer and clears the Redo stack.
 * USE: Call this in `App.tsx` every time a drawing stroke finishes.
 * 
 * @param before - The pixel buffer snapshot to save.
 */
  commit(before: Uint8ClampedArray) {
    // ORIGIN: App.tsx (the current pixel array). USAGE: Pushed onto the Undo stack.
    this.undoStack.push({ kind: "buffer", snapshot: cloneBuffer(before) });
    this.redoStack = [];
  }

/**
 * WHAT: Saves a snapshot of all Layers across all Frames.
 * WHY: When you add or delete a layer, we need to save that "project structure" change.
 * HOW: It deep-clones the layer object and the pixel buffers inside them.
 * USE: Call this when the user adds, deletes, or reorders layers.
 */
  commitLayers(before: FrameLayersSnapshot) {
    this.undoStack.push({ kind: "layers", snapshot: cloneFrameLayers(before) });
    this.redoStack = [];
  }

/**
 * WHAT: Checks if there is anything to Undo.
 * WHY: Used to decide if the "Undo" button should look gray or clickable.
 * USE: Internal helper and UI state check.
 */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

/**
 * WHAT: Checks if there is anything to Redo.
 * WHY: Used to decide if the "Redo" button should look gray or clickable.
 */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

/**
 * WHAT: Goes back one step in time.
 * WHY: To fix mistakes.
 * HOW: Pops the last snapshot from the Undo stack, pushes the current state to the Redo stack, and returns the old snapshot.
 * USE: Call this in the `onUndo` event in `App.tsx`.
 * RATIONALE: We save the "Future" into Redo so you can "Redo" if you change your mind.
 * 
 * 🛠️ NOOB CHALLENGE: Can you add a `limit` to the `HistoryStack` so it only saves 50 steps? (Memory saving!)
 */
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

/**
 * WHAT: Goes forward one step in time (if you undo-ed).
 * WHY: To restore something you accidentally Undid.
 * HOW: Pops from Redo, pushes current to Undo, and returns the snapshot.
 */
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
 * WHAT: Deletes the whole time machine history.
 * WHY: Useful when starting a completely new project to save memory.
 * 
 * Useful for "New Project" later.
 */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

/**
 * Internal helper to copy pixel bytes.
 */
function cloneBuffer(buf: Uint8ClampedArray): Uint8ClampedArray {
  return new Uint8ClampedArray(buf);
}

/**
 * WHAT: Makes a "Deep Copy" of a complex layer system.
 * WHY: JavaScript objects are usually "referenced". If you don't clone, changing a layer in the 'present' might change it in the 'past' history!
 * HOW: It loops through every frame and every layer, creating brand new copies of the pixels and the objects.
 */
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
