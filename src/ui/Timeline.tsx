import React from "react";
import { UiSettings } from "../types";

type Props = {
  settings: UiSettings;
  onChangeSettings: (next: UiSettings) => void;
};

/**
 * Timeline (unten): v0.1 nur Layout + Platzhalter.
 * v0.2 kommt:
 * - Frame Thumbnails
 * - Durations
 * - Markers (Contact/Impact/Hold)
 * - Diff View (inkl. first<->last)
 */
export default function Timeline({ settings }: Props) {
  return (
    <div className="timeline">
      <div className="timeline__header">
        <div className="timeline__title">Timeline</div>
        <div className="timeline__hint muted">
          (v0.2) Markers + Diff View (incl. first ↔ last)
        </div>
      </div>

      <div className="timeline__body">
        <div className="timeline__placeholder">
          Frames will appear here. (Idle/Walk/Attack)
        </div>
      </div>
    </div>
  );
}
