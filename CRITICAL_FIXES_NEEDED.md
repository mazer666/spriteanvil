# Critical Fixes Needed - Action Plan

## Status: In Progress
**Date**: 2026-01-28

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

#### 1. Layer Compositing (NOT WORKING)
**Issue**: Layers exist in UI, but drawing always targets a single buffer.

**Fix Required**:
- Create a pixel buffer per layer
- Composite visible layers to the canvas
- Apply layer opacity + blend modes during compositing

#### 2. Selection System (PARTIAL)
**Issue**: Basic selection and operations work, but key behaviors are missing.
- ✅ Deselect works (Escape/Cmd+D)
- ✅ Invert/grow/shrink operations implemented
- ❌ Boolean operations (union, subtract, intersect) still stubs
- ❌ Drawing is not constrained to active selection
- ❌ Selection move/transform missing

**Fix Required**:
- Implement boolean selection operations
- Restrict drawing to selection mask when active
- Add selection transform (move, scale, rotate)

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
1. ⬜ Fix gradient tool integration (45 min)
2. ⬜ Fix lasso/wand integration (45 min)
3. ⬜ Fix transform scale apply button (10 min)
4. ⬜ Fix export panel formats (30 min)

**Phase 2: Make it better** (2-3 hours)
5. ⬜ Fix boolean selection ops (1 hour)
6. ⬜ Add fill tolerance support (30 min)
7. ⬜ Apply symmetry mode (45 min)

**Phase 3: Make it great** (3-4 hours)
8. ⬜ Multi-layer compositing (2 hours)
9. ⬜ Selection move/transform (1 hour)
10. ⬜ Tool grouping UI (1 hour)

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
