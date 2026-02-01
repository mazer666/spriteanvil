/**
 * src/hooks/usePaletteManager.ts
 * -----------------------------------------------------------------------------
 * ## THE PALETTE MANAGER (Noob Guide)
 * 
 * Think of this hook as your **Box of Crayons**.
 * Designing a pixel art game usually requires a limited set of colors to look consistent.
 * 
 * This hook handles:
 * - **Creating/Deleting** crayon boxes (Palettes).
 * - **Adding/Removing** specific colors.
 * - **Importing/Exporting**: Getting palettes from professional artists or saving your own.
 * - **Extraction**: Automatically finding all colors used in your drawing.
 * - **Color Swapping**: Changing "Every Red pixel to Blue" across the whole project.
 * 
 * ### 🎨 Color Swapping Flow (Mermaid)
 *
 * ```mermaid
 * graph LR
 *   A[Start Swap] --> B[Pick Old Color]
 *   B --> C[Pick New Color]
 *   C --> D[Loop Every Frame]
 *   D --> E[Loop Every Layer]
 *   E --> F[Check Every Pixel]
 *   F -- Match Found --> G[Update Pixel]
 *   F -- No Match --> H[Skip]
 *   G --> I[Done]
 *   H --> I
 * ```
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

  // WHAT: Finds every unique color currently visible on your canvas.
  // WHY: To quickly build a palette based on what you've already drawn.
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

  // WHAT: Replaces all instances of one color with another across ALL layers and frames.
  // WHY: If you decide a character's red shirt should actually be blue, you can change it everywhere at once.
  // HOW: It scans every single pixel in the entire project and swaps the RGB values.
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
