/**
 * src/ui/PalettePanel.tsx
 * -----------------------------------------------------------------------------
 * ## PALETTE PANEL (Noob Guide)
 * 
 * This is where you pick your "Paint Colors".
 * 
 * ## JARGON GLOSSARY
 * 1. PRIMARY COLOR: The color used by the Left Mouse Button.
 * 2. SECONDARY COLOR: The color used by the Right Mouse Button.
 * 3. RAMPS: A sequence of colors from highlight to shadow.
 * 4. HEX CODE: A 6-character code (like #FFFFFF) that names a color.
 * 
 * ## VISUAL FLOW (Mermaid)
 * ```mermaid
 * graph LR
 *   Click[Click Palette Swatch] --> Pick[Update Primary Color]
 *   Pick --> Recent[Push to Recent Colors]
 *   Recent --> Canvas[Brushes now use new color]
 * ```
 */
import React, { useRef, useState } from "react";
import { PaletteData } from "../lib/projects/snapshot";

type Props = {
  palettes: PaletteData[];
  activePaletteId: string | null;
  primaryColor: string;
  secondaryColor?: string;
  recentColors: string[];
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

export default function PalettePanel({
  palettes,
  activePaletteId,
  primaryColor,
  secondaryColor,
  recentColors,
  onSelectPalette,
  onCreatePalette,
  onDeletePalette,
  onAddColorToPalette,
  onRemoveColorFromPalette,
  onSelectColor,
  onSwapColors,
  onExtractPalette,
  onImportPalette,
  onExportPalette,
  onGenerateRamp,
}: Props) {
  const [showNewPalette, setShowNewPalette] = useState(false);
  const [newPaletteName, setNewPaletteName] = useState("");
  const [colorPickerValue, setColorPickerValue] = useState(primaryColor);
  const [swapFromColor, setSwapFromColor] = useState<string | null>(null);
  const [rampSteps, setRampSteps] = useState(6);
  const [showSaved, setShowSaved] = useState(true);
  const [showDefault, setShowDefault] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePalette = palettes.find(p => p.id === activePaletteId);
  const defaultPalettes = palettes.filter((palette) => palette.is_default);
  const savedPalettes = palettes.filter((palette) => !palette.is_default);

/**
 * WHAT: Creates a brand new Palette from scratch.
 * WHY: Artists need to organize colors for specific projects (e.g., "Sky Palette", "Lava Palette").
 * USE: The "+ New" button.
 */
  function createPalette() {
    if (newPaletteName.trim()) {
      onCreatePalette(newPaletteName.trim(), [primaryColor]);
      setNewPaletteName("");
      setShowNewPalette(false);
    }
  }

/**
 * WHAT: Picks a color to start painting.
 * WHY: This is the core interaction for drawing.
 * HOW: It checks if you are in "Swap Mode" first. 
 *      If not, it just sets the Primary Color.
 * 
 * 🛠️ NOOB CHALLENGE: How would you store the "Last 10 Colors" used by the user? 
 * (Hint: Look at the `recentColors` prop.)
 */
  function handleColorClick(color: string) {
    if (swapFromColor) {
      onSwapColors(swapFromColor, color);
      setSwapFromColor(null);
    } else {
      onSelectColor(color);
    }
  }

  return (
    <div className="palette-panel">
      <div className="palette-panel__header">
        Palettes
      </div>

      <div className="palette-panel__primary">
        <div className="palette-panel__block">
          <label className="palette-panel__label">
            Primary Color
          </label>
          <div className="palette-panel__row">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => onSelectColor(e.target.value)}
              className="palette-panel__color-input"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => {
                const val = e.target.value;
                if (/^#[0-9a-fA-F]{0,6}$/.test(val)) {
                  if (val.length === 7) onSelectColor(val);
                  setColorPickerValue(val);
                }
              }}
              className="palette-panel__hex-input"
              placeholder="#RRGGBB"
            />
          </div>
        </div>

        {recentColors.length > 0 && (
          <div>
            <div className="palette-panel__label">Recent Colors</div>
            <div className="palette-panel__recent-grid">
              {recentColors.map((color, idx) => (
                <div
                  key={idx}
                  onClick={() => handleColorClick(color)}
                  style={{
                    background: color,
                    border: color === primaryColor ? '2px solid #fff' : '1px solid #444',
                    cursor: 'pointer',
                    borderRadius: '2px',
                  }}
                  title={color}
                  className="palette-panel__swatch"
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="palette-panel__list">
        <div className="palette-panel__list-header">
          <button
            className="palette-panel__collapse-btn"
            onClick={() => setShowSaved((prev) => !prev)}
            aria-expanded={showSaved}
          >
            {showSaved ? "▾" : "▸"} Saved Palettes
          </button>
          <button
            onClick={() => setShowNewPalette(!showNewPalette)}
            className="palette-panel__small-btn"
            title="Create new palette"
          >
            + New
          </button>
        </div>

        {showNewPalette && (
          <div className="palette-panel__new">
            <input
              type="text"
              value={newPaletteName}
              onChange={(e) => setNewPaletteName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createPalette();
                if (e.key === 'Escape') setShowNewPalette(false);
              }}
              placeholder="Palette name..."
              autoFocus
              className="palette-panel__text-input"
            />
            <div className="palette-panel__row">
              <button onClick={createPalette} className="palette-panel__small-btn">Create</button>
              <button onClick={() => setShowNewPalette(false)} className="palette-panel__small-btn">Cancel</button>
            </div>
          </div>
        )}

        {showSaved && (
          <div className="palette-panel__section palette-panel__section--saved">
            {savedPalettes.length === 0 ? (
              <div className="palette-panel__empty">
                No saved palettes yet. Click + New to create one.
              </div>
            ) : (
              <div className="palette-panel__scroll">
                {savedPalettes.map((palette) => (
                  <div
                    key={palette.id}
                    className="palette-panel__palette-card"
                    style={{
                      background: palette.id === activePaletteId ? '#3a3a3a' : '#2a2a2a',
                      border: '1px solid ' + (palette.id === activePaletteId ? '#555' : '#333'),
                    }}
                    onClick={() => onSelectPalette(palette.id)}
                  >
                    <div className="palette-panel__row palette-panel__row--space">
                      <span className="palette-panel__palette-title">
                        {palette.name}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeletePalette(palette.id); }}
                        className="palette-panel__small-btn"
                        title="Delete palette"
                      >
                        🗑
                      </button>
                    </div>

                    <div className="palette-panel__swatches">
                      {palette.colors.map((color, idx) => (
                        <div
                          key={idx}
                          onClick={(e) => { e.stopPropagation(); handleColorClick(color); }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onRemoveColorFromPalette(palette.id, idx);
                          }}
                          style={{
                            background: color,
                            border: color === primaryColor ? '2px solid #fff' : '1px solid #444',
                            cursor: 'pointer',
                            borderRadius: '2px',
                          }}
                          title={`${color}\nRight-click to remove`}
                          className="palette-panel__swatch"
                        />
                      ))}
                      {palette.id === activePaletteId && (
                        <div
                          onClick={(e) => { e.stopPropagation(); onAddColorToPalette(palette.id, primaryColor); }}
                          className="palette-panel__swatch palette-panel__swatch--add"
                          title="Add current color to palette"
                        >
                          +
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="palette-panel__list-header palette-panel__list-header--secondary">
          <button
            className="palette-panel__collapse-btn"
            onClick={() => setShowDefault((prev) => !prev)}
            aria-expanded={showDefault}
          >
            {showDefault ? "▾" : "▸"} Default Palettes
          </button>
        </div>

        {showDefault && (
          <div className="palette-panel__section palette-panel__section--default">
            {defaultPalettes.length === 0 ? (
              <div className="palette-panel__empty">
                No default palettes available.
              </div>
            ) : (
              <div className="palette-panel__scroll">
                {defaultPalettes.map((palette) => (
                  <div
                    key={palette.id}
                    className="palette-panel__palette-card"
                    style={{
                      background: palette.id === activePaletteId ? '#343434' : '#262626',
                      border: '1px solid ' + (palette.id === activePaletteId ? '#555' : '#333'),
                    }}
                    onClick={() => onSelectPalette(palette.id)}
                  >
                    <div className="palette-panel__row palette-panel__row--space">
                      <span className="palette-panel__palette-title">
                        {palette.name} <span style={{ color: '#888', fontSize: '10px' }}>(default)</span>
                      </span>
                    </div>

                    <div className="palette-panel__swatches">
                      {palette.colors.map((color, idx) => (
                        <div
                          key={idx}
                          onClick={(e) => { e.stopPropagation(); handleColorClick(color); }}
                          style={{
                            background: color,
                            border: color === primaryColor ? '2px solid #fff' : '1px solid #444',
                            cursor: 'pointer',
                            borderRadius: '2px',
                          }}
                          title={color}
                          className="palette-panel__swatch"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="palette-panel__footer">
        <div className="palette-panel__tools">
          <div className="palette-panel__label">Palette Tools</div>
          <div className="palette-panel__row">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="palette-panel__tool-btn"
              title="Import .gpl or .ase palette"
            >
              Import Palette
            </button>
            <button
              onClick={() => onExportPalette("gpl")}
              className="palette-panel__tool-btn"
              disabled={!activePalette}
              title="Export palette as .gpl"
            >
              Export GPL
            </button>
            <button
              onClick={() => onExportPalette("ase")}
              className="palette-panel__tool-btn"
              disabled={!activePalette}
              title="Export palette as .ase"
            >
              Export ASE
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".gpl,.ase"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportPalette(file);
              e.currentTarget.value = "";
            }}
          />
        </div>

        <button
          onClick={onExtractPalette}
          className="palette-panel__full-btn"
          title="Extract colors from the current sprite"
        >
          Extract Palette from Image
        </button>
        <div className="palette-panel__tools">
          <label className="palette-panel__label">Palette Ramp Builder</label>
          <div className="palette-panel__row">
            <input
              type="number"
              min={2}
              max={32}
              value={rampSteps}
              onChange={(e) => setRampSteps(Number(e.target.value))}
              className="palette-panel__number-input"
            />
            <button
              onClick={() => onGenerateRamp(rampSteps)}
              className="palette-panel__tool-btn"
              title="Generate gradient colors between primary and secondary"
            >
              Add Ramp
            </button>
          </div>
        </div>
        <button
          onClick={() => setSwapFromColor(swapFromColor ? null : primaryColor)}
          className="palette-panel__full-btn"
          style={{ background: swapFromColor ? '#4a4a4a' : '#2a2a2a' }}
          title="Click to start color swap, then click another color"
        >
          {swapFromColor ? `Swapping ${swapFromColor}... (click color)` : 'Color Swap Mode'}
        </button>
      </div>
    </div>
  );
}
