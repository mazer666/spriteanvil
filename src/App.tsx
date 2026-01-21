import React, { useMemo, useState } from "react";
import DockLayout from "./ui/DockLayout";
import { UiSettings } from "./types";

/**
 * App Root.
 * Hier halten wir (vorerst) UI-Settings im State.
 * Später ziehen wir das in ein "Store"-Modul (z.B. Zustand) um,
 * aber am Anfang ist plain React-State für Laien leichter.
 */
export default function App() {
  const [settings, setSettings] = useState<UiSettings>(() => ({
    zoom: 8, // 8 = 800% (für Pixelart ist hoher Zoom üblich)
    brushStabilizerEnabled: true,
    backgroundMode: "checker",
    showGrid: true,
    gridSize: 1,
    showOnionSkin: true,
    onionPrev: 1,
    onionNext: 1
  }));

  const zoomLabel = useMemo(() => `${Math.round(settings.zoom * 100)}%`, [settings.zoom]);

  return (
    <DockLayout
      settings={settings}
      onChangeSettings={setSettings}
      topBar={
        <div className="topbar">
          <div className="brand">
            <div className="brand__name">SpriteAnvil</div>
            <div className="brand__tagline">Forge sprites. Shape motion.</div>
          </div>

          <div className="topbar__group">
            <label className="ui-row">
              <input
                type="checkbox"
                checked={settings.brushStabilizerEnabled}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, brushStabilizerEnabled: e.target.checked }))
                }
              />
              <span>Brush Stabilizer</span>
            </label>

            <label className="ui-row">
              <span>Zoom</span>
              <input
                className="zoom"
                type="range"
                min={1}
                max={32}
                step={0.25}
                value={settings.zoom}
                onChange={(e) => setSettings((s) => ({ ...s, zoom: Number(e.target.value) }))}
              />
              <span className="mono">{zoomLabel}</span>
            </label>
          </div>

          <div className="topbar__group">
            <label className="ui-row">
              <span>Background</span>
              <select
                value={settings.backgroundMode}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, backgroundMode: e.target.value as any }))
                }
              >
                <option value="checker">Checkerboard</option>
                <option value="solidDark">Solid (Dark)</option>
                <option value="solidLight">Solid (Light)</option>
                <option value="greenscreen">Greenscreen</option>
                <option value="bluescreen">Bluescreen</option>
              </select>
            </label>

            <label className="ui-row">
              <input
                type="checkbox"
                checked={settings.showGrid}
                onChange={(e) => setSettings((s) => ({ ...s, showGrid: e.target.checked }))}
              />
              <span>Grid</span>
            </label>

            <label className="ui-row">
              <span>Grid size</span>
              <input
                className="gridSize"
                type="number"
                min={1}
                max={64}
                value={settings.gridSize}
                onChange={(e) => setSettings((s) => ({ ...s, gridSize: Number(e.target.value) }))}
              />
              <span className="muted">px</span>
            </label>
          </div>
        </div>
      }
    />
  );
}
