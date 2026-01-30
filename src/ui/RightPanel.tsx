import React, { useMemo, useState } from "react";
import { UiSettings, ToolId, LayerData, BlendMode, CanvasSpec } from "../types";
import LayerPanel from "./LayerPanel";
import PalettePanel from "./PalettePanel";
import { PaletteData } from "../lib/projects/snapshot";
import TransformPanel from "./TransformPanel";
import ColorAdjustPanel from "./ColorAdjustPanel";
import ToolOptionsPanel from "./ToolOptionsPanel";
import SelectionPanel from "./SelectionPanel";
import AIPanel from "./AIPanel";
import MipmapPreview from "./MipmapPreview";

type Props = {
  tool: ToolId;
  settings: UiSettings;
  onChangeSettings: (next: UiSettings) => void;
  canvasSpec?: CanvasSpec;
  previewBuffer?: Uint8ClampedArray;
  selectionMask?: Uint8Array | null;
  layerPixels?: Uint8ClampedArray | null;
  onInpaint?: (payload: { prompt: string; denoiseStrength: number; promptInfluence: number }) => Promise<string>;
  onImageToImage?: (payload: { prompt: string; denoiseStrength: number; promptInfluence: number }) => Promise<string>;
  collapsed?: boolean;

  layers?: LayerData[];
  activeLayerId?: string | null;
  onLayerOperations?: {
    onSelectLayer: (id: string) => void;
    onCreateLayer: () => void;
    onDeleteLayer: (id: string) => void;
    onDuplicateLayer: (id: string) => void;
    onToggleVisibility: (id: string) => void;
    onToggleLock: (id: string) => void;
    onUpdateOpacity: (id: string, opacity: number) => void;
    onUpdateBlendMode: (id: string, mode: BlendMode) => void;
    onRenameLayer: (id: string, name: string) => void;
    onReorderLayers: (fromIndex: number, toIndex: number) => void;
    onMergeDown: (id: string) => void;
    onFlatten: () => void;
  };

  palettes?: PaletteData[];
  activePaletteId?: string | null;
  recentColors?: string[];
  onPaletteOperations?: {
    onSelectPalette: (id: string) => void;
    onCreatePalette: (name: string, colors: string[]) => void;
    onDeletePalette: (id: string) => void;
    onAddColorToPalette: (paletteId: string, color: string) => void;
    onRemoveColorFromPalette: (paletteId: string, colorIndex: number) => void;
    onSelectColor: (color: string) => void;
    onSwapColors: (fromColor: string, toColor: string) => void;
    onExtractPalette: () => void;
    onImportPalette: (file: File) => void;
    onExportPalette: (format: "gpl" | "ase") => void;
    onGenerateRamp: (steps: number) => void;
  };

  onTransformOperations?: {
    onFlipHorizontal: () => void;
    onFlipVertical: () => void;
    onRotate90CW: () => void;
    onRotate90CCW: () => void;
    onRotate180: () => void;
    onScale: (scaleX: number, scaleY: number) => void;
    onRotate: (degrees: number) => void;
    onSmartOutline: (mode: import("../editor/outline").OutlineMode) => void;
  };

  onColorAdjustOperations?: {
    onAdjustHue: (hueShift: number) => void;
    onAdjustSaturation: (saturationDelta: number) => void;
    onAdjustBrightness: (brightnessDelta: number) => void;
    onPreviewAdjust: (preview: { hueShift: number; saturationDelta: number; brightnessDelta: number }) => void;
    onClearPreview: () => void;
    onInvert: () => void;
    onDesaturate: () => void;
    onPosterize: (levels: number) => void;
  };

  hasSelection?: boolean;
  onSelectionOperations?: {
    onSelectAll: () => void;
    onDeselect: () => void;
    onInvertSelection: () => void;
    onGrow: () => void;
    onShrink: () => void;
    onFeather: (radius: number) => void;
    onDetectObject: () => void;
  };
};

export default function RightPanel({
  tool,
  settings,
  onChangeSettings,
  layers,
  activeLayerId,
  onLayerOperations,
  palettes,
  activePaletteId,
  recentColors,
  onPaletteOperations,
  onTransformOperations,
  onColorAdjustOperations,
  hasSelection,
  onSelectionOperations,
  canvasSpec,
  previewBuffer,
  selectionMask,
  layerPixels,
  onInpaint,
  onImageToImage,
  collapsed = false,
}: Props) {
  const tabs = useMemo(
    () => ["Tool", "Layers", "Palette", "Transform", "Color", "Selection", "AI"] as const,
    []
  );
  const [active, setActive] = useState<(typeof tabs)[number]>("Tool");
  const tabIcons: Record<(typeof tabs)[number], string> = {
    Tool: "🛠",
    Layers: "🗂",
    Palette: "🎨",
    Transform: "🧭",
    Color: "🌈",
    Selection: "🔲",
    AI: "🤖",
  };

  return (
    <div className={"rightpanel" + (collapsed ? " rightpanel--collapsed" : "")}>
      <div className="rightpanel__tabs">
        {tabs.map((t) => (
          <button
            key={t}
            className={"tab" + (active === t ? " tab--active" : "")}
            onClick={() => setActive(t)}
          >
            <span className="tab__icon" aria-hidden="true">{tabIcons[t]}</span>
            <span className="tab__label">{t}</span>
            {t === "Selection" && hasSelection && <span className="tab__badge">•</span>}
          </button>
        ))}
      </div>

      <div className="rightpanel__content" style={{ height: "calc(100% - 40px)", overflow: "auto" }}>
        {active === "Tool" && (
          <>
            <ToolOptionsPanel tool={tool} settings={settings} onChangeSettings={onChangeSettings} />
            {canvasSpec && previewBuffer && (
              <MipmapPreview canvasSpec={canvasSpec} pixels={previewBuffer} />
            )}
          </>
        )}

        {active === "Layers" && layers && activeLayerId && onLayerOperations && (
          <LayerPanel
            layers={layers}
            activeLayerId={activeLayerId}
            {...onLayerOperations}
          />
        )}

        {active === "Palette" && palettes && activePaletteId && onPaletteOperations && (
          <PalettePanel
            palettes={palettes}
            activePaletteId={activePaletteId}
            primaryColor={settings.primaryColor}
            secondaryColor={settings.secondaryColor}
            recentColors={recentColors || []}
            {...onPaletteOperations}
          />
        )}

        {active === "Transform" && onTransformOperations && (
          <TransformPanel {...onTransformOperations} />
        )}

        {active === "Color" && onColorAdjustOperations && (
          <ColorAdjustPanel {...onColorAdjustOperations} />
        )}

        {active === "Selection" && onSelectionOperations && (
          <SelectionPanel hasSelection={!!hasSelection} {...onSelectionOperations} />
        )}

        {active === "AI" && (
          <AIPanel
            enabled
            canvasSpec={canvasSpec}
            selectionMask={selectionMask}
            layerPixels={layerPixels}
            onInpaint={onInpaint}
            onImageToImage={onImageToImage}
          />
        )}
      </div>
    </div>
  );
}
