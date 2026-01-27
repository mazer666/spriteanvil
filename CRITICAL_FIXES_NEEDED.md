# Critical Fixes Needed - Action Plan

## Status: In Progress
**Date**: 2026-01-27

---

## What's Been Created (Infrastructure)

✅ **New Components Created**:
1. `ToolOptionsPanel.tsx` - Tool-specific settings (fill tolerance, gradient options, symmetry, etc.)
2. `SelectionPanel.tsx` - Selection operations including boolean ops
3. `AIPanel.tsx` - Placeholder for AI features (greyed out)
4. `RightPanel.tsx` (rebuilt) - Now includes 7 tabs: Tool, Layers, Palette, Transform, Color, Selection, AI

✅ **Types Extended**:
- Added `GradientType`, `DitheringType`, `SymmetryMode`
- Extended `UiSettings` with tool-specific properties

---

## What Still Needs Fixing (Priority Order)

### 🔴 **CRITICAL** - Breaks Core Functionality

#### 1. Selection System (BROKEN)
**Issue**: Selection doesn't work properly
- ✅ Deselect works (Escape/Cmd+D)
- ❌ Invert selection not implemented
- ❌ Can't paste multiple times (clipboard clears after first paste)
- ❌ Can't move pasted content
- ❌ No visual selection bounds/handles
- ❌ Can draw outside selection (should be constrained)
- ❌ Boolean operations (union, subtract, intersect) not implemented

**Fix Required**:
- Add `invertSelection()` function in `src/editor/selection.ts`
- Modify clipboard system to keep data after paste
- Add selection transform (move, scale, rotate)
- Add boolean selection operations
- Restrict drawing to selection mask when active

#### 2. App.tsx Settings Defaults (MISSING)
**Issue**: New settings properties cause undefined errors

**Fix Required**:
```typescript
// In App.tsx, update settings initialization:
const [settings, setSettings] = useState<UiSettings>(() => ({
  // ... existing settings ...
  primaryColor: "#f2ead7",
  secondaryColor: "#000000",  // ADD THIS
  fillTolerance: 0,            // ADD THIS
  gradientType: "linear",      // ADD THIS
  ditheringType: "none",       // ADD THIS
  symmetryMode: "none",        // ADD THIS
  brushSize: 1,                // ADD THIS
  wandTolerance: 32,           // ADD THIS
}));
```

#### 3. Selection Handlers in App.tsx (MISSING)
**Fix Required**:
```typescript
// Add to App.tsx:
function handleInvertSelection() {
  if (!selection) return;
  const inverted = new Uint8Array(canvasSpec.width * canvasSpec.height);
  for (let i = 0; i < inverted.length; i++) {
    inverted[i] = selection[i] ? 0 : 1;
  }
  setSelection(inverted);
}

function handleGrowSelection() { /* TODO */ }
function handleShrinkSelection() { /* TODO */ }
function handleFeatherSelection(radius: number) { /* TODO */ }
function handleBooleanUnion() { /* TODO */ }
function handleBooleanSubtract() { /* TODO */ }
function handleBooleanIntersect() { /* TODO */ }
```

#### 4. Pass Selection Operations to DockLayout (MISSING)
**Fix Required** in App.tsx:
```typescript
<DockLayout
  // ... existing props ...
  onSelectionOperations={{
    onSelectAll: handleSelectAll,
    onDeselect: handleDeselect,
    onInvertSelection: handleInvertSelection,
    onGrow: handleGrowSelection,
    onShrink: handleShrinkSelection,
    onFeather: handleFeatherSelection,
    onBooleanUnion: handleBooleanUnion,
    onBooleanSubtract: handleBooleanSubtract,
    onBooleanIntersect: handleBooleanIntersect,
  }}
  // ...
/>
```

---

### 🟡 **HIGH PRIORITY** - Missing Features

#### 5. Gradient Tool (NOT WORKING)
**Issue**: Tool exists but doesn't render gradients

**Fix Required**:
- Integrate `src/editor/tools/gradient.ts` in `CanvasStage.tsx`
- Add gradient preview during drag
- Apply gradient on mouse up

#### 6. Lasso & Magic Wand (NOT WORKING)
**Issue**: Tools exist but do nothing

**Fix Required**:
- Integrate `src/editor/tools/lasso.ts` in `CanvasStage.tsx`
- Implement magic wand flood-fill selection

#### 7. Transform Panel Scale (NOT WORKING)
**Issue**: Scale inputs don't apply

**Fix Required** in `TransformPanel.tsx`:
- Add "Apply" button that calls `onScale(scaleX, scaleY)`
- Currently missing the apply action

#### 8. Export Panel (LIMITED)
**Issue**: Only shows PNG, missing GIF and JSON

**Fix Required** in `ExportPanel.tsx`:
- Add format selector (PNG / GIF / JSON)
- Show format-specific options
- Wire up `src/lib/export/gif.ts` and `src/lib/export/metadata.ts`

#### 9. Layer Compositing (NOT WORKING)
**Issue**: Layers exist but all drawing goes to single buffer

**Fix Required**:
- Canvas needs to composite multiple layer buffers
- Each layer needs its own pixel buffer
- Respect layer visibility, opacity, and blend mode

---

### 🟢 **MEDIUM PRIORITY** - UX Improvements

#### 10. Fill Tool Tolerance (NOT ACCESSIBLE)
**Issue**: Setting exists but `floodFill` function doesn't use it

**Fix Required**:
- Modify `src/editor/tools/fill.ts` to accept tolerance parameter
- Pass `settings.fillTolerance` from CanvasStage

#### 11. Symmetry Mode (NOT VISIBLE)
**Issue**: Setting exists in ToolOptionsPanel but not applied in drawing

**Fix Required**:
- Modify `CanvasStage.tsx` drawing logic to apply symmetry transforms
- Use `src/editor/symmetry.ts` functions

#### 12. Brush Stabilizer (COSMETIC ONLY)
**Issue**: Smooths cursor but doesn't visually help much

**Fix Required**:
- Tune stabilizer alpha parameter
- Add visual preview of smoothed path

#### 13. Tool Grouping (UX)
**Issue**: Toolbar shows all 16+ tools separately (cluttered)

**Fix Required**:
- Group related tools (rect + filled rect, circle + filled circle)
- Show active tool variant
- Photoshop-style nested menus

#### 14. Move Tool (MISSING)
**Issue**: No way to pan canvas or move selections

**Fix Required**:
- Add move tool that pans viewport OR moves selection
- Space bar + drag for temp pan

---

### 🔵 **LOW PRIORITY** - Polish

#### 15. Minimap
#### 16. Multiple Undo/Redo History Display
#### 17. Selection Bounds Handles
#### 18. Brush Preview Circle

---

## Recommended Fix Order

**Phase 1: Make it work** (3-4 hours)
1. ✅ Fix App.tsx settings defaults (5 min)
2. ✅ Add selection operation handlers (30 min)
3. ✅ Wire up selection operations (10 min)
4. ⬜ Fix gradient tool integration (45 min)
5. ⬜ Fix lasso/wand integration (45 min)
6. ⬜ Fix transform scale apply button (10 min)
7. ⬜ Fix export panel formats (30 min)

**Phase 2: Make it better** (2-3 hours)
8. ⬜ Implement invert selection (15 min)
9. ⬜ Fix boolean selection ops (1 hour)
10. ⬜ Add fill tolerance support (30 min)
11. ⬜ Apply symmetry mode (45 min)

**Phase 3: Make it great** (3-4 hours)
12. ⬜ Multi-layer compositing (2 hours)
13. ⬜ Selection move/transform (1 hour)
14. ⬜ Tool grouping UI (1 hour)

---

## Test Checklist

After fixes, verify:
- [ ] Can select area and paste multiple times
- [ ] Can invert selection (Cmd+Shift+I)
- [ ] Can deselect (Escape / Cmd+D)
- [ ] Drawing respects selection mask
- [ ] Gradient tool renders all 5 types
- [ ] Lasso creates custom selection
- [ ] Magic wand selects similar colors
- [ ] Transform scale applies correctly
- [ ] Export shows PNG, GIF, JSON options
- [ ] Fill respects tolerance setting
- [ ] Symmetry mode mirrors drawing
- [ ] Layers composite correctly

---

## Current Build Status

```bash
npm run build
# Should compile without errors but many features non-functional
```

**Next Step**: Start Phase 1 fixes immediately.
