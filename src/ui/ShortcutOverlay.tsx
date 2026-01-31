/**
 * src/ui/ShortcutOverlay.tsx
 * -----------------------------------------------------------------------------
 * ## SHORTCUT CHEAT SHEET (Noob Guide)
 * 
 * This is a "Pop-up Help" screen that reminds you which keys do what.
 * 
 * - Learning these keys is the best way to become a "Speed Painter".
 * - For example, instead of clicking the Eraser icon, you can just press [E]!
 */
import React from "react";

export type ShortcutGroup = {
  title: string;
  items: Array<{ label: string; shortcut: string }>;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  groups: ShortcutGroup[];
};

export default function ShortcutOverlay({ isOpen, onClose, groups }: Props) {
  if (!isOpen) return null;

  return (
    <div className="shortcut-overlay" onClick={onClose}>
      <div className="shortcut-card" onClick={(e) => e.stopPropagation()}>
        <div className="shortcut-header">
          <h2>Shortcut Cheat Sheet</h2>
          <button className="uiBtn" onClick={onClose} title="Close">
            Close
          </button>
        </div>
        <div className="shortcut-grid">
          {groups.map((group) => (
            <div key={group.title} className="shortcut-group">
              <div className="shortcut-title">{group.title}</div>
              {group.items.map((item) => (
                <div key={item.label} className="shortcut-item">
                  <span>{item.label}</span>
                  <span className="shortcut-key">{item.shortcut}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="shortcut-footer">Press Cmd+/ again to close.</div>
      </div>
    </div>
  );
}
