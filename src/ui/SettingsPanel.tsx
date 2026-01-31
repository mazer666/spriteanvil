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

/**
 * src/ui/SettingsPanel.tsx
 * -----------------------------------------------------------------------------
 * ## SETTINGS PANEL (Noob Guide)
 * 
 * This is the "Engine Room" where you tweak how the app looks and feels.
 * 
 * ## JARGON GLOSSARY
 * 1. CHECKERBOARD: The classic gray-and-white pattern that represents "Transparency".
 * 2. GRID SIZE: How many pixels are in one "Block".
 * 3. GREENSCREEN: Setting the background to a bright color to make it easier to
 *    remove later (common in video editing).
 */
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

            {settings.showGrid && (
              <label className="ui-row">
                <span>Grid Size (px)</span>
                <input
                  type="number"
                  min="1"
                  max="128"
                  value={settings.gridSize}
                  onChange={(e) =>
                    onChangeSettings({ ...settings, gridSize: Math.max(1, parseInt(e.target.value) || 1) })
                  }
                />
              </label>
            )}

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
                <option value="solidCustom">Custom Color</option>
              </select>
            </label>

            {settings.backgroundMode === "solidCustom" && (
              <label className="ui-row">
                <span>Color</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={settings.customBackgroundColor || "#000000"}
                    onChange={(e) =>
                      onChangeSettings({ ...settings, customBackgroundColor: e.target.value })
                    }
                    style={{ padding: 0, width: '32px', height: '32px', border: 'none', background: 'none' }}
                  />
                  <input
                    type="text"
                    value={settings.customBackgroundColor || "#000000"}
                    onChange={(e) =>
                      onChangeSettings({ ...settings, customBackgroundColor: e.target.value })
                    }
                    style={{ width: '80px' }}
                  />
                </div>
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
