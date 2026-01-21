import React, { useMemo, useState } from "react";
import { UiSettings } from "../types";

type Props = {
  settings: UiSettings;
  onChangeSettings: (next: UiSettings) => void;

  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

export default function RightPanel({
  settings,
  onChangeSettings,
  onUndo,
  onRedo,
  canUndo,
  canRedo
}: Props) {
  const tabs = useMemo(() => ["Animation", "Layers", "Rig", "Palette", "Export"] as const, []);
  const [active, setActive] = useState<(typeof tabs)[number]>("Animation");

  return (
    <div className="rightpanel">
      <div className="rightpanel__tabs">
        {tabs.map((t) => (
          <button
            key={t}
            className={"tab" + (active === t ? " tab--active" : "")}
            onClick={() => setActive(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="rightpanel__content">
        {active === "Animation" && (
          <section>
            <h3>Animation</h3>
            <p className="muted">
              Next steps: FPS, Tags (idle/walk/attack), Frame durations, Markers, Diff view (incl. first ↔ last).
            </p>

            <div className="card">
              <div className="card__row">
                <span>Undo / Redo</span>
                <div className="ui-row">
                  <button className="uiBtn" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
                    Undo
                  </button>
                  <button className="uiBtn" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
                    Redo
                  </button>
                </div>
              </div>

              <div className="card__row">
                <span>Onion Skin</span>
                <label className="ui-row">
                  <input
                    type="checkbox"
                    checked={settings.showOnionSkin}
                    onChange={(e) =>
                      onChangeSettings({ ...settings, showOnionSkin: e.target.checked })
                    }
                  />
                  <span>Enabled</span>
                </label>
              </div>

              <div className="card__row">
                <span>Prev / Next</span>
                <div className="ui-row">
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={settings.onionPrev}
                    onChange={(e) =>
                      onChangeSettings({ ...settings, onionPrev: Number(e.target.value) })
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={settings.onionNext}
                    onChange={(e) =>
                      onChangeSettings({ ...settings, onionNext: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {active !== "Animation" && (
          <section>
            <h3>{active}</h3>
            <p className="muted">Panel shell only (we fill this step by step).</p>
          </section>
        )}
      </div>
    </div>
  );
}
