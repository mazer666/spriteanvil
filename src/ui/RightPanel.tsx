import React, { useState } from "react";
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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    art: true,
    color: true,
    transform: true,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className={"rightpanel" + (collapsed ? " rightpanel--collapsed" : "")}>
      <div className="rightpanel__content">
        <section className="accordion-section">
          <button
            className="accordion-section__header"
            onClick={() => toggleSection("art")}
            aria-expanded={openSections.art}
          >
            <span>Art & Layers</span>
            <span className="accordion-section__icon">{openSections.art ? "−" : "+"}</span>
          </button>
          {openSections.art && (
            <div className="accordion-section__body">
              <ToolOptionsPanel tool={tool} settings={settings} onChangeSettings={onChangeSettings} />
              {canvasSpec && previewBuffer && (
                <MipmapPreview canvasSpec={canvasSpec} pixels={previewBuffer} />
              )}
              {layers && activeLayerId && onLayerOperations && (
                <LayerPanel
                  layers={layers}
                  activeLayerId={activeLayerId}
                  {...onLayerOperations}
                />
              )}
            </div>
          )}
        </section>

        <section className="accordion-section">
          <button
            className="accordion-section__header"
            onClick={() => toggleSection("color")}
            aria-expanded={openSections.color}
          >
            <span>Colors & Palettes</span>
            <span className="accordion-section__icon">{openSections.color ? "−" : "+"}</span>
          </button>
          {openSections.color && (
            <div className="accordion-section__body">
              {palettes && activePaletteId && onPaletteOperations && (
                <PalettePanel
                  palettes={palettes}
                  activePaletteId={activePaletteId}
                  primaryColor={settings.primaryColor}
                  secondaryColor={settings.secondaryColor}
                  recentColors={recentColors || []}
                  {...onPaletteOperations}
                />
              )}
              {onColorAdjustOperations && (
                <ColorAdjustPanel {...onColorAdjustOperations} />
              )}
            </div>
          )}
        </section>

        <section className="accordion-section">
          <button
            className="accordion-section__header"
            onClick={() => toggleSection("transform")}
            aria-expanded={openSections.transform}
          >
            <span>Transform & AI</span>
            <span className="accordion-section__icon">{openSections.transform ? "−" : "+"}</span>
          </button>
          {openSections.transform && (
            <div className="accordion-section__body">
              {onTransformOperations && <TransformPanel {...onTransformOperations} />}
              {onSelectionOperations && (
                <SelectionPanel hasSelection={!!hasSelection} {...onSelectionOperations} />
              )}
              <AIPanel
                enabled
                canvasSpec={canvasSpec}
                selectionMask={selectionMask}
                layerPixels={layerPixels}
                onInpaint={onInpaint}
                onImageToImage={onImageToImage}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
