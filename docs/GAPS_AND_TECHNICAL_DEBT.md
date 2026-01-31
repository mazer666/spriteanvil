# SpriteAnvil - Gaps & Technical Debt

This document lists identified discrepancies between the project documentation and current implementation, as well as known technical issues.

## 🚩 Feature Gaps (Documentation vs. Code)

### 1. Lasso Tool Shortcut Mapping

- **Status in UI**: Tooltip claims `W` for Lasso Selection.
- **Current State**: The `W` key is actually mapped to the **Magic Wand** (`selectWand`) in `useKeyboardShortcuts.ts`. The Lasso tool (`selectLasso`) exists in the code and ToolRail but currently has no functional shortcut if `W` is taken by the Wand.
- **Fix Needed**: Correct the shortcut mapping so Lasso has its own key or the `W` key behavior is standardized.

### 3. Layer Management Discovery

- **Status in Docs**: Full layer management implemented.
- **Current State**: While the code in `LayerPanel.tsx` contains a "+ New Layer" button, it can be difficult to locate or may not be rendering correctly under certain conditions (e.g., during React state errors).
- **Fix Needed**: UI polish to ensure the layer management remains visible and accessible.

## ⚠️ Known Technical Issues

### 1. React Infinite Update Loop

- **Component**: `ColorAdjustPanel`.
- **Symptom**: Console flooded with `Maximum update depth exceeded` warnings.
- **Impact**: Can lead to browser hangs, UI unresponsiveness, and blocked rendering of other components.
- **Fix Needed**: Fix the state dependency loop in the color adjustment preview logic.

### 2. Canvas Port Discrepancy

- **Issue**: Standard Vite port is `5173`, but some documentation or local environments may point to `50412`.
- **Fix Needed**: Standardize development URL documentation.
