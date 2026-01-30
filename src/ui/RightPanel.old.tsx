import React, { useMemo, useState } from "react";
import { UiSettings, CanvasSpec, Frame } from "../types";
import LayerPanel from "./LayerPanel";
import { LayerData, BlendMode } from "../types";
import PalettePanel from "./PalettePanel";
import { PaletteData } from "../lib/projects/snapshot";
import TransformPanel from "./TransformPanel";
import ColorAdjustPanel from "./ColorAdjustPanel";

type Props = {
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
  };

  onColorAdjustOperations?: {
    onAdjustHue: (hueShift: number) => void;
    onAdjustSaturation: (saturationDelta: number) => void;
    onAdjustBrightness: (brightnessDelta: number) => void;
    onInvert: () => void;
    onDesaturate: () => void;
    onPosterize: (levels: number) => void;
  };
};

export default function RightPanel({
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
}: Props) {
  const tabs = useMemo(() => ["Settings", "Layers", "Palette", "Transform", "Color"] as const, []);
  const [active, setActive] = useState<(typeof tabs)[number]>("Settings");

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
          </button>
        ))}
      </div>

      <div className="rightpanel__content" style={{ height: 'calc(100% - 40px)', overflow: 'auto' }}>
        {active === "Settings" && (
          <section>
            <h3>Settings</h3>

            <div className="card">
              <div className="card__row">
                <span>Onion Skin</span>
                <label className="ui-row">
                  <input
                    type="checkbox"
                    checked={settings.showOnionSkin}
                    onChange={(e) =>
                      onChangeSettings({ ...settings, showOnionSkin: e.target.checked })
                    }
                  />
                  <span>Enabled</span>
                </label>
              </div>

              <div className="card__row">
                <span>Prev / Next</span>
                <div className="ui-row">
                  <input
                    type="number"
                    min={0}
                    max={15}
                    value={settings.onionPrev}
                    onChange={(e) =>
                      onChangeSettings({ ...settings, onionPrev: Number(e.target.value) })
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    max={15}
                    value={settings.onionNext}
                    onChange={(e) =>
                      onChangeSettings({ ...settings, onionNext: Number(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="card__row">
                <span>Show Grid</span>
                <label className="ui-row">
                  <input
                    type="checkbox"
                    checked={settings.showGrid}
                    onChange={(e) =>
                      onChangeSettings({ ...settings, showGrid: e.target.checked })
                    }
                  />
                  <span>Enabled</span>
                </label>
              </div>

              <div className="card__row">
                <span>Brush Stabilizer</span>
                <label className="ui-row">
                  <input
                    type="checkbox"
                    checked={settings.brushStabilizerEnabled}
                    onChange={(e) =>
                      onChangeSettings({ ...settings, brushStabilizerEnabled: e.target.checked })
                    }
                  />
                  <span>Enabled</span>
                </label>
              </div>
            </div>
          </section>
        )}

        {active === "Layers" && layers && onLayerOperations && (
          <LayerPanel
            layers={layers}
            activeLayerId={activeLayerId || null}
            {...onLayerOperations}
          />
        )}

        {active === "Palette" && palettes && onPaletteOperations && (
          <PalettePanel
            palettes={palettes}
            activePaletteId={activePaletteId || null}
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
      </div>
    </div>
  );
}
