import { useEffect } from "react";
import { ToolId } from "../types";

export type ShortcutHandler = {
  onUndo?: () => void;
  onRedo?: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
  onSelectAll?: () => void;
  onDeselect?: () => void;
  onChangeTool?: (tool: ToolId) => void;
  onSave?: () => void;
  onExport?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onToggleGrid?: () => void;
  onToggleOnionSkin?: () => void;
  onFlipHorizontal?: () => void;
  onFlipVertical?: () => void;
  onRotate90CW?: () => void;
  onRotate90CCW?: () => void;
  onOpenCommandPalette?: () => void;
  onNewFrame?: () => void;
  onDuplicateFrame?: () => void;
  onDeleteFrame?: () => void;
  onNextFrame?: () => void;
  onPrevFrame?: () => void;
  onPlayPause?: () => void;
};

export function useKeyboardShortcuts(handlers: ShortcutHandler, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod && e.key === 'z' && !e.shiftKey && handlers.onUndo) {
        e.preventDefault();
        handlers.onUndo();
      } else if (mod && e.key === 'z' && e.shiftKey && handlers.onRedo) {
        e.preventDefault();
        handlers.onRedo();
      } else if (mod && e.key === 'y' && handlers.onRedo) {
        e.preventDefault();
        handlers.onRedo();
      } else if (mod && e.key === 'c' && handlers.onCopy) {
        e.preventDefault();
        handlers.onCopy();
      } else if (mod && e.key === 'x' && handlers.onCut) {
        e.preventDefault();
        handlers.onCut();
      } else if (mod && e.key === 'v' && handlers.onPaste) {
        e.preventDefault();
        handlers.onPaste();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && handlers.onDelete && !isInputFocused()) {
        e.preventDefault();
        handlers.onDelete();
      } else if (mod && e.key === 'a' && handlers.onSelectAll) {
        e.preventDefault();
        handlers.onSelectAll();
      } else if (mod && e.key === 'd' && handlers.onDeselect) {
        e.preventDefault();
        handlers.onDeselect();
      } else if (mod && e.key === 's' && handlers.onSave) {
        e.preventDefault();
        handlers.onSave();
      } else if (mod && e.key === 'e' && handlers.onExport) {
        e.preventDefault();
        handlers.onExport();
      } else if (mod && e.key === '=' && handlers.onZoomIn) {
        e.preventDefault();
        handlers.onZoomIn();
      } else if (mod && e.key === '-' && handlers.onZoomOut) {
        e.preventDefault();
        handlers.onZoomOut();
      } else if (mod && e.key === '0' && handlers.onZoomReset) {
        e.preventDefault();
        handlers.onZoomReset();
      } else if (mod && e.key === '\'' && handlers.onToggleGrid) {
        e.preventDefault();
        handlers.onToggleGrid();
      } else if (mod && e.key === ';' && handlers.onToggleOnionSkin) {
        e.preventDefault();
        handlers.onToggleOnionSkin();
      } else if (mod && e.key === 'h' && !e.shiftKey && handlers.onFlipHorizontal) {
        e.preventDefault();
        handlers.onFlipHorizontal();
      } else if (mod && e.key === 'h' && e.shiftKey && handlers.onFlipVertical) {
        e.preventDefault();
        handlers.onFlipVertical();
      } else if (mod && e.key === 'r' && !e.shiftKey && handlers.onRotate90CW) {
        e.preventDefault();
        handlers.onRotate90CW();
      } else if (mod && e.key === 'r' && e.shiftKey && handlers.onRotate90CCW) {
        e.preventDefault();
        handlers.onRotate90CCW();
      } else if (mod && e.key === 'k' && handlers.onOpenCommandPalette) {
        e.preventDefault();
        handlers.onOpenCommandPalette();
      } else if (!mod && !isInputFocused() && handlers.onChangeTool) {
        handleToolShortcut(e, handlers.onChangeTool);
      } else if (e.key === 'ArrowRight' && e.altKey && handlers.onNextFrame) {
        e.preventDefault();
        handlers.onNextFrame();
      } else if (e.key === 'ArrowLeft' && e.altKey && handlers.onPrevFrame) {
        e.preventDefault();
        handlers.onPrevFrame();
      } else if (e.key === ' ' && handlers.onPlayPause && !isInputFocused()) {
        e.preventDefault();
        handlers.onPlayPause();
      }
    }

    function handleToolShortcut(e: KeyboardEvent, onChangeTool: (tool: ToolId) => void) {
      const key = e.key.toLowerCase();
      const shift = e.shiftKey;

      const toolMap: Record<string, ToolId> = {
        'b': 'pen',
        'e': shift ? 'ellipse' : 'eraser',
        'i': 'eyedropper',
        'f': 'fill',
        'g': 'gradient',
        'l': 'line',
        'r': shift ? 'rectangleFilled' : 'rectangle',
        'c': shift ? 'circleFilled' : 'circle',
        'o': shift ? 'ellipse' : 'ellipseFilled',
        'm': shift ? 'selectEllipse' : 'selectRect',
        'w': 'selectWand',
        'v': 'move',
      };

      if (toolMap[key]) {
        e.preventDefault();
        onChangeTool(toolMap[key]);
      }
    }

    function isInputFocused(): boolean {
      const active = document.activeElement;
      return active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || (active?.hasAttribute('contenteditable') ?? false);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers, enabled]);
}
