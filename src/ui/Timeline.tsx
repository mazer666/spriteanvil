import React, { useEffect, useRef } from "react";
import { CanvasSpec, Frame, UiSettings } from "../types";

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
  onTogglePlayback
}: Props) {
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

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

  function handleDurationChange(index: number, value: string) {
    const ms = Math.max(10, Math.min(5000, Number(value)));
    if (!isNaN(ms)) {
      onUpdateFrameDuration(index, ms);
    }
  }

  const totalDuration = frames.reduce((sum, f) => sum + f.durationMs, 0);
  const fps = frames.length > 0 ? Math.round((1000 * frames.length) / totalDuration) : 0;

  return (
    <div className="timeline">
      <div className="timeline__header">
        <div className="timeline__title">Timeline</div>

        <div className="timeline__controls">
          <button
            className={isPlaying ? "uiBtn uiBtn--active" : "uiBtn"}
            onClick={onTogglePlayback}
            title={isPlaying ? "Stop (Space)" : "Play (Space)"}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>

          <span className="timeline__info">
            {frames.length} frame{frames.length !== 1 ? "s" : ""} · {totalDuration}ms · ~{fps} FPS
          </span>
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
