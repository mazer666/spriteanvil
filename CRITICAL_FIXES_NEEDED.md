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

#### 1. Selection System (PARTIAL)
**Issue**: Core selection tools work, but selection transforms are missing.
- ✅ Deselect works (Escape/Cmd+D)
- ✅ Invert/grow/shrink operations implemented
- ✅ Boolean operations via Shift/Alt modifiers
- ✅ Drawing constrained to active selection
- ❌ Selection move/transform missing

**Fix Required**:
- Add selection transform (move, scale, rotate)

---

### 🟡 **HIGH PRIORITY** - Missing Features

#### 5. Layer Operations (PARTIAL)
**Issue**: Core layer UI and compositing work, but advanced operations are missing.

**Fix Required**:
- Add flatten/export of merged layers
- Add missing layer operations (clipping masks, non-destructive effects)

---

### 🟢 **MEDIUM PRIORITY** - UX Improvements

#### 11. Symmetry Mode (PARTIAL)
**Issue**: Symmetry works across drawing tools, but custom axes are not supported yet.

**Fix Required**:
- Add custom symmetry axis configuration

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

#### 14. Canvas Pan (IMPLEMENTED)
**Issue**: Canvas panning is available via space + drag.

---

### 🔵 **LOW PRIORITY** - Polish

#### 15. Minimap
#### 16. Multiple Undo/Redo History Display
#### 17. Selection Bounds Handles
#### 18. Brush Preview Circle

---

## Recommended Fix Order

**Phase 1: Make it work** (3-4 hours)
1. ⬜ Add selection transform (move/scale/rotate) (2 hours)
2. ⬜ Add custom symmetry axis (45 min)
3. ⬜ Add layer flatten/export buffer (30 min)
4. ✅ Add canvas pan (Space + drag)

**Phase 2: Make it better** (2-3 hours)
5. ⬜ Improve stabilizer + preview (30 min)
6. ⬜ Tool grouping UI (1 hour)
7. ⬜ Minimap + selection handles (1 hour)

**Phase 3: Make it great** (3-4 hours)
8. ⬜ Layer effects/clipping masks (2 hours)
9. ⬜ Advanced brush dynamics (1 hour)
10. ⬜ Export polish (APNG/PNG sequence) (1 hour)

---

## Test Checklist

After fixes, verify:
- [ ] Can select area and paste multiple times
- [ ] Can invert selection (Cmd+Shift+I)
- [ ] Can deselect (Escape / Cmd+D)
- [ ] Drawing respects selection mask
- [x] Gradient tool renders all 5 types
- [x] Lasso creates custom selection
- [x] Magic wand selects similar colors
- [x] Transform scale applies correctly
- [x] Export shows PNG, GIF, JSON options
- [x] Fill respects tolerance setting
- [x] Symmetry mode mirrors drawing for all tools
- [x] Layers composite correctly

---

## Current Build Status

```bash
npm run build
# Should compile without errors but many features non-functional
```

**Next Step**: Start Phase 1 fixes immediately.
