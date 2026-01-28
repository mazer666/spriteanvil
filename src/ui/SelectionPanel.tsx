import React from "react";

type Props = {
  hasSelection: boolean;
  onSelectAll: () => void;
  onDeselect: () => void;
  onInvertSelection: () => void;
  onGrow: () => void;
  onShrink: () => void;
  onFeather: (radius: number) => void;
};

export default function SelectionPanel({
  hasSelection,
  onSelectAll,
  onDeselect,
  onInvertSelection,
  onGrow,
  onShrink,
  onFeather,
}: Props) {
  return (
    <div className="panel">
      <div className="panel__header">
        <div className="panel__title">Selection</div>
      </div>

      <div className="panel__body">
        <div className="option-group">
          <div className="option-label">Selection Tools</div>
          <button className="uiBtn uiBtn--full" onClick={onSelectAll}>
            Select All (Cmd+A)
          </button>
          <button
            className="uiBtn uiBtn--full"
            onClick={onDeselect}
            disabled={!hasSelection}
          >
            Deselect (Cmd+D)
          </button>
          <button
            className="uiBtn uiBtn--full"
            onClick={onInvertSelection}
            disabled={!hasSelection}
          >
            Invert Selection (Cmd+Shift+I)
          </button>
        </div>

        <div className="option-group">
          <div className="option-label">Modify Selection</div>
          <button
            className="uiBtn uiBtn--full"
            onClick={onGrow}
            disabled={!hasSelection}
          >
            Grow Selection
          </button>
          <button
            className="uiBtn uiBtn--full"
            onClick={onShrink}
            disabled={!hasSelection}
          >
            Shrink Selection
          </button>
        </div>

        <div className="option-group">
          <div className="option-label">Boolean Operations</div>
          <div className="option-hint">
            Hold Shift to add, Alt to subtract, Shift+Alt to intersect.
          </div>
        </div>

        {hasSelection && (
          <div className="option-group">
            <div className="selection-info">
              <span className="selection-info__icon">✓</span>
              <span>Active Selection</span>
            </div>
            <div className="option-hint">
              Press Escape or Cmd+D to deselect
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
