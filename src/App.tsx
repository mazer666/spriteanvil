import React, { useEffect, useMemo, useRef, useState } from "react";
import DockLayout from "./ui/DockLayout";
import { CanvasSpec, ToolId, UiSettings } from "./types";
import { HistoryStack } from "./editor/history";
import { cloneBuffer, createBuffer } from "./editor/pixels";
import { getSelectionBounds } from "./editor/selection";

/**
 * App Root.
 * We keep a minimal "document model" in App state:
 * - a single canvas size (J1: fixed per animation for now)
 * - a single frame buffer (we add real multi-frame timeline next)
 *
 * CanvasStage will mutate pixels during a stroke, then call onStrokeEnd() to:
 * - commit undo history
 * - store the final buffer snapshot in React state
 */
export default function App() {
  // Fixed canvas size for the current animation (J1).
  const [canvasSpec] = useState<CanvasSpec>(() => ({ width: 64, height: 64 }));

  // Current tool
  const [tool, setTool] = useState<ToolId>("pen");

  // Pixel buffer for the current frame (RGBA).
  const [buffer, setBuffer] = useState<Uint8ClampedArray>(() =>
    createBuffer(canvasSpec.width, canvasSpec.height, { r: 0, g: 0, b: 0, a: 0 })
  );

  // Active selection mask (1 byte per pixel: 1 = selected, 0 = not selected)
  const [selection, setSelection] = useState<Uint8Array | null>(null);

  // Clipboard for cut/copy/paste operations
  const clipboardRef = useRef<{
    pixels: Uint8ClampedArray;
    width: number;
    height: number;
  } | null>(null);

  // History stack is stored in a ref (does not need to cause rerenders automatically).
  const historyRef = useRef<HistoryStack>(new HistoryStack());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  function syncHistoryFlags() {
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  }

  // UI Settings (view + some tool settings)
  const [settings, setSettings] = useState<UiSettings>(() => ({
    zoom: 8, // 800% (pixel art usually needs high zoom)
    brushStabilizerEnabled: true,

    backgroundMode: "checker",
    checkerSize: 24,
    checkerA: "rgba(255,255,255,0.08)",
    checkerB: "rgba(0,0,0,0.10)",

    showGrid: true,
    gridSize: 1,

    showOnionSkin: true,
    onionPrev: 1,
    onionNext: 1,

    primaryColor: "#f2ead7"
  }));

  const zoomLabel = useMemo(() => `${Math.round(settings.zoom * 100)}%`, [settings.zoom]);

  // Keyboard shortcuts (simple, predictable)
  useEffect(() => {
    function isTextInput(el: Element | null): boolean {
      if (!el) return false;
      const tag = (el as HTMLElement).tagName?.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || (el as HTMLElement).isContentEditable;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isTextInput(document.activeElement)) return;

      // Tools
      if (e.key === "b" || e.key === "B") setTool("pen");
      if (e.key === "e" || e.key === "E") setTool("eraser");
      if (e.key === "m" || e.key === "M") setTool("selectRect");

      // Undo/Redo (Ctrl+Z / Ctrl+Y)
      if (e.ctrlKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        handleUndo();
      }
      if (e.ctrlKey && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        handleRedo();
      }

      // Selection operations
      if (e.ctrlKey && (e.key === "x" || e.key === "X")) {
        e.preventDefault();
        handleCut();
      }
      if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        handleCopy();
      }
      if (e.ctrlKey && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        handlePaste();
      }
      if (e.ctrlKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        handleDeselect();
      }
      if (e.key === "Escape") {
        handleDeselect();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffer]);

  function handleUndo() {
    const next = historyRef.current.undo(buffer);
    if (next !== buffer) {
      setBuffer(next);
      syncHistoryFlags();
    }
  }

  function handleRedo() {
    const next = historyRef.current.redo(buffer);
    if (next !== buffer) {
      setBuffer(next);
      syncHistoryFlags();
    }
  }

  function handleCopy() {
    if (!selection) return;

    const bounds = getSelectionBounds(selection, canvasSpec.width, canvasSpec.height);
    if (!bounds) return;

    const clipWidth = bounds.width;
    const clipHeight = bounds.height;
    const clipData = new Uint8ClampedArray(clipWidth * clipHeight * 4);

    for (let y = 0; y < clipHeight; y++) {
      for (let x = 0; x < clipWidth; x++) {
        const srcX = bounds.x + x;
        const srcY = bounds.y + y;
        const srcIdx = (srcY * canvasSpec.width + srcX) * 4;
        const selIdx = srcY * canvasSpec.width + srcX;
        const dstIdx = (y * clipWidth + x) * 4;

        if (selection[selIdx]) {
          clipData[dstIdx] = buffer[srcIdx];
          clipData[dstIdx + 1] = buffer[srcIdx + 1];
          clipData[dstIdx + 2] = buffer[srcIdx + 2];
          clipData[dstIdx + 3] = buffer[srcIdx + 3];
        }
      }
    }

    clipboardRef.current = {
      pixels: clipData,
      width: clipWidth,
      height: clipHeight
    };
  }

  function handleCut() {
    if (!selection) return;

    handleCopy();

    const before = cloneBuffer(buffer);
    const after = cloneBuffer(buffer);

    for (let i = 0; i < selection.length; i++) {
      if (selection[i]) {
        const idx = i * 4;
        after[idx] = 0;
        after[idx + 1] = 0;
        after[idx + 2] = 0;
        after[idx + 3] = 0;
      }
    }

    historyRef.current.commit(before);
    setBuffer(after);
    syncHistoryFlags();
  }

  function handlePaste() {
    if (!clipboardRef.current) return;

    const before = cloneBuffer(buffer);
    const after = cloneBuffer(buffer);

    const clip = clipboardRef.current;
    const pasteX = 0;
    const pasteY = 0;

    for (let y = 0; y < clip.height; y++) {
      for (let x = 0; x < clip.width; x++) {
        const dstX = pasteX + x;
        const dstY = pasteY + y;

        if (dstX >= 0 && dstX < canvasSpec.width && dstY >= 0 && dstY < canvasSpec.height) {
          const srcIdx = (y * clip.width + x) * 4;
          const dstIdx = (dstY * canvasSpec.width + dstX) * 4;

          const alpha = clip.pixels[srcIdx + 3];
          if (alpha > 0) {
            after[dstIdx] = clip.pixels[srcIdx];
            after[dstIdx + 1] = clip.pixels[srcIdx + 1];
            after[dstIdx + 2] = clip.pixels[srcIdx + 2];
            after[dstIdx + 3] = clip.pixels[srcIdx + 3];
          }
        }
      }
    }

    historyRef.current.commit(before);
    setBuffer(after);
    syncHistoryFlags();
  }

  function handleDeselect() {
    setSelection(null);
  }

  /**
   * Called by CanvasStage when a stroke ended AND pixels actually changed.
   * - before: snapshot taken at stroke start
   * - after: final snapshot after drawing
   */
  function onStrokeEnd(before: Uint8ClampedArray, after: Uint8ClampedArray) {
    historyRef.current.commit(before);
    setBuffer(after);
    syncHistoryFlags();
  }

  return (
    <DockLayout
      settings={settings}
      onChangeSettings={setSettings}
      tool={tool}
      onChangeTool={setTool}
      canvasSpec={canvasSpec}
      buffer={buffer}
      onStrokeEnd={onStrokeEnd}
      selection={selection}
      onChangeSelection={setSelection}
      onUndo={handleUndo}
      onRedo={handleRedo}
      canUndo={canUndo}
      canRedo={canRedo}
      topBar={
        <div className="topbar">
          <div className="brand">
            <div className="brand__name">SpriteAnvil</div>
            <div className="brand__tagline">Forge sprites. Shape motion.</div>
          </div>

          <div className="topbar__group">
            <button className="uiBtn" onClick={handleUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
              Undo
            </button>
            <button className="uiBtn" onClick={handleRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
              Redo
            </button>
          </div>

          <div className="topbar__group">
            <label className="ui-row">
              <input
                type="checkbox"
                checked={settings.brushStabilizerEnabled}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, brushStabilizerEnabled: e.target.checked }))
                }
              />
              <span>Brush Stabilizer</span>
            </label>

            <label className="ui-row">
              <span>Color</span>
              <input
                className="color"
                type="color"
                value={settings.primaryColor}
                onChange={(e) => setSettings((s) => ({ ...s, primaryColor: e.target.value }))}
                title="Primary Color"
              />
            </label>

            <label className="ui-row">
              <span>Zoom</span>
              <input
                className="zoom"
                type="range"
                min={1}
                max={32}
                step={0.25}
                value={settings.zoom}
                onChange={(e) => setSettings((s) => ({ ...s, zoom: Number(e.target.value) }))}
              />
              <span className="mono">{zoomLabel}</span>
            </label>
          </div>

          <div className="topbar__group">
            <label className="ui-row">
              <span>Background</span>
              <select
                value={settings.backgroundMode}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, backgroundMode: e.target.value as any }))
                }
              >
                <option value="checker">Checkerboard</option>
                <option value="solidDark">Solid (Dark)</option>
                <option value="solidLight">Solid (Light)</option>
                <option value="greenscreen">Greenscreen</option>
                <option value="bluescreen">Bluescreen</option>
              </select>
            </label>

            {settings.backgroundMode === "checker" && (
              <>
                <label className="ui-row">
                  <span>Size</span>
                  <input
                    className="checkerSize"
                    type="range"
                    min={8}
                    max={64}
                    step={1}
                    value={settings.checkerSize}
                    onChange={(e) => setSettings((s) => ({ ...s, checkerSize: Number(e.target.value) }))}
                  />
                  <span className="mono">{settings.checkerSize}px</span>
                </label>

                <label className="ui-row">
                  <span>A</span>
                  <input
                    className="colorSmall"
                    type="color"
                    value={toHexFallback(settings.checkerA, "#3a3a3a")}
                    onChange={(e) => setSettings((s) => ({ ...s, checkerA: e.target.value }))}
                    title="Checker color A"
                  />
                  <span>B</span>
                  <input
                    className="colorSmall"
                    type="color"
                    value={toHexFallback(settings.checkerB, "#1f1f1f")}
                    onChange={(e) => setSettings((s) => ({ ...s, checkerB: e.target.value }))}
                    title="Checker color B"
                  />
                </label>
              </>
            )}

            <label className="ui-row">
              <input
                type="checkbox"
                checked={settings.showGrid}
                onChange={(e) => setSettings((s) => ({ ...s, showGrid: e.target.checked }))}
              />
              <span>Grid</span>
            </label>

            <label className="ui-row">
              <span>Grid</span>
              <input
                className="gridSize"
                type="number"
                min={1}
                max={64}
                value={settings.gridSize}
                onChange={(e) => setSettings((s) => ({ ...s, gridSize: Number(e.target.value) }))}
              />
              <span className="muted">px</span>
            </label>
          </div>
        </div>
      }
    />
  );
}

/**
 * Because checkerA/checkerB are CSS colors (could be rgba),
 * but <input type="color"> requires hex, we use a safe fallback.
 * For now we keep it simple.
 */
function toHexFallback(_cssColor: string, fallbackHex: string): string {
  // We do not parse arbitrary CSS colors in v0.1.
  // Later we will store checker colors as hex consistently.
  if (/^#[0-9a-fA-F]{6}$/.test(_cssColor)) return _cssColor;
  return fallbackHex;
}
