# SpriteAnvil Godot Integration Guide

This document explains how to use SpriteAnvil exports in **Godot (4.x)**.
It is focused on practical, beginner-safe steps and stable mapping rules.

SpriteAnvil exports:
- `mySprite.png` (spritesheet)
- `mySprite.spriteanvil.json` (metadata)

See `EXPORT_FORMAT.md` for field definitions.

---

## 1) Recommended export settings for Godot

For the first iterations (fastest workflow):

- Export **grid layout** (simple to reason about)
- Keep frames **untrimmed** (`trimmed = false`) unless you really need trimming
- Set a consistent pivot (e.g. feet on ground)

Why:
- Godot import is easiest when all frames share the same size
- untrimmed frames avoid offset/paste reconstruction logic

---

## 2) Import settings in Godot (PNG)

When importing pixel art textures:

Recommended:
- **Filter:** Off
- **Mipmaps:** Off (usually for pixel art)
- **Repeat:** Disabled unless you need tiling
- **Compression:** Use “Lossless” (or disable compression if artifacts appear)

Goal:
- keep pixels crisp
- avoid blurring

---

## 3) Using the export in Godot: two common approaches

### Approach A — AnimatedSprite2D with SpriteFrames (simple)

You will:
1) slice the spritesheet into regions
2) assign regions as frames in a `SpriteFrames` resource
3) set per-frame timing using `durationMs`

Pros:
- easy to get started
Cons:
- manual slicing without tooling

### Approach B — AnimationPlayer + Sprite2D (more flexible)

You will:
1) create a Sprite2D
2) animate its `region_rect` property over time
3) set keyframe timing using `durationMs`

Pros:
- flexible, can animate multiple properties
Cons:
- more setup

---

## 4) Mapping rules from SpriteAnvil JSON

For each frame entry:

```json
{
  "rect": { "x": 0, "y": 0, "w": 16, "h": 16 },
  "durationMs": 100,
  "pivot": { "x": 8, "y": 15 },
  "trimmed": false,
  "offset": { "x": 0, "y": 0 }
}
```

### 4.1 Region rectangle
Godot region rect:
- position: `(rect.x, rect.y)`
- size: `(rect.w, rect.h)`

### 4.2 Frame timing
Godot timing is typically seconds:
- `durationSeconds = durationMs / 1000.0`

### 4.3 Pivot handling
Godot has multiple ways to handle pivot/origin:

- For `Sprite2D`, you can set:
  - `centered = false` and position manually
  - or use `offset`
- For animation, you often want a consistent origin point.

Recommended mapping rule (simple):
- Treat SpriteAnvil pivot as “desired origin inside the frame”.
- Compute Sprite2D offset as:

```text
offset = (-pivot.x, -pivot.y)
```

This makes the sprite’s node position correspond to the pivot point.

> Note: Some projects prefer feet alignment or center alignment. Keep it consistent.

### 4.4 Trimmed frames
If `trimmed = true`:
- you must reconstruct placement using `offset` when placing the sprite on the full canvas.
Godot region still uses `rect`, but you must offset the sprite so that the trimmed content appears at correct location.

Rule:
- add `offset` to the visual placement (or to the node offset), depending on your setup.

---

## 5) Suggested automation (future)

Because manual slicing is painful, the long-term solution is:

- A small import helper script that:
  - reads `*.spriteanvil.json`
  - creates a `SpriteFrames` resource automatically
  - sets per-frame durations
  - optionally creates an `AnimatedSprite2D` scene

This project can add:
- `docs/GODOT_IMPORT_SCRIPT.md` (future)
- a `tools/godot/` folder (future) containing the helper

---

## 6) Definition of Done (Godot integration)

- [ ] PNG imports pixel-perfect (no blur)
- [ ] frames slice correctly using rects
- [ ] frame timing matches `durationMs`
- [ ] pivot produces consistent placement
- [ ] tag ranges can be played as separate animations (optional step)
