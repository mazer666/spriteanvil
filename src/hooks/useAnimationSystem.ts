/**
 * src/hooks/useAnimationSystem.ts
 * -----------------------------------------------------------------------------
 * ## ANIMATION SYSTEM HOOK
 * 
 * This hook encapsulates all animation/timeline logic including:
 * - Frame CRUD operations (insert, duplicate, delete, reorder)
 * - Playback control (play/pause, frame advancement)
 * - Multi-frame selection
 * - Frame duration management
 * 
 * WHY THIS EXISTS:
 * Extracted from App.tsx to reduce complexity and improve testability.
 * Part of the Phase 16 refactoring initiative.
 * 
 * USED BY:
 * - src/App.tsx
 */

import { useCallback, useEffect, useRef } from "react";
import { Frame, LayerData, CanvasSpec, BlendMode } from "../types";
import { cloneBuffer, createBuffer } from "../editor/pixels";
import { compositeLayers } from "../editor/layers";
import { AnimationTag } from "../lib/supabase/animation_tags";

// ============================================================================
// TYPES
// ============================================================================

export interface AnimationState {
  frames: Frame[];
  currentFrameIndex: number;
  selectedFrameIndices: Set<number>;
  isPlaying: boolean;
  frameLayers: Record<string, LayerData[]>;
  frameActiveLayerIds: Record<string, string>;
}

export interface AnimationActions {
  setFrames: React.Dispatch<React.SetStateAction<Frame[]>>;
  setCurrentFrameIndex: React.Dispatch<React.SetStateAction<number>>;
  setSelectedFrameIndices: React.Dispatch<React.SetStateAction<Set<number>>>;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setFrameLayers: React.Dispatch<React.SetStateAction<Record<string, LayerData[]>>>;
  setFrameActiveLayerIds: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export interface AnimationConfig {
  canvasSpec: CanvasSpec;
  defaultPivot: { x: number; y: number };
  activeTag: AnimationTag | null;
  loopTagOnly: boolean;
  // Callbacks for UI state (dialogs, errors)
  setConfirmDialog: (dialog: ConfirmDialogConfig | null) => void;
  setConfirmBusy: (busy: boolean) => void;
  setProjectError: (error: string | null) => void;
}

export interface ConfirmDialogConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  isDangerous?: boolean;
  onConfirm: () => Promise<void> | void;
}

export interface UseAnimationSystemReturn {
  // Frame operations
  handleInsertFrame: () => void;
  handleDuplicateFrame: () => void;
  handleReorderFrames: (fromIndex: number, toIndex: number) => void;
  handleDeleteFrame: () => void;
  handleSelectFrame: (index: number) => void;
  handleMultiSelectFrame: (index: number, modifier?: "add" | "range" | null) => void;
  handleUpdateFrameDuration: (index: number, durationMs: number) => void;
  
  // Playback
  handleTogglePlayback: () => void;
}

// ============================================================================
// HELPER: Create empty layer
// ============================================================================

function createLayer(
  name: string,
  width: number,
  height: number,
  pixels?: Uint8ClampedArray
): LayerData & { pixels: Uint8ClampedArray } {
  return {
    id: crypto.randomUUID(),
    name,
    opacity: 1,
    blend_mode: "normal" as BlendMode,
    is_visible: true,
    is_locked: false,
    pixels: pixels ?? createBuffer(width, height, { r: 0, g: 0, b: 0, a: 0 }),
  };
}

// ============================================================================
// HOOK
// ============================================================================

export function useAnimationSystem(
  state: AnimationState,
  actions: AnimationActions,
  config: AnimationConfig
): UseAnimationSystemReturn {
  const {
    frames,
    currentFrameIndex,
    selectedFrameIndices,
    isPlaying,
    frameLayers,
  } = state;

  const {
    setFrames,
    setCurrentFrameIndex,
    setSelectedFrameIndices,
    setIsPlaying,
    setFrameLayers,
    setFrameActiveLayerIds,
  } = actions;

  const {
    canvasSpec,
    defaultPivot,
    activeTag,
    loopTagOnly,
    setConfirmDialog,
    setConfirmBusy,
    setProjectError,
  } = config;

  const playbackTimerRef = useRef<number | null>(null);
  const isPlayingRef = useRef(isPlaying); // Track playing state for timer callback
  const currentFrame = frames[currentFrameIndex];
  
  // Use refs for values needed in the timer to avoid stale closures and re-triggering effects
  const framesRef = useRef(frames);
  const activeTagRef = useRef(activeTag);
  const loopTagOnlyRef = useRef(loopTagOnly);
  
  // Keep refs in sync
  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);
  
  useEffect(() => {
    activeTagRef.current = activeTag;
  }, [activeTag]);
  
  useEffect(() => {
    loopTagOnlyRef.current = loopTagOnly;
  }, [loopTagOnly]);
  
  // CRITICAL: Keep isPlayingRef in sync - this prevents runaway timers
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // ============================================================================
  // PLAYBACK EFFECT
  // ============================================================================
  
  // Track current frame index in a ref for the timer to use
  const currentFrameIndexRef = useRef(currentFrameIndex);
  useEffect(() => {
    currentFrameIndexRef.current = currentFrameIndex;
  }, [currentFrameIndex]);

  useEffect(() => {
    // Clear any existing timer first
    if (playbackTimerRef.current !== null) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    
    // Early exit if not playing
    if (!isPlaying) return;

    const advanceFrame = () => {
      // CRITICAL: Check if we're still playing before doing anything
      if (!isPlayingRef.current) {
        return; // Stop the chain if playback was stopped
      }
      
      const currentFrames = framesRef.current;
      const tag = activeTagRef.current;
      const shouldLoopTag = loopTagOnlyRef.current;
      const currentIdx = currentFrameIndexRef.current;
      
      const tagStart = tag?.start_frame ?? 0;
      const tagEnd = tag?.end_frame ?? currentFrames.length - 1;
      const loopRange = shouldLoopTag && tag ? { start: tagStart, end: tagEnd } : null;
      const next = loopRange
        ? (currentIdx + 1 > loopRange.end ? loopRange.start : currentIdx + 1)
        : (currentIdx + 1) % currentFrames.length;
      
      // Update frame index
      setCurrentFrameIndex(next);
      currentFrameIndexRef.current = next; // Update ref immediately for next iteration
      
      // Schedule next frame ONLY if still playing (OUTSIDE state updater!)
      if (isPlayingRef.current) {
        const nextDuration = currentFrames[next]?.durationMs ?? 100;
        playbackTimerRef.current = window.setTimeout(advanceFrame, nextDuration);
      }
    };

    // Start the first timer using current frame's duration from ref
    const initialDuration = framesRef.current[currentFrameIndex]?.durationMs ?? 100;
    playbackTimerRef.current = window.setTimeout(advanceFrame, initialDuration);

    return () => {
      if (playbackTimerRef.current !== null) {
        clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps
  // IMPORTANT: Only depend on isPlaying! The timer chain is self-contained.

  // ============================================================================
  // FRAME OPERATIONS
  // ============================================================================

  const handleInsertFrame = useCallback(() => {
    const newLayer = createLayer("Layer 1", canvasSpec.width, canvasSpec.height);
    const composite = compositeLayers([newLayer], canvasSpec.width, canvasSpec.height);
    const newFrame: Frame = {
      id: crypto.randomUUID(),
      pixels: composite,
      durationMs: 100,
      pivot: defaultPivot,
    };

    setFrames((prev) => {
      const updated = [...prev];
      updated.splice(currentFrameIndex + 1, 0, newFrame);
      return updated;
    });
    setFrameLayers((prev) => ({ ...prev, [newFrame.id]: [newLayer] }));
    setFrameActiveLayerIds((prev) => ({ ...prev, [newFrame.id]: newLayer.id }));
    setCurrentFrameIndex(currentFrameIndex + 1);
  }, [canvasSpec, currentFrameIndex, defaultPivot, setFrames, setFrameLayers, setFrameActiveLayerIds, setCurrentFrameIndex]);

  const handleDuplicateFrame = useCallback(() => {
    if (frames.length === 0) return;
    const current = frames[currentFrameIndex];
    if (!current) return;

    const nextFrame: Frame = {
      ...current,
      id: crypto.randomUUID(),
      pixels: cloneBuffer(current.pixels),
    };

    const currentLayers = frameLayers[current.id] || [];
    const nextLayers = currentLayers.map((l) => ({
      ...l,
      id: crypto.randomUUID(),
      pixels: cloneBuffer(l.pixels!),
    }));

    setFrames((prev) => {
      const next = [...prev];
      next.splice(currentFrameIndex + 1, 0, nextFrame);
      return next;
    });

    setFrameLayers((prev) => ({
      ...prev,
      [nextFrame.id]: nextLayers,
    }));

    setFrameActiveLayerIds((prev) => ({
      ...prev,
      [nextFrame.id]: nextLayers[0]?.id || "",
    }));

    setCurrentFrameIndex(currentFrameIndex + 1);
  }, [frames, currentFrameIndex, frameLayers, setFrames, setFrameLayers, setFrameActiveLayerIds, setCurrentFrameIndex]);

  const handleReorderFrames = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= frames.length) return;
    if (toIndex < 0 || toIndex >= frames.length) return;

    setFrames((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });

    if (currentFrameIndex === fromIndex) {
      setCurrentFrameIndex(toIndex);
    } else if (currentFrameIndex > fromIndex && currentFrameIndex <= toIndex) {
      setCurrentFrameIndex(currentFrameIndex - 1);
    } else if (currentFrameIndex < fromIndex && currentFrameIndex >= toIndex) {
      setCurrentFrameIndex(currentFrameIndex + 1);
    }
  }, [frames.length, currentFrameIndex, setFrames, setCurrentFrameIndex]);

  const handleMultiSelectFrame = useCallback((index: number, modifier?: "add" | "range" | null) => {
    if (modifier === "add") {
      setSelectedFrameIndices((prev) => {
        const next = new Set(prev);
        if (next.has(index)) {
          next.delete(index);
          if (next.size === 0) next.add(index);
        } else {
          next.add(index);
        }
        return next;
      });
      setCurrentFrameIndex(index);
    } else if (modifier === "range") {
      const start = Math.min(currentFrameIndex, index);
      const end = Math.max(currentFrameIndex, index);
      const range = new Set<number>();
      for (let i = start; i <= end; i++) range.add(i);
      setSelectedFrameIndices(range);
      setCurrentFrameIndex(index);
    } else {
      setSelectedFrameIndices(new Set([index]));
      setCurrentFrameIndex(index);
    }
  }, [currentFrameIndex, setSelectedFrameIndices, setCurrentFrameIndex]);

  const handleDeleteFrame = useCallback(() => {
    let indicesToDelete = Array.from(selectedFrameIndices);
    if (indicesToDelete.length === 0) indicesToDelete = [currentFrameIndex];
    indicesToDelete.sort((a, b) => b - a);

    const message = indicesToDelete.length > 1
      ? `Are you sure you want to delete these ${indicesToDelete.length} frames?`
      : "Are you sure you want to delete this frame?";

    setConfirmDialog({
      title: indicesToDelete.length > 1 ? "Delete Frames?" : "Delete Frame?",
      message: `${message} This action cannot be undone.`,
      confirmLabel: "Delete",
      isDangerous: true,
      onConfirm: async () => {
        setConfirmBusy(true);
        try {
          const frameIdsToDelete = indicesToDelete.map((i) => frames[i]?.id).filter(Boolean);

          const finalLength = frames.length - indicesToDelete.length;
          const shouldCreateNew = finalLength <= 0;
          let newFrame: Frame | null = null;
          let newLayer: LayerData | null = null;
          let newFrameId: string | null = null;

          if (shouldCreateNew) {
            newFrameId = crypto.randomUUID();
            newFrame = {
              id: newFrameId,
              pixels: new Uint8ClampedArray(canvasSpec.width * canvasSpec.height * 4),
              durationMs: 100,
              pivot: defaultPivot,
            };

            const rootLayerId = crypto.randomUUID();
            newLayer = {
              id: rootLayerId,
              name: "Layer 1",
              opacity: 1,
              blend_mode: "normal",
              is_visible: true,
              is_locked: false,
              pixels: new Uint8ClampedArray(canvasSpec.width * canvasSpec.height * 4),
            };
          }

          setFrames((prev) => {
            const next = [...prev];
            indicesToDelete.forEach((i) => {
              if (i >= 0 && i < next.length) next.splice(i, 1);
            });

            if (next.length === 0 && newFrame) {
              next.push(newFrame);
            }
            return next;
          });

          setFrameLayers((prev) => {
            const next = { ...prev };
            frameIdsToDelete.forEach((id) => delete next[id]);
            if (shouldCreateNew && newFrameId && newLayer) {
              next[newFrameId] = [newLayer];
            }
            return next;
          });

          setFrameActiveLayerIds((prev) => {
            const next = { ...prev };
            frameIdsToDelete.forEach((id) => delete next[id]);
            if (shouldCreateNew && newFrameId && newLayer) {
              next[newFrameId] = newLayer.id;
            }
            return next;
          });

          setCurrentFrameIndex(0);
          setSelectedFrameIndices(new Set([0]));
        } catch (error) {
          console.error(error);
          setProjectError(error instanceof Error ? error.message : "Failed to delete frame.");
        } finally {
          setConfirmBusy(false);
          setConfirmDialog(null);
        }
      },
    });
  }, [
    selectedFrameIndices,
    currentFrameIndex,
    frames,
    canvasSpec,
    defaultPivot,
    setConfirmDialog,
    setConfirmBusy,
    setProjectError,
    setFrames,
    setFrameLayers,
    setFrameActiveLayerIds,
    setCurrentFrameIndex,
    setSelectedFrameIndices,
  ]);

  const handleSelectFrame = useCallback((index: number) => {
    if (isPlaying) setIsPlaying(false);
    setCurrentFrameIndex(index);
  }, [isPlaying, setIsPlaying, setCurrentFrameIndex]);

  const handleUpdateFrameDuration = useCallback((index: number, durationMs: number) => {
    setFrames((prev) =>
      prev.map((f, i) => (i === index ? { ...f, durationMs } : f))
    );
  }, [setFrames]);

  const handleTogglePlayback = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, [setIsPlaying]);

  return {
    handleInsertFrame,
    handleDuplicateFrame,
    handleReorderFrames,
    handleDeleteFrame,
    handleSelectFrame,
    handleMultiSelectFrame,
    handleUpdateFrameDuration,
    handleTogglePlayback,
  };
}

export default useAnimationSystem;
