/**
 * src/ui/ToolOptionsPanel.tsx
 * -----------------------------------------------------------------------------
 * ## TOOL OPTIONS (Noob Guide)
 * 
 * Every tool has "Secret Settings". This panel shows them.
 * 
 * - If you have the PEN, you can change its SIZE or OPACITY.
 * - If you have a SELECTION tool, you can change if it REPLACES or ADDS 
 *   to what you already picked.
 * - If you have the GRADIENT tool, you can choose between LINEAR or RADIAL.
 */
import React from "react";
import { ToolId, UiSettings, GradientType, DitheringType } from "../types";


type Props = {
  tool: ToolId;
  settings: UiSettings;
  onChangeSettings: (settings: UiSettings) => void;
};

export default function ToolOptionsPanel({ tool, settings, onChangeSettings }: Props) {
  const updateSetting = <K extends keyof UiSettings>(key: K, value: UiSettings[K]) => {
    onChangeSettings({ ...settings, [key]: value });
  };

  const isDrawingTool = tool === "pen" || tool === "eraser" || tool === "smudge" || tool === "line" || 
                        tool === "rectangle" || tool === "circle" || tool === "ellipse" || 
                        tool === "rectangleFilled" || tool === "circleFilled" || tool === "ellipseFilled";
  
  const isSelectionTool = tool === "selectRect" || tool === "selectEllipse" || tool === "selectLasso" || tool === "selectWand";

  return (
    <div className="panel">
      <div className="panel__header">
        <div className="panel__title">Tool Options</div>
      </div>

      <div className="panel__body">
        {isDrawingTool && (
          <div className="option-group">
            <label className="option-row">
              <span>Size</span>
              <input
                type="range"
                min={1}
                max={50}
                value={settings.brushSize}
                onChange={(e) => updateSetting("brushSize", Number(e.target.value))}
              />
              <span className="mono">{settings.brushSize}px</span>
            </label>

            {tool !== "eraser" && (
              <label className="option-row">
                <span>Opacity</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round((settings.brushOpacity ?? 1) * 100)}
                  onChange={(e) => updateSetting("brushOpacity", Number(e.target.value) / 100)}
                />
                <span className="mono">{Math.round((settings.brushOpacity ?? 1) * 100)}%</span>
              </label>
            )}

            {(tool === "pen" || tool === "eraser" || tool === "smudge") && (
              <>
                 <label className="option-row">
                  <span>Pressure</span>
                  <select
                    value={settings.pressureMode}
                    onChange={(e) => updateSetting("pressureMode", e.target.value as UiSettings["pressureMode"])}
                  >
                    <option value="off">Off</option>
                    <option value="size">Brush Size</option>
                    <option value="opacity">Opacity</option>
                  </select>
                </label>

                {settings.pressureMode !== "off" && (
                  <label className="option-row">
                    <span>Smoothing</span>
                    <input
                      type="range"
                      min={0.05}
                      max={0.6}
                      step={0.05}
                      value={settings.pressureEasing}
                      onChange={(e) => updateSetting("pressureEasing", Number(e.target.value))}
                    />
                    <span className="mono">{settings.pressureEasing.toFixed(2)}</span>
                  </label>
                )}
                 {tool !== "smudge" && (
                  <label className="option-row">
                    <input
                      type="checkbox"
                      checked={settings.brushStabilizerEnabled}
                      onChange={(e) => updateSetting("brushStabilizerEnabled", e.target.checked)}
                    />
                    <span>Stabilizer</span>
                  </label>
                )}
              </>
            )}

            {tool === "pen" && (
              <label className="option-row">
                <span>Texture</span>
                <select
                  value={settings.brushTexture}
                  onChange={(e) => updateSetting("brushTexture", e.target.value as UiSettings["brushTexture"])}
                >
                  <option value="none">Solid</option>
                  <option value="noise">Noise Mask</option>
                  <option value="dither">Dither Mask</option>
                </select>
              </label>
            )}

            {tool === "smudge" && (
              <label className="option-row">
                <span>Strength</span>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={settings.smudgeStrength}
                  onChange={(e) => updateSetting("smudgeStrength", Number(e.target.value))}
                />
                <span className="mono">{settings.smudgeStrength}%</span>
              </label>
            )}
          </div>
        )}
        
        {isSelectionTool && (
           <div className="option-group">
              <div className="option-label">Selection Mode</div>
              <div className="ui-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                 <button 
                    className={`uiBtn uiBtn--small ${settings.selectionMode === "replace" ? "uiBtn--active" : "uiBtn--ghost"}`}
                    onClick={() => updateSetting("selectionMode", "replace")}
                    title="Replace Selection"
                 >
                   Replace
                 </button>
                 <button 
                    className={`uiBtn uiBtn--small ${settings.selectionMode === "add" ? "uiBtn--active" : "uiBtn--ghost"}`}
                    onClick={() => updateSetting("selectionMode", "add")}
                    title="Add to Selection"
                 >
                   Add
                 </button>
                 <button 
                    className={`uiBtn uiBtn--small ${settings.selectionMode === "subtract" ? "uiBtn--active" : "uiBtn--ghost"}`}
                    onClick={() => updateSetting("selectionMode", "subtract")}
                    title="Subtract from Selection"
                 >
                   Sub
                 </button>
              </div>

              {tool === "selectWand" && (
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
              )}
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
            <label className="option-row">
              <span>Pattern</span>
              <select
                value={settings.fillPattern}
                onChange={(e) => updateSetting("fillPattern", e.target.value as UiSettings["fillPattern"])}
              >
                <option value="solid">Solid Color</option>
                <option value="checker">Checker 8x8</option>
                <option value="dither">Dither 8x8</option>
                <option value="noise">Noise 8x8</option>
              </select>
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
              checked={settings.symmetryMode === "radial"}
              onChange={() => updateSetting("symmetryMode", "radial")}
            />
            <span>Radial</span>
          </label>

          {settings.symmetryMode !== "none" && (
            <label className="option-row" style={{ marginTop: "6px" }}>
              <span>Axis angle</span>
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={settings.symmetryAngle}
                onChange={(e) => updateSetting("symmetryAngle", Number(e.target.value))}
              />
              <span className="mono">{settings.symmetryAngle}°</span>
            </label>
          )}

          {settings.symmetryMode === "radial" && (
            <label className="option-row">
              <span>Segments</span>
              <input
                type="number"
                min={2}
                max={32}
                value={settings.symmetrySegments}
                onChange={(e) => updateSetting("symmetrySegments", Number(e.target.value))}
              />
            </label>
          )}
        </div>

        <div className="option-group">
          <div className="option-label">Edge Snapping</div>
          <label className="option-row">
            <input
              type="checkbox"
              checked={settings.edgeSnapEnabled}
              onChange={(e) => updateSetting("edgeSnapEnabled", e.target.checked)}
            />
            <span>Snap brush to edges</span>
          </label>
          {settings.edgeSnapEnabled && (
            <label className="option-row">
              <span>Snap Radius</span>
              <input
                type="range"
                min={1}
                max={12}
                value={settings.edgeSnapRadius}
                onChange={(e) => updateSetting("edgeSnapRadius", Number(e.target.value))}
              />
              <span className="mono">{settings.edgeSnapRadius}px</span>
            </label>
          )}
        </div>

        <div className="option-group">
          <div className="option-label">Physics Guides</div>
          <label className="option-row">
            <input
              type="checkbox"
              checked={settings.showArcGuides}
              onChange={(e) => updateSetting("showArcGuides", e.target.checked)}
            />
            <span>Show arc guides</span>
          </label>
          <label className="option-row">
            <input
              type="checkbox"
              checked={settings.showGravityGuides}
              onChange={(e) => updateSetting("showGravityGuides", e.target.checked)}
            />
            <span>Show gravity guides</span>
          </label>
          <label className="option-row">
            <input
              type="checkbox"
              checked={settings.showMotionTrails}
              onChange={(e) => updateSetting("showMotionTrails", e.target.checked)}
            />
            <span>Motion trails on onion skin</span>
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
            <div className="ui-row">
               <span className="muted" style={{fontSize: 10}}>Prev:</span>
               <input
                  type="number"
                  min={0}
                  max={5}
                  value={settings.onionPrev}
                  onChange={(e) => updateSetting("onionPrev", Number(e.target.value))}
                  style={{width: 40}}
                />
               <span className="muted" style={{fontSize: 10}}>Next:</span>
               <input
                  type="number"
                  min={0}
                  max={5}
                  value={settings.onionNext}
                  onChange={(e) => updateSetting("onionNext", Number(e.target.value))}
                  style={{width: 40}}
                />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
