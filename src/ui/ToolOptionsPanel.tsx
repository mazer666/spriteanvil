import React from "react";
import { ToolId, UiSettings, GradientType, DitheringType, SymmetryMode } from "../types";

type Props = {
  tool: ToolId;
  settings: UiSettings;
  onChangeSettings: (settings: UiSettings) => void;
};

export default function ToolOptionsPanel({ tool, settings, onChangeSettings }: Props) {
  const updateSetting = <K extends keyof UiSettings>(key: K, value: UiSettings[K]) => {
    onChangeSettings({ ...settings, [key]: value });
  };

  return (
    <div className="panel">
      <div className="panel__header">
        <div className="panel__title">Tool Options</div>
      </div>

      <div className="panel__body">
        {(tool === "pen" || tool === "eraser") && (
          <div className="option-group">
            <label className="option-row">
              <span>Brush Size</span>
              <input
                type="range"
                min={1}
                max={50}
                value={settings.brushSize}
                onChange={(e) => updateSetting("brushSize", Number(e.target.value))}
              />
              <span className="mono">{settings.brushSize}px</span>
            </label>

            <label className="option-row">
              <input
                type="checkbox"
                checked={settings.brushStabilizerEnabled}
                onChange={(e) => updateSetting("brushStabilizerEnabled", e.target.checked)}
              />
              <span>Brush Stabilizer</span>
            </label>
          </div>
        )}

        {tool === "fill" && (
          <div className="option-group">
            <label className="option-row">
              <span>Tolerance</span>
              <input
                type="range"
                min={0}
                max={255}
                value={settings.fillTolerance}
                onChange={(e) => updateSetting("fillTolerance", Number(e.target.value))}
              />
              <span className="mono">{settings.fillTolerance}</span>
            </label>
            <div className="option-hint">
              Higher tolerance fills similar colors
            </div>
          </div>
        )}

        {tool === "gradient" && (
          <div className="option-group">
            <label className="option-row">
              <span>Gradient Type</span>
              <select
                value={settings.gradientType}
                onChange={(e) => updateSetting("gradientType", e.target.value as GradientType)}
              >
                <option value="linear">Linear</option>
                <option value="radial">Radial</option>
                <option value="angle">Angle</option>
                <option value="reflected">Reflected</option>
                <option value="diamond">Diamond</option>
              </select>
            </label>

            <label className="option-row">
              <span>Color A</span>
              <input
                type="color"
                value={settings.primaryColor}
                onChange={(e) => updateSetting("primaryColor", e.target.value)}
              />
            </label>

            <label className="option-row">
              <span>Color B</span>
              <input
                type="color"
                value={settings.secondaryColor || "#000000"}
                onChange={(e) => updateSetting("secondaryColor", e.target.value)}
              />
            </label>

            <label className="option-row">
              <span>Dithering</span>
              <select
                value={settings.ditheringType}
                onChange={(e) => updateSetting("ditheringType", e.target.value as DitheringType)}
              >
                <option value="none">None (Smooth)</option>
                <option value="bayer">Bayer Matrix</option>
                <option value="floyd">Floyd-Steinberg</option>
              </select>
            </label>
          </div>
        )}

        {tool === "selectWand" && (
          <div className="option-group">
            <label className="option-row">
              <span>Tolerance</span>
              <input
                type="range"
                min={0}
                max={255}
                value={settings.wandTolerance}
                onChange={(e) => updateSetting("wandTolerance", Number(e.target.value))}
              />
              <span className="mono">{settings.wandTolerance}</span>
            </label>
            <div className="option-hint">
              Select similar colors within tolerance
            </div>
          </div>
        )}

        <div className="option-group">
          <div className="option-label">Symmetry Mode</div>
          <label className="option-row">
            <input
              type="radio"
              name="symmetry"
              checked={settings.symmetryMode === "none"}
              onChange={() => updateSetting("symmetryMode", "none")}
            />
            <span>None</span>
          </label>
          <label className="option-row">
            <input
              type="radio"
              name="symmetry"
              checked={settings.symmetryMode === "horizontal"}
              onChange={() => updateSetting("symmetryMode", "horizontal")}
            />
            <span>Horizontal Mirror</span>
          </label>
          <label className="option-row">
            <input
              type="radio"
              name="symmetry"
              checked={settings.symmetryMode === "vertical"}
              onChange={() => updateSetting("symmetryMode", "vertical")}
            />
            <span>Vertical Mirror</span>
          </label>
          <label className="option-row">
            <input
              type="radio"
              name="symmetry"
              checked={settings.symmetryMode === "both"}
              onChange={() => updateSetting("symmetryMode", "both")}
            />
            <span>Both Axes</span>
          </label>
          <label className="option-row">
            <input
              type="radio"
              name="symmetry"
              checked={settings.symmetryMode === "radial4"}
              onChange={() => updateSetting("symmetryMode", "radial4")}
            />
            <span>Radial 4-way</span>
          </label>
          <label className="option-row">
            <input
              type="radio"
              name="symmetry"
              checked={settings.symmetryMode === "radial8"}
              onChange={() => updateSetting("symmetryMode", "radial8")}
            />
            <span>Radial 8-way</span>
          </label>
        </div>

        <div className="option-group">
          <div className="option-label">Background</div>
          <label className="option-row">
            <select
              value={settings.backgroundMode}
              onChange={(e) => updateSetting("backgroundMode", e.target.value as any)}
            >
              <option value="solidDark">Solid Dark</option>
              <option value="solidLight">Solid Light</option>
              <option value="checker">Checkerboard</option>
              <option value="greenscreen">Greenscreen</option>
              <option value="bluescreen">Bluescreen</option>
            </select>
          </label>

          {settings.backgroundMode === "checker" && (
            <>
              <label className="option-row">
                <span>Size</span>
                <input
                  type="range"
                  min={8}
                  max={64}
                  step={1}
                  value={settings.checkerSize}
                  onChange={(e) => updateSetting("checkerSize", Number(e.target.value))}
                />
                <span className="mono">{settings.checkerSize}px</span>
              </label>
            </>
          )}
        </div>

        <div className="option-group">
          <div className="option-label">View Options</div>
          <label className="option-row">
            <input
              type="checkbox"
              checked={settings.showGrid}
              onChange={(e) => updateSetting("showGrid", e.target.checked)}
            />
            <span>Show Grid</span>
          </label>

          {settings.showGrid && (
            <label className="option-row">
              <span>Grid Size</span>
              <input
                type="number"
                min={1}
                max={64}
                value={settings.gridSize}
                onChange={(e) => updateSetting("gridSize", Number(e.target.value))}
              />
              <span>px</span>
            </label>
          )}

          <label className="option-row">
            <input
              type="checkbox"
              checked={settings.showOnionSkin}
              onChange={(e) => updateSetting("showOnionSkin", e.target.checked)}
            />
            <span>Onion Skin</span>
          </label>

          {settings.showOnionSkin && (
            <>
              <label className="option-row">
                <span>Previous Frames</span>
                <input
                  type="number"
                  min={0}
                  max={15}
                  value={settings.onionPrev}
                  onChange={(e) => updateSetting("onionPrev", Number(e.target.value))}
                />
              </label>
              <label className="option-row">
                <span>Next Frames</span>
                <input
                  type="number"
                  min={0}
                  max={15}
                  value={settings.onionNext}
                  onChange={(e) => updateSetting("onionNext", Number(e.target.value))}
                />
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
