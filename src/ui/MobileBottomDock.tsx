import React from "react";
import { ToolId, UiSettings } from "../types";

type Props = {
  tool: ToolId;
  onChangeTool: (tool: ToolId) => void;
  settings: UiSettings;
  onChangeSettings: (next: UiSettings) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOpenSheet: (sheet: "tools" | "layers" | "palette" | "options") => void;
};

export default function MobileBottomDock({
  tool,
  settings,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onOpenSheet,
}: Props) {
  return (
    <div className="mobile-dock">
      <button
        className="mobile-dock__tab"
        onClick={() => onOpenSheet("tools")}
        aria-label="Select Tool"
      >
        <span className="mobile-dock__icon">🖌️</span>
        <span className="mobile-dock__label">Tools</span>
      </button>

      <button
        className="mobile-dock__tab"
        onClick={() => onOpenSheet("layers")}
        aria-label="Layers"
      >
        <span className="mobile-dock__icon">🥞</span>
        <span className="mobile-dock__label">Layers</span>
      </button>

      <button
        className="mobile-dock__tab"
        onClick={() => onOpenSheet("palette")}
        aria-label="Colors"
      >
        <span
          className="mobile-dock__icon mobile-dock__color-swatch"
          style={{ backgroundColor: settings.primaryColor }}
        />
        <span className="mobile-dock__label">Colors</span>
      </button>
      
      <button
        className="mobile-dock__tab"
        onClick={() => onOpenSheet("options")}
        aria-label="Options"
      >
        <span className="mobile-dock__icon">⚙️</span>
        <span className="mobile-dock__label">Settings</span>
      </button>

      <div className="mobile-dock__sep" />

      <button
        className="mobile-dock__action"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo"
      >
        ↩
      </button>
      <button
        className="mobile-dock__action"
        onClick={onRedo}
        disabled={!canRedo}
        aria-label="Redo"
      >
        ↪
      </button>
    </div>
  );
}
