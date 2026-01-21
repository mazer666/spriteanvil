import React, { useMemo, useState } from "react";
import { UiSettings } from "../types";

type Props = {
  settings: UiSettings;
  onChangeSettings: (next: UiSettings) => void;
};

/**
 * Right Panel: Tabs (Animation / Layers / Rig / Palette / Export)
 * V0.1: nur UI-Shell + ein paar Settings.
 */
export default function RightPanel({ settings, onChangeSettings }: Props) {
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
              In v0.1 kommen hier: FPS, Tags (idle/walk/attack), Frame Durations.
            </p>

            <div className="card">
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
