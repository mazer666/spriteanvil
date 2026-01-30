import React from "react";

type Props = {
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onRotate90CW: () => void;
  onRotate90CCW: () => void;
  onRotate180: () => void;
  onScale: (scaleX: number, scaleY: number) => void;
  onRotate: (degrees: number) => void;
};

export default function TransformPanel({
  onFlipHorizontal,
  onFlipVertical,
  onRotate90CW,
  onRotate90CCW,
  onRotate180,
  onScale,
  onRotate,
}: Props) {
  const [scaleX, setScaleX] = React.useState(2);
  const [scaleY, setScaleY] = React.useState(2);
  const [lockAspect, setLockAspect] = React.useState(true);
  const [rotateDegrees, setRotateDegrees] = React.useState(90);

  function handleScaleXChange(value: number) {
    setScaleX(value);
    if (lockAspect) setScaleY(value);
  }

  function handleScaleYChange(value: number) {
    setScaleY(value);
    if (lockAspect) setScaleX(value);
  }

  return (
    <div style={{ padding: '8px' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>
        Transform
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Flip</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={onFlipHorizontal} style={{ flex: 1, padding: '6px', fontSize: '12px' }} title="Flip Horizontal">
            ↔ Horizontal
          </button>
          <button onClick={onFlipVertical} style={{ flex: 1, padding: '6px', fontSize: '12px' }} title="Flip Vertical">
            ↕ Vertical
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Rotate</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          <button onClick={onRotate90CCW} style={{ padding: '6px', fontSize: '12px' }} title="Rotate 90° Counter-Clockwise">
            ↶ 90° CCW
          </button>
          <button onClick={onRotate90CW} style={{ padding: '6px', fontSize: '12px' }} title="Rotate 90° Clockwise">
            ↷ 90° CW
          </button>
          <button onClick={onRotate180} style={{ padding: '6px', fontSize: '12px', gridColumn: 'span 2' }} title="Rotate 180°">
            ↻ 180°
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px', marginTop: '8px' }}>
          <input
            type="number"
            value={rotateDegrees}
            onChange={(e) => setRotateDegrees(parseFloat(e.target.value) || 0)}
            step="90"
            style={{ width: '100%', padding: '4px', background: '#1a1a1a', color: '#fff', border: '1px solid #444' }}
          />
          <button
            onClick={() => onRotate(rotateDegrees)}
            style={{ padding: '6px', fontSize: '12px' }}
            title="Rotate selection (snaps to 90°)"
          >
            Apply
          </button>
        </div>
      </div>

      <div>
        <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Scale</div>

        <div style={{ marginBottom: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={lockAspect}
              onChange={(e) => setLockAspect(e.target.checked)}
            />
            Lock aspect ratio
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div>
            <label style={{ fontSize: '11px', color: '#aaa', display: 'block', marginBottom: '2px' }}>
              Width: {scaleX}x
            </label>
            <input
              type="number"
              value={scaleX}
              onChange={(e) => handleScaleXChange(parseFloat(e.target.value) || 1)}
              min="0.1"
              max="8"
              step="0.1"
              style={{ width: '100%', padding: '4px', background: '#1a1a1a', color: '#fff', border: '1px solid #444' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#aaa', display: 'block', marginBottom: '2px' }}>
              Height: {scaleY}x
            </label>
            <input
              type="number"
              value={scaleY}
              onChange={(e) => handleScaleYChange(parseFloat(e.target.value) || 1)}
              min="0.1"
              max="8"
              step="0.1"
              disabled={lockAspect}
              style={{ width: '100%', padding: '4px', background: '#1a1a1a', color: '#fff', border: '1px solid #444' }}
            />
          </div>
        </div>

        <button
          onClick={() => onScale(scaleX, scaleY)}
          style={{ width: '100%', padding: '8px', fontSize: '12px' }}
        >
          Apply Scale
        </button>
      </div>
    </div>
  );
}
