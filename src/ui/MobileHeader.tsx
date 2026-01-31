import React, { useState } from "react";
import { ToolId, UiSettings, LayerData, BlendMode, CanvasSpec } from "../types";
import { PaletteData } from "../lib/projects/snapshot";
import LayerPanel from "./LayerPanel";
import PalettePanel from "./PalettePanel";
import ColorAdjustPanel from "./ColorAdjustPanel";
import ToolOptionsPanel from "./ToolOptionsPanel";
import { TOOL_GROUPS, ToolDefinition } from "./toolCatalog";

type Props = {
    tool: ToolId;
    onChangeTool: (tool: ToolId) => void;
    settings: UiSettings;
    onChangeSettings: (next: UiSettings) => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;

    // Layer props
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

    // Palette props
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

    onToggleMenu: () => void;
};

export default function MobileHeader({
    tool,
    onChangeTool,
    settings,
    onChangeSettings,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    layers,
    activeLayerId,
    onLayerOperations,
    palettes,
    activePaletteId,
    recentColors,
    onPaletteOperations,
    onColorAdjustOperations,
    onToggleMenu,
}: Props) {
    const [activePopover, setActivePopover] = useState<"layers" | "colors" | "tools-lib" | "tools-opt" | null>(null);

    const togglePopover = (id: "layers" | "colors" | "tools-lib" | "tools-opt") => {
        setActivePopover((prev) => (prev === id ? null : id));
    };

    // Find current tool definition
    const currentToolDef = TOOL_GROUPS.flatMap(g => g.tools).find(t => t.id === tool);

    return (
        <>
            <div className="mobile-header">
                <div className="mobile-header__left">
                    <button className="uiBtn uiBtn--ghost" onClick={onToggleMenu}>
                        ☰ <span className="mobile-label">Gallery</span>
                    </button>
                    <div className="mobile-header__sep" />
                    <button
                        className="uiBtn uiBtn--ghost"
                        onClick={onUndo}
                        disabled={!canUndo}
                        title="Undo"
                    >
                        ↩
                    </button>
                    <button
                        className="uiBtn uiBtn--ghost"
                        onClick={onRedo}
                        disabled={!canRedo}
                        title="Redo"
                    >
                        ↪
                    </button>
                </div>

                <div className="mobile-header__right">
                    {/* Tool Picker Button (shows current tool icon) */}
                    <button
                        className={`uiBtn ${activePopover === "tools-lib" ? "uiBtn--active" : "uiBtn--ghost"}`}
                        onClick={() => togglePopover("tools-lib")}
                        title="Select Tool"
                    >
                        {currentToolDef?.label || "🖌️"}
                    </button>

                    {/* Tool Options (Wrench) */}
                    <button
                        className={`uiBtn ${activePopover === "tools-opt" ? "uiBtn--active" : "uiBtn--ghost"}`}
                        onClick={() => togglePopover("tools-opt")}
                        title="Tool Settings"
                    >
                        <span style={{ fontSize: "16px" }}>🔧</span>
                    </button>

                    <div className="mobile-header__sep" />

                    {/* Layer Panel Toggle */}
                    <button
                        className={`uiBtn ${activePopover === "layers" ? "uiBtn--active" : "uiBtn--ghost"}`}
                        onClick={() => togglePopover("layers")}
                        title="Layers"
                    >
                        🥞
                    </button>

                    {/* Color Panel Toggle */}
                    <button
                        className={`uiBtn ${activePopover === "colors" ? "uiBtn--active" : "uiBtn--ghost"}`}
                        onClick={() => togglePopover("colors")}
                        title="Colors"
                    >
                        <div
                            className="color-circle"
                            style={{ backgroundColor: settings.primaryColor }}
                        />
                    </button>
                </div>
            </div>

            {activePopover && (
                <>
                    <div className="mobile-popover-backdrop" onClick={() => setActivePopover(null)} />

                    <div className={`mobile-popover ${activePopover === "tools-lib" ? "mobile-popover--tools-library" :
                            activePopover === "tools-opt" ? "mobile-popover--tools-options" : ""
                        }`}>
                        <div className="mobile-popover__header">
                            <h3>
                                {activePopover === "layers" && "Layers"}
                                {activePopover === "colors" && "Colors"}
                                {activePopover === "tools-lib" && "Tools"}
                                {activePopover === "tools-opt" && "Tool Settings"}
                            </h3>
                            <button className="uiBtn uiBtn--ghost" onClick={() => setActivePopover(null)}>✕</button>
                        </div>

                        <div className="mobile-popover__content">
                            {activePopover === "layers" && layers && activeLayerId && onLayerOperations && (
                                <LayerPanel layers={layers} activeLayerId={activeLayerId} {...onLayerOperations} />
                            )}

                            {activePopover === "colors" && (
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
                            )}

                            {activePopover === "tools-opt" && (
                                <ToolOptionsPanel tool={tool} settings={settings} onChangeSettings={onChangeSettings} />
                            )}

                            {activePopover === "tools-lib" && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px' }}>
                                    {TOOL_GROUPS.map(group => (
                                        <div key={group.title}>
                                            <div className="toolrail__sectionTitle" style={{ marginBottom: '8px', opacity: 0.7, fontSize: '11px', textTransform: 'uppercase' }}>
                                                {group.title}
                                            </div>
                                            <div className="tool-grid">
                                                {group.tools.map(t => (
                                                    <button
                                                        key={t.id}
                                                        className={`tool-grid__item ${tool === t.id ? "tool-grid__item--active" : ""}`}
                                                        onClick={() => {
                                                            onChangeTool(t.id);
                                                            setActivePopover(null); // Close on select? Or keep open? Let's close for now.
                                                        }}
                                                        title={t.title}
                                                    >
                                                        <span className="tool-grid__icon">{t.label}</span>
                                                        <span>{t.id}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
