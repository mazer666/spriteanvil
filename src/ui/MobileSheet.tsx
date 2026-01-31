import React, { ReactNode } from "react";

type Props = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export default function MobileSheet({ isOpen, title, onClose, children }: Props) {
  if (!isOpen) return null;

  return (
    <>
      <div className="mobile-sheet__backdrop" onClick={onClose} />
      <div className="mobile-sheet">
        <div className="mobile-sheet__header">
          <h3 className="mobile-sheet__title">{title}</h3>
          <button className="uiBtn uiBtn--ghost mobile-sheet__close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="mobile-sheet__content">{children}</div>
      </div>
    </>
  );
}
