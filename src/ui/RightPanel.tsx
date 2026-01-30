import React, { useEffect, useMemo, useState } from "react";
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
  const defaultOrder = ["tools", "layers", "colors", "transform", "selection", "ai"];
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("spriteanvil:rightpanelOrder");
      if (!raw) return defaultOrder;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return defaultOrder;
      const normalized = parsed.filter((id) => defaultOrder.includes(id));
      return normalized.length ? normalized : defaultOrder;
    } catch {
      return defaultOrder;
    }
  });
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    tools: true,
    layers: true,
    colors: true,
    transform: true,
    selection: true,
    ai: true,
  });
  const [compactSections, setCompactSections] = useState<Record<string, boolean>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("spriteanvil:rightpanelOrder", JSON.stringify(sectionOrder));
  }, [sectionOrder]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleCompact = (key: string) => {
    setCompactSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const sections = useMemo(
    () => ({
      tools: {
        title: "Tools",
        content: (
          <>
            <ToolOptionsPanel tool={tool} settings={settings} onChangeSettings={onChangeSettings} />
            {canvasSpec && previewBuffer && (
              <MipmapPreview canvasSpec={canvasSpec} pixels={previewBuffer} />
            )}
          </>
        ),
      },
      layers: {
        title: "Layers",
        content:
          layers && activeLayerId && onLayerOperations ? (
            <LayerPanel layers={layers} activeLayerId={activeLayerId} {...onLayerOperations} />
          ) : null,
      },
      colors: {
        title: "Colors & Palettes",
        content: (
          <>
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
            {onColorAdjustOperations && <ColorAdjustPanel {...onColorAdjustOperations} />}
          </>
        ),
      },
      transform: {
        title: "Transform",
        content: onTransformOperations ? <TransformPanel {...onTransformOperations} /> : null,
      },
      selection: {
        title: "Selection",
        content: onSelectionOperations ? (
          <SelectionPanel hasSelection={!!hasSelection} {...onSelectionOperations} />
        ) : null,
      },
      ai: {
        title: "AI Tools",
        content: (
          <AIPanel
            enabled
            canvasSpec={canvasSpec}
            selectionMask={selectionMask}
            layerPixels={layerPixels}
            onInpaint={onInpaint}
            onImageToImage={onImageToImage}
          />
        ),
      },
    }),
    [
      activeLayerId,
      canvasSpec,
      hasSelection,
      layers,
      onChangeSettings,
      onColorAdjustOperations,
      onImageToImage,
      onInpaint,
      onLayerOperations,
      onPaletteOperations,
      onSelectionOperations,
      onTransformOperations,
      palettes,
      previewBuffer,
      recentColors,
      selectionMask,
      settings,
      tool,
      layerPixels,
    ]
  );

  const handleDragStart = (id: string) => (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(id);
  };

  const handleDrop = (targetId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = draggingId || e.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === targetId) return;
    setSectionOrder((prev) => {
      const fromIndex = prev.indexOf(sourceId);
      const toIndex = prev.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const next = [...prev];
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, sourceId);
      return next;
    });
    setDraggingId(null);
  };

  const handleDragEnd = () => setDraggingId(null);

  return (
    <div className={"rightpanel" + (collapsed ? " rightpanel--collapsed" : "")}>
      <div className="rightpanel__content">
        {sectionOrder.map((sectionId) => {
          const section = sections[sectionId as keyof typeof sections];
          if (!section) return null;
          const isOpen = openSections[sectionId];
          const isCompact = compactSections[sectionId];
          return (
            <section
              key={sectionId}
              className={
                "accordion-section" +
                (isCompact ? " accordion-section--compact" : "") +
                (draggingId === sectionId ? " accordion-section--dragging" : "")
              }
              draggable
              onDragStart={handleDragStart(sectionId)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop(sectionId)}
              onDragEnd={handleDragEnd}
            >
              <div className="accordion-section__header">
                <button
                  className="accordion-section__toggle"
                  onClick={() => toggleSection(sectionId)}
                  aria-expanded={isOpen}
                  type="button"
                >
                  <span>{section.title}</span>
                  <span className="accordion-section__icon">{isOpen ? "−" : "+"}</span>
                </button>
                <div className="accordion-section__tools">
                  <button
                    className="uiBtn uiBtn--ghost"
                    onClick={() => toggleCompact(sectionId)}
                    title={isCompact ? "Expand section spacing" : "Compact section spacing"}
                    type="button"
                  >
                    {isCompact ? "Expand" : "Compact"}
                  </button>
                  <span className="accordion-section__drag" title="Drag to reorder">
                    ☰
                  </span>
                </div>
              </div>
              {isOpen && <div className="accordion-section__body">{section.content}</div>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
