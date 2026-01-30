import React, { useState } from "react";
import { Frame, CanvasSpec } from "../types";
import { AnimationTag } from "../lib/supabase/animation_tags";
import { exportToGIF, downloadGIF } from "../lib/export/gif";
import { generateMetadata, downloadJSON } from "../lib/export/metadata";
import {
  generateSpritesheetAsync,
  downloadCanvasAsPNG,
  SpritesheetLayout,
  EngineTarget,
  EngineJsonFormat,
  generateGodotAtlasTextures,
  generateUnitySpritesheetJSON,
  generatePhaserAtlasJSON,
} from "../lib/export/spritesheet";

type Props = {
  frames: Frame[];
  canvasSpec: CanvasSpec;
  animationTags: AnimationTag[];
  onClose: () => void;
};

export default function ExportPanel({ frames, canvasSpec, animationTags, onClose }: Props) {
  const [projectName, setProjectName] = useState("sprite");
  const [exportFormat, setExportFormat] = useState<"png" | "gif" | "json">("png");
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [targetEngine, setTargetEngine] = useState<EngineTarget>("spriteanvil");
  const [engineJsonFormat, setEngineJsonFormat] = useState<EngineJsonFormat>("hash");
  const [layout, setLayout] = useState<SpritesheetLayout>("grid");
  const [padding, setPadding] = useState(0);
  const [spacing, setSpacing] = useState(0);
  const [scale, setScale] = useState(1);
  const [gifLoop, setGifLoop] = useState(true);
  const [gifQuality, setGifQuality] = useState(10);
  const [gifPaletteSize, setGifPaletteSize] = useState(64);
  const [gifDither, setGifDither] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function downloadTextFile(contents: string, filename: string, type = "text/plain") {
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleExport() {
    setExporting(true);
    setErrorMessage(null);

    try {
      const imageName = `${projectName}.png`;
      const metadataName = `${projectName}.spriteanvil.json`;
      const engineMetadataName = `${projectName}.${targetEngine}.${engineJsonFormat}.json`;

      if (exportFormat === "gif") {
        const gifBlob = await exportToGIF({
          width: canvasSpec.width,
          height: canvasSpec.height,
          frames,
          loop: gifLoop,
          quality: gifQuality,
          paletteSize: gifPaletteSize,
          dither: gifDither,
        });
        downloadGIF(gifBlob, `${projectName}.gif`);
        if (includeMetadata) {
          const metadata = generateMetadata(
            frames,
            canvasSpec.width,
            canvasSpec.height,
            frames.map((_, index) => ({
              x: index * canvasSpec.width,
              y: 0,
              w: canvasSpec.width,
              h: canvasSpec.height,
            })),
            canvasSpec.width * frames.length,
            canvasSpec.height,
            "horizontal",
            0,
            0,
            imageName,
            animationTags
          );
          downloadJSON(metadata, metadataName);
        }
      } else {
        const result = await generateSpritesheetAsync(
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
          imageName,
          animationTags
        );

        if (exportFormat === "png") {
          downloadCanvasAsPNG(result.canvas, imageName);
          if (includeMetadata) {
            if (targetEngine === "spriteanvil") {
              downloadJSON(metadata, metadataName);
            }
            if (targetEngine === "unity") {
              const unityJson = generateUnitySpritesheetJSON(
                frames,
                result.frameRects,
                canvasSpec.width,
                canvasSpec.height,
                result.sheetWidth,
                result.sheetHeight,
                imageName,
                engineJsonFormat
              );
              downloadTextFile(unityJson, engineMetadataName, "application/json");
            }
            if (targetEngine === "phaser") {
              const phaserJson = generatePhaserAtlasJSON(
                frames,
                result.frameRects,
                canvasSpec.width,
                canvasSpec.height,
                result.sheetWidth,
                result.sheetHeight,
                imageName,
                engineJsonFormat
              );
              downloadTextFile(phaserJson, engineMetadataName, "application/json");
            }
            if (targetEngine === "godot") {
              const tresFiles = generateGodotAtlasTextures(projectName, imageName, result.frameRects);
              tresFiles.forEach((file) => downloadTextFile(file.content, file.filename));
            }
          }
        }

        if (exportFormat === "json") {
          if (targetEngine === "spriteanvil") {
            downloadJSON(metadata, metadataName);
          }
          if (targetEngine === "unity") {
            const unityJson = generateUnitySpritesheetJSON(
              frames,
              result.frameRects,
              canvasSpec.width,
              canvasSpec.height,
              result.sheetWidth,
              result.sheetHeight,
              imageName,
              engineJsonFormat
            );
            downloadTextFile(unityJson, engineMetadataName, "application/json");
          }
          if (targetEngine === "phaser") {
            const phaserJson = generatePhaserAtlasJSON(
              frames,
              result.frameRects,
              canvasSpec.width,
              canvasSpec.height,
              result.sheetWidth,
              result.sheetHeight,
              imageName,
              engineJsonFormat
            );
            downloadTextFile(phaserJson, engineMetadataName, "application/json");
          }
          if (targetEngine === "godot") {
            const tresFiles = generateGodotAtlasTextures(projectName, imageName, result.frameRects);
            tresFiles.forEach((file) => downloadTextFile(file.content, file.filename));
          }
        }
      }

      setTimeout(onClose, 500);
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
                <label>Target Engine</label>
                <select
                  value={targetEngine}
                  onChange={(e) => setTargetEngine(e.target.value as EngineTarget)}
                >
                  <option value="spriteanvil">SpriteAnvil</option>
                  <option value="godot">Godot (AtlasTexture .tres)</option>
                  <option value="unity">Unity Spritesheet JSON</option>
                  <option value="phaser">Phaser Atlas JSON</option>
                </select>
              </div>

              {(targetEngine === "unity" || targetEngine === "phaser") && (
                <div className="form-group">
                  <label>JSON Format</label>
                  <select
                    value={engineJsonFormat}
                    onChange={(e) => setEngineJsonFormat(e.target.value as EngineJsonFormat)}
                  >
                    <option value="hash">Hash (frame name keys)</option>
                    <option value="array">Array (frame list)</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Layout</label>
                <select value={layout} onChange={(e) => setLayout(e.target.value as SpritesheetLayout)}>
                  <option value="grid">Grid</option>
                  <option value="packed">Packed</option>
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

          {(exportFormat === "png" || exportFormat === "gif") && (
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
              <label className="form-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  checked={gifDither}
                  onChange={(e) => setGifDither(e.target.checked)}
                />
                Dither colors
              </label>
              <div className="form-group">
                <label>Palette size</label>
                <select
                  value={gifPaletteSize}
                  onChange={(e) => setGifPaletteSize(Number(e.target.value))}
                >
                  <option value="16">16 colors</option>
                  <option value="32">32 colors</option>
                  <option value="64">64 colors</option>
                  <option value="128">128 colors</option>
                  <option value="256">256 colors</option>
                </select>
              </div>
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
