import React, { useState } from "react";
import { Frame, CanvasSpec } from "../types";
import { exportToGIF, downloadGIF } from "../lib/export/gif";
import { generateMetadata, downloadJSON } from "../lib/export/metadata";
import { generateSpritesheet, downloadCanvasAsPNG, SpritesheetLayout } from "../lib/export/spritesheet";

type Props = {
  frames: Frame[];
  canvasSpec: CanvasSpec;
  onClose: () => void;
};

export default function ExportPanel({ frames, canvasSpec, onClose }: Props) {
  const [projectName, setProjectName] = useState("sprite");
  const [exportFormat, setExportFormat] = useState<"png" | "gif" | "json">("png");
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [layout, setLayout] = useState<SpritesheetLayout>("grid");
  const [padding, setPadding] = useState(0);
  const [spacing, setSpacing] = useState(0);
  const [scale, setScale] = useState(1);
  const [gifLoop, setGifLoop] = useState(true);
  const [gifQuality, setGifQuality] = useState(10);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setErrorMessage(null);

    try {
      const imageName = `${projectName}.png`;
      const metadataName = `${projectName}.spriteanvil.json`;

      if (exportFormat === "gif") {
        const gifBlob = await exportToGIF({
          width: canvasSpec.width,
          height: canvasSpec.height,
          frames,
          loop: gifLoop,
          quality: gifQuality,
        });
        downloadGIF(gifBlob, `${projectName}.gif`);
      } else {
        const result = generateSpritesheet(
          frames,
          canvasSpec.width,
          canvasSpec.height,
          { layout, padding, spacing, scale }
        );

        const metadata = generateMetadata(
          frames,
          canvasSpec.width,
          canvasSpec.height,
          result.frameRects,
          result.sheetWidth,
          result.sheetHeight,
          layout,
          padding,
          spacing,
          imageName
        );

        if (exportFormat === "png") {
          downloadCanvasAsPNG(result.canvas, imageName);
          if (includeMetadata) {
            downloadJSON(metadata, metadataName);
          }
        }

        if (exportFormat === "json") {
          downloadJSON(metadata, metadataName);
        }
      }

      setTimeout(() => {
        setExporting(false);
        onClose();
      }, 500);
    } catch (error) {
      console.error("Export failed:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Export failed. Please try again."
      );
      setExporting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Export Sprite</h2>
          <button className="modal-close" onClick={onClose} title="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="sprite"
            />
          </div>

          <div className="form-group">
            <label>Format</label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as "png" | "gif" | "json")}
            >
              <option value="png">PNG Spritesheet</option>
              <option value="gif">GIF Animation</option>
              <option value="json">JSON Metadata</option>
            </select>
          </div>

          {(exportFormat === "png" || exportFormat === "json") && (
            <>
              <div className="form-group">
                <label>Layout</label>
                <select value={layout} onChange={(e) => setLayout(e.target.value as SpritesheetLayout)}>
                  <option value="grid">Grid</option>
                  <option value="horizontal">Horizontal Strip</option>
                  <option value="vertical">Vertical Strip</option>
                </select>
              </div>

              <div className="form-group">
                <label>Scale</label>
                <select value={scale} onChange={(e) => setScale(Number(e.target.value))}>
                  <option value="1">1x (Original)</option>
                  <option value="2">2x</option>
                  <option value="3">3x</option>
                  <option value="4">4x</option>
                  <option value="8">8x</option>
                </select>
              </div>

              <div className="form-group">
                <label>Padding (px)</label>
                <input
                  type="number"
                  min="0"
                  max="32"
                  value={padding}
                  onChange={(e) => setPadding(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>Spacing (px)</label>
                <input
                  type="number"
                  min="0"
                  max="32"
                  value={spacing}
                  onChange={(e) => setSpacing(Number(e.target.value))}
                />
              </div>
            </>
          )}

          {exportFormat === "png" && (
            <label className="form-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
              />
              Include JSON metadata
            </label>
          )}

          {exportFormat === "gif" && (
            <>
              <label className="form-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  checked={gifLoop}
                  onChange={(e) => setGifLoop(e.target.checked)}
                />
                Loop animation
              </label>
              <div className="form-group">
                <label>Quality (lower is better)</label>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={gifQuality}
                  onChange={(e) => setGifQuality(Number(e.target.value))}
                />
                <div style={{ fontSize: "12px", color: "#aaa" }}>{gifQuality}</div>
              </div>
            </>
          )}

          {errorMessage && (
            <div className="export-info" style={{ color: "#ff8b8b" }}>
              {errorMessage}
            </div>
          )}

          <div className="export-info">
            <div>
              <strong>Frames:</strong> {frames.length}
            </div>
            <div>
              <strong>Canvas Size:</strong> {canvasSpec.width}×{canvasSpec.height}
            </div>
            {scale > 1 && (
              <div>
                <strong>Scaled Size:</strong> {canvasSpec.width * scale}×{canvasSpec.height * scale}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="uiBtn" onClick={onClose} disabled={exporting}>
            Cancel
          </button>
          <button
            className="uiBtn uiBtn--primary"
            onClick={handleExport}
            disabled={exporting || !projectName}
          >
            {exporting ? "Exporting..." : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
