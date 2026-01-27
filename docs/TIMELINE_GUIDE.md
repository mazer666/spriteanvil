# SpriteAnvil Timeline Guide

This document defines the **timeline + animation model** for SpriteAnvil:
- how frames are stored and ordered
- how timing works (`durationMs`)
- how playback works (forward/reverse/pingpong)
- how onion skin should be rendered
- how tags (“Idle/Walk/Run”) behave
- how to keep the timeline performant (virtualization)

> This is a **source-of-truth spec**. Implementations should follow it.

---

## 1) Core concepts

### 1.1 Frame
A frame is a single image in an animation sequence.

Each frame has:
- pixel data (RGBA buffer or layer stack later)
- a display duration (`durationMs`)
- optional metadata (future: events/markers)

### 1.2 Timeline
The timeline is an ordered list of frames.

- Frames are **0-based indexed**
- The **active frame** is the one being edited
- The playhead points at the currently displayed frame during playback

### 1.3 Tags (animation ranges)
Tags define named sub-ranges of frames:
- `Idle`, `Walk`, `Attack`, etc.

Tags allow:
- playing only a specific range
- exporting animation slices cleanly

---

## 2) Data model (recommended)

### 2.1 Frame metadata

```ts
export interface FrameMeta {
  id: string;          // stable identifier, e.g. "frame_000"
  index: number;       // 0-based order in timeline
  durationMs: number;  // integer, >= 1
}
```

### 2.2 Tag model

```ts
export type TagDirection = "forward" | "reverse" | "pingpong";

export interface AnimationTag {
  name: string;        // e.g. "Walk"
  from: number;        // inclusive
  to: number;          // inclusive
  direction: TagDirection;
}
```

Rules:
- `0 <= from <= to < frameCount`
- Tag ranges are inclusive (Aseprite-like)
- Tag names are case-sensitive by default (UI may normalize display)

---

## 3) Frame operations (behavior contract)

### 3.1 Insert frame
- Inserts a new frame at a given index
- All frames at or after that index shift right (+1)
- The new frame becomes active (recommended)

### 3.2 Duplicate frame
- Copies pixel data + metadata (but assigns new `id`)
- Insert duplicate right after the source frame (recommended)

### 3.3 Delete frame
- Removes frame at index
- If last frame is deleted, keep at least 1 frame (recommended safety)
- Adjust active frame index so it stays valid

### 3.4 Reorder frames (drag & drop)
- Updates frame ordering
- Frame `index` fields should match their position after reorder
- IDs remain stable (do not rewrite IDs unnecessarily)

---

## 4) Timing rules

### 4.1 `durationMs`
- integer milliseconds
- must be >= 1
- typical defaults:
  - 100ms (10 FPS)
  - 83ms (12 FPS)
  - 50ms (20 FPS)

### 4.2 Global FPS vs per-frame duration
SpriteAnvil should treat **per-frame duration** as the source of truth.

A “FPS display” may be computed as:
- `fps ≈ 1000 / durationMs` (for fixed-duration animations)
But because durations can vary, UI should show:
- per-frame duration field
- optional “effective FPS” for a selected range (average)

### 4.3 Playback speed multiplier
Playback speed can be multiplied:
- 0.25×, 0.5×, 1×, 2×, 4×

Rule:
- effectiveDurationMs = durationMs / speedMultiplier

---

## 5) Playback behavior (engine contract)

Playback should be deterministic and frame-accurate.

### 5.1 Modes
- forward: 0 → n-1 → 0 ...
- reverse: n-1 → 0 → n-1 ...
- pingpong: 0 → n-1 → n-2 → ... → 1 → 0 ...

### 5.2 Tag playback
If a tag is active:
- only frames in `[tag.from, tag.to]` are considered
- direction is taken from the tag (`direction`)

### 5.3 Timing loop
Playback loop should:
- use real time (performance.now)
- advance frames when accumulated time >= current frame duration
- handle large time jumps by advancing multiple frames (without drift)

Pseudo:

```text
accumulated += deltaTime
while accumulated >= currentFrameDuration:
  accumulated -= currentFrameDuration
  advanceFrame()
```

---

## 6) Onion skin specification

Onion skin is a **render overlay** that shows adjacent frames.

### 6.1 Settings
- enabled: boolean
- beforeCount: 0..15
- afterCount: 0..15
- baseOpacity: 0..1
- tint mode:
  - previous frames: red tint
  - next frames: blue tint
  - optional: user-configurable

### 6.2 Render order
Recommended:
1) render base current frame
2) render previous frames (fading with distance)
3) render next frames (fading with distance)
4) render selection + previews on top

### 6.3 Opacity falloff
Example falloff rule:
- opacity = baseOpacity / distance
  - distance 1: baseOpacity
  - distance 2: baseOpacity/2
  - etc.

### 6.4 Performance notes
- Onion skin rendering should avoid re-decoding/allocating buffers each tick.
- Cache `ImageData` for frames when possible.
- Only render onion skin when enabled.

---

## 7) Timeline UI behavior (minimum)

### 7.1 Thumbnails
- Each frame shows a thumbnail
- Active frame is highlighted
- Thumbnails update when frame pixels change (debounced)

### 7.2 Multi-select (future-ready)
- Shift-click selects a range
- Ctrl/Cmd-click toggles selection

### 7.3 Scrubbing
- Clicking a thumbnail sets active frame
- Dragging across thumbnails can “scrub” active frame (optional)

---

## 8) Virtualization strategy (performance)

Timeline must remain usable with 1000+ frames.

### 8.1 Rule
Only render thumbnails that are visible in the viewport (+ a small buffer).

Example:
- viewport shows 20 thumbnails
- render 20 + 10 buffer on each side

### 8.2 Stable heights
- Thumbnail size should be fixed (or quantized)
- Avoid variable height rows (prevents layout thrash)

### 8.3 Lazy thumbnail generation
- Generate thumbnails when a frame becomes visible
- Cache results
- Invalidate only when frame pixels changed

---

## 9) Export mapping

Timeline maps to `EXPORT_FORMAT.md`:

- `frames[index].durationMs` → exported `durationMs`
- tag ranges → exported `tags` entries

---

## 10) Definition of Done for timeline changes

- [ ] Insert/duplicate/delete behave as specified
- [ ] Frame durations are respected in playback
- [ ] Tag playback works (forward/reverse/pingpong)
- [ ] Onion skin respects counts and opacity
- [ ] Timeline stays responsive with many frames (virtualization)
