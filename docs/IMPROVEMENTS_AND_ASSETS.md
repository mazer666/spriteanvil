# Improvements & Asset Checklist

This document captures **performance/UX/UI optimization suggestions** and the **visual assets** needed to fully match the classic pixel‑editor aesthetic (gold trim + beveled panels).

## Performance / Architecture Suggestions

1. **Batch realtime pixel patches**
   - Aggregate pixel diffs for 50–100ms windows and send a single payload to reduce Supabase broadcast overhead.
   - Consider run‑length encoding for patches to reduce payload size.

2. **Offscreen canvas caching**
   - Cache onion‑skin and overlay layers in OffscreenCanvas to reduce per‑frame work.
   - Throttle redraws to 60fps using `requestAnimationFrame`.

3. **Layer composite caching**
   - Memoize composite buffer per layer stack hash to avoid recompositing when no layer changes.

4. **Lazy timeline thumbnails**
   - Render frame previews on demand when visible in the scroller.

5. **Chunked AI payloads**
   - For large sprites, downscale preview for AI requests and keep full‑res for final merge.

## UX / UI Suggestions

1. **Iconography parity**
   - Replace emoji/tool characters with sprite‑style SVG or PNG icons (16–20px).

2. **Classic editor toolbar**
   - Add top‑bar dropdown menus (File/Edit/View) for parity with reference UIs.

3. **Timeline interaction**
   - Drag to reorder frames and add right‑click context actions (duplicate/delete).

4. **Realtime collaboration**
   - Cursor labels should show user names once user profiles are available.

5. **AI workflow clarity**
   - Display preview thumbnails for inpainting results before applying.

## Required Image Assets (suggested)

To fully match the example UI theme, provide these assets:

- `ui/panel_bevel.png` — 9‑slice for panel borders (golden bevel).
- `ui/button_bevel.png` — 9‑slice for buttons (pressed/hovered/active states).
- `ui/toolbar_bg.png` — subtle dark metal texture with vignette.
- `ui/tool_icons/*.png` — 16px pixel tool icons (pen/eraser/fill/etc).
- `ui/timeline_frame_bg.png` — thumbnail frame with gilded outline.
- `ui/scrollbar_thumb.png` — small gold‑accent scrollbar thumb.
- `ui/app_bg_noise.png` — subtle noise tile for the background.

Recommended formats: **PNG**, power‑of‑two sizes for repeatable textures.

---

## AI Providers (OpenRouter)

OpenRouter is now part of the provider list. When wiring actual API calls:
- Use the OpenRouter REST API (`https://openrouter.ai/api/v1`) with `Authorization: Bearer <key>`
- Supply `X-Title` for attribution and `HTTP-Referer` when required.

