import React, { useEffect, useRef, useState } from "react";
import { CanvasSpec, Frame, UiSettings } from "../types";
import type { EasingCurve } from "../editor/animation";
import { AnimationTag } from "../lib/supabase/animation_tags";

type Props = {
  settings: UiSettings;
  onChangeSettings: (next: UiSettings) => void;
  canvasSpec: CanvasSpec;
  frames: Frame[];
  currentFrameIndex: number;
  isPlaying: boolean;
  onSelectFrame: (index: number) => void;
  onInsertFrame: () => void;
  onDuplicateFrame: () => void;
  onDeleteFrame: () => void;
  onUpdateFrameDuration: (index: number, durationMs: number) => void;
  onTogglePlayback: () => void;
  onGenerateTweens: (startIndex: number, endIndex: number, count: number, easing: EasingCurve) => void;
  animationTags: AnimationTag[];
  activeTagId: string | null;
  loopTagOnly: boolean;
  onToggleLoopTagOnly: (next: boolean) => void;
  onSelectTag: (id: string | null) => void;
  onCreateTag: (tag: Omit<AnimationTag, "id" | "created_at">) => void;
  onUpdateTag: (id: string, updates: Partial<AnimationTag>) => void;
  onDeleteTag: (id: string) => void;
};

export default function Timeline({
  settings,
  onChangeSettings,
  canvasSpec,
  frames,
  currentFrameIndex,
  isPlaying,
  onSelectFrame,
  onInsertFrame,
  onDuplicateFrame,
  onDeleteFrame,
  onUpdateFrameDuration,
  onTogglePlayback,
  onGenerateTweens,
  animationTags,
  activeTagId,
  loopTagOnly,
  onToggleLoopTagOnly,
  onSelectTag,
  onCreateTag,
  onUpdateTag,
  onDeleteTag
}: Props) {
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const [newTagName, setNewTagName] = useState("");
  const [newTagStart, setNewTagStart] = useState(0);
  const [newTagEnd, setNewTagEnd] = useState(0);
  const [newTagColor, setNewTagColor] = useState("#4bb8bf");
  const [tweenStart, setTweenStart] = useState(0);
  const [tweenEnd, setTweenEnd] = useState(1);
  const [tweenCount, setTweenCount] = useState(1);
  const [tweenEasing, setTweenEasing] = useState<EasingCurve>("linear");
  const [showTags, setShowTags] = useState(false);
  const [showTween, setShowTween] = useState(false);

  useEffect(() => {
    frames.forEach((frame, index) => {
      const canvas = canvasRefs.current.get(frame.id);
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new ImageData(
        new Uint8ClampedArray(frame.pixels),
        canvasSpec.width,
        canvasSpec.height
      );

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.putImageData(img, 0, 0);
    });
  }, [frames, canvasSpec]);

  useEffect(() => {
    if (frames.length === 0) {
      setNewTagStart(0);
      setNewTagEnd(0);
      return;
    }
    setNewTagStart((prev) => Math.min(prev, frames.length - 1));
    setNewTagEnd((prev) => Math.min(Math.max(prev, 0), frames.length - 1));
  }, [frames.length]);

  useEffect(() => {
    if (frames.length < 2) {
      setTweenStart(0);
      setTweenEnd(0);
      return;
    }
    setTweenStart((prev) => Math.min(prev, frames.length - 2));
    setTweenEnd((prev) => Math.min(Math.max(prev, 1), frames.length - 1));
  }, [frames.length]);

  function handleGenerateTweens() {
    if (frames.length < 2) return;
    const start = Math.min(tweenStart, tweenEnd);
    const end = Math.max(tweenStart, tweenEnd);
    if (start === end) return;
    onGenerateTweens(start, end, Math.max(1, tweenCount), tweenEasing);
  }

  function handleDurationChange(index: number, value: string) {
    const ms = Math.max(10, Math.min(5000, Number(value)));
    if (!isNaN(ms)) {
      onUpdateFrameDuration(index, ms);
    }
  }

  const totalDuration = frames.reduce((sum, f) => sum + f.durationMs, 0);
  const fps = frames.length > 0 ? Math.round((1000 * frames.length) / totalDuration) : 0;
  const [fpsInput, setFpsInput] = useState(fps || 12);
  const activeTag = animationTags.find((tag) => tag.id === activeTagId) || null;

  useEffect(() => {
    if (fps > 0) {
      setFpsInput(fps);
    }
  }, [fps]);

  function handleFpsChange(value: string) {
    const next = Math.max(1, Math.min(60, Number(value)));
    setFpsInput(next);
    if (!Number.isFinite(next) || next <= 0) return;
    const durationMs = Math.max(10, Math.round(1000 / next));
    frames.forEach((_, index) => onUpdateFrameDuration(index, durationMs));
  }

  function handleCreateTag() {
    if (!newTagName.trim() || frames.length === 0) return;
    const start = Math.max(0, Math.min(frames.length - 1, newTagStart));
    const end = Math.max(start, Math.min(frames.length - 1, newTagEnd));
    onCreateTag({
      sprite_id: "local",
      name: newTagName.trim(),
      start_frame: start,
      end_frame: end,
      color: newTagColor,
    });
    setNewTagName("");
  }

  return (
    <div className="timeline">
      <div className="timeline__header">
        <div className="timeline__title">Timeline</div>

        <div className="timeline__controls">
          <button
            className="uiBtn"
            onClick={() => onSelectFrame(Math.max(0, currentFrameIndex - 1))}
            disabled={currentFrameIndex <= 0}
            title="Previous frame (Alt+Left)"
          >
            ⟨
          </button>
          <button
            className={isPlaying ? "uiBtn uiBtn--active" : "uiBtn"}
            onClick={onTogglePlayback}
            title={isPlaying ? "Stop (Space)" : "Play (Space)"}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button
            className="uiBtn"
            onClick={() => onSelectFrame(Math.min(frames.length - 1, currentFrameIndex + 1))}
            disabled={currentFrameIndex >= frames.length - 1}
            title="Next frame (Alt+Right)"
          >
            ⟩
          </button>
          <button
            className={showTags ? "uiBtn uiBtn--active" : "uiBtn"}
            onClick={() => setShowTags((prev) => !prev)}
            title="Toggle animation tags"
          >
            Tags
          </button>
          <button
            className={showTween ? "uiBtn uiBtn--active" : "uiBtn"}
            onClick={() => setShowTween((prev) => !prev)}
            title="Toggle tween generator"
          >
            Tween
          </button>

          <label className="timeline__fps">
            <span>FPS</span>
            <input
              type="number"
              min="1"
              max="60"
              value={fpsInput}
              onChange={(e) => handleFpsChange(e.target.value)}
            />
          </label>
        </div>

        <div className="timeline__controls">
          <button
            className="uiBtn"
            onClick={onInsertFrame}
            title="Insert new frame after current"
          >
            + Insert
          </button>
          <button
            className="uiBtn"
            onClick={onDuplicateFrame}
            title="Duplicate current frame"
          >
            Duplicate
          </button>
          <button
            className="uiBtn"
            onClick={onDeleteFrame}
            disabled={frames.length <= 1}
            title="Delete current frame"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="timeline__body">
        <span className="timeline__info">
          {frames.length} frame{frames.length !== 1 ? "s" : ""} · {totalDuration}ms · ~{fps} FPS
        </span>

        {showTags && (
        <div className="timeline__tags" style={{ padding: "8px", borderBottom: "1px solid #333" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <strong style={{ fontSize: "12px" }}>Animation Tags</strong>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#aaa" }}>
              <input
                type="checkbox"
                checked={loopTagOnly}
                onChange={(e) => onToggleLoopTagOnly(e.target.checked)}
              />
              Loop selected tag only
            </label>
          </div>

          <div style={{ position: "relative", height: "18px", background: "#1a1a1a", border: "1px solid #333", borderRadius: "3px" }}>
            {animationTags.map((tag) => {
              const total = Math.max(1, frames.length);
              const left = (tag.start_frame / total) * 100;
              const width = ((tag.end_frame - tag.start_frame + 1) / total) * 100;
              return (
                <button
                  key={tag.id}
                  onClick={() => onSelectTag(tag.id)}
                  title={`${tag.name}: ${tag.start_frame + 1}-${tag.end_frame + 1}`}
                  style={{
                    position: "absolute",
                    left: `${left}%`,
                    width: `${width}%`,
                    height: "100%",
                    background: tag.color,
                    border: tag.id === activeTagId ? "2px solid #fff" : "1px solid #111",
                    cursor: "pointer",
                    borderRadius: "2px",
                  }}
                />
              );
            })}
          </div>

          <div style={{ marginTop: "8px", display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: "6px", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Tag name (Idle)"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              style={{ padding: "4px", background: "#1a1a1a", color: "#fff", border: "1px solid #444" }}
            />
            <input
              type="number"
              min="1"
              max={frames.length}
              value={newTagStart + 1}
              onChange={(e) => setNewTagStart(Math.max(0, Number(e.target.value) - 1))}
              style={{ width: "70px", padding: "4px", background: "#1a1a1a", color: "#fff", border: "1px solid #444" }}
              title="Start frame"
            />
            <input
              type="number"
              min="1"
              max={frames.length}
              value={newTagEnd + 1}
              onChange={(e) => setNewTagEnd(Math.max(0, Number(e.target.value) - 1))}
              style={{ width: "70px", padding: "4px", background: "#1a1a1a", color: "#fff", border: "1px solid #444" }}
              title="End frame"
            />
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              title="Tag color"
              style={{ width: "32px", height: "28px", border: "1px solid #444" }}
            />
            <button onClick={handleCreateTag} style={{ padding: "6px", fontSize: "11px" }}>
              Add Tag
            </button>
          </div>

          {activeTag && (
            <div style={{ marginTop: "8px", display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "6px", alignItems: "center" }}>
              <input
                type="text"
                value={activeTag.name}
                onChange={(e) => onUpdateTag(activeTag.id, { name: e.target.value })}
                style={{ padding: "4px", background: "#1a1a1a", color: "#fff", border: "1px solid #444" }}
              />
              <input
                type="number"
                min="1"
                max={frames.length}
                value={activeTag.start_frame + 1}
                onChange={(e) =>
                  onUpdateTag(activeTag.id, {
                    start_frame: Math.max(0, Math.min(frames.length - 1, Number(e.target.value) - 1)),
                  })
                }
                style={{ width: "70px", padding: "4px", background: "#1a1a1a", color: "#fff", border: "1px solid #444" }}
              />
              <input
                type="number"
                min="1"
                max={frames.length}
                value={activeTag.end_frame + 1}
                onChange={(e) =>
                  onUpdateTag(activeTag.id, {
                    end_frame: Math.max(0, Math.min(frames.length - 1, Number(e.target.value) - 1)),
                  })
                }
                style={{ width: "70px", padding: "4px", background: "#1a1a1a", color: "#fff", border: "1px solid #444" }}
              />
              <button onClick={() => onDeleteTag(activeTag.id)} style={{ padding: "6px", fontSize: "11px" }}>
                Delete
              </button>
            </div>
          )}
        </div>
        )}

        {showTween && (
        <div className="timeline__tween">
          <div className="timeline__tween-header">
            <strong className="timeline__tween-title">Tween Generator</strong>
            <span className="timeline__tween-subtitle">Build in-between frames with easing</span>
          </div>

          <div className="timeline__tween-controls">
            <label className="timeline__tween-label">From</label>
            <select
              value={tweenStart}
              onChange={(e) => setTweenStart(Number(e.target.value))}
              className="timeline__tween-select"
            >
              {frames.map((_, index) => (
                <option key={`tween-start-${index}`} value={index}>
                  {index + 1}
                </option>
              ))}
            </select>

            <label className="timeline__tween-label">To</label>
            <select
              value={tweenEnd}
              onChange={(e) => setTweenEnd(Number(e.target.value))}
              className="timeline__tween-select"
            >
              {frames.map((_, index) => (
                <option key={`tween-end-${index}`} value={index}>
                  {index + 1}
                </option>
              ))}
            </select>

            <label className="timeline__tween-label">In-betweens</label>
            <input
              type="number"
              min={1}
              max={32}
              value={tweenCount}
              onChange={(e) => setTweenCount(Number(e.target.value))}
              className="timeline__tween-input"
            />

            <label className="timeline__tween-label">Easing</label>
            <select
              value={tweenEasing}
              onChange={(e) => setTweenEasing(e.target.value as EasingCurve)}
              className="timeline__tween-select"
            >
              <option value="linear">Linear</option>
              <option value="easeInQuad">Ease In Quad</option>
              <option value="easeOutQuad">Ease Out Quad</option>
              <option value="elastic">Elastic</option>
            </select>

            <button
              onClick={handleGenerateTweens}
              className="timeline__tween-button"
              disabled={frames.length < 2}
            >
              Generate Tweens
            </button>
          </div>
        </div>
        )}

        <div className="timeline__frames">
          {frames.map((frame, index) => (
            <div
              key={frame.id}
              className={
                index === currentFrameIndex
                  ? "timeline__frame timeline__frame--active"
                  : "timeline__frame"
              }
              onClick={() => onSelectFrame(index)}
              title={`Frame ${index + 1}`}
            >
              <div className="timeline__frame__number">{index + 1}</div>

              <div className="timeline__frame__preview">
                <canvas
                  ref={(el) => {
                    if (el) canvasRefs.current.set(frame.id, el);
                  }}
                  width={canvasSpec.width}
                  height={canvasSpec.height}
                  className="timeline__frame__canvas"
                />
              </div>

              <div className="timeline__frame__duration">
                <input
                  type="number"
                  min="10"
                  max="5000"
                  step="10"
                  value={frame.durationMs}
                  onChange={(e) => handleDurationChange(index, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  title="Duration in milliseconds"
                />
                <span className="timeline__frame__duration__label">ms</span>
              </div>
            </div>
          ))}
        </div>

        <div className="timeline__settings">
          <label className="timeline__setting">
            <input
              type="checkbox"
              checked={settings.showOnionSkin}
              onChange={(e) =>
                onChangeSettings({ ...settings, showOnionSkin: e.target.checked })
              }
            />
            <span>Onion Skin</span>
          </label>

          {settings.showOnionSkin && (
            <>
              <label className="timeline__setting">
                <span>Previous</span>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={settings.onionPrev}
                  onChange={(e) =>
                    onChangeSettings({ ...settings, onionPrev: Number(e.target.value) })
                  }
                  className="timeline__setting__input"
                />
              </label>

              <label className="timeline__setting">
                <span>Next</span>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={settings.onionNext}
                  onChange={(e) =>
                    onChangeSettings({ ...settings, onionNext: Number(e.target.value) })
                  }
                  className="timeline__setting__input"
                />
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
