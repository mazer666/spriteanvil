# SpriteAnvil Feature Integration Plan & Architecture
## Related docs

- Docs index: [`/docs/README.md`](./README.md)
- Current status: [`/STATUS_UPDATE.md`](../STATUS_UPDATE.md)
- Implementation snapshot: [`/IMPLEMENTATION_COMPLETE.md`](../IMPLEMENTATION_COMPLETE.md)

---


## Overview

This document explains the plan for extending SpriteAnvil from a basic pen/eraser tool to a full-featured pixel art editor. It covers what was built, how the architecture works, and how everything was integrated.

---

## Phase 1: Advanced Drawing Tools

### Goal
Add professional drawing tools commonly found in pixel art editors like Aseprite, Photoshop, or GIMP.

### What Was Built

#### 1. Fill Tool (Flood Fill)
**Location:** `src/editor/tools/fill.ts`

**What It Does:**
- Click on any pixel to fill all connected pixels of the same color
- Uses a scanline flood fill algorithm for efficient performance
- Supports tolerance-based filling (fills similar colors, not just exact matches)

**Algorithm:**
- Starts at clicked pixel
- Remembers the target color
- Fills entire horizontal lines (scanlines) instead of individual pixels
- Checks pixels above and below each scanline
- Continues until all connected pixels are filled

**Key Functions:**
- `floodFill()` - Basic flood fill with exact color matching
- `floodFillWithTolerance()` - Fills similar colors within a tolerance range

#### 2. Shape Tools
**Location:** `src/editor/tools/shapes.ts`

**What It Does:**
Provides geometric shape drawing with pixel-perfect algorithms:

- **Rectangle Tools:**
  - `drawRectangle()` - Draws rectangle outline
  - `fillRectangle()` - Draws filled rectangle

- **Circle Tools:**
  - `drawCircle()` - Draws circle outline using Bresenham's circle algorithm
  - `fillCircle()` - Draws filled circle

- **Ellipse Tools:**
  - `drawEllipse()` - Draws ellipse outline using midpoint ellipse algorithm
  - `fillEllipse()` - Draws filled ellipse

**Technical Details:**
- All shapes use integer-only math for pixel-perfect results
- No anti-aliasing - every pixel is fully on or fully off
- Circle algorithm uses 8-way symmetry (only calculates 1/8 of circle, mirrors the rest)

#### 3. Selection System
**Location:** `src/editor/selection.ts`

**What It Does:**
Allows users to select regions of pixels for operations like cut, copy, paste, or applying effects to specific areas.

**Selection Storage:**
- Uses a boolean mask (Uint8Array) - one byte per pixel
- 1 = pixel is selected, 0 = pixel is not selected
- Much more memory-efficient than storing coordinate lists

**Selection Types:**
- `selectRectangle()` - Select rectangular region
- `selectEllipse()` - Select elliptical region
- `selectCircle()` - Select circular region
- `selectMagicWand()` - Select connected pixels of similar color (like fill tool but creates selection instead)

**Selection Operations:**
- `selectionUnion()` - Combine selections (A + B)
- `selectionIntersection()` - Keep only overlapping parts (A ∩ B)
- `selectionSubtract()` - Remove one selection from another (A - B)
- `invertSelection()` - Flip selected/unselected pixels
- `getSelectionBounds()` - Find smallest rectangle containing selection

---

## Architecture

### File Organization

```
src/
├── editor/
│   ├── pixels.ts          # Core pixel manipulation (setPixel, drawLine, etc.)
│   ├── history.ts         # Undo/redo system
│   ├── selection.ts       # Selection system (NEW)
│   └── tools/
│       ├── fill.ts        # Flood fill algorithms (NEW)
│       └── shapes.ts      # Shape drawing tools (NEW)
├── ui/
│   ├── CanvasStage.tsx    # Main drawing canvas (UPDATED)
│   ├── ToolRail.tsx       # Tool selection sidebar (UPDATED)
│   ├── RightPanel.tsx     # Settings panel
│   └── Timeline.tsx       # Frame timeline
├── types.ts               # TypeScript definitions (UPDATED)
└── App.tsx                # Main application component
```

### Data Flow

```
User Interaction
      ↓
ToolRail (Select Tool)
      ↓
App.tsx (Tool State)
      ↓
CanvasStage (Tool Logic)
      ↓
Tool Functions (fill.ts, shapes.ts, pixels.ts)
      ↓
Pixel Buffer (Uint8ClampedArray)
      ↓
Canvas Rendering
      ↓
Visual Output
```

### Key Design Decisions

#### 1. Modular Tool System
Each tool is implemented as a standalone module with pure functions:
- Easy to test in isolation
- Can be reused in different contexts
- Clear separation of concerns

#### 2. Direct Pixel Buffer Manipulation
All tools work directly on `Uint8ClampedArray`:
- Maximum performance (no intermediate abstractions)
- Predictable memory usage
- Easy integration with Canvas API

#### 3. Preview System for Shapes
Shapes show live preview while dragging:
- Stored in React state (`shapePreview`)
- Rendered on top of canvas using Canvas 2D API
- Only committed to pixel buffer on mouse release

---

## Integration Steps

### Step 1: Update Type Definitions
**File:** `src/types.ts`

**What Changed:**
```typescript
// BEFORE
export type ToolId = "pen" | "eraser";

// AFTER
export type ToolId =
  | "pen"
  | "eraser"
  | "fill"           // NEW
  | "line"           // NEW
  | "rectangle"      // NEW
  | "rectangleFilled" // NEW
  | "circle"         // NEW
  | "circleFilled"   // NEW
  | "selectRect";    // NEW
```

**Why:**
TypeScript needs to know about the new tool types for type safety across the entire application.

---

### Step 2: Update Tool Rail UI
**File:** `src/ui/ToolRail.tsx`

**What Changed:**
Replaced placeholder buttons with functional tool buttons:

```tsx
// BEFORE
<button className="toolbtn toolbtn--disabled" title="Fill (coming next)" disabled>
  ⛶
</button>

// AFTER
{btn("fill", "⛶", "Fill (F)")}
{btn("line", "╱", "Line (L)")}
{btn("rectangle", "▭", "Rectangle (R)")}
{btn("rectangleFilled", "▮", "Filled Rectangle (Shift+R)")}
{btn("circle", "○", "Circle (C)")}
{btn("circleFilled", "●", "Filled Circle (Shift+C)")}
{btn("selectRect", "⬚", "Select Rectangle (M)")}
```

**Why:**
Makes the tools visible and clickable in the UI. The `btn()` helper function already existed and handles tool selection state automatically.

---

### Step 3: Integrate Tools into Canvas Logic
**File:** `src/ui/CanvasStage.tsx`

This was the main integration work. Here's what was added:

#### A. Import New Tool Functions
```typescript
import { floodFill } from "../editor/tools/fill";
import {
  drawRectangle,
  fillRectangle,
  drawCircle,
  fillCircle
} from "../editor/tools/shapes";
```

#### B. Add Shape Preview State
```typescript
const [shapePreview, setShapePreview] = useState<{
  startX: number;
  startY: number;
  endX: number;
  endY: number;
} | null>(null);
```

**Why:**
Shapes need to show a preview while the user drags. This state tracks the start and end points.

#### C. Track Starting Position
Added `startX` and `startY` to stroke state:
```typescript
const strokeRef = useRef<{
  // ... existing fields ...
  startX: number;  // NEW
  startY: number;  // NEW
}>({
  // ... existing values ...
  startX: -1,
  startY: -1,
});
```

**Why:**
Shape tools need to know where the drag started to calculate the shape dimensions.

#### D. Update `beginStroke()` Function
Added tool-specific logic:

```typescript
function beginStroke(e: React.PointerEvent) {
  // ... existing setup code ...

  // NEW: Fill tool - immediate action
  if (tool === "fill") {
    const pixelsChanged = floodFill(
      bufRef.current,
      canvasSpec.width,
      canvasSpec.height,
      p.x,
      p.y,
      c
    );
    if (pixelsChanged > 0) st.changed = true;
    draw();
    endStroke();  // Finish immediately
    return;
  }

  // Existing pen/eraser logic stays the same
  if (tool === "pen" || tool === "eraser") {
    // ... existing code ...
  }

  // NEW: Initialize shape preview for shape tools
  if (tool === "line" || tool === "rectangle" || /* ... */) {
    setShapePreview({
      startX: p.x,
      startY: p.y,
      endX: p.x,
      endY: p.y
    });
  }
}
```

**Why:**
- Fill tool works on click (no drag needed)
- Shape tools start their preview on mouse down

#### E. Update `moveStroke()` Function
Added preview updates for shape tools:

```typescript
function moveStroke(e: React.PointerEvent) {
  // ... existing pen/eraser logic ...

  // NEW: Update shape preview
  if (tool === "line" || tool === "rectangle" || /* ... */) {
    setShapePreview({
      startX: st.startX,
      startY: st.startY,
      endX: p0.x,
      endY: p0.y
    });
  }
}
```

**Why:**
Updates the preview as the user drags to show what the shape will look like.

#### F. Update `endStroke()` Function
Added logic to commit shapes to pixel buffer:

```typescript
function endStroke() {
  // ... existing setup code ...

  if (shapePreview) {
    const { startX, startY, endX, endY } = shapePreview;

    // Draw the appropriate shape
    if (tool === "line") {
      drawLine(bufRef.current, /* ... */, startX, startY, endX, endY, c);
    }

    if (tool === "rectangle") {
      const w = Math.abs(endX - startX) + 1;
      const h = Math.abs(endY - startY) + 1;
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);
      drawRectangle(bufRef.current, /* ... */, x, y, w, h, c);
    }

    // ... other shape tools ...

    setShapePreview(null);  // Clear preview
  }

  // ... existing undo history code ...
}
```

**Why:**
When the user releases the mouse, we commit the shape to the actual pixel buffer and clear the preview.

#### G. Update `draw()` Function
Added preview rendering:

```typescript
function draw() {
  // ... existing canvas rendering ...

  // NEW: Render shape preview on top
  if (shapePreview) {
    const { startX, startY, endX, endY } = shapePreview;

    ctx.strokeStyle = settings.primaryColor;
    ctx.fillStyle = settings.primaryColor;
    ctx.globalAlpha = 0.7;  // Semi-transparent

    // Convert pixel coordinates to screen coordinates
    const x1 = originX + startX * zoom;
    const y1 = originY + startY * zoom;
    const x2 = originX + endX * zoom;
    const y2 = originY + endY * zoom;

    // Draw appropriate preview
    if (tool === "line") {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    if (tool === "rectangle" || tool === "rectangleFilled") {
      const w = x2 - x1;
      const h = y2 - y1;
      if (tool === "rectangleFilled") {
        ctx.fillRect(x1, y1, w, h);
      } else {
        ctx.strokeRect(x1, y1, w, h);
      }
    }

    // ... other shape previews ...
  }
}
```

**Why:**
Shows the live preview as the user drags. Uses Canvas 2D API for smooth rendering without modifying the pixel buffer.

---

## How It All Works Together

### Example: User Draws a Circle

1. **User clicks Circle tool in ToolRail**
   - `ToolRail.tsx` calls `onClick` prop
   - `App.tsx` updates `currentTool` state to `"circle"`
   - React re-renders `CanvasStage` with `tool="circle"`

2. **User clicks and drags on canvas**
   - `beginStroke()` is called:
     - Captures starting position (startX, startY)
     - Creates initial shape preview
   - `moveStroke()` is called repeatedly:
     - Updates shape preview with current mouse position
     - React re-renders canvas with updated preview
   - User sees semi-transparent circle outline following their mouse

3. **User releases mouse**
   - `endStroke()` is called:
     - Calculates final circle dimensions (center point and radius)
     - Calls `drawCircle()` from `shapes.ts`
     - `drawCircle()` modifies pixel buffer using Bresenham's algorithm
     - Clears shape preview
     - Creates undo history entry
   - Canvas re-renders with final circle permanently drawn

### Example: User Uses Fill Tool

1. **User clicks Fill tool in ToolRail**
   - Tool state updates to `"fill"`

2. **User clicks on canvas**
   - `beginStroke()` is called:
     - Gets clicked pixel coordinates
     - Calls `floodFill()` immediately
     - `floodFill()` processes the entire connected region:
       - Gets target color at clicked pixel
       - Uses scanline algorithm to fill all matching pixels
       - Returns number of pixels changed
     - Calls `endStroke()` immediately (no drag phase)
     - Creates undo history entry
   - Canvas re-renders with filled area

---

## Why This Architecture Works

### 1. Separation of Concerns
- **Tool logic** (`fill.ts`, `shapes.ts`) - Pure functions, no UI knowledge
- **UI logic** (`CanvasStage.tsx`) - Handles user interaction, previews, and rendering
- **State management** (`App.tsx`) - Manages tool selection and canvas state

### 2. Performance
- Direct pixel buffer manipulation (no intermediate layers)
- Efficient algorithms (scanline fill, Bresenham's circle)
- Preview uses Canvas 2D API (GPU-accelerated)
- No unnecessary re-renders (refs for buffer access)

### 3. Maintainability
- Each tool is isolated and testable
- Clear data flow from user input to pixel output
- Type safety ensures tools are used correctly
- Preview system prevents accidental permanent changes

### 4. Extensibility
- Easy to add new tools (just implement the function and wire it up)
- Selection system ready for future features (move, transform, filters)
- Tool modules can be enhanced without touching UI code

---

## Future Enhancements

### Phase 2: Selection Features (Ready But Not Connected)
The selection system is built but not yet connected to UI:
- **Cut/Copy/Paste** - Move or duplicate selected pixels
- **Transform** - Scale, rotate, or flip selections
- **Filters** - Apply effects only to selected areas

### Phase 3: Advanced Tools
- **Gradient Tool** - Fill with color gradients
- **Dithering Tool** - Artistic dithering patterns
- **Eyedropper** - Pick colors from canvas
- **Lasso Selection** - Freehand selection

### Phase 4: Multi-Frame Animation
- Timeline already exists but needs frame management
- Onion skinning (show previous/next frames)
- Frame duplication and manipulation
- Export as GIF or sprite sheet

---

## Testing the Features

### Manual Testing Steps

1. **Fill Tool:**
   - Click fill tool (bucket icon)
   - Click on canvas to fill area
   - Try filling different colors
   - Test undo/redo

2. **Line Tool:**
   - Click line tool
   - Drag from start to end point
   - Release to commit line
   - Try different angles

3. **Rectangle Tools:**
   - Click rectangle or filled rectangle
   - Drag from corner to corner
   - Watch live preview
   - Release to commit

4. **Circle Tools:**
   - Click circle or filled circle
   - Drag to define size
   - Watch live preview
   - Release to commit

5. **Selection Rectangle:**
   - Click selection tool
   - Drag to create selection
   - (Note: Selection is shown but cut/copy/paste not yet implemented)

---

## Technical Notes

### Pixel Buffer Format
```
Uint8ClampedArray with RGBA format:
[R, G, B, A, R, G, B, A, ...]
 ↑        ↑        ↑
pixel 0   pixel 1  pixel 2

Index calculation: (y * width + x) * 4
```

### Color Matching in Fill Tool
```javascript
// Exact match
colorsEqual(color1, color2)

// Tolerance match
Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) +
Math.abs(c1.b - c2.b) + Math.abs(c1.a - c2.a) <= tolerance * 4
```

### Bresenham's Circle Algorithm
```
Uses integer-only arithmetic
Exploits 8-way symmetry
Calculates only 1/8 of circle
Mirrors to all 8 octants
Result: Pixel-perfect circles with minimal calculations
```

---

## Summary

The integration successfully connected all the advanced drawing tools to the UI. The architecture is clean, performant, and extensible. All tools work with the existing undo/redo system and integrate seamlessly with the canvas rendering pipeline.

**What Was Previously Missing:**
- Tool modules were built but not imported into CanvasStage
- Tool buttons were disabled placeholders
- No logic to handle shape previews or tool execution

**What Was Fixed:**
- Imported all tool functions into CanvasStage
- Connected tool buttons to actual functionality
- Implemented shape preview system
- Added tool-specific logic to stroke handlers
- Properly integrated with undo/redo system

The application is now a functional pixel art editor with professional-grade drawing tools.

---

# The Road Ahead: Complete Feature Roadmap

This section outlines the comprehensive plan to transform SpriteAnvil into a professional, AI-powered sprite editor with complete Aseprite parity plus innovative features that exceed market standards.

---

## Phase 0: Code Organization & Documentation Standards

**Goal:** Establish a foundation of clear, maintainable, beginner-friendly code throughout all future development.

### Documentation & Code Clarity Foundation

**What Will Be Built:**
- Dedicated folders for each feature area with purpose-specific README files
- Comprehensive inline comments explaining the "why" behind every function and complex logic
- TypeScript with strict typing and explicit type definitions
- JSDoc comments for all functions with usage examples
- Beginner-friendly variable naming (no abbreviations like `fpd`, use `framePixelData`)
- Clear function names describing exact purpose (`calculateZoomToFitCanvas` not `calcZoom`)
- Architecture comments explaining overall structure and data flow
- Algorithm comments with step-by-step logic explanations

**Documentation Structure:**
```
docs/
├── ARCHITECTURE.md              # Overall application structure
├── MODULE_GUIDE.md             # Feature module breakdown
├── CODE_STYLE.md               # Naming conventions and patterns
├── COMMON_TASKS.md             # Step-by-step guides for frequent changes
└── [feature-specific docs]
```

**Development Resources:**
- `/src/examples` - Commented example code for each API
- `/src/constants.ts` - All magic numbers with clear names and comments
- Clear separation: business logic in `/src/lib`, UI in `/src/ui`
- Utility function library in `/src/utils` with documentation
- Console logging with descriptive messages and log-level control
- `/CONTRIBUTING.md` for new developers

**Why This Matters:**
Makes the codebase approachable for beginners while maintaining professional standards. Every piece of code becomes a learning opportunity with clear explanations of design decisions and algorithm implementations.

---

## Phase 1: Responsive Foundation & Core Architecture

**Goal:** Build a solid foundation with responsive design and database architecture to support all future features.

### 1.1 Responsive Layout System

**What Will Be Built:**
- CSS Grid-based responsive breakpoints:
  - Desktop (1200px+) - Full interface with all panels
  - Tablet (768px-1199px) - Adaptive panels with right panel below canvas
  - Mobile (320px-767px) - Collapsible interface with floating controls
- Fluid panel system scaling proportionally with viewport
- Collapsible tool rail becoming hamburger menu on tablets
- Floating minimap for navigation on constrained viewports
- Gesture support: pinch-zoom, swipe navigation
- Horizontal scrollable timeline adapting to screen height
- Touch interface with larger hit targets and haptic feedback
- Keyboard shortcuts with touch/gesture equivalents
- Persistent panel state per device type

**Technical Implementation:**
```css
/* Desktop-first approach */
.app-layout {
  display: grid;
  grid-template-columns: 60px 1fr 300px;
  grid-template-rows: auto 1fr 150px;
}

/* Tablet adaptation */
@media (max-width: 1199px) {
  .app-layout {
    grid-template-columns: 60px 1fr;
    grid-template-rows: auto 1fr 300px 150px;
  }
}

/* Mobile adaptation */
@media (max-width: 767px) {
  .app-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }
}
```

### 1.2 Database Architecture

**Goal:** Complete Supabase database schema supporting all features.

**Tables to Create:**

1. **users** - User accounts and API key storage
   ```sql
   - id (uuid, primary key)
   - email (text, unique)
   - encrypted_api_keys (jsonb) -- OpenAI, Stability AI, etc.
   - created_at (timestamptz)
   - last_login (timestamptz)
   ```

2. **projects** - Top-level project container
   ```sql
   - id (uuid, primary key)
   - user_id (uuid, foreign key)
   - name (text)
   - description (text)
   - thumbnail_url (text) -- Preview image
   - created_at (timestamptz)
   - updated_at (timestamptz)
   - metadata (jsonb) -- Tags, custom data
   ```

3. **sprites** - Individual sprite within project
   ```sql
   - id (uuid, primary key)
   - project_id (uuid, foreign key)
   - name (text)
   - width (integer)
   - height (integer)
   - created_at (timestamptz)
   ```

4. **frames** - Animation frames
   ```sql
   - id (uuid, primary key)
   - sprite_id (uuid, foreign key)
   - frame_number (integer)
   - duration_ms (integer)
   - pixel_data (text) -- Compressed base64 RGBA data
   - visible (boolean)
   ```

5. **layers** - Layer system per frame
   ```sql
   - id (uuid, primary key)
   - frame_id (uuid, foreign key)
   - name (text)
   - order_index (integer)
   - blend_mode (text)
   - opacity (float)
   - locked (boolean)
   - visible (boolean)
   ```

6. **undo_snapshots** - Efficient history
   ```sql
   - id (uuid, primary key)
   - sprite_id (uuid, foreign key)
   - snapshot_data (text) -- Delta-compressed changes
   - created_at (timestamptz)
   ```

7. **palettes** - Color palette storage
   ```sql
   - id (uuid, primary key)
   - user_id (uuid, foreign key)
   - name (text)
   - colors (jsonb) -- Array of color definitions
   - tags (text[])
   ```

8. **brush_presets** - Custom brushes
   ```sql
   - id (uuid, primary key)
   - user_id (uuid, foreign key)
   - name (text)
   - shape_data (text)
   - settings (jsonb) -- Size, hardness, etc.
   ```

9. **animation_tags** - Animation organization
   ```sql
   - id (uuid, primary key)
   - sprite_id (uuid, foreign key)
   - name (text) -- "Walk", "Run", "Jump"
   - start_frame (integer)
   - end_frame (integer)
   - color (text) -- Visual tag color
   ```

**Security (RLS Policies):**
All tables will have Row Level Security enabled with policies ensuring:
- Users can only access their own data
- Shared projects require explicit permission
- Read-only access for public galleries

### 1.3 AI Integration Architecture

**What Will Be Built:**
- Multi-provider abstraction supporting:
  - OpenAI DALL-E 3
  - Stability AI (Stable Diffusion)
  - Hugging Face Inference API
  - Replicate
  - Local Ollama
- Secure credential management with client-side encryption
- AI settings panel with provider selection
- Generation queue preventing simultaneous requests
- Generation history with caching
- Smart prompt templates optimized per provider
- Cost calculator showing estimated API usage

**File Structure:**
```
src/lib/ai/
├── providers/
│   ├── openai.ts           # OpenAI DALL-E integration
│   ├── stability.ts        # Stability AI integration
│   ├── huggingface.ts      # Hugging Face integration
│   └── base.ts             # Common provider interface
├── queue.ts                # Generation queue manager
├── cache.ts                # Result caching
└── prompts.ts              # Template library
```

---

## Phase 2: Complete Drawing & Selection Toolset

**Goal:** Achieve complete parity with professional pixel art tools like Aseprite.

### 2.1 Advanced Selection Tools

**Tools to Build:**

1. **Rectangular Selection**
   - Fixed aspect ratio mode
   - Snap-to-grid option
   - Marching ants animation

2. **Elliptical Selection**
   - Circular constraint mode (hold Shift)
   - From center mode (hold Alt)

3. **Free-form Lasso**
   - Smoothing algorithm
   - Pressure sensitivity support
   - Auto-close on release

4. **Magic Wand**
   - Configurable tolerance (0-255)
   - Contiguous/non-contiguous mode
   - Anti-alias option

5. **Smart Select by Color**
   - Select all pixels of similar color
   - Works across frames or current frame only

**Selection Operations:**
- Grow/Shrink selection by N pixels
- Feather edges with Gaussian blur
- Invert, union, intersection, difference
- Quick mask mode for brush-based refinement
- Save/load named selections
- Selection to path conversion

**Implementation Notes:**
```typescript
// Marching ants animation
function animateSelection(ctx: CanvasRenderingContext2D, mask: Uint8Array) {
  const dashOffset = (Date.now() / 50) % 16;
  ctx.setLineDash([8, 8]);
  ctx.lineDashOffset = -dashOffset;
  // Draw selection outline...
}
```

### 2.2 Transform & Distortion Tools

**Tools to Build:**

1. **Move Tool**
   - Sub-pixel precision
   - Grid snapping toggle
   - Show distance/angle indicator

2. **Rotation Tool**
   - Free rotate with angle input
   - Quick 90°/180° buttons
   - Custom pivot point
   - Nearest-neighbor resampling (no blur)

3. **Scale Tool**
   - Aspect ratio lock
   - Pixel-perfect upscaling only (2x, 3x, 4x)
   - Corner/edge handles

4. **Flip Commands**
   - Horizontal, vertical, diagonal
   - Live preview before commit

5. **Perspective Skew**
   - For isometric transformations
   - Four-corner control

6. **Distort Mesh**
   - Grid-based warping
   - Adjustable mesh density

7. **Warp Tool**
   - Brush-based distortion
   - Configurable brush size and intensity

**Transform Matrix Documentation:**
```typescript
// Rotation transformation
// [ cos(θ)  -sin(θ)  tx ]
// [ sin(θ)   cos(θ)  ty ]
// [   0        0      1  ]
function rotatePoint(x: number, y: number, angle: number, pivotX: number, pivotY: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = x - pivotX;
  const dy = y - pivotY;
  return {
    x: pivotX + dx * cos - dy * sin,
    y: pivotY + dx * sin + dy * cos
  };
}
```

### 2.3 Advanced Brush & Drawing System

**Brush System:**

1. **15+ Default Brush Shapes**
   - Circle, square, diamond, star
   - Custom patterns
   - Import from sprite

2. **Brush Dynamics**
   - Size: responds to pressure/speed
   - Opacity: pressure-sensitive
   - Flow: continuous paint rate
   - Hardness: edge softness

3. **Drawing Modes**
   - Normal, scatter, texture
   - Symmetry-aware
   - Pixel-perfect mode

4. **Stroke Stabilization**
   - Multiple algorithms:
     - Simple averaging (fast)
     - Catmull-Rom spline (smooth)
     - Kalman filter (predictive)

5. **Color Picker**
   - Eyedropper from canvas
   - Recent colors history
   - Color wheel with HSV sliders

**Brush Builder UI:**
```
src/ui/BrushEditor.tsx
- Visual brush preview
- Shape selection grid
- Dynamics configuration
- Save/load presets
```

### 2.4 Fill & Gradient Tools

**Fill Tools:**

1. **Intelligent Fill**
   - Edge detection
   - Minimum gap closure (1-5px)
   - Pattern fill mode
   - Gradient fill mode

2. **Gradient Tool**
   - 20+ gradient types:
     - Linear, radial, angular, reflected
     - Spiral, diamond, square
   - Custom color stops
   - Dithering modes:
     - Ordered (Bayer matrix)
     - Floyd-Steinberg
     - Atkinson
     - Clustered

3. **Content-Aware Fill**
   - Smart background inpainting
   - Sample from surrounding pixels
   - Texture synthesis

**Dithering Algorithms:**
```typescript
// Floyd-Steinberg error diffusion
//        X    7/16
// 3/16  5/16  1/16
function floydSteinbergDither(pixels: Uint8ClampedArray, width: number, height: number, palette: Color[]) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const oldColor = getPixel(pixels, x, y, width);
      const newColor = findClosestPaletteColor(oldColor, palette);
      setPixel(pixels, x, y, width, newColor);

      const error = {
        r: oldColor.r - newColor.r,
        g: oldColor.g - newColor.g,
        b: oldColor.b - newColor.b
      };

      // Distribute error to neighbors
      distributeError(pixels, x + 1, y, error, 7/16);
      distributeError(pixels, x - 1, y + 1, error, 3/16);
      distributeError(pixels, x, y + 1, error, 5/16);
      distributeError(pixels, x + 1, y + 1, error, 1/16);
    }
  }
}
```

### 2.5 Symmetry & Mirror Modes

**Symmetry Tools:**

1. **Basic Symmetry**
   - Horizontal mirror
   - Vertical mirror
   - Both axes simultaneously

2. **Advanced Symmetry**
   - Radial symmetry (2-32 segments)
   - Custom axis angle
   - Diagonal symmetry
   - Multi-axis (grid patterns)

3. **Symmetry Features**
   - Per-tool preferences
   - Visual guide lines
   - Preview all instances
   - Works with all drawing tools

**Implementation:**
```typescript
// Radial symmetry with N segments
function applyRadialSymmetry(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  segments: number
): Point[] {
  const points: Point[] = [];
  const angleStep = (2 * Math.PI) / segments;

  for (let i = 0; i < segments; i++) {
    const angle = i * angleStep;
    points.push(rotatePoint(x, y, angle, centerX, centerY));
  }

  return points;
}
```

---

## Phase 3: Animation & Timeline Mastery

**Goal:** Professional animation tools with frame management and playback.

### 3.1 Frame & Animation Timeline

**Timeline Features:**

1. **Frame Management**
   - Insert, duplicate, delete frames
   - Drag to reorder
   - Multi-frame selection
   - Frame locking
   - Frame linking (edit affects linked copies)

2. **Animation Organization**
   - Tags for animation sequences
   - Color-coded tags
   - Tag-based playback
   - Frame ranges

3. **Timeline UI**
   - Infinite scroll with lazy loading
   - Frame thumbnails
   - Duration display and edit
   - Visual frame rate indicator
   - Keyboard shortcuts for all operations

**Data Structure:**
```typescript
interface AnimationTag {
  id: string;
  name: string;          // "Walk", "Run", "Jump"
  startFrame: number;
  endFrame: number;
  color: string;         // Visual indicator color
  loopMode: "forward" | "reverse" | "pingpong";
}
```

### 3.2 Onion Skin & Preview

**Onion Skin Features:**

1. **Configurable Display**
   - Show 1-15 previous/next frames
   - Color tinting (red for previous, blue for next)
   - Opacity slider per frame
   - Toggle on/off per tool

2. **Advanced Modes**
   - Difference highlighting (show pixel changes)
   - Auto-onion (intelligent frame selection)
   - Keyframe-only mode
   - Motion trails

3. **Loop Validation**
   - First/last frame overlay
   - Seamless loop checker
   - Gap detection

**Rendering:**
```typescript
function renderOnionSkin(
  ctx: CanvasRenderingContext2D,
  frames: Frame[],
  currentFrame: number,
  beforeCount: number,
  afterCount: number
) {
  // Render previous frames (red tint)
  for (let i = 1; i <= beforeCount; i++) {
    const frame = frames[currentFrame - i];
    if (frame) {
      ctx.globalAlpha = 0.3 / i; // Fade with distance
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "#ff0000";
      renderFrame(ctx, frame);
    }
  }

  // Render next frames (blue tint)
  for (let i = 1; i <= afterCount; i++) {
    const frame = frames[currentFrame + i];
    if (frame) {
      ctx.globalAlpha = 0.3 / i;
      ctx.fillStyle = "#0000ff";
      renderFrame(ctx, frame);
    }
  }
}
```

### 3.3 Animation Playback & Export

**Playback Engine:**
- Frame-accurate timing
- Variable playback speed (0.1x - 4x)
- Loop modes: forward, reverse, pingpong
- Scrubber with frame seeking
- Playback region selection

**Export Formats:**

1. **GIF Export**
   - Color quantization (adaptive palettes)
   - Dithering options
   - Optimization (frame differencing)
   - Loop count configuration

2. **Video Export**
   - WebM and MP4
   - Quality/bitrate settings
   - FPS configuration

3. **PNG Sequence**
   - Numbered files
   - JSON metadata

4. **Spritesheet**
   - Grid layout (automatic packing)
   - JSON/XML metadata
   - Godot AtlasTexture format
   - Unity Sprite Sheet format

**Export Configuration:**
```typescript
interface ExportSettings {
  format: "gif" | "webm" | "mp4" | "png-sequence" | "spritesheet";
  frameRange: { start: number; end: number };
  fps: number;
  scale: number;  // 1x, 2x, 3x, 4x
  // Format-specific options
  gif?: {
    dithering: "none" | "ordered" | "floyd-steinberg";
    colors: number;  // 2-256
    loop: number | "infinite";
  };
  spritesheet?: {
    layout: "grid" | "packed" | "horizontal" | "vertical";
    padding: number;
    metadata: "json" | "xml" | "yaml";
  };
}
```

---

## Phase 4: Layers, Palette & Color Management

**Goal:** Professional layer compositing and color management.

### 4.1 Complete Layer System

**Layer Features:**

1. **Layer Management**
   - Create, delete, reorder (drag-drop)
   - Layer naming and color coding
   - Layer groups (nested organization)
   - Layer thumbnails
   - Search and filter

2. **Blend Modes**
   - Normal, Multiply, Screen, Overlay
   - Add, Subtract, Divide
   - Darken, Lighten
   - Color, Hue, Saturation, Luminosity

3. **Layer Properties**
   - Opacity (0-100%)
   - Lock modes:
     - Transparent pixels
     - Image content
     - Position
   - Visibility toggle
   - Clipping masks

4. **Layer Effects**
   - Drop shadow
   - Outer glow
   - Stroke (outline)
   - All non-destructive

**Blend Mode Math:**
```typescript
// Multiply blend mode
// Result = (Top * Bottom) / 255
function blendMultiply(top: Color, bottom: Color): Color {
  return {
    r: (top.r * bottom.r) / 255,
    g: (top.g * bottom.g) / 255,
    b: (top.b * bottom.b) / 255,
    a: top.a
  };
}

// Screen blend mode
// Result = 255 - ((255 - Top) * (255 - Bottom)) / 255
function blendScreen(top: Color, bottom: Color): Color {
  return {
    r: 255 - ((255 - top.r) * (255 - bottom.r)) / 255,
    g: 255 - ((255 - top.g) * (255 - bottom.g)) / 255,
    b: 255 - ((255 - top.b) * (255 - bottom.b)) / 255,
    a: top.a
  };
}
```

### 4.2 Palette & Color System

**Palette Features:**

1. **Default Palette Library**
   - 50+ curated palettes
   - Categories: retro, fantasy, nature, etc.
   - Import from Lospec, ColourLovers

2. **Custom Palette Editor**
   - Add, remove, reorder colors
   - Drag colors to rearrange
   - Name and tag palettes
   - Export/import formats:
     - .ase (Aseprite)
     - .gpl (GIMP)
     - .pal (Paint.NET)
     - .act (Adobe Color Table)

3. **Palette Tools**
   - Color swap (replace color A with color B)
   - Palette ramp builder (generate gradients)
   - Color harmonies (complementary, triadic, tetradic)
   - Palette extraction from images

4. **Color Features**
   - Recent colors history (20 colors)
   - Eyedropper (sample from canvas)
   - Color search by name or value
   - Palette animation (cycle colors over frames)

### 4.3 Advanced Color Controls

**Color Adjustment Tools:**

1. **Basic Adjustments**
   - Hue shift (-180° to +180°)
   - Saturation (-100% to +100%)
   - Brightness/Lightness
   - Contrast

2. **Advanced Adjustments**
   - Color curves (RGB, per-channel)
   - Levels (input/output mapping)
   - Color balance (shadows, midtones, highlights)
   - Selective color (adjust specific color ranges)

3. **Color Operations**
   - Invert colors
   - Posterize (reduce to N colors)
   - Desaturate (convert to grayscale)
   - Color quantization

4. **Dithering**
   - Algorithm selection:
     - Ordered/Bayer
     - Floyd-Steinberg
     - Atkinson
     - Jarvis-Judice-Ninke
   - Configurable palette
   - Strength control

**HSL Conversion:**
```typescript
// RGB to HSL conversion
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    switch (max) {
      case r: h = ((g - b) / delta + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / delta + 2) / 6; break;
      case b: h = ((r - g) / delta + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}
```

---

## Phase 5: AI-Powered Features

**Goal:** Integrate AI assistance across the entire workflow.

### 5.1 AI Image Generation

**Generation Features:**

1. **Provider Support**
   - OpenAI DALL-E 3
   - Stability AI (Stable Diffusion XL)
   - Hugging Face (various models)
   - Replicate (flux, etc.)
   - Local Ollama

2. **Generation Modes**
   - Text-to-image (from scratch)
   - Image-to-image (use current sprite as reference)
   - Inpainting (fill selection with AI)
   - Outpainting (extend canvas)

3. **Prompt System**
   - 50+ optimized prompt templates
   - Negative prompts
   - Style presets (cyberpunk, fantasy, pixel art, etc.)
   - Prompt auto-completion from history
   - Prompt library (save favorites)

4. **Generation Management**
   - Batch generation (4-16 variations)
   - Generation queue
   - History with search
   - Cost calculator
   - Result caching (avoid duplicate API calls)

**UI Components:**
```
src/ui/ai/
├── GenerationPanel.tsx      # Main generation interface
├── ProviderSelector.tsx     # Choose AI provider
├── PromptEditor.tsx         # Prompt composition
├── GenerationHistory.tsx    # Past generations
└── ResultGallery.tsx        # Batch result selection
```

### 5.2 AI Post-Processing

**AI Enhancement Tools:**

1. **Upscaling**
   - Real-ESRGAN (4x upscale)
   - Super Resolution
   - Pixel-art-aware upscaling

2. **Smart Operations**
   - Palette extraction from generated images
   - Color harmony suggestions
   - Background completion
   - Remove background (automatic masking)

3. **Style Transfer**
   - Apply artistic styles to existing sprites
   - Style library
   - Strength control

4. **Animation Generation**
   - Frame interpolation (optical flow)
   - Generate animation from single image
   - Motion prediction

### 5.3 ML-Assisted Drawing

**Smart Drawing Features:**

1. **Edge Detection**
   - Snap to object boundaries
   - Edge highlighting
   - Auto-trace

2. **Predictive Completion**
   - Stroke prediction
   - Pattern recognition
   - Tile compatibility suggestions

3. **Object Detection**
   - Recognize similar shapes
   - Smart copy-paste
   - Auto-organize layers by content

4. **Smart Suggestions**
   - Color palette suggestions
   - Outline thickness
   - Shadow placement

---

## Phase 6: Professional UX & Accessibility

**Goal:** Polish the user experience to professional standards.

### 6.1 Command Palette & Keyboard System

**Command Palette:**
- Cmd/Ctrl+K to open
- Search all functions
- Recent commands
- Keyboard shortcut display
- Fuzzy search

**Keyboard Shortcuts:**
- Fully customizable
- Conflict detection
- Context-aware (different per tool)
- Visual cheat sheet
- Macro recording

**Shortcuts Example:**
```
Cmd/Ctrl+Z     - Undo
Cmd/Ctrl+Shift+Z - Redo
P - Pen tool
E - Eraser
F - Fill tool
B - Brush
Cmd/Ctrl+C - Copy
Cmd/Ctrl+V - Paste
Space+Drag - Pan canvas
Cmd/Ctrl+Scroll - Zoom
```

### 6.2 Interface Polish & Accessibility

**Theming:**
- Dark theme (default)
- Light theme
- High-contrast mode
- Custom themes

**Accessibility:**
- Keyboard-only navigation
- Screen reader support (ARIA labels)
- Focus indicators
- Reduced motion mode
- Tooltips with keyboard hints

**UI Enhancements:**
- Status bar (cursor position, tool info, memory usage)
- Toast notifications with progress
- Context menus
- Undo history panel with previews
- First-run tutorial
- Interactive help system
- Video guides per feature

**Mobile/Touch:**
- Gesture support
- Haptic feedback
- Touch-optimized controls
- Floating toolbar

### 6.3 Performance & Memory

**Optimization:**

1. **Web Workers**
   - Offload expensive operations:
     - Image processing
     - Export generation
     - AI requests

2. **Memory Management**
   - Efficient pixel buffers (typed arrays)
   - IndexedDB caching
   - Garbage collection of old history
   - Compression of stored frames

3. **Rendering**
   - Virtual scrolling (1000+ frames)
   - Progressive rendering
   - Hardware acceleration
   - Dirty rectangle optimization

4. **Profiling**
   - Memory profiler
   - Performance monitor
   - Frame time display

**Optimization Example:**
```typescript
// Web Worker for export generation
// main.ts
const exportWorker = new Worker("/workers/export.worker.js");
exportWorker.postMessage({ frames, settings });
exportWorker.onmessage = (e) => {
  const { blob, progress } = e.data;
  if (blob) downloadBlob(blob);
  else updateProgressBar(progress);
};

// export.worker.ts
self.onmessage = (e) => {
  const { frames, settings } = e.data;

  // Generate spritesheet (heavy operation)
  for (let i = 0; i < frames.length; i++) {
    processFrame(frames[i]);
    self.postMessage({ progress: (i + 1) / frames.length });
  }

  const blob = generateFinalOutput();
  self.postMessage({ blob });
};
```

---

## Phase 7: Clipboard & Import/Export Excellence

**Goal:** Seamless data exchange with other applications.

### 7.1 Clipboard Operations

**Clipboard Features:**
- Full image read/write
- Paste as new layer
- Paste-special with scaling options:
  - 1:1 (original size)
  - Fit to canvas
  - Tile
- Copy entire frames or selections
- Copy as spritesheet
- Paste with alignment guides
- Animation blending during placement

### 7.2 Import & Project Loading

**Import Formats:**

1. **Images**
   - PNG, JPG, WebP, BMP
   - Automatic canvas sizing or fit-to-canvas
   - Preserve transparency

2. **Sprite Sheets**
   - Automatic grid detection
   - Manual configuration
   - Import as frame sequence

3. **Animations**
   - GIF (split into frames)
   - Video (MP4, WebM) at specified FPS
   - APNG

4. **Project Files**
   - Aseprite (.ase) - if format accessible
   - PSD (extract layers)
   - Import layers from other projects

5. **Batch Import**
   - Process multiple files
   - Auto-arrange as frames

### 7.3 Export Flexibility

**Export Formats:**

1. **Spritesheet Export**
   - Layout algorithms:
     - Grid (fixed size)
     - Packed (optimal space)
     - Horizontal row
     - Vertical column
   - Metadata formats:
     - JSON (frame rects, durations, pivot points)
     - XML
     - YAML

2. **Engine-Specific Exports**
   - **Godot:**
     - AtlasTexture with `.tres` resource files
     - AnimatedSprite scenes
   - **Unity:**
     - Sprite sheet with `.meta` files
     - Animation clips
   - **Unreal:**
     - Flipbook assets
   - **Phaser:**
     - JSON atlas format

3. **Developer Formats**
   - C arrays (`const uint8_t sprite[] = {...}`)
   - JavaScript objects
   - Python dictionaries
   - Frame timing data
   - Collision shape export

**Export Example:**
```typescript
// Godot export
interface GodotAtlasTexture {
  resource_type: "AtlasTexture";
  resource_path: string;
  atlas: string;  // Path to texture
  region: { x: number; y: number; w: number; h: number };
  margin: { x: number; y: number; w: number; h: number };
}

function exportGodotAtlas(frames: Frame[]): GodotAtlasTexture[] {
  const spritesheet = packFrames(frames);
  const textures: GodotAtlasTexture[] = [];

  frames.forEach((frame, i) => {
    textures.push({
      resource_type: "AtlasTexture",
      resource_path: `res://sprites/frame_${i}.tres`,
      atlas: "res://sprites/spritesheet.png",
      region: frame.rect,
      margin: { x: 0, y: 0, w: 0, h: 0 }
    });
  });

  return textures;
}
```

---

## Phase 8: Collaboration & Cloud Features

**Goal:** Enable team collaboration and cloud backup.

### 8.1 Cloud Synchronization

**Sync Features:**
- Auto-save every 30 seconds
- Manual save with versioning
- Version history (restore to any previous save)
- Conflict detection and resolution:
  - Keep local
  - Keep remote
  - Manual merge
- Offline mode with sync on reconnect
- Automatic daily backups

**Sync Architecture:**
```typescript
interface SyncState {
  lastSyncTime: number;
  localVersion: number;
  remoteVersion: number;
  conflictResolution: "local" | "remote" | "manual" | null;
}

async function syncProject(projectId: string): Promise<SyncResult> {
  const localData = await getLocalProject(projectId);
  const remoteData = await getRemoteProject(projectId);

  // Detect conflicts
  if (localData.version !== remoteData.version) {
    return { status: "conflict", localData, remoteData };
  }

  // Upload changes
  if (localData.updatedAt > remoteData.updatedAt) {
    await uploadProject(projectId, localData);
    return { status: "uploaded" };
  }

  // Download changes
  if (remoteData.updatedAt > localData.updatedAt) {
    await downloadProject(projectId, remoteData);
    return { status: "downloaded" };
  }

  return { status: "in-sync" };
}
```

### 8.2 Collaboration Features

**Real-Time Collaboration:**
- Multiple users editing simultaneously
- Live cursor positions
- User presence indicators
- Change broadcasting
- Conflict-free replicated data types (CRDTs)

**Communication:**
- Comment system on frames
- @mentions for feedback
- Activity feed showing all project changes
- Notification system

### 8.3 Project Management

**Organization Features:**
- Project gallery with thumbnails
- Search and filter (by tags, date, name)
- Project templates for quick starts
- Favorites/starred projects
- Recent projects quick-access
- Project duplication
- Project statistics (frame count, size, last edited)
- Project archival
- Portfolio publishing (share publicly)

---

## Phase 9: Beyond Aseprite - Unique Innovations

**Goal:** Features that exceed existing tools and set SpriteAnvil apart.

### 9.1 Advanced Symmetry

**Innovations:**
- Line symmetry with any custom angle (not just H/V)
- Rotation symmetry for radial patterns (kaleidoscope mode)
- Asymmetric drawing preview (see mirrored result before commit)
- Multiple axis symmetry simultaneously
- Symmetry applies to all operations:
  - Selection
  - Transformation
  - Fill
  - Filters
- Smart symmetry detection (auto-detect natural symmetry axes)

### 9.2 Enhanced Animation Tools

**Unique Features:**

1. **Animation Tweening**
   - Automatic in-between frame generation
   - Easing curves:
     - Linear
     - Quadratic (ease in/out)
     - Cubic (smooth)
     - Elastic (bounce)
     - Back (overshoot)
   - Custom Bezier curves

2. **Animation Blending**
   - Smooth transition between animation sequences
   - Crossfade duration control

3. **Physics Preview**
   - Gravity simulation
   - Bounce simulation
   - Arc motion helpers
   - Collision detection helpers

**Easing Functions:**
```typescript
// Easing function implementations
const easingFunctions = {
  linear: (t: number) => t,

  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) =>
    t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (--t) * t * t + 1,

  elastic: (t: number) =>
    Math.sin(-13 * (t + 1) * Math.PI / 2) * Math.pow(2, -10 * t) + 1
};

// Tween between two frames
function tweenFrames(
  frame1: Frame,
  frame2: Frame,
  steps: number,
  easing: keyof typeof easingFunctions
): Frame[] {
  const inbetweens: Frame[] = [];

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const easedT = easingFunctions[easing](t);
    inbetweens.push(interpolateFrames(frame1, frame2, easedT));
  }

  return inbetweens;
}
```

### 9.3 Smart Pixel Operations

**Advanced Features:**

1. **Smart Outline Generation**
   - Configurable thickness (1-10px)
   - Inside, outside, or centered
   - Corner style (sharp, rounded, beveled)

2. **Edge Detection**
   - Canny edge detection
   - Sobel operator
   - Custom threshold

3. **Pixel Spread**
   - Noise effects
   - Organic growth patterns
   - Texture generation

4. **Mipmap Preview**
   - See how sprite looks at different scales
   - Identify detail loss
   - Optimize for target resolution

5. **Smart Palette Reduction**
   - Preserve visual detail
   - Median cut algorithm
   - Octree quantization
   - K-means clustering

---

## Phase 10: Mobile & Tablet Optimization

**Goal:** Full-featured mobile/tablet experience (secondary priority).

### 10.1 Touch & Gesture Interface

**Gestures:**
- Pinch to zoom (with momentum)
- Two-finger pan
- Three-finger tap to undo
- Three-finger swipe to redo
- Long-press for context menu
- Double-tap to reset zoom

**Touch Drawing:**
- Pressure simulation
- Palm rejection
- Stylus support (Apple Pencil, S Pen)
- Touch brush with size control

### 10.2 Mobile Layout

**Adaptations:**
- Full-screen canvas mode
- Floating toolbar (draggable)
- Simplified tool palette
- Bottom drawer for timeline
- Slide-in panels (right panel)
- Tablet two-panel layout (canvas + timeline)
- Responsive font sizing
- Touch-optimized buttons (minimum 44x44px)
- Orientation change handling

---

## Development Approach

### Documentation Standards

Every feature implementation includes:

1. **Header Comments**
   - What the feature does
   - Why it matters
   - How it fits in the architecture

2. **Algorithm Documentation**
   - Step-by-step logic explanation
   - Mathematical formulas
   - Complexity analysis (Big-O)
   - Visual diagrams (ASCII art)

3. **API Documentation**
   - JSDoc comments
   - Parameter explanations
   - Return value descriptions
   - Usage examples
   - Edge cases

4. **Example Code**
   - `/src/examples` folder
   - Commented demonstrations
   - Common use cases

### Code Organization

**Folder Structure:**
```
src/
├── lib/                    # Business logic
│   ├── ai/                # AI integration
│   ├── color/             # Color management
│   ├── animation/         # Animation engine
│   ├── export/            # Export functionality
│   └── import/            # Import functionality
├── editor/                # Core editing logic
│   ├── tools/             # Drawing tools
│   ├── pixels.ts          # Pixel operations
│   ├── history.ts         # Undo/redo
│   └── selection.ts       # Selection system
├── ui/                    # React components
│   ├── canvas/            # Canvas-related
│   ├── panels/            # Side panels
│   ├── timeline/          # Timeline components
│   └── ai/                # AI UI
├── utils/                 # Utility functions
├── constants.ts           # All constants
├── types.ts              # TypeScript definitions
└── config.ts             # Configuration

docs/
├── ARCHITECTURE.md        # System architecture
├── MODULE_GUIDE.md       # Module breakdown
├── CODE_STYLE.md         # Coding standards
├── COMMON_TASKS.md       # Task guides
└── [feature docs]/       # Per-feature documentation
```

### Testing Strategy

**Test Levels:**

1. **Unit Tests**
   - Test individual functions
   - Pixel operations
   - Color calculations
   - Selection algorithms

2. **Integration Tests**
   - Test tool workflows
   - Canvas interactions
   - Database operations

3. **Visual Tests**
   - Screenshot comparisons
   - Render correctness
   - Animation playback

4. **Performance Tests**
   - Memory usage
   - Render speed
   - Large canvas handling

---

## Timeline & Priorities

### Immediate Priorities (Next 2-4 Weeks)

1. **Connect Selection System** (Already Built)
   - Wire up selection UI
   - Implement cut/copy/paste
   - Add selection visualization

2. **Database Integration**
   - Create all tables
   - Implement save/load
   - Add auto-save

3. **Basic Animation**
   - Frame duplication
   - Frame deletion
   - Simple playback

### Short-Term Goals (1-2 Months)

1. **Complete Drawing Tools**
   - Eyedropper
   - Gradient tool
   - Advanced brushes

2. **Layer System**
   - Basic layer operations
   - Blend modes
   - Layer effects

3. **Export System**
   - GIF export
   - Spritesheet export
   - PNG sequence

### Medium-Term Goals (2-4 Months)

1. **AI Integration**
   - Text-to-image generation
   - Basic post-processing
   - Provider abstraction

2. **Advanced Animation**
   - Onion skinning
   - Animation tags
   - Tweening

3. **Color Management**
   - Palette system
   - Color adjustments
   - Dithering

### Long-Term Vision (4-6+ Months)

1. **Collaboration**
   - Real-time editing
   - Comments
   - Sharing

2. **Mobile Optimization**
   - Responsive design
   - Touch controls
   - Gestures

3. **Advanced AI**
   - ML-assisted drawing
   - Animation generation
   - Style transfer

---

## Success Metrics

**User Experience:**
- Tool response time < 16ms (60 FPS)
- Save operation < 500ms
- Export < 5s for typical sprite
- Zero data loss

**Feature Completeness:**
- 100% Aseprite parity
- 20+ unique features beyond Aseprite
- Support for all major export formats
- Mobile-friendly interface

**Code Quality:**
- 100% TypeScript coverage
- Comprehensive comments
- Clear architecture documentation
- Beginner-friendly code structure

---

## Summary

This comprehensive roadmap transforms SpriteAnvil into a professional-grade sprite editor that achieves complete Aseprite parity while introducing significant innovations in AI assistance, responsive design, and advanced drawing capabilities.

**Key Differentiators:**
1. **Multi-Provider AI Integration** - Not limited to one AI service
2. **Superior Responsive Design** - Works seamlessly across all devices
3. **Advanced Symmetry Modes** - Beyond basic mirror drawing
4. **Comprehensive Documentation** - Every feature is well-documented and explained
5. **Beginner-Friendly Code** - Clear naming, extensive comments, learning-oriented

**Current Status:**
- Phase 1 (Advanced Drawing Tools) - **90% Complete**
  - ✅ Fill tool
  - ✅ Shape tools
  - ✅ Selection system (needs UI connection)
  - ⏳ Transform tools
  - ⏳ Advanced brushes

**Next Steps:**
1. Connect selection system to UI
2. Implement cut/copy/paste
3. Set up database schema
4. Build save/load functionality
5. Begin Phase 2 (Advanced Tools)

The architecture is solid, the foundation is in place, and the path forward is clear. Each phase builds logically on previous work, maintaining code quality and documentation standards throughout.
