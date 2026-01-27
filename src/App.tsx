import React, { useEffect, useMemo, useRef, useState } from "react";
import DockLayout from "./ui/DockLayout";
import ExportPanel from "./ui/ExportPanel";
import { CanvasSpec, ToolId, UiSettings, Frame } from "./types";
import { HistoryStack } from "./editor/history";
import { cloneBuffer, createBuffer } from "./editor/pixels";
import { copySelection, cutSelection, pasteClipboard, ClipboardData } from "./editor/clipboard";

/**
 * App Root.
 * Manages the complete animation with multiple frames and timeline.
 */
export default function App() {
  const [canvasSpec] = useState<CanvasSpec>(() => ({ width: 64, height: 64 }));
  const [tool, setTool] = useState<ToolId>("pen");

  const [frames, setFrames] = useState<Frame[]>(() => [
    {
      id: crypto.randomUUID(),
      pixels: createBuffer(canvasSpec.width, canvasSpec.height, { r: 0, g: 0, b: 0, a: 0 }),
      durationMs: 100
    }
  ]);

  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);

  const [selection, setSelection] = useState<Uint8Array | null>(null);

  const clipboardRef = useRef<ClipboardData | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const playbackTimerRef = useRef<number | null>(null);

  const [showExportPanel, setShowExportPanel] = useState(false);

  const historyRef = useRef<HistoryStack>(new HistoryStack());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const currentFrame = frames[currentFrameIndex];
  const buffer = currentFrame.pixels;

  function syncHistoryFlags() {
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  }

  useEffect(() => {
    if (!isPlaying) return;

    const advanceFrame = () => {
      setCurrentFrameIndex((prev) => {
        const next = (prev + 1) % frames.length;
        const nextDuration = frames[next].durationMs;
        playbackTimerRef.current = window.setTimeout(advanceFrame, nextDuration);
        return next;
      });
    };

    playbackTimerRef.current = window.setTimeout(advanceFrame, currentFrame.durationMs);

    return () => {
      if (playbackTimerRef.current !== null) {
        clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [isPlaying, currentFrame.durationMs, frames.length]);

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

      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        handleTogglePlayback();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffer]);

  function handleUndo() {
    const next = historyRef.current.undo(buffer);
    if (next !== buffer) {
      updateCurrentFrame(next);
      syncHistoryFlags();
    }
  }

  function handleRedo() {
    const next = historyRef.current.redo(buffer);
    if (next !== buffer) {
      updateCurrentFrame(next);
      syncHistoryFlags();
    }
  }

  function handleCopy() {
    if (!selection) return;
    const clip = copySelection(buffer, selection, canvasSpec.width, canvasSpec.height);
    if (clip) clipboardRef.current = clip;
  }

  function handleCut() {
    if (!selection) return;
    const before = cloneBuffer(buffer);
    const { clipboardData, modifiedBuffer } = cutSelection(buffer, selection, canvasSpec.width, canvasSpec.height);

    if (clipboardData) clipboardRef.current = clipboardData;

    historyRef.current.commit(before);
    updateCurrentFrame(modifiedBuffer);
    syncHistoryFlags();
  }

  function handlePaste() {
    if (!clipboardRef.current) return;

    const before = cloneBuffer(buffer);
    const after = pasteClipboard(buffer, clipboardRef.current, canvasSpec.width, canvasSpec.height);

    historyRef.current.commit(before);
    updateCurrentFrame(after);
    syncHistoryFlags();
  }

  function handleDeselect() {
    setSelection(null);
  }

  function updateCurrentFrame(newPixels: Uint8ClampedArray) {
    setFrames((prev) =>
      prev.map((f, i) => (i === currentFrameIndex ? { ...f, pixels: newPixels } : f))
    );
  }

  function onStrokeEnd(before: Uint8ClampedArray, after: Uint8ClampedArray) {
    historyRef.current.commit(before);
    updateCurrentFrame(after);
    syncHistoryFlags();
  }

  function handleInsertFrame() {
    const newFrame: Frame = {
      id: crypto.randomUUID(),
      pixels: createBuffer(canvasSpec.width, canvasSpec.height, { r: 0, g: 0, b: 0, a: 0 }),
      durationMs: 100
    };

    setFrames((prev) => {
      const updated = [...prev];
      updated.splice(currentFrameIndex + 1, 0, newFrame);
      return updated;
    });

    setCurrentFrameIndex(currentFrameIndex + 1);
  }

  function handleDuplicateFrame() {
    const duplicate: Frame = {
      id: crypto.randomUUID(),
      pixels: cloneBuffer(currentFrame.pixels),
      durationMs: currentFrame.durationMs
    };

    setFrames((prev) => {
      const updated = [...prev];
      updated.splice(currentFrameIndex + 1, 0, duplicate);
      return updated;
    });

    setCurrentFrameIndex(currentFrameIndex + 1);
  }

  function handleDeleteFrame() {
    if (frames.length <= 1) return;

    setFrames((prev) => prev.filter((_, i) => i !== currentFrameIndex));

    if (currentFrameIndex >= frames.length - 1) {
      setCurrentFrameIndex(Math.max(0, frames.length - 2));
    }
  }

  function handleSelectFrame(index: number) {
    if (isPlaying) setIsPlaying(false);
    setCurrentFrameIndex(index);
  }

  function handleUpdateFrameDuration(index: number, durationMs: number) {
    setFrames((prev) =>
      prev.map((f, i) => (i === index ? { ...f, durationMs } : f))
    );
  }

  function handleTogglePlayback() {
    setIsPlaying(!isPlaying);
  }

  return (
    <>
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
      onColorPick={(color) => setSettings((s) => ({ ...s, primaryColor: color }))}
      onUndo={handleUndo}
      onRedo={handleRedo}
      canUndo={canUndo}
      canRedo={canRedo}
      frames={frames}
      currentFrameIndex={currentFrameIndex}
      isPlaying={isPlaying}
      onSelectFrame={handleSelectFrame}
      onInsertFrame={handleInsertFrame}
      onDuplicateFrame={handleDuplicateFrame}
      onDeleteFrame={handleDeleteFrame}
      onUpdateFrameDuration={handleUpdateFrameDuration}
      onTogglePlayback={handleTogglePlayback}
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
            <button
              className="uiBtn uiBtn--primary"
              onClick={() => setShowExportPanel(true)}
              title="Export Sprite"
            >
              Export
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

      {showExportPanel && (
        <ExportPanel
          frames={frames}
          canvasSpec={canvasSpec}
          onClose={() => setShowExportPanel(false)}
        />
      )}
    </>
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
