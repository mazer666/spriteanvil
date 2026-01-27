# SpriteAnvil Feature Integration Plan & Architecture

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
