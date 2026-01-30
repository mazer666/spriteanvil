import React from "react";

export type StatusBarInfo = {
  colorHex: string;
  colorRgb: string;
  zoomLabel: string;
  memoryUsage: string;
  cursor: string;
};

type Props = {
  info: StatusBarInfo;
};

export default function StatusBar({ info }: Props) {
  return (
    <div className="status-bar">
      <div className="status-item">
        <span className="status-label">Color</span>
        <span className="status-value">{info.colorHex}</span>
        <span className="status-muted">{info.colorRgb}</span>
      </div>
      <div className="status-item">
        <span className="status-label">Zoom</span>
        <span className="status-value">{info.zoomLabel}</span>
      </div>
      <div className="status-item">
        <span className="status-label">Pixel Buffer</span>
        <span className="status-value">{info.memoryUsage}</span>
      </div>
      <div className="status-item">
        <span className="status-label">Cursor</span>
        <span className="status-value">{info.cursor}</span>
      </div>
    </div>
  );
}
