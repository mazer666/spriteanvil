/**
 * src/hooks/usePaletteManager.ts
 * -----------------------------------------------------------------------------
 * ## PALETTE MANAGER HOOK
 * 
 * This hook encapsulates palette management logic including:
 * - Palette CRUD (create, delete)
 * - Color operations (add, remove)
 * - Import/Export functionality
 * - Palette generation (extract from image, color ramp)
 * - Color swapping across the project
 * 
 * WHY THIS EXISTS:
 * Extracted from App.tsx to reduce complexity and improve testability.
 * Part of the Phase 16 refactoring initiative.
 * 
 * USED BY:
 * - src/App.tsx
 */

import { useCallback } from "react";
import { LayerData, CanvasSpec, UiSettings } from "../types";
import { PaletteData } from "../lib/projects/snapshot";
import { importPaletteFile, exportPaletteFile, buildPaletteRamp } from "../lib/supabase/palettes";
import { extractPaletteFromPixels } from "../editor/palette";
import { hexToRgb } from "../utils/colors";
import { HistoryStack } from "../editor/history";

// ============================================================================
// TYPES
// ============================================================================

export interface PaletteState {
  palettes: PaletteData[];
  activePaletteId: string;
  compositeBuffer: Uint8ClampedArray;
  frameLayers: Record<string, LayerData[]>;
  isActiveLayerLocked: boolean;
}

export interface PaletteActions {
  setPalettes: React.Dispatch<React.SetStateAction<PaletteData[]>>;
  setActivePaletteId: React.Dispatch<React.SetStateAction<string>>;
  setFrameLayers: React.Dispatch<React.SetStateAction<Record<string, LayerData[]>>>;
}

export interface PaletteConfig {
  canvasSpec: CanvasSpec;
  settings: UiSettings;
  historyRef: React.RefObject<HistoryStack>;
  rebuildFramesFromLayers: (layers: Record<string, LayerData[]>) => void;
  syncHistoryFlags: () => void;
}

export interface UsePaletteManagerReturn {
  handleCreatePalette: (name: string, colors: string[]) => void;
  handleImportPalette: (file: File) => Promise<void>;
  handleExportPalette: (format: "gpl" | "ase") => void;
  handleExtractPaletteFromImage: () => void;
  handleGeneratePaletteRamp: (steps: number) => void;
  handleDeletePalette: (id: string) => void;
  handleAddColorToPalette: (paletteId: string, color: string) => void;
  handleRemoveColorFromPalette: (paletteId: string, colorIndex: number) => void;
  handleSwapColors: (fromColor: string, toColor: string) => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function usePaletteManager(
  state: PaletteState,
  actions: PaletteActions,
  config: PaletteConfig
): UsePaletteManagerReturn {
  const {
    palettes,
    activePaletteId,
    compositeBuffer,
    frameLayers,
    isActiveLayerLocked,
  } = state;

  const {
    setPalettes,
    setActivePaletteId,
    setFrameLayers,
  } = actions;

  const {
    canvasSpec,
    settings,
    historyRef,
    rebuildFramesFromLayers,
    syncHistoryFlags,
  } = config;

  const handleCreatePalette = useCallback(
    (name: string, colors: string[]) => {
      const newPalette: PaletteData = {
        id: `palette-${Date.now()}`,
        name,
        colors,
        is_default: false,
      };
      setPalettes((prev) => [newPalette, ...prev]);
      setActivePaletteId(newPalette.id);
    },
    [setPalettes, setActivePaletteId]
  );

  const handleImportPalette = useCallback(
    async (file: File) => {
      try {
        const { name, colors } = await importPaletteFile(file);
        if (colors.length === 0) return;
        handleCreatePalette(name, colors);
      } catch (error) {
        console.error("Palette import failed:", error);
      }
    },
    [handleCreatePalette]
  );

  const handleExportPalette = useCallback(
    (format: "gpl" | "ase") => {
      const palette = palettes.find((p) => p.id === activePaletteId);
      if (!palette) return;
      const blob = exportPaletteFile(palette.name, palette.colors, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${palette.name}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    },
    [palettes, activePaletteId]
  );

  const handleExtractPaletteFromImage = useCallback(() => {
    const colors = extractPaletteFromPixels(
      compositeBuffer,
      canvasSpec.width,
      canvasSpec.height
    );
    if (colors.length === 0) return;
    const newPalette: PaletteData = {
      id: `palette-${Date.now()}`,
      name: `Extracted ${new Date().toLocaleTimeString()}`,
      colors,
      is_default: false,
    };
    setPalettes((prev) => [newPalette, ...prev]);
    setActivePaletteId(newPalette.id);
  }, [compositeBuffer, canvasSpec.width, canvasSpec.height, setPalettes, setActivePaletteId]);

  const handleGeneratePaletteRamp = useCallback(
    (steps: number) => {
      const ramp = buildPaletteRamp(
        settings.primaryColor,
        settings.secondaryColor || "#000000",
        steps
      );
      if (ramp.length === 0) return;
      if (!activePaletteId) return;
      setPalettes((prev) =>
        prev.map((palette) =>
          palette.id === activePaletteId
            ? { ...palette, colors: [...palette.colors, ...ramp] }
            : palette
        )
      );
    },
    [settings.primaryColor, settings.secondaryColor, activePaletteId, setPalettes]
  );

  const handleDeletePalette = useCallback(
    (id: string) => {
      setPalettes((prev) => prev.filter((p) => p.id !== id));
      if (activePaletteId === id) {
        setActivePaletteId(palettes.find((p) => p.id !== id)?.id || "default");
      }
    },
    [activePaletteId, palettes, setPalettes, setActivePaletteId]
  );

  const handleAddColorToPalette = useCallback(
    (paletteId: string, color: string) => {
      setPalettes((prev) =>
        prev.map((p) =>
          p.id === paletteId ? { ...p, colors: [...p.colors, color] } : p
        )
      );
    },
    [setPalettes]
  );

  const handleRemoveColorFromPalette = useCallback(
    (paletteId: string, colorIndex: number) => {
      setPalettes((prev) =>
        prev.map((p) =>
          p.id === paletteId
            ? { ...p, colors: p.colors.filter((_, i) => i !== colorIndex) }
            : p
        )
      );
    },
    [setPalettes]
  );

  const handleSwapColors = useCallback(
    (fromColor: string, toColor: string) => {
      if (isActiveLayerLocked) return;
      const from = hexToRgb(fromColor);
      const to = hexToRgb(toColor);
      if (!from || !to) return;

      historyRef.current?.commitLayers(frameLayers);
      const next: Record<string, LayerData[]> = {};
      Object.entries(frameLayers).forEach(([frameId, layers]) => {
        next[frameId] = layers.map((layer) => {
          if (!layer.pixels) return layer;
          const updated = new Uint8ClampedArray(layer.pixels);
          for (let i = 0; i < updated.length; i += 4) {
            if (
              updated[i] === from.r &&
              updated[i + 1] === from.g &&
              updated[i + 2] === from.b
            ) {
              updated[i] = to.r;
              updated[i + 1] = to.g;
              updated[i + 2] = to.b;
            }
          }
          return { ...layer, pixels: updated };
        });
      });
      setFrameLayers(next);
      rebuildFramesFromLayers(next);
      syncHistoryFlags();
    },
    [
      isActiveLayerLocked,
      frameLayers,
      historyRef,
      setFrameLayers,
      rebuildFramesFromLayers,
      syncHistoryFlags,
    ]
  );

  return {
    handleCreatePalette,
    handleImportPalette,
    handleExportPalette,
    handleExtractPaletteFromImage,
    handleGeneratePaletteRamp,
    handleDeletePalette,
    handleAddColorToPalette,
    handleRemoveColorFromPalette,
    handleSwapColors,
  };
}

export default usePaletteManager;
