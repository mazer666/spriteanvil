# SpriteAnvil Export Format

This document defines the **export contract** of SpriteAnvil.

If you export a sprite/animation from SpriteAnvil, you should be able to reliably load it in:
- game engines (Godot, Unity, Phaser, etc.)
- pipelines/tools (custom build scripts, asset packers)
- future versions of SpriteAnvil itself

> **Important:** The export format is the *source of truth for outputs*.  
> Internal state can evolve, but exports should remain stable (or versioned with migration rules).

---

## 1) What SpriteAnvil exports

SpriteAnvil exports **pixel data** + **metadata**.

### 1.1 Primary formats (recommended baseline)

1) **Spritesheet PNG** (single image)  
2) **JSON metadata** (describes frames, rects, timing, pivots, tags, etc.)

This combination is:
- simple
- engine-friendly
- easy to debug
- easy to version-control

### 1.2 Optional formats (future / roadmap)

- PNG sequence (`frame_000.png`, `frame_001.png`, …) + JSON
- GIF / APNG
- WebM / MP4
- Engine-specific exports (Godot `.tres`, Unity `.meta`, etc.)

This document focuses on the **Spritesheet + JSON** baseline.

---

## 2) Coordinate system and conventions

### 2.1 Pixel coordinates

- Origin (0,0) is **top-left**
- X increases to the right
- Y increases downward

### 2.2 Rect conventions

A frame rectangle `rect` is defined in **spritesheet pixel coordinates**:

```json
{ "x": 32, "y": 0, "w": 16, "h": 16 }
```

Meaning:
- The frame is located at `(x, y)` in the spritesheet
- It occupies `w × h` pixels

### 2.3 Pivot conventions

A pivot is a **point inside the frame’s local rectangle**, in pixels.

```json
{ "x": 8, "y": 15 }
```

Typical uses:
- placing the sprite “on the ground”
- aligning weapon hands
- consistent rotation origin

### 2.4 Integer-only rule

All exported pixel coordinates are integers:
- rects
- pivots
- offsets
- sizes

---

## 3) The metadata file: `*.spriteanvil.json`

### 3.1 File naming

Recommended naming:
- `mySprite.png`
- `mySprite.spriteanvil.json`

Engines and pipelines can associate them by base name.

### 3.2 Top-level structure (v1)

```json
{
  "format": "spriteanvil",
  "formatVersion": 1,
  "generatedBy": {
    "app": "SpriteAnvil",
    "appVersion": "0.1.0"
  },
  "canvas": {
    "width": 16,
    "height": 16
  },
  "spritesheet": {
    "image": "mySprite.png",
    "layout": "grid",
    "width": 256,
    "height": 64,
    "padding": 0,
    "spacing": 0
  },
  "frames": [
    {
      "id": "frame_000",
      "index": 0,
      "rect": { "x": 0, "y": 0, "w": 16, "h": 16 },
      "durationMs": 100,
      "pivot": { "x": 8, "y": 15 },
      "trimmed": false,
      "sourceRect": { "x": 0, "y": 0, "w": 16, "h": 16 },
      "offset": { "x": 0, "y": 0 }
    }
  ],
  "tags": [
    {
      "name": "Idle",
      "from": 0,
      "to": 3,
      "direction": "forward"
    }
  ]
}
```

---

## 4) Field-by-field specification

### 4.1 `format`

- Type: string
- Must be: `"spriteanvil"`

Purpose: lets importers quickly detect the file.

### 4.2 `formatVersion`

- Type: number (integer)
- Current: `1`

Rules:
- If a breaking change is made, increment `formatVersion`.
- Older versions must remain documented.

### 4.3 `generatedBy`

Information for debugging and compatibility.

```json
"generatedBy": {
  "app": "SpriteAnvil",
  "appVersion": "0.1.0"
}
```

### 4.4 `canvas`

The **logical canvas size** the user edited in SpriteAnvil.

```json
"canvas": { "width": 16, "height": 16 }
```

Why it matters:
- If frames are trimmed, you still need the original canvas size to reconstruct placement.

### 4.5 `spritesheet`

```json
"spritesheet": {
  "image": "mySprite.png",
  "layout": "grid",
  "width": 256,
  "height": 64,
  "padding": 0,
  "spacing": 0
}
```

Fields:

- `image`: filename (string)
- `layout`: `"grid" | "packed" | "row" | "column"`
- `width` / `height`: actual PNG dimensions in pixels
- `padding`: outer padding (pixels)
- `spacing`: spacing between frames (pixels)

Notes:
- For `"packed"`, `padding` and `spacing` are still useful for packer output.
- A `"grid"` layout can be reconstructed if you also store `grid` details (optional extension, see below).

#### Optional extension: grid details

If `layout === "grid"`, you may include:

```json
"grid": { "cellW": 16, "cellH": 16, "columns": 16 }
```

This is not required if all rects are explicit, but it helps debugging.

### 4.6 `frames` (array)

Each entry describes one exported frame.

Required fields:

- `id` (string): stable identifier (e.g. `"frame_000"`)
- `index` (number): 0-based order in animation timeline
- `rect` (object): where this frame lives in the spritesheet
- `durationMs` (number): how long to show this frame
- `pivot` (object): local pivot point

Recommended fields for trim support:

- `trimmed` (boolean)
- `sourceRect` (object): original untrimmed rect inside canvas
- `offset` (object): placement offset when reconstructing untrimmed canvas

#### Trim semantics (important)

If `trimmed === false`:
- `rect.w/h` should match `canvas.width/height` for a simple grid export
- `sourceRect` can equal full canvas and `offset` is `(0,0)`

If `trimmed === true`:
- `rect.w/h` is the trimmed bounding box size
- `sourceRect` is the bounding box in the original canvas coordinates
- `offset` is typically the same as `sourceRect.x/y` (where the trimmed region starts)

**Example:**
Canvas is 16×16, but the visible pixels only occupy a 6×10 area starting at (4,2).

```json
{
  "trimmed": true,
  "rect": { "x": 64, "y": 0, "w": 6, "h": 10 },
  "sourceRect": { "x": 4, "y": 2, "w": 6, "h": 10 },
  "offset": { "x": 4, "y": 2 }
}
```

Importer reconstruction rule:
- create a 16×16 empty buffer
- paste the 6×10 pixels at (offset.x, offset.y)

### 4.7 `tags` (array)

Tags define named animation ranges (Aseprite-like).

```json
{
  "name": "Walk",
  "from": 10,
  "to": 17,
  "direction": "pingpong"
}
```

Fields:
- `name` (string)
- `from` (number, inclusive, frame index)
- `to` (number, inclusive, frame index)
- `direction`:
  - `"forward"`
  - `"reverse"`
  - `"pingpong"`

---

## 5) Minimal valid file (smallest compliant metadata)

```json
{
  "format": "spriteanvil",
  "formatVersion": 1,
  "canvas": { "width": 16, "height": 16 },
  "spritesheet": { "image": "sprite.png", "layout": "grid", "width": 64, "height": 16, "padding": 0, "spacing": 0 },
  "frames": [
    { "id": "frame_000", "index": 0, "rect": { "x": 0, "y": 0, "w": 16, "h": 16 }, "durationMs": 100, "pivot": { "x": 8, "y": 15 }, "trimmed": false, "sourceRect": { "x": 0, "y": 0, "w": 16, "h": 16 }, "offset": { "x": 0, "y": 0 } }
  ],
  "tags": []
}
```

---

## 6) Godot-friendly notes (practical)

Godot (2D) often works well with:
- atlas textures (region rects)
- animated sprites / animation player timing

Recommendations:
- Keep `durationMs` explicit (ms precision).
- Keep pivots consistent across frames (especially for character feet).
- Prefer `layout = "grid"` for simplest import in early prototypes.
- If you later add packed layouts, rects remain enough for AtlasTexture regions.

Future (optional):
- Provide a separate `GODOT_EXPORT.md` for creating `.tres` resources automatically.

---

## 7) Validation rules (importers should enforce)

When reading `*.spriteanvil.json`, validate:

- `format === "spriteanvil"`
- `formatVersion` supported
- `canvas.width/height > 0`
- every frame rect is within spritesheet size:
  - `0 <= x < sheet.width`, `0 <= y < sheet.height`
  - `x + w <= sheet.width`, `y + h <= sheet.height`
- `durationMs >= 1`
- pivots inside rect:
  - `0 <= pivot.x <= rect.w-1`
  - `0 <= pivot.y <= rect.h-1`

If validation fails:
- fail with a clear error message (and mention which frame/index caused it)

---

## 8) Future extensions (versioned)

When adding new fields, prefer:
- backwards-compatible optional fields
- or bump `formatVersion` if semantics change

Examples of future extensions:
- layers export
- per-frame events/markers
- collision shapes
- palette export (ASE/GPL/etc.)
- per-frame custom metadata

---

## 9) Implementation notes (where this should live in code)

When implementing export, a good structure is:

- `src/lib/export/` or `src/editor/export/` (choose one and document it)
- keep packer logic UI-agnostic
- keep JSON construction deterministic (stable ordering)

---

## 10) Appendix: JSON schema sketch (informal)

This is a human-readable schema summary (not strict JSON Schema):

- `format`: string, required
- `formatVersion`: integer, required
- `generatedBy`: object, optional
- `canvas`: object { width:int, height:int }, required
- `spritesheet`: object { image:string, layout:string, width:int, height:int, padding:int, spacing:int, grid?:object }, required
- `frames`: array of:
  - id:string
  - index:int
  - rect:{x:int,y:int,w:int,h:int}
  - durationMs:int
  - pivot:{x:int,y:int}
  - trimmed:bool
  - sourceRect:{x:int,y:int,w:int,h:int}
  - offset:{x:int,y:int}
- `tags`: array of:
  - name:string
  - from:int
  - to:int
  - direction:"forward"|"reverse"|"pingpong"
