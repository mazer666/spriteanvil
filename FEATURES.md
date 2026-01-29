# SpriteAnvil - Complete Feature List

**Version**: 0.8.0 (Phase 8 Implementation)
**Last Updated**: 2026-01-28

---

## ✅ Fully Implemented & Working Features

### 🎨 Drawing Tools (5 tools)

1. **Pen Tool** (B) - Freehand pixel-perfect drawing with adjustable brush size
2. **Eraser Tool** (E) - Remove pixels with adjustable brush size
3. **Eyedropper Tool** (I) - Pick colors from canvas
4. **Fill Tool** (F) - Flood fill with scanline algorithm + tolerance control
5. **Line Tool** (L) - Draw straight lines

### 📐 Shape Tools (6 tools)

7. **Rectangle** (R) - Outlined rectangle
8. **Filled Rectangle** (Shift+R) - Solid rectangle
9. **Circle** (C) - Outlined circle
10. **Filled Circle** (Shift+C) - Solid circle
11. **Ellipse** (Shift+O) - Outlined ellipse
12. **Filled Ellipse** (O) - Solid ellipse

### ✂️ Selection Tools (4 tools)

13. **Rectangle Selection** (M) - Rectangular marquee
14. **Ellipse Selection** (Shift+M) - Elliptical marquee
15. **Lasso Selection** (W) - Free-form polygon selection
16. **Magic Wand** - Tolerance-based selection

**Selection Operations:**
- Copy (Cmd+C)
- Cut (Cmd+X)
- Paste (Cmd+V)
- Select All (Cmd+A)
- Deselect (Cmd+D / Escape)
- Invert / Grow / Shrink
- Boolean add/subtract/intersect via Shift/Alt modifiers
- Marching ants animation

### 🖼️ Layer System (UI + Compositing)

**Features:**
- Create, delete, duplicate layers
- Rename layers (double-click)
- Reorder layers (drag & drop)
- Toggle visibility (eye icon)
- Lock/unlock layers
- Opacity control (0-100%)
- **10 Blend Modes:**
  - Normal
  - Multiply
  - Screen
  - Overlay
  - Add
  - Subtract
  - Darken
  - Lighten
  - Difference
  - Exclusion
- Merge down functionality

**Note**: Drawing targets the active layer, and previews composite all visible layers.

**Access**: Right Panel → Layers tab

### 🎨 Palette & Color System

**Palette Management:**
- Create custom palettes
- Delete palettes (except default)
- Add colors to palette
- Remove colors from palette
- Default palette system (16-color default)

**Color Picker:**
- Hex color input (#RRGGBB)
- Color picker widget
- Recent colors (last 20)
- Color swap mode (click-to-swap)

**Access**: Right Panel → Palette tab

### 🔄 Transform Operations

**Available Transforms:**
- Flip Horizontal (Cmd+H)
- Flip Vertical (Cmd+Shift+H)
- Rotate 90° Clockwise (Cmd+R)
- Rotate 90° Counter-Clockwise (Cmd+Shift+R)
- Rotate 180°
- Scale with nearest-neighbor (pixel-perfect)
  - Lock aspect ratio option
  - 0.1x - 8x range
**Note:** When a selection is active, transforms apply to the selection only.

**Access**: Right Panel → Transform tab

### 🎨 Color Adjustments

**Available Adjustments:**
1. **Hue Shift** (-180° to +180°)
2. **Saturation** (-100 to +100)
3. **Brightness** (-100 to +100)
4. **Invert Colors**
5. **Desaturate** (convert to grayscale)
6. **Posterize** (2-16 levels)

**Algorithms:**
- RGB ↔ HSL color space conversion
- Non-destructive preview
- Undo/redo support

**Access**: Right Panel → Color tab

### 🎬 Animation System

**Timeline Features:**
- Add/delete frames
- Duplicate frames
- Reorder frames (drag & drop)
- Frame duration control (per frame)
- Play/pause (Spacebar)
- Frame navigation (Alt+← / Alt+→)
- Current frame indicator

**Onion Skinning:**
- Toggle on/off (Cmd+;)
- Previous frames (0-15)
- Next frames (0-15)
- Adjustable opacity

**Access**: Bottom timeline panel

### 📤 Export System

**Export Formats:**

1. **PNG Spritesheet**
   - Grid layout
   - Horizontal strip
   - Vertical strip
   - Configurable padding/spacing
   - Scale multiplier (1x-8x)
2. **GIF Animation**
   - Loop toggle
   - Quality slider
3. **JSON Metadata**
   - SpriteAnvil metadata spec

**Access**: Top bar → Export button (Cmd+E)

### ⌨️ Keyboard Shortcuts (30+ shortcuts)

**Edit Operations:**
- Undo: Cmd+Z
- Redo: Cmd+Y / Cmd+Shift+Z
- Copy: Cmd+C
- Cut: Cmd+X
- Paste: Cmd+V
- Select All: Cmd+A
- Deselect: Cmd+D

**Tool Shortcuts:**
- B: Pen
- E: Eraser
- I: Eyedropper
- F: Fill
- G: Gradient
- L: Line
- R: Rectangle / Shift+R: Filled Rectangle
- C: Circle / Shift+C: Filled Circle
- O: Filled Ellipse / Shift+O: Ellipse
- M: Rectangle Selection / Shift+M: Ellipse Selection
- W: Lasso Selection
- V: Move Selection

**View Controls:**
- Cmd+=: Zoom in
- Cmd+-: Zoom out
- Cmd+0: Reset zoom to 100%
- Cmd+': Toggle grid
- Cmd+;: Toggle onion skin
- Space + drag: Pan canvas

**Transform:**
- Cmd+H: Flip horizontal
- Cmd+Shift+H: Flip vertical
- Cmd+R: Rotate 90° CW
- Cmd+Shift+R: Rotate 90° CCW

**Animation:**
- Alt+→: Next frame
- Alt+←: Previous frame
- Space: Play/pause

**Other:**
- Cmd+K: Open command palette
- Cmd+E: Export
- Cmd+S: Save (planned)
- Escape: Deselect

### 🔍 Command Palette

**Features:**
- Fuzzy search across all commands
- Keyboard navigation (↑/↓ arrows)
- Category filtering
- Shortcut display
- Quick command execution
- 25+ commands available

**Access**: Cmd+K or top bar → Commands button

### ⚙️ View Settings

**Background Options:**
- Checkerboard (customizable colors & size)
- Solid Dark
- Solid Light
- Greenscreen
- Bluescreen

**Grid Options:**
- Toggle on/off
- Pixel size (1-64px)
- Visual overlay

**Other Settings:**
- Zoom (1x - 32x)
- Brush stabilizer
- Checker size & colors

**Access**: Right Panel → Tool tab

### 💾 History System

**Features:**
- Unlimited undo/redo
- Per-frame history
- Efficient snapshot system
- Undo/redo indicators in UI

**Access**:
- Top bar buttons
- Cmd+Z / Cmd+Y

---

## 🎨 Advanced Features

### Gradient Tool (5 types)

1. **Linear** - Straight gradient
2. **Radial** - Circular gradient from center
3. **Angle** - Circular sweep around center
4. **Reflected** - Mirrored linear gradient
5. **Diamond** - Manhattan distance gradient

**Dithering Support:**
- None (smooth)
- Bayer matrix (ordered)
- Floyd-Steinberg (error diffusion)

### Symmetry Modes (Applied, Custom Axis Pending)

**Implemented in `src/editor/symmetry.ts`:**
- Horizontal mirror
- Vertical mirror
- Both axes
- Radial 4-way
- Radial 8-way
- Visual guides

*Note: Symmetry applies to pen/eraser, line, shapes, and gradients; custom symmetry axes are still pending.*

### Selection Tools (Integrated)

**Lasso Selection:**
- Free-form polygon drawing
- Point-in-polygon algorithm
- Path smoothing

**Magic Wand:**
- Color tolerance selection
- Flood-fill based
- Adjustable tolerance

---

## 🗄️ Database Integration (Supabase)

**Complete Schema with RLS:**
- ✅ `projects` table
- ✅ `sprites` table
- ✅ `frames` table
- ✅ `layers` table
- ✅ `palettes` table
- ✅ `animation_tags` table
- ✅ `user_settings` table

**Security:**
- Row Level Security (RLS) on all tables
- Performance-optimized policies
- No SQL injection vulnerabilities
- Secure multi-user support

**APIs:**
- `src/lib/supabase/projects.ts`
- `src/lib/supabase/sprites.ts`
- `src/lib/supabase/frames.ts`
- `src/lib/supabase/layers.ts`
- `src/lib/supabase/palettes.ts`
- `src/lib/supabase/animation_tags.ts`

---

## 🏗️ Architecture

### Code Organization

```
src/
├── editor/           # Core algorithms (pure functions)
│   ├── pixels.ts     # Pixel manipulation
│   ├── history.ts    # Undo/redo system
│   ├── selection.ts  # Selection operations
│   ├── clipboard.ts  # Copy/paste
│   ├── symmetry.ts   # Symmetry modes
│   └── tools/        # Tool implementations
│       ├── fill.ts
│       ├── shapes.ts
│       ├── gradient.ts
│       ├── lasso.ts
│       ├── transform.ts
│       └── coloradjust.ts
├── ui/               # React components
│   ├── App.tsx       # Main application
│   ├── DockLayout.tsx
│   ├── CanvasStage.tsx
│   ├── ToolRail.tsx
│   ├── Timeline.tsx
│   ├── RightPanel.tsx
│   ├── LayerPanel.tsx
│   ├── PalettePanel.tsx
│   ├── TransformPanel.tsx
│   ├── ColorAdjustPanel.tsx
│   ├── CommandPalette.tsx
│   └── ExportPanel.tsx
├── lib/              # External integrations
│   ├── supabase/     # Database APIs
│   └── export/       # Export formats
│       ├── spritesheet.ts
│       ├── metadata.ts
│       └── gif.ts
├── hooks/            # React hooks
│   └── useKeyboardShortcuts.ts
└── utils/            # Utility functions
    ├── canvas.ts
    ├── colors.ts
    └── math.ts
```

### Design Principles

1. **Clean Separation**
   - UI layer (React components)
   - Business logic (pure functions)
   - Database layer (Supabase APIs)
   - Export layer (standalone modules)

2. **Type Safety**
   - Full TypeScript throughout
   - Strict type checking
   - No `any` types in core logic

3. **Performance**
   - Pixel-perfect algorithms (no anti-aliasing)
   - Efficient flood fill (scanline algorithm)
   - Optimized selection operations
   - Undo/redo with snapshots

4. **Security**
   - RLS on all database tables
   - Performance-optimized policies
   - No SQL injection vulnerabilities

---

## 📊 Implementation Status by Phase

| Phase | Features | Status | Notes |
|-------|----------|--------|-------|
| **Phase 0** | Documentation | 80% | Core docs in place |
| **Phase 1** | Foundation | 60% | Database 100% complete |
| **Phase 2** | Drawing Tools | 70% | Core tools + gradient/lasso/wand wired |
| **Phase 3** | Animation | 80% | PNG/GIF/JSON export working |
| **Phase 4** | Layers & Color | 45% | UI + compositing working |
| **Phase 5** | AI Features | 5% | Database ready |
| **Phase 6** | Professional UX | 70% | Shortcuts + command palette done |
| **Phase 7** | Export | 80% | PNG/GIF/JSON UI available |
| **Phase 8** | Collaboration | 10% | Infrastructure only |

**Overall: ~68% Complete**

---

## 🚀 What's Production-Ready

### Core Functionality (Partial)
- ✅ Core drawing tools (pen/eraser/line/shapes)
- ✅ Rectangle/ellipse selections + basic ops
- ✅ Palette and color adjustment panels
- ✅ Animation timeline + playback
- ✅ PNG spritesheet export
- ✅ Keyboard shortcuts + command palette
- ✅ Undo/redo system
- ⏳ Gradient/lasso/magic wand integration
- ⏳ Layer compositing
- ⏳ JSON/GIF export wiring

### User Experience (70%)
- ✅ Keyboard navigation
- ✅ Command palette
- ✅ Contextual help (shortcuts)
- ⏳ Responsive UI
- ⏳ Tutorial system
- ⏳ Help documentation

### Performance (70%)
- ✅ Efficient pixel operations
- ✅ Optimized rendering
- ⏳ Web Workers for heavy operations
- ⏳ IndexedDB caching
- ⏳ Virtual scrolling for large projects

---

## ⏳ Planned Features (Not Yet Implemented)

### Phase 5: AI Features
- AI image generation integration
- Prompt-based sprite generation
- Image-to-image transformation
- Inpainting for selections
- API key management UI

### Phase 8: Collaboration
- Real-time collaborative editing
- Live cursor tracking
- Presence indicators
- Comments & annotations
- Version history
- Conflict resolution

### Additional Features
- Video export (WebM/MP4)
- APNG export
- Responsive design for mobile/tablet
- Touch gesture support
- High-contrast accessibility mode
- Multiple symmetry guides simultaneously
- Brush presets & custom brushes

---

## 📝 Known Limitations

1. **Single layer drawing** - While layers exist in state, drawing currently only affects the main buffer (multi-layer compositing not fully integrated)
2. **No auto-save** - Manual save required
3. **Desktop-focused** - Not optimized for mobile/touch
4. **No WebGL acceleration** - All rendering is Canvas 2D
5. **Memory limits** - Very large canvases (>1024x1024) may be slow

---

## 🎯 Quick Start Guide

### Basic Workflow

1. **Draw**
   - Select a tool from the left toolbar (or use keyboard shortcuts)
   - Choose a color from the palette
   - Draw on the canvas

2. **Animate**
   - Add frames using the timeline
   - Draw on each frame
   - Use onion skinning to see previous/next frames
   - Press Space to preview animation

3. **Manage Layers**
   - Open Right Panel → Layers tab
   - Add/delete/reorder layers
   - Adjust opacity and blend mode

4. **Transform**
   - Select pixels or entire frame
   - Use Right Panel → Transform tab
   - Apply flips, rotations, or scaling

5. **Adjust Colors**
   - Open Right Panel → Color tab
   - Adjust hue, saturation, brightness
   - Apply effects like invert or posterize

6. **Export**
   - Press Cmd+E or click Export button
   - Export a PNG spritesheet
   - Configure export settings
   - Download your sprite!

### Keyboard Shortcuts Cheat Sheet

**Essential:**
- B: Pen tool
- E: Eraser
- M: Select
- Cmd+Z: Undo
- Cmd+K: Command palette
- Space: Play/Pause animation

**Pro Tips:**
- Hold Shift with shape tools for filled versions
- Use Cmd+K to quickly find any command
- Alt+Arrow keys to navigate frames
- Cmd+H/R for quick transforms

---

## 🏆 Best-in-Class Features

1. **Pixel-Perfect Precision** - No anti-aliasing, true pixel art
2. **Layer Controls** - Rich layer UI (compositing pending)
3. **Selection Workflow** - Rectangle/ellipse selections with growth/shrink
4. **Command Palette** - Vim/VSCode-style quick command access
5. **Comprehensive Shortcuts** - 30+ keyboard shortcuts
6. **Export Flexibility** - PNG spritesheets today, JSON/GIF planned
7. **Database-Backed** - Cloud-ready with Supabase integration
8. **Type-Safe** - Full TypeScript with strict typing

---

## 📚 Documentation

- `docs/PROJECT_PLAN.md` - Complete project roadmap
- `docs/ARCHITECTURE.md` - System architecture
- `docs/CODE_STYLE.md` - Coding standards
- `docs/IMPLEMENTATION_STATUS.md` - Current progress
- `docs/PHASE_5_TO_8_SUMMARY.md` - Advanced features summary
- `docs/SELECTION_MODEL.md` - Selection system details
- `docs/PALETTE_AND_COLOR.md` - Color management
- `docs/TIMELINE_GUIDE.md` - Animation system
- `docs/EXPORT_FORMAT.md` - Export specifications
- `docs/GODOT_INTEGRATION.md` - Game engine integration

---

## 🔗 Links

- GitHub: (your repository)
- Documentation: `docs/`
- License: See LICENSE file

---

**Built with**: React, TypeScript, Supabase, Vite
**Author**: SpriteAnvil Team
**Version**: 0.8.0
**Status**: Production-ready for core features
