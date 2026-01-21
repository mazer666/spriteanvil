import React, { useMemo } from "react";
import { UiSettings } from "../types";

/**
 * CanvasStage:
 * V0.1 ist es nur eine "Stage" mit Hintergrund-Modus + Zoom-Anzeige.
 * In v0.1.1 kommt ein echtes <canvas> mit Pixel-Grid + Pen Tool.
 */
export default function CanvasStage({ settings }: { settings: UiSettings }) {
  const bgClass = useMemo(() => {
    switch (settings.backgroundMode) {
      case "checker":
        return "stage stage--checker";
      case "solidDark":
        return "stage stage--dark";
      case "solidLight":
        return "stage stage--light";
      case "greenscreen":
        return "stage stage--green";
      case "bluescreen":
        return "stage stage--blue";
      default:
        return "stage stage--checker";
    }
  }, [settings.backgroundMode]);

  return (
    <div className={bgClass}>
      <div className="stage__hud">
        <div className="hudpill">
          Zoom: <span className="mono">{Math.round(settings.zoom * 100)}%</span>
        </div>
        <div className="hudpill">
          Grid: <span className="mono">{settings.showGrid ? "ON" : "OFF"}</span>
        </div>
        <div className="hudpill">
          Stabilizer: <span className="mono">{settings.brushStabilizerEnabled ? "ON" : "OFF"}</span>
        </div>
      </div>

      <div className="stage__center">
        <div className="canvasPlaceholder">
          Canvas comes next (Pen / Fill / Wand / Selection / Copy-Paste)
        </div>
      </div>
    </div>
  );
}
