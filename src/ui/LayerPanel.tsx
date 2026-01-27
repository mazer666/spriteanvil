import React, { useState } from "react";

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'add' | 'subtract' | 'darken' | 'lighten' | 'difference' | 'exclusion';

export type LayerData = {
  id: string;
  name: string;
  opacity: number;
  blend_mode: BlendMode;
  is_visible: boolean;
  is_locked: boolean;
};

type Props = {
  layers: LayerData[];
  activeLayerId: string | null;
  onSelectLayer: (id: string) => void;
  onCreateLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onDuplicateLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onUpdateOpacity: (id: string, opacity: number) => void;
  onUpdateBlendMode: (id: string, mode: BlendMode) => void;
  onRenameLayer: (id: string, name: string) => void;
  onReorderLayers: (fromIndex: number, toIndex: number) => void;
  onMergeDown: (id: string) => void;
};

export default function LayerPanel({
  layers,
  activeLayerId,
  onSelectLayer,
  onCreateLayer,
  onDeleteLayer,
  onDuplicateLayer,
  onToggleVisibility,
  onToggleLock,
  onUpdateOpacity,
  onUpdateBlendMode,
  onRenameLayer,
  onReorderLayers,
  onMergeDown,
}: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const activeLayer = layers.find(l => l.id === activeLayerId);

  function startRename(layer: LayerData) {
    setRenamingId(layer.id);
    setRenameValue(layer.name);
  }

  function finishRename() {
    if (renamingId && renameValue.trim()) {
      onRenameLayer(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: '13px' }}>
      <div style={{ padding: '8px', borderBottom: '1px solid #333', fontWeight: 'bold' }}>
        Layers
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
        {layers.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
            No layers. Click + to add one.
          </div>
        ) : (
          layers.map((layer, idx) => (
            <div
              key={layer.id}
              style={{
                marginBottom: '2px',
                padding: '6px',
                background: layer.id === activeLayerId ? '#3a3a3a' : '#2a2a2a',
                border: '1px solid ' + (layer.id === activeLayerId ? '#555' : '#333'),
                borderRadius: '3px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onClick={() => onSelectLayer(layer.id)}
            >
              <button
                style={{ width: '20px', height: '20px', padding: 0, fontSize: '12px' }}
                onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                title={layer.is_visible ? 'Hide layer' : 'Show layer'}
              >
                {layer.is_visible ? '👁' : '🚫'}
              </button>

              <button
                style={{ width: '20px', height: '20px', padding: 0, fontSize: '12px' }}
                onClick={(e) => { e.stopPropagation(); onToggleLock(layer.id); }}
                title={layer.is_locked ? 'Unlock layer' : 'Lock layer'}
              >
                {layer.is_locked ? '🔒' : '🔓'}
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                {renamingId === layer.id ? (
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={finishRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') finishRename();
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    autoFocus
                    style={{ width: '100%', padding: '2px 4px', background: '#111', color: '#fff', border: '1px solid #555' }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div
                    onDoubleClick={(e) => { e.stopPropagation(); startRename(layer); }}
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {layer.name}
                  </div>
                )}
              </div>

              <button
                style={{ width: '24px', height: '24px', padding: 0, fontSize: '11px' }}
                onClick={(e) => { e.stopPropagation(); onDuplicateLayer(layer.id); }}
                title="Duplicate layer"
              >
                ⎘
              </button>

              <button
                style={{ width: '24px', height: '24px', padding: 0, fontSize: '11px' }}
                onClick={(e) => { e.stopPropagation(); onDeleteLayer(layer.id); }}
                title="Delete layer"
                disabled={layers.length === 1}
              >
                🗑
              </button>
            </div>
          ))
        )}
      </div>

      {activeLayer && (
        <div style={{ padding: '8px', borderTop: '1px solid #333', background: '#252525' }}>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', color: '#aaa' }}>
              Opacity: {Math.round(activeLayer.opacity * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={activeLayer.opacity * 100}
              onChange={(e) => onUpdateOpacity(activeLayer.id, parseInt(e.target.value) / 100)}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', color: '#aaa' }}>
              Blend Mode
            </label>
            <select
              value={activeLayer.blend_mode}
              onChange={(e) => onUpdateBlendMode(activeLayer.id, e.target.value as BlendMode)}
              style={{ width: '100%', padding: '4px', background: '#1a1a1a', color: '#fff', border: '1px solid #444' }}
            >
              <option value="normal">Normal</option>
              <option value="multiply">Multiply</option>
              <option value="screen">Screen</option>
              <option value="overlay">Overlay</option>
              <option value="add">Add</option>
              <option value="subtract">Subtract</option>
              <option value="darken">Darken</option>
              <option value="lighten">Lighten</option>
              <option value="difference">Difference</option>
              <option value="exclusion">Exclusion</option>
            </select>
          </div>

          <button
            onClick={() => onMergeDown(activeLayer.id)}
            disabled={layers.indexOf(activeLayer) === layers.length - 1}
            style={{ width: '100%', padding: '6px', fontSize: '12px' }}
            title="Merge layer with layer below"
          >
            Merge Down
          </button>
        </div>
      )}

      <div style={{ padding: '8px', borderTop: '1px solid #333', display: 'flex', gap: '4px' }}>
        <button onClick={onCreateLayer} style={{ flex: 1, padding: '8px' }} title="New layer">
          + New Layer
        </button>
      </div>
    </div>
  );
}
