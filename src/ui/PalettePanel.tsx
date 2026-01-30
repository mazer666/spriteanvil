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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePalette = palettes.find(p => p.id === activePaletteId);

  function createPalette() {
    if (newPaletteName.trim()) {
      onCreatePalette(newPaletteName.trim(), [primaryColor]);
      setNewPaletteName("");
      setShowNewPalette(false);
    }
  }

  function handleColorClick(color: string) {
    if (swapFromColor) {
      onSwapColors(swapFromColor, color);
      setSwapFromColor(null);
    } else {
      onSelectColor(color);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: '13px' }}>
      <div style={{ padding: '8px', borderBottom: '1px solid #333', fontWeight: 'bold' }}>
        Palettes
      </div>

      <div style={{ padding: '8px', borderBottom: '1px solid #333' }}>
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', color: '#aaa' }}>
            Primary Color
          </label>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => onSelectColor(e.target.value)}
              style={{ width: '40px', height: '40px', border: '1px solid #555', cursor: 'pointer' }}
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
              style={{ flex: 1, padding: '4px', background: '#1a1a1a', color: '#fff', border: '1px solid #444', fontFamily: 'monospace' }}
              placeholder="#RRGGBB"
            />
          </div>
        </div>

        {recentColors.length > 0 && (
          <div>
            <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Recent Colors</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '2px' }}>
              {recentColors.map((color, idx) => (
                <div
                  key={idx}
                  onClick={() => handleColorClick(color)}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    background: color,
                    border: color === primaryColor ? '2px solid #fff' : '1px solid #444',
                    cursor: 'pointer',
                    borderRadius: '2px',
                  }}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', color: '#aaa' }}>SAVED PALETTES</span>
          <button
            onClick={() => setShowNewPalette(!showNewPalette)}
            style={{ padding: '2px 8px', fontSize: '11px' }}
            title="Create new palette"
          >
            + New
          </button>
        </div>

        {showNewPalette && (
          <div style={{ marginBottom: '8px', padding: '8px', background: '#2a2a2a', border: '1px solid #444', borderRadius: '3px' }}>
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
              style={{ width: '100%', padding: '4px', background: '#1a1a1a', color: '#fff', border: '1px solid #444', marginBottom: '4px' }}
            />
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={createPalette} style={{ flex: 1, padding: '4px', fontSize: '11px' }}>Create</button>
              <button onClick={() => setShowNewPalette(false)} style={{ flex: 1, padding: '4px', fontSize: '11px' }}>Cancel</button>
            </div>
          </div>
        )}

        {palettes.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
            No palettes yet. Click + New to create one.
          </div>
        ) : (
          palettes.map((palette) => (
            <div
              key={palette.id}
              style={{
                marginBottom: '8px',
                padding: '8px',
                background: palette.id === activePaletteId ? '#3a3a3a' : '#2a2a2a',
                border: '1px solid ' + (palette.id === activePaletteId ? '#555' : '#333'),
                borderRadius: '3px',
                cursor: 'pointer',
              }}
              onClick={() => onSelectPalette(palette.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '12px' }}>
                  {palette.name} {palette.is_default && <span style={{ color: '#888', fontSize: '10px' }}>(default)</span>}
                </span>
                {!palette.is_default && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeletePalette(palette.id); }}
                    style={{ padding: '2px 6px', fontSize: '11px' }}
                    title="Delete palette"
                  >
                    🗑
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '2px' }}>
                {palette.colors.map((color, idx) => (
                  <div
                    key={idx}
                    onClick={(e) => { e.stopPropagation(); handleColorClick(color); }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!palette.is_default) {
                        onRemoveColorFromPalette(palette.id, idx);
                      }
                    }}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      background: color,
                      border: color === primaryColor ? '2px solid #fff' : '1px solid #444',
                      cursor: 'pointer',
                      borderRadius: '2px',
                    }}
                    title={`${color}\nRight-click to remove`}
                  />
                ))}
                {!palette.is_default && palette.id === activePaletteId && (
                  <div
                    onClick={(e) => { e.stopPropagation(); onAddColorToPalette(palette.id, primaryColor); }}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      border: '1px dashed #666',
                      cursor: 'pointer',
                      borderRadius: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      color: '#666',
                    }}
                    title="Add current color to palette"
                  >
                    +
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ padding: '8px', borderTop: '1px solid #333', background: '#252525' }}>
        <div style={{ display: "grid", gap: "6px", marginBottom: "8px" }}>
          <div style={{ fontSize: "11px", color: "#aaa" }}>Palette Tools</div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ flex: 1, padding: "6px", fontSize: "12px" }}
              title="Import .gpl or .ase palette"
            >
              Import Palette
            </button>
            <button
              onClick={() => onExportPalette("gpl")}
              style={{ flex: 1, padding: "6px", fontSize: "12px" }}
              disabled={!activePalette}
              title="Export palette as .gpl"
            >
              Export GPL
            </button>
            <button
              onClick={() => onExportPalette("ase")}
              style={{ flex: 1, padding: "6px", fontSize: "12px" }}
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
          style={{ width: '100%', padding: '6px', fontSize: '12px', marginBottom: '6px' }}
          title="Extract colors from the current sprite"
        >
          Extract Palette from Image
        </button>
        <div style={{ display: "grid", gap: "6px", marginBottom: "6px" }}>
          <label style={{ fontSize: "11px", color: "#aaa" }}>Palette Ramp Builder</label>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <input
              type="number"
              min={2}
              max={32}
              value={rampSteps}
              onChange={(e) => setRampSteps(Number(e.target.value))}
              style={{ width: "70px", padding: "4px", background: "#1a1a1a", color: "#fff", border: "1px solid #444" }}
            />
            <button
              onClick={() => onGenerateRamp(rampSteps)}
              style={{ flex: 1, padding: "6px", fontSize: "12px" }}
              title="Generate gradient colors between primary and secondary"
            >
              Add Ramp
            </button>
          </div>
        </div>
        <button
          onClick={() => setSwapFromColor(swapFromColor ? null : primaryColor)}
          style={{
            width: '100%',
            padding: '6px',
            fontSize: '12px',
            background: swapFromColor ? '#4a4a4a' : '#2a2a2a',
          }}
          title="Click to start color swap, then click another color"
        >
          {swapFromColor ? `Swapping ${swapFromColor}... (click color)` : 'Color Swap Mode'}
        </button>
      </div>
    </div>
  );
}
