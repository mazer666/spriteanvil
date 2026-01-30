import React, { useMemo, useState } from "react";
import { UiSettings, ToolId, LayerData, BlendMode } from "../types";
import LayerPanel from "./LayerPanel";
import PalettePanel, { PaletteData } from "./PalettePanel";
import TransformPanel from "./TransformPanel";
import ColorAdjustPanel from "./ColorAdjustPanel";
import ToolOptionsPanel from "./ToolOptionsPanel";
import SelectionPanel from "./SelectionPanel";
import AIPanel from "./AIPanel";

type Props = {
  tool: ToolId;
  settings: UiSettings;
  onChangeSettings: (next: UiSettings) => void;

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
  };

  onTransformOperations?: {
    onFlipHorizontal: () => void;
    onFlipVertical: () => void;
    onRotate90CW: () => void;
    onRotate90CCW: () => void;
    onRotate180: () => void;
    onScale: (scaleX: number, scaleY: number) => void;
    onRotate: (degrees: number) => void;
  };

  onColorAdjustOperations?: {
    onAdjustHue: (hueShift: number) => void;
    onAdjustSaturation: (saturationDelta: number) => void;
    onAdjustBrightness: (brightnessDelta: number) => void;
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
}: Props) {
  const tabs = useMemo(
    () => ["Tool", "Layers", "Palette", "Transform", "Color", "Selection", "AI"] as const,
    []
  );
  const [active, setActive] = useState<(typeof tabs)[number]>("Tool");

  return (
    <div className="rightpanel">
      <div className="rightpanel__tabs">
        {tabs.map((t) => (
          <button
            key={t}
            className={"tab" + (active === t ? " tab--active" : "")}
            onClick={() => setActive(t)}
          >
            {t}
            {t === "Selection" && hasSelection && <span className="tab__badge">•</span>}
          </button>
        ))}
      </div>

      <div className="rightpanel__content" style={{ height: "calc(100% - 40px)", overflow: "auto" }}>
        {active === "Tool" && (
          <ToolOptionsPanel tool={tool} settings={settings} onChangeSettings={onChangeSettings} />
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

        {active === "AI" && <AIPanel enabled={false} />}
      </div>
    </div>
  );
}
