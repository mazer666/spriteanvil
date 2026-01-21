import React from "react";
import { UiSettings } from "../types";

type Props = {
  settings: UiSettings;
  onChangeSettings: (next: UiSettings) => void;
};

/**
 * Timeline (bottom): v0.1 is layout + placeholder.
 * v0.2 adds:
 * - Frame thumbnails
 * - Durations
 * - Markers (Contact/Impact/Hold)
 * - Diff View (frame-to-frame + first<->last loop check)
 */
export default function Timeline({ settings }: Props) {
  return (
    <div className="timeline">
      <div className="timeline__header">
        <div className="timeline__title">Timeline</div>
        <div className="timeline__hint muted">
          Onion: {settings.onionPrev} / {settings.onionNext} · Diff (incl. first ↔ last) next
        </div>
      </div>

      <div className="timeline__body">
        <div className="timeline__placeholder">Frames will appear here (Idle / Walk / Attack).</div>
      </div>
    </div>
  );
}
