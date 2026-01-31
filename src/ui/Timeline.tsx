/**
 * src/ui/Timeline.tsx
 * -----------------------------------------------------------------------------
 * ## THE TIMELINE (Noob Guide)
 * 
 * This is the "Film Strip" for your animation.
 * 
 * ## JARGON GLOSSARY
 * 1. FRAME: A single image in the animation sequence.
 * 2. FPS: Frames Per Second. How fast the animation plays.
 * 3. TWEEN: Short for "In-Betweening". The app automatically generates 
 *    frames between two pictures to create smooth motion.
 * 4. ONION SKIN: Seeing a ghost of the previous/next frame while you draw.
 * 
 * ## VISUAL FLOW (Mermaid)
 * ```mermaid
 * stateDiagram-v2
 *   [*] --> Stopped
 *   Stopped --> Playing: Spacebar/Play
 *   Playing --> Playing: Next Frame (Timer)
 *   Playing --> Stopped: Pause
 *   Stopped --> Scrubbing: Drag Timeline
 *   Scrubbing --> Stopped
 * ```
 * 
 * ## VAR TRACE
 * - `frames`: (Origin: App state) The ordered list of animation frames.
 * - `animationTags`: (Origin: Supabase) Named ranges (e.g. "Run Cycle").
 * - `canvasRefs`: (Origin: Internal refs) DOM elements for thumbnail rendering.
 */
import React, { useEffect, useRef, useState } from "react";
import { CanvasSpec, Frame, UiSettings } from "../types";
import type { EasingCurve } from "../editor/animation";
import { AnimationTag } from "../lib/supabase/animation_tags";

type Props = {
  settings: UiSettings;
  onChangeSettings: (next: UiSettings) => void;
  timelineVisible: boolean;
  onToggleTimeline: (next: boolean) => void;
  canvasSpec: CanvasSpec;
  frames: Frame[];
  currentFrameIndex: number;
  selectedFrameIndices?: Set<number>;
  isPlaying: boolean;
  onSelectFrame: (index: number, modifier?: "add" | "range" | null) => void;
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
  dragDropEnabled?: boolean;
  onReorderFrames?: (fromIndex: number, toIndex: number) => void;
};

export default function Timeline({
  settings,
  onChangeSettings,
  timelineVisible,
  onToggleTimeline,
  canvasSpec,
  frames,

  currentFrameIndex,
  selectedFrameIndices,
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
  onDeleteTag,
  dragDropEnabled = false,
  onReorderFrames
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

/**
 * WHAT: Generates "In-Between" frames (Tweens) between two keyframes.
 * WHY: So you don't have to draw every single frame for a simple movement.
 * HOW: It looks at the Pixels in Frame A and Frame B and calculates a mathematical mix for every frame in between.
 * USE: The "∿" button in the Timeline.
 * 
 * ASCII VISUAL:
 * [Frame 1] --> [Tween 1] --> [Tween 2] --> [Frame 2]
 */
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

/**
 * WHAT: Changes the speed of the animation.
 * WHY: Different animations need different speeds (e.g., a "Run" is faster than a "Walk").
 * HOW: It converts "Frames Per Second" into "Milliseconds per Frame" (Duration = 1000 / FPS).
 * USE: The FPS input box.
 * 
 * 🛠️ NOOB CHALLENGE: Can you explain why we use `Math.round(1000 / next)`? 
 * What happens if the division isn't a whole number?
 */
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

  function handleDragStart(e: React.DragEvent, index: number) {
    if (!dragDropEnabled || !onReorderFrames) return;
    e.dataTransfer.setData("application/x-spriteanvil-frame", index.toString());
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    if (!dragDropEnabled || !onReorderFrames) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent, toIndex: number) {
    if (!dragDropEnabled || !onReorderFrames) return;
    e.preventDefault();
    const fromIndexStr = e.dataTransfer.getData("application/x-spriteanvil-frame");
    if (!fromIndexStr) return;
    
    const fromIndex = parseInt(fromIndexStr, 10);
    if (isNaN(fromIndex)) return;
    
    onReorderFrames(fromIndex, toIndex);
  }

  return (
    <div 
      className={`timeline ${!timelineVisible ? "timeline--hidden" : ""}`} 
      style={{ height: timelineVisible ? settings.layout.timelineHeight : 0 }}
    >
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
            className="uiBtn uiBtn--icon" 
            onClick={onTogglePlayback}
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
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
          
          <div className="timeline__fps">
            <label>FPS</label>
            <input 
              type="number" 
              value={Number.isFinite(fpsInput) ? fpsInput : ""} 
              onChange={(e) => handleFpsChange(e.target.value)}
              onBlur={() => {
                if (!fpsInput || fpsInput <= 0) handleFpsChange("12");
              }}
              min="1" 
              max="60" 
            />
          </div>

          <div className="timeline__actions">
            <button className="uiBtn uiBtn--icon" onClick={onInsertFrame} title="New Frame (N)">
              +
            </button>
            <button className="uiBtn uiBtn--icon" onClick={onDuplicateFrame} title="Duplicate Frame (D)">
              ❐
            </button>
            <button className="uiBtn uiBtn--icon" onClick={onDeleteFrame} title="Delete Frame (Backspace)">
              🗑
            </button>
          </div>
          
          <div className="timeline__divider" />
          
          <div className="timeline__tween">
             <button 
              className={`uiBtn uiBtn--icon ${showTween ? "uiBtn--active" : ""}`}
              onClick={() => setShowTween(!showTween)}
              title="Tweening"
            >
              ∿
            </button>
            {showTween && (
              <div className="timeline__popover">
                <h4>Generate Tweens</h4>
                <div className="ui-row">
                  <label>Start Frame</label>
                  <input 
                    type="number" 
                    value={tweenStart + 1} 
                    onChange={e => setTweenStart(Math.max(0, parseInt(e.target.value) - 1))}
                  />
                </div>
                <div className="ui-row">
                  <label>End Frame</label>
                  <input 
                    type="number" 
                    value={tweenEnd + 1} 
                    onChange={e => setTweenEnd(Math.max(0, parseInt(e.target.value) - 1))}
                  />
                </div>
                <div className="ui-row">
                  <label>Count</label>
                  <input 
                    type="number" 
                    value={tweenCount} 
                    onChange={e => setTweenCount(Math.max(1, parseInt(e.target.value)))}
                  />
                </div>
                <div className="ui-row">
                  <label>Easing</label>
                  <select 
                    value={tweenEasing} 
                    onChange={e => setTweenEasing(e.target.value as EasingCurve)}
                  >
                    <option value="linear">Linear</option>
                    <option value="ease_in">Ease In</option>
                    <option value="ease_out">Ease Out</option>
                    <option value="ease_in_out">Ease In/Out</option>
                  </select>
                </div>
                <button className="uiBtn uiBtn--primary" onClick={() => {
                  handleGenerateTweens();
                  setShowTween(false);
                }}>
                  Generate
                </button>
              </div>
            )}
          </div>

          <div className="timeline__tags">
             <button 
              className={`uiBtn uiBtn--icon ${showTags ? "uiBtn--active" : ""}`}
              onClick={() => setShowTags(!showTags)}
              title="Animation Tags"
            >
              🏷
            </button>
             {showTags && (
              <div className="timeline__popover">
                <h4>Animation Tags</h4>
                <div className="ui-list">
                  {animationTags.map(tag => (
                    <div key={tag.id} className="tag-item">
                      <span className="tag-color" style={{ backgroundColor: tag.color }} />
                      <span className="tag-name">{tag.name}</span>
                       <button className="uiBtn uiBtn--small uiBtn--ghost" onClick={() => onDeleteTag(tag.id)}>✕</button>
                    </div>
                  ))}
                  {animationTags.length === 0 && <div className="ui-empty">No tags</div>}
                </div>
                <div className="ui-divider" />
                <div className="ui-row">
                  <input 
                    placeholder="Tag Name" 
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                  />
                  <input 
                    type="color" 
                    value={newTagColor}
                    onChange={e => setNewTagColor(e.target.value)}
                    style={{ width: 32, padding: 0 }}
                  />
                </div>
                <div className="ui-row">
                   <label>Start</label>
                   <input 
                    type="number" 
                    value={newTagStart + 1} 
                    onChange={e => setNewTagStart(Math.max(0, parseInt(e.target.value) - 1))}
                    style={{ width: 60 }}
                   />
                   <label>End</label>
                   <input 
                    type="number" 
                    value={newTagEnd + 1} 
                    onChange={e => setNewTagEnd(Math.max(0, parseInt(e.target.value) - 1))}
                    style={{ width: 60 }}
                   />
                </div>
                <button 
                  className="uiBtn uiBtn--primary uiBtn--full"
                  disabled={!newTagName.trim()}
                  onClick={() => {
                    handleCreateTag();
                    setShowTags(false);
                  }}
                >
                  Create Tag
                </button>
              </div>
            )}
            
            <label className="ui-checkbox" title="Loop only active tag">
              <input 
                type="checkbox" 
                checked={loopTagOnly} 
                onChange={(e) => onToggleLoopTagOnly(e.target.checked)} 
              />
              <span>Loop Tag</span>
            </label>

            <select 
              className="tag-select"
              value={activeTagId || ""}
              onChange={(e) => onSelectTag(e.target.value || null)}
            >
              <option value="">All Frames</option>
              {animationTags.map(tag => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="timeline__track">
        <div className="timeline__frames">
          {frames.map((frame, index) => (
            <div
              key={frame.id}
              className={`timeline-frame ${(selectedFrameIndices ? selectedFrameIndices.has(index) : index === currentFrameIndex) ? "timeline-frame--active" : ""}`}
              onClick={(e) => {
                let modifier: "add" | "range" | null = null;
                if (e.metaKey || e.ctrlKey) modifier = "add";
                else if (e.shiftKey) modifier = "range";
                onSelectFrame(index, modifier);
              }}
              title={`Frame ${index + 1}`}
              draggable={dragDropEnabled}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
            >
              <div className="timeline-frame__canvas-wrapper">
                <canvas
                  ref={(el) => {
                    if (el) canvasRefs.current.set(frame.id, el);
                    else canvasRefs.current.delete(frame.id);
                  }}
                  width={canvasSpec.width}
                  height={canvasSpec.height}
                />
              </div>
              <div className="timeline-frame__footer">
                <span className="timeline-frame__index">{index + 1}</span>
                <input
                  className="timeline-frame__duration"
                  value={frame.durationMs}
                  onChange={(e) => handleDurationChange(index, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="timeline-frame__unit">ms</span>
              </div>
              {/* Render tag indicators */}
              <div className="timeline-frame__tags">
                {animationTags
                  .filter(tag => index >= tag.start_frame && index <= tag.end_frame)
                  .map(tag => (
                    <div 
                      key={tag.id} 
                      className="frame-tag-dot" 
                      style={{ backgroundColor: tag.color }} 
                      title={tag.name}
                    />
                  ))}
              </div>
            </div>
          ))}
          <div 
            className="timeline-frame timeline-frame--add"
            onClick={onInsertFrame}
            title="Add Frame"
          >
            <span>+</span>
          </div>
        </div>
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
  );
}
