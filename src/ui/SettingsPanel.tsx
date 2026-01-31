import React from "react";
import { UiSettings } from "../types";
import { Project } from "../lib/supabase/projects";

type Props = {
  settings: UiSettings;
  onChangeSettings: (next: UiSettings) => void;
  onClose: () => void;
  activeProject: Project | null;
  onSaveSnapshot: () => void;
  onReloadSnapshot: () => void;
};

export default function SettingsPanel({
  settings,
  onChangeSettings,
  onClose,
  activeProject,
  onSaveSnapshot,
  onReloadSnapshot,
}: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Workspace Settings</h2>
          <button className="modal-close" onClick={onClose} title="Close">
            ×
          </button>
        </div>
        <div className="modal-body settings-panel">
          <div className="settings-section">
            <h3>Project</h3>
            <div className="settings-actions">
              <button
                className="uiBtn"
                onClick={onSaveSnapshot}
                disabled={!activeProject}
              >
                Save Snapshot
              </button>
              <button
                className="uiBtn"
                onClick={onReloadSnapshot}
                disabled={!activeProject}
              >
                Reload Snapshot
              </button>
            </div>
          </div>

          <div className="settings-section">
            <h3>Display</h3>
            <label className="ui-row">
              <span>Show Grid</span>
              <input
                type="checkbox"
                checked={settings.showGrid}
                onChange={(e) =>
                  onChangeSettings({ ...settings, showGrid: e.target.checked })
                }
              />
            </label>
            <label className="ui-row">
              <span>Onion Skin</span>
              <input
                type="checkbox"
                checked={settings.showOnionSkin}
                onChange={(e) =>
                  onChangeSettings({ ...settings, showOnionSkin: e.target.checked })
                }
              />
            </label>
            <label className="ui-row">
              <span>Background</span>
              <select
                value={settings.backgroundMode}
                onChange={(e) =>
                  onChangeSettings({ ...settings, backgroundMode: e.target.value as any })
                }
              >
                <option value="checker">Checkerboard</option>
                <option value="solidDark">Solid (Dark)</option>
                <option value="solidLight">Solid (Light)</option>
                <option value="greenscreen">Greenscreen</option>
                <option value="bluescreen">Bluescreen</option>
              </select>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
