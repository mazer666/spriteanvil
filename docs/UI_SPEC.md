# UI_SPEC.md – SpriteAnvil UI Target Vision
## Related docs

- Docs index: [`/docs/README.md`](./README.md)
- Current status: [`/STATUS_UPDATE.md`](../STATUS_UPDATE.md)
- Implementation snapshot: [`/IMPLEMENTATION_COMPLETE.md`](../IMPLEMENTATION_COMPLETE.md)

---


This document defines the **binding UI target vision** for SpriteAnvil — based on the reference design (dark, premium panel UI with clear tool icons, a centered canvas, and a timeline at the bottom).

**Two fixed requirements (as requested):**
1. **Tool icons slightly smaller** (hit area stays, icon size is reduced)
2. **Timeline extends all the way to the left** (under Tool Rail + Canvas; Right Panel stays separate)

---

## 1) Layout base structure (desktop)

SpriteAnvil uses a dock layout with:
- **Top Bar** (top, full width)
- **Main Area** (center: Tool Rail + Canvas + Right Panel)
- **Timeline** (bottom)

**Top Bar UX notes:**
- Primary actions (Projects, Export, Background, Settings) live in the **hamburger menu**.
- Quick controls (Commands + color + grid) remain visible on desktop and are mirrored in the menu for compact layouts.
- Zoom controls are anchored to the **minimap** instead of the top bar.

**Important:** The Right Panel should feel continuous (as in the reference design) and **must not** be covered by the timeline.  
The timeline sits **only under Tool Rail + Canvas**, not under the Right Panel.

### 1.1 Grid split (conceptual)

**Columns**
1. **Tool Rail** (fixed)
2. **Canvas Area** (flex)
3. **Right Panel** (fixed, resizable)

**Rows**
A. **Top Bar**  
B. **Workspace** (Tool Rail + Canvas + Right Panel)  
C. **Timeline** (only under columns 1–2)

**Timeline spanning rule (fixed):**
- Timeline spans **columns 1–2**
- Right Panel remains **column 3** and can visually run to the bottom

---

## 2) Implementation in current code (aligned with project state)

The current project already has a dock system:

- `src/ui/DockLayout.tsx`
- CSS classes in `src/styles/app.css`:
  - `.dock`, `.dock__top`, `.dock__body`, `.dock__left`, `.dock__center`, `.dock__right`, `.dock__bottom`
  - `.splitter--v` (Right Panel resize)
  - `.splitter--h` (Timeline height resize)

### 2.1 Persistent sizes (already present)

Sizes are controlled via CSS variables (DockLayout sets them inline):

- `--rightPanelWidth`
- `--timelineHeight`

**Target:**
- Right Panel stays resizable (e.g. 240–500px)
- Timeline height stays resizable (e.g. 120–350px)

### 2.2 Required layout adjustment (to match reference design)

Currently the timeline sits in the root grid as a “bottom” row and effectively spans full width.  
To match the reference design:

- The root grid should have **two columns**:
  - `main` (Tool Rail + Canvas + Timeline)
  - `right` (Right Panel, continuous)
- Top Bar spans both columns.
- Timeline lives only in the `main` column.

> This is a structural UI change and should be implemented in DockLayout/CSS so the Right Panel does not sit “under” the timeline.

---

## 3) Tool Rail — smaller icons (fixed)

Current CSS defines tool buttons as:

- `.toolbtn`: `40×40`
- Icon/text: `font-size: 18px`

**Target change:**
- Hit area stays (40×40 is fine; can be larger later)
- Icon should be smaller: **16px** (or 15–16px)

Recommended adjustment:

- `.toolbtn { font-size: 16px; }`
- Optional: `.toolbtn svg { width: 18px; height: 18px; }` (if switching to SVG icons)

**Important:** Do not make the button tile smaller — only the icon content.

---

## 4) Timeline — flush left (fixed)

The timeline must **start under the Tool Rail**, not just under the canvas.

That means:
- Timeline starts at x=0 (left edge of the app)
- Timeline covers Tool Rail + Canvas Area
- Right Panel stays separate (no timeline underneath)

**UI content (as in the reference image):**
- Left: playback controls (Play/Pause/Loop/Step)
- Right: frame thumbnails with horizontal scroll
- Active frame: clear highlight frame

---

## 5) Right Panel — tabs & panels (current project)

The Right Panel currently has text tabs:

`Tool`, `Layers`, `Palette`, `Transform`, `Color`, `Selection`, `AI`

This is already a good modular structure.  
**Target vision:** Tabs can later move to icon tabs, but:
- The structure stays
- Panels stay as framed sections/accordions
- Sections should be **reorderable** by drag & drop and offer a compact density toggle.

---

## 6) Theme tokens (current + target)

Current global tokens in `src/styles/app.css` (updated to match the reference gold/bronze feel):

```css
:root{
  --bg0:#0b0a09;
  --bg1:#14110d;
  --panel:#1a1713;
  --panel2:#141210;
  --ink:#efe6d4;
  --muted:#b9ab92;
  --accent:#d6b26b;
  --border:rgba(255,255,255,0.08);
  --shadow: rgba(0,0,0,0.55);

  --rightPanelWidth: 300px;
  --timelineHeight: 180px;
}
```

**Target feel (reference):**
- Dark panels + premium bevelled edges
- Warm accent color (gold look) set via `--accent` and `--accent-strong`

---

## 7) Component acceptance criteria

- [ ] Timeline starts at the left app edge (under Tool Rail)
- [ ] Timeline does **not** extend under the Right Panel
- [ ] Tool icons are visibly smaller (e.g. 18px → 16px), hit area unchanged
- [ ] Right Panel is resizable (and remains visually continuous)
- [ ] Layout remains stable (no scroll/resize artifacts)

---

## 8) What this doc does NOT define

- Exact icon sets (emoji vs SVG)
- Final color palette (token structure only)
- Mobile/tablet layout (later)
