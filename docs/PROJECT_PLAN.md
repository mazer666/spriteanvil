# Plan: Professional AI-Powered Sprite Editor  

## Related docs

- Docs index: [`/docs/README.md`](./README.md)
- Current status: [`/STATUS_UPDATE.md`](../STATUS_UPDATE.md)
- Implementation snapshot: [`/IMPLEMENTATION_COMPLETE.md`](../IMPLEMENTATION_COMPLETE.md)

---

## Complete Best in Class Solution Parity + Innovations (Beginner-Friendly, Fully Documented)

This document is the end-to-end development plan for building a **professional sprite editor** that reaches **feature parity with best in class solution**, and then goes beyond it with **AI assistance, advanced symmetry, better UX**, and **cloud/collaboration**.

A core principle throughout every phase: **code and architecture must be understandable for beginners** while staying professional-grade.

---

## Table of Contents

- [Guiding Principles](#guiding-principles)
- [Phase 0: Code Organization & Documentation Standards](#phase-0-code-organization--documentation-standards-apply-across-all-phases)
- [Phase 1: Responsive Foundation & Core Architecture](#phase-1-responsive-foundation--core-architecture)
- [Phase 2: Complete Drawing & Selection Toolset](#phase-2-complete-drawing--selection-toolset-parity--improvements)
- [Phase 3: Animation & Timeline Mastery](#phase-3-animation--timeline-mastery)
- [Phase 4: Layers, Palette & Color Management](#phase-4-layers-palette--color-management)
- [Phase 5: AI-Powered Features](#phase-5-ai-powered-features)
- [Phase 6: Professional UX & Accessibility](#phase-6-professional-ux--accessibility)
- [Phase 7: Clipboard & Import/Export Excellence](#phase-7-clipboard--importexport-excellence)
- [Phase 8: Collaboration & Cloud Features](#phase-8-collaboration--cloud-features)
- [Phase 9: Market Leadership - Procreate Power + Figma Minimalism](#phase-9-market-leadership-procreate-power--figma-minimalism)
- [Phase 10: Advanced Creative Suite](#phase-10-advanced-creative-suite)
- [Phase 11: Mobile & Tablet Optimization](#phase-11-mobile--tablet-optimization-secondary-priority)
- [Documentation Best Practices Applied Throughout](#code-documentation-best-practices-applied-throughout-all-phases)
- [Summary](#summary)

---

## Guiding Principles

- **Current best in class solution parity first, then innovation.**
- **Documentation is a feature.** (Every complex decision explained in code and docs.)
- **Separation of concerns.** Business logic vs. UI, reusable libs, clear module boundaries.
- **Predictable performance.** Pixel ops, transforms, timeline virtualization, caching.
- **Security by design.** API keys encrypted, sensible storage, rate limiting, safe defaults.
- **Desktop-first responsive design.** Tablet/mobile supported via adaptive UI and gestures.

---

## Phase 0: Code Organization & Documentation Standards (Apply Across All Phases)

### 0.1 Documentation & Code Clarity Foundation

- [ ] Establish clear code organization with dedicated folders per feature area, each with purpose-specific README files.
- [ ] Add comprehensive inline comments explaining the **“why”**, not just the “what”, for every function and complex logic block.
- [ ] Use TypeScript with **strict typing** and explicit type definitions to make intent clear.
- [ ] Add JSDoc for all functions, parameters, and return values (include usage examples).
- [ ] Beginner-friendly naming (avoid abbreviations):
  - Use `framePixelData` instead of `fpd`
  - Use `calculateZoomToFitCanvas` instead of `calcZoom`
- [ ] Add **Architecture comments** at the top of complex files describing structure and data flow.
- [ ] Add step-by-step comments before algorithm-heavy sections (pixel ops, transforms, flood fill, etc.).
- [ ] Favor modular functions (single responsibility principle).
- [ ] Add error message comments explaining what can go wrong and why.
- [ ] Maintain meaningful `TODO` / `FIXME` with rationale and intended fix.

**/docs folder must contain:**
- [ ] `ARCHITECTURE.md` — overall application structure
- [ ] `MODULE_GUIDE.md` — breakdown of each feature module
- [ ] `CODE_STYLE.md` — naming conventions and organization patterns
- [ ] `COMMON_TASKS.md` — step-by-step guides for frequent changes

### 0.2 Development Workflow & Learning Resources

- [ ] Create `/src/examples` with commented example code showing how to use each API.
- [ ] Create `/src/constants.ts` centralizing all magic numbers with clear names + comments.
- [ ] Separate business logic and UI:
  - `/src/lib` — business logic
  - `/src/ui` — UI components
- [ ] Create `/src/utils` helper library with well-documented utility functions.
- [ ] Add debug logging at key points with descriptive messages + log-level control.
- [ ] Create `/CONTRIBUTING.md` aimed at new developers: how to extend features safely.
- [ ] Add “Before/After” comment examples for complex transformations.
- [ ] Implement type guards/assertions with clear error messages.
- [ ] Use ASCII diagrams in comments for complex data structures/algorithms.
- [ ] Add performance notes where optimizations are critical.

### 0.3 Configuration & Constants Management

- [ ] Create `/src/config.ts` as a **centralized configuration hub** (fully documented).
- [ ] Create color palette constants with **semantic names** (not only hex).
- [ ] Document **magic numbers** and why they exist (e.g. why stabilizer alpha is `0.35`).
- [ ] Preset constants for common dimensions/speeds/behaviors.
- [ ] Document acceptable ranges and what each value controls.
- [ ] Environment-based configuration for development vs. production.

---

## Phase 1: Responsive Foundation & Core Architecture

### 1.1 Responsive Layout System (Desktop-Priority Implementation)

- [ ] **CSS Grid-based breakpoints**:
  - Desktop: `1200px+`
  - Tablet: `768px–1199px`
  - Mobile: `320px–767px`
- [ ] Add `/src/styles/RESPONSIVE_GUIDE.md` describing breakpoint strategy + extension rules.
- [ ] Desktop: fluid panel system with proportional scaling.
- [ ] Tablet: right panel stacks below canvas (adaptive layout).
- [ ] **Tool rail**: collapsible → hamburger menu on tablet → full-screen drawer on mobile.
- [ ] Floating minimap for constrained viewports.
- [ ] **Gesture support**: pinch-zoom (tablet/mobile), swipe navigation.
- [ ] **Timeline**: horizontally scrollable, adaptive height based on screen real estate.
- [ ] **Mobile touch UX**:
  - larger hit targets
  - optional haptic feedback
- [ ] Ensure all keyboard shortcuts have touch/gesture equivalents.
- [ ] Persist panel state per device type (desktop layout saved separately from mobile).

### 1.2 Database Architecture for Complete Feature Set

- [ ] `users` table with **encrypted API key storage** (OpenAI, Stability, Hugging Face, custom endpoints).
- [ ] Migrations file with comments explaining schema design and relationships.
- [ ] `projects` table: metadata, create date, last modified, preview thumbnail.
- [ ] `sprites` table: link to project, dimensions, created timestamp.
- [ ] `frames` table: RGBA pixel data (compressed base64), duration, visibility flags.
- [ ] `layers` table per frame: blend modes, opacity, lock status, visibility.
- [ ] `undo_snapshots` table: efficient history with delta compression.
- [ ] `palettes` table: color definitions + tags.
- [ ] `brush_presets` table: brush shapes/sizes/behavior.
- [ ] `animation_tags` table: organize multiple animations within one sprite.
- [ ] `selection_history` table: track recent selections.
- [ ] `export_presets` table: saved export configurations.
- [ ] Auto-save every 30 seconds + conflict detection.
- [ ] Cloud backup with version history (restore any previous save).
- [ ] `/src/database/SCHEMA_GUIDE.md` with diagrams of table relationships.

### 1.3 AI Integration Architecture (Multi-Provider)

- [ ] Provider abstraction layer supporting:
  - OpenAI (DALL·E 3)
  - Stability AI (API v1)
  - Hugging Face Inference API
  - Replicate
  - Local Ollama
- [ ] Document each provider: rate limits, costs, known pitfalls.
- [ ] **Secure credential management**:
  - client-side encryption
  - server-side storage in Bolt Database vault
- [ ] **AI settings panel**: provider selection, model configuration, generation parameters.
- [ ] Generation queue: prevent simultaneous requests + handle rate limits.
- [ ] Generation history + caching to avoid duplicate API calls.
- [ ] Smart prompt templates optimized for each provider (pixel art focus).
- [ ] `/src/ai/PROVIDER_GUIDE.md` explaining how to add new providers.

---

## Phase 2: Complete Drawing & Selection Toolset (Best in Class Solution Parity + Improvements)

### 2.1 Advanced Selection Tools

- [ ] **Rectangular selection**:
  - fixed aspect ratio
  - snap-to-grid
- [ ] Document marching-ants rendering + animation.
- [ ] **Elliptical selection** with circular constraint.
- [ ] **Free-form lasso**:
  - smoothing
  - pressure sensitivity
- [ ] **Magic wand**:
  - tolerance setting
  - contiguous option
- [ ] Document flood fill selection algorithm step-by-step.
- [ ] Smart select by color (whole image or current frame only).
- [ ] Grow/shrink/feather with pixel-accurate previews.
- [ ] **Boolean ops**:
  - invert
  - union
  - intersection
  - difference
- [ ] Quick mask mode for fine tuning selections with brush.
- [ ] Save/load named selections (templates).
- [ ] Marching ants customization (speed, style).
- [ ] `/src/tools/selection/SELECTION_ALGORITHM.md` with pseudocode + visual examples.

### 2.2 Transform & Distortion Tools

- [ ] **Move tool**:
  - sub-pixel precision
  - grid snapping toggle
- [ ] **Rotation tool**:
  - free rotate
  - 90/180 quick buttons
  - angle input
- [ ] Document rotation matrix math with clear variable names.
- [ ] **Scale tool**:
  - aspect lock
  - pixel-perfect upscaling only
- [ ] **Flip**:
  - horizontal
  - vertical
  - diagonal
- [ ] **Perspective skew** (isometric transformations).
- [ ] **Distort mesh** (non-linear warping).
- [ ] **Warp tool** with brush size + intensity control.
- [ ] Transformation “staging”:
  - allow multiple transforms before commit
  - transformation history
- [ ] Content-aware fill for gaps after transforms.
- [ ] Anchor point control (pivot for rotate/scale).
- [ ] “Before/After” visual comments for each transform type.

### 2.3 Advanced Brush & Drawing System

- [ ] 15+ default **brush shapes**:
  - circle, square, diamond, star, patterns, etc.
- [ ] Document brush shape generation algorithms.
- [ ] Controls: size, hardness, opacity, flow.
- [ ] Dynamics: pressure, tilt, speed.
- [ ] **Color picker**:
  - from artwork
  - picker-following crosshair
- [ ] Stroke preview before commit.
- [ ] **Edge smoothing** algorithms:
  - linear
  - quadratic
  - catmull-rom
- [ ] Include formulas in comments for each smoothing algorithm.
- [ ] Scatter + texture brush modes.
- [ ] Stroke stabilization with preset curves.
- [ ] Anti-alias toggle (crisp vs smooth).
- [ ] Custom brush builder from existing artwork.
- [ ] `/src/tools/brush/BRUSH_GUIDE.md` on creating/registering new brush types.

### 2.4 Fill & Gradient Tools

- [ ] **Intelligent fill** with edge detection + minimum gap closure.
- [ ] Flood fill modes:
  - solid
  - pattern
  - gradient
- [ ] Bucket fill with neighbor matching algorithm.
- [ ] **Gradient tool**:
  - 20+ preset types
  - custom stops
- [ ] Explain each gradient type (linear, radial, spiral, etc.).
- [ ] Gradient dithering:
  - ordered
  - noise
  - clustered
- [ ] Document dithering algorithms with mathematical explanations.
- [ ] Symmetrical fill across mirror lines.
- [ ] Content-aware fill (smart background inpainting).
- [ ] Stroke-to-outline tool converting strokes to pixel-perfect outlines.

### 2.5 Symmetry & Mirror Modes

- [ ] Horizontal and vertical **mirror drawing**.
- [ ] Radial symmetry (circular patterns).
- [ ] Custom symmetry axis with angle control.
- [ ] Symmetry preview overlay (all mirrored regions).
- [ ] Diagonal and multi-axis symmetry.
- [ ] Symmetry across multiple selected regions.
- [ ] Per-tool symmetry preferences.
- [ ] `/src/tools/symmetry/SYMMETRY_MATH.md` with diagrams of reflection/rotation math.

---

## Phase 3: Animation & Timeline Mastery

### 3.1 Frame & Animation Timeline

- [ ] **Infinite-scroll timeline**:
  - thumbnails
  - lazy loading
- [ ] Document virtualization strategy (which frames render and why).
- [ ] **Frame ops**:
  - insert
  - duplicate
  - delete
  - keyboard shortcuts
- [ ] Drag-to-reorder with displacement preview.
- [ ] Frame duration display + edit shortcuts.
- [ ] Frame ranges for multi-select.
- [ ] Animation tagging (Walk/Run/Jump/Idle, etc.).
- [ ] Preview playback with adjustable speed.
- [ ] Frame locking to prevent accidental edits.
- [ ] Frame linking (linked frames update together).
- [ ] Reverse + pingpong playback modes.
- [ ] Frame rate calculator (ms precision).
- [ ] `/src/animation/TIMELINE_GUIDE.md` with ASCII diagrams showing data structure.

### 3.2 Onion Skin & Preview

- [ ] **Onion skin**:
  - 1–15 previous/next frames
- [ ] Document blending calculations + rendering order.
- [ ] Tinting (default red/blue), configurable.
- [ ] Opacity slider for onion intensity.
- [ ] **Difference highlighting** (pixel changes between frames).
- [ ] **Auto-onion**: show relevant frames based on timeline position.
- [ ] Loop checker: compare first/last frame for seamless loops.
- [ ] Motion trails (ghosting across multiple frames).
- [ ] Keyframe-only onion skin mode.
- [ ] Per-frame onion opacity controls.

### 3.3 Animation Playback & Export

- [ ] Frame-accurate playback engine (variable speed).
- [ ] Document timing math and conversions.
- [ ] Looping modes + single-play mode.
- [ ] Scrubber with frame-accurate seeking.
- [ ] Playback preview in timeline with region indicator.
- [ ] Export formats:
  - GIF (optimization, color reduction, dithering)
  - WebM / MP4 (quality settings)
  - PNG sequence + JSON metadata
  - Godot AtlasTexture-friendly spritesheet export
  - APNG (for supporting browsers)
  - Custom spritesheet layout + JSON metadata (rects, duration, pivots)
- [ ] Comments explaining each export format’s use cases.

---

## Phase 4: Layers, Palette & Color Management

### 4.1 Complete Layer System

- [ ] **Layer panel** with thumbnails.
- [ ] Document layer compositor + render order with detailed comments.
- [ ] Create/delete/reorder layers (drag & drop).
- [ ] Naming + color coding.
- [ ] Layer groups (nested).
- [ ] Blend modes:
  - Normal, Multiply, Screen, Overlay, Add, Subtract, Darken, Lighten
- [ ] Include formulas as comments for each blend mode.
- [ ] Opacity slider per layer.
- [ ] **Lock modes**:
  - transparent pixels only
  - image content
  - position
- [ ] Visibility toggle (eye icon).
- [ ] Merge down + flatten.
- [ ] Clipping masks.
- [ ] **Non-destructive effects**:
  - drop shadow
  - outer glow
  - stroke
- [ ] Layer search/filtering.
- [ ] `/src/layers/BLEND_MODES.md` with visual examples.

### 4.2 Palette & Color System

- [ ] Default palette library (curated sets).
- [ ] **Custom palette editor**:
  - add/remove/reorder colors
- [ ] Import/export formats:
  - ASE, PAL, GPL
- [ ] Document file structures for each format.
- [ ] Color swap system (quick substitutions).
- [ ] Palette ramp builder (smooth gradients).
- [ ] Color harmony suggestions (complementary/triadic/etc.).
- [ ] Color history (recent 20).
- [ ] **Eyedropper sampling across frames**.
- [ ] Replace color with tolerance settings.
- [ ] Color replacement history (undo support).
- [ ] Palette animation (cycling color ranges over frames).
- [ ] Document RGB↔HSL conversions and other color math.

### 4.3 Advanced Color Controls

- [ ] **Hue/Saturation/Brightness tools**.
- [ ] Document HSL formulas.
- [ ] Curves with control points.
- [ ] Levels adjustment (input/output mapping).
- [ ] Color balance (shadows/midtones/highlights).
- [ ] Color range selection sliders.
- [ ] Operations:
  - invert
  - posterize
  - desaturate
- [ ] Dithering selection:
  - Ordered/Bayer
  - Floyd–Steinberg
  - Atkinson
- [ ] ASCII diagrams for dithering patterns.
- [ ] Color quantization (configurable palette size).
- [ ] Color spaces:
  - RGB
  - HSL
  - Lab
- [ ] `/src/color/COLOR_MATH.md` with formulas + pseudocode.

---

## Phase 5: AI-Powered Features

### 5.1 AI Image Generation Integration

- [ ] **AI generation panel**:
  - provider dropdown
  - API key management
- [ ] Document key encryption process (security rationale).
- [ ] Sprite-optimized prompt templates (50+ presets).
- [ ] Image-to-image using current sprite as reference.
- [ ] Inpainting for selected regions.
- [ ] Batch generation with grid preview selection.
- [ ] Generation history (searchable metadata).
- [ ] Negative prompts (per provider).
- [ ] Style presets (cyberpunk, fantasy, retro, realistic, etc.).
- [ ] Size presets for common sprite dimensions.
- [ ] Prompt auto-completion from history.
- [ ] Local caching to prevent duplicate API calls.
- [ ] Document cache keys + invalidation strategy.
- [ ] Cost calculator estimating API usage.
- [ ] `/src/ai/GENERATION_GUIDE.md` with prompt examples + result guidance.

### 5.2 AI Post-Processing

- [ ] **AI upscaling**:
  - Real-ESRGAN
  - Super Resolution
- [ ] Palette extraction from generated images.
- [ ] Harmony suggestions from AI output.
- [ ] AI background fill for partial sprites.
- [ ] **Sketch-to-pixel** (scribble-to-image).
- [ ] Style transfer to existing sprites.
- [ ] Frame interpolation using optical flow.
- [ ] Animation generation from a single image.
- [ ] Content-aware padding for edge artifacts.
- [ ] Detailed comments per model: input/output formats, limitations.

### 5.3 ML-Assisted Drawing

- [ ] **Edge detection** snapping.
- [ ] Predictive stroke completion.
- [ ] Object detection for similar shapes.
- [ ] Pattern recognition for tile-friendly edits.
- [ ] Auto-outline generation.
- [ ] Similarity-based color suggestions.
- [ ] Outline thickness suggestions.
- [ ] Document confidence thresholds + failure modes.

---

## Phase 6: Professional UX & Accessibility

### 6.1 Command Palette & Keyboard System

- [ ] Command palette (Cmd+K) searching all actions + descriptions.
- [ ] Document command registration + examples.
- [ ] Customizable shortcuts with conflict detection.
- [ ] Document system-reserved shortcuts and why.
- [ ] Context-aware shortcuts per tool.
- [ ] Shortcut cheat sheet.
- [ ] Macro recording (multi-step workflows).
- [ ] Tool-specific shortcut sets that auto-switch.
- [ ] Key repeat for continuous actions (paint/pan).
- [ ] Toggle shortcuts for checkboxes/radio options.
- [ ] Number input shortcuts for sliders (hotkey then number).
- [ ] `/src/input/KEYBOARD_GUIDE.md` listing shortcuts + customization.

### 6.2 Interface Polish & Accessibility

- [ ] Dark theme default + optional light theme.
- [ ] High-contrast mode.
- [ ] Full keyboard navigation.
- [ ] Screen reader support (ARIA labels).
- [ ] Status bar: cursor pos, tool info, memory usage.
- [ ] Toast notifications + progress indicators.
- [ ] Context menu for common operations.
- [ ] Undo history panel with previews.
- [ ] First-run tutorial with interactive tooltips.
- [ ] Help system (video guides per feature).
- [ ] Gesture support on touch devices.
- [ ] Optional haptic feedback for actions.
- [ ] Document WCAG 2.1 AA compliance choices.

### 6.3 Performance & Memory

- [ ] Web Workers for expensive operations.
- [ ] Document what runs in workers and why.
- [ ] Efficient pixel buffer management (typed arrays).
- [ ] IndexedDB caching for frames (instant loading).
- [ ] Virtual scrolling timeline (1000+ frames).
- [ ] Progressive rendering prioritizing viewport.
- [ ] Memory profiler (buffer allocation tracking).
- [ ] GC of unused history snapshots.
- [ ] Compression of frame data in storage.
- [ ] Document compression choice (zlib vs LZ4 vs others) with performance notes.
- [ ] Hardware-accelerated canvas rendering when available.
- [ ] `/src/performance/OPTIMIZATION_GUIDE.md` with profiling steps.

---

## Phase 7: Clipboard & Import/Export Excellence

### 7.1 Clipboard Operations

- [ ] Full clipboard image read/write.
- [ ] Document Clipboard API + fallback strategies.
- [ ] Paste-as-new-layer.
- [ ] **Paste Special**:
  - 1:1
  - fit-to-canvas
  - tile
- [ ] Copy-to-clipboard for frames or selections.
- [ ] Copy as spritesheet.
- [ ] Paste align with snap guides.
- [ ] Paste animation blending modes during placement preview.

### 7.2 Import & Project Loading

- [ ] **Image import**:
  - auto canvas sizing
  - fit-to-canvas options
- [ ] Document format detection + conversion.
- [ ] Sprite sheet splitter:
  - auto grid detection
  - manual config
- [ ] Document grid detection algorithm.
- [ ] GIF import → frames.
- [ ] Video import (MP4/WebM) → frames at specified FPS.
- [ ] PSD import → layers.
- [ ] Aseprite import `.ase` (if format accessible).
- [ ] Import layers from other projects.
- [ ] Clipboard import from other apps.
- [ ] Batch import multiple files.
- [ ] Import preview before commit.
- [ ] `/src/import/FORMAT_GUIDE.md` supported formats + conversions.

### 7.3 Export Flexibility

- [ ] **Spritesheet layouts**:
  - packed
  - grid
  - row
  - column
- [ ] Document each layout with ASCII diagrams.
- [ ] **Metadata export**:
  - JSON
  - XML
  - YAML
- [ ] Engine-specific exports:
  - **Godot**
  - Unity
  - Unreal
  - Phaser
- [ ] Document each engine’s import expectations.
- [ ] Texture atlas generation + optimization.
- [ ] CLI export presets for batch operations.
- [ ] Custom export templates.
- [ ] Export preview showing exact output.
- [ ] Compression options for file size.
- [ ] Watermark options for social sharing.
- [ ] `/src/export/ENGINE_INTEGRATION_GUIDE.md` with examples.

---

## Phase 8: Collaboration & Cloud Features

### 8.1 Cloud Synchronization

- [ ] **Auto-save** to Bolt Database every 30 seconds.
- [ ] Document conflict resolution strategy.
- [ ] Manual save with version snapshots.
- [ ] Version history restore.
- [ ] Conflict detection + merge strategies.
- [ ] Sharing via unique read-only links.
- [ ] Collaborative editing (real-time cursors).
- [ ] Comment system on frames.
- [ ] Activity feed of project changes.
- [ ] Daily archival backups.
- [ ] `/src/sync/SYNC_PROTOCOL.md` with data formats + conflict rules.

### 8.2 Project Management

- [ ] Project gallery with thumbnails.
- [ ] Search/filter by tags/date.
- [ ] Templates for quick starts.
- [ ] Favorites/starred projects.
- [ ] Recent projects quick-access.
- [ ] Duplicate project with customization.
- [ ] Project stats (frame count, size, etc.).
- [ ] Publish projects to portfolio.
- [ ] Archive old projects.
- [ ] Document listing/search logic edge cases.

---

## Phase 9: Market Leadership (Procreate Power + Figma Minimalism)

### 9.1 Procreate-Level Brush Engine & Gestures

- [ ] **Advanced Input System**:
  - [ ] 2-finger tap (Undo), 3-finger tap (Redo).
  - [ ] QuickShape: Draw & hold triggers geometric fit (line/poly/ellipse).
  - [ ] ColorDrop: Drag swatch to canvas -> triggers flood fill with slide-to-adjust tolerance.
- [ ] **Brush Studio**:
  - [ ] "Streamline" rope stabilization (position averaging window).
  - [ ] Pressure dynamics: Size/Opacity/Flow tied to input pressure.
  - [ ] Dual brushes: Masking brush tip with texture grain.
  - [ ] Wet mix / smudge engine.

### 9.2 Figma-Style Minimalist UI

- [ ] **Contextual HUDs**:
  - [ ] Selection actions appear floating near selection (Transform, Flip, etc.).
  - [ ] "Invisible" chrome: Hide panels when drawing.
- [ ] **Properties Panel**:
  - [ ] Context-aware right panel (Show text props only when text selected).
  - [ ] High density data with generous whitespace.

### 9.3 Innovation Features

- [ ] **Smart Tile Mode**:
  - [ ] 3x3 grid rendering.
  - [ ] Wrap-around drawing (draw on right edge -> appears on left).
- [ ] **Time-Lapse Recorder**:
  - [ ] Capture canvas state on every standard undo-commit.
  - [ ] Replay engine for export.
- [ ] **Engine Keep-Alive (Live Link)**:
  - [ ] File watcher / companion server.
  - [ ] Auto-export on save to target directory.
- [ ] **Procedural "Juice"**:
  - [ ] Real-time 1px Auto-Outline (Stroke).
  - [ ] Pixel-perfect Liquify (warp grid).

### 9.4 Better Symmetry & Mirror

- [ ] Line symmetry with custom angle control (beyond horizontal/vertical).
- [ ] Document symmetry axis calculations with math comments.
- [ ] Rotation symmetry (radial patterns).
- [ ] Asymmetric drawing preview option.
- [ ] Multi-axis symmetry fill.
- [ ] Symmetry applies to:
  - selection
  - transforms
  - fill
- [ ] Smart symmetry detection (infer natural symmetry axes).
- [ ] `/src/tools/symmetry/SYMMETRY_ALGORITHMS.md` with derivations.

### 9.2 Enhanced Animation Tools

- [ ] **Tweening** with easing curves.
- [ ] Document easing math (quadratic, cubic, elastic, etc.).
- [ ] **Frame interpolation** (in-between generation).
- [ ] Animation blending between sequences.
- [ ] Onion-skin-driven animation assistant.
- [ ] Duration curves (speed ramping).
- [ ] Collision helper previews (platformer sprites).
- [ ] Physics preview for gravity/bounce.
- [ ] Comments explaining easing visual effects.

### 9.3 Advanced Pixel Operations

- [ ] **Smart outline generation** (config thickness).
- [ ] Edge detection boundary visualization.
- [ ] Pixel spread algorithm (noise effects).
- [ ] Mipmap preview (multiple scales).
- [ ] **Smart palette reduction** preserving detail.
- [ ] Dithering preview with multiple algorithms.
- [ ] **Anti-alias removal** for pixel-perfect conversions.
- [ ] Document complexity analysis + edge cases for each algorithm.

### 9.4 Developer-Friendly Features

- [ ] Export sprite data as:
  - C arrays
  - JavaScript objects
  - other dev formats
- [ ] Export animation timing in JSON/XML/YAML.
- [ ] Godot-specific export + GDScript integration.
- [ ] Tile animation export.
- [ ] Texture atlas metadata in multiple formats.
- [ ] Frame event markers (custom engine triggers).
- [ ] Collision shape export (physics engines).
- [ ] Layer export preserving structure.
- [ ] `/src/export/DEV_FORMAT_GUIDE.md` with code examples.

---

## Phase 10: Advanced Creative Suite

### 10.1 Extended Brush Engine (Brush Tip Parameters)

- [ ] **Brush Tip Parameters**:
  - [ ] Angle (0-360 degrees) support for all brush shapes.
  - [ ] Roundness (0-100%) flattening (aspect ratio of the tip).
  - [ ] Simulation of calligraphy and chisel tips.
- [ ] **Custom Brush Shapes**:
  - [ ] Support for user-defined 1-bit bitmaps (masks).
  - [ ] Preset shapes: Square, Raute (Diamond), Custom Alpha.
  - [ ] Brush management interface (Import/Create).
- [ ] **Technical**:
  - [ ] Update `src/editor/tools/brush.ts` to handle rotation/aspect math.
  - [ ] Optimize hit-testing for non-square brushes.

### 10.2 Advanced & Vector Tools

- [ ] **Clone Stamp Tool**:
  - [ ] Source point (Alt+Click) vs. Target drawing.
  - [ ] Aligned vs. Non-aligned cloning modes.
  - [ ] Cross-frame cloning support.
- [ ] **Path / Bezier Tool**:
  - [ ] Vector overlay rendering in `CanvasStage.tsx`.
  - [ ] Cubic Bezier manipulation (handles, anchors).
  - [ ] "Stroke Path" rasterization to pixel grid.
  - [ ] Editable shape paths before commit.
- [ ] **Advanced Selection Transform**:
  - [ ] "Transform Selection" mode (modifying the marquee without pixels).
  - [ ] Rotate/Scale the selection outline.
  - [ ] Perspective skew for selection box.

### 10.3 Smart Cloning & Instances

- [ ] **Tiles & Symbols (Figma-style)**:
  - [ ] Master Component -> Instance model.
  - [ ] Editing Master updates all Instances in real-time.
  - [ ] Override support (flipping/rotating instances).
- [ ] **Pattern/Tile Mode**:
  - [ ] 3x3 repeating view for tile creation.
  - [ ] Seamless drawing across boundaries.

---

## Phase 11: Mobile & Tablet Optimization (Secondary Priority)

### 11.1 Touch & Gesture Interface

- [ ] **Pinch-zoom** with **momentum scrolling**.
- [ ] Document gesture detection + momentum calculation.
- [ ] Two-finger pan for canvas movement.
- [ ] Three-finger undo/redo.
- [ ] Long-press context menu.
- [ ] Touch brush with pressure simulation.
- [ ] Tool selection via swipe gestures.
- [ ] Layer navigation via horizontal swipes.
- [ ] Timeline scrubbing via finger drag.
- [ ] Floating toolbox buttons for accessibility.

### 11.2 Mobile Layout Adaptations

- [ ] Full-screen canvas mode + floating toolbar.
- [ ] Simplified mobile tool palette.
- [ ] Collapsible right panel (slide-in).
- [ ] Bottom drawer timeline on mobile.
- [ ] Tablet layout: canvas + timeline side-by-side.
- [ ] Responsive font sizing for readability.
- [ ] Touch target sizing (min 44×44px).
- [ ] Orientation change handling with layout preservation.
- [ ] `/src/mobile/TOUCH_GUIDE.md` gesture strategy + pitfalls.

---

## Code Documentation Best Practices Applied Throughout All Phases

Every feature implementation includes:

- **Header comments**: what the feature does and why it matters  
- Architecture comments: data flow and module boundaries  
- Algorithm comments: step-by-step logic for complex operations  
- Parameter comments: input meaning and valid ranges  
- Return value comments: what returns and under what conditions  
- Side effects: warnings about mutation/state impacts  
- Performance notes: bottlenecks and optimization targets  
- **Usage examples**: how to call/use APIs correctly  
- Edge cases: limitations and special behaviors  
- TODO/FIXME with rationale and intended future direction  

---

## Summary

This plan delivers a **professional, production-grade sprite editor** that:

- Reaches **complete Best in Class Solution (e.g. Aseprite) parity** / no copy only
- Adds **multi-provider AI generation and assistance**
- Provides **superior symmetry tools, ML-assisted workflows, and advanced pixel ops**
- Implements **desktop-first responsive UX** with tablet and mobile support
- Prioritizes **performance, security, and maintainability**
- Is **beginner-friendly** via rigorous documentation, clean architecture, and guided docs

The phased approach enables **incremental shipping** while keeping code quality and clarity high.

---
