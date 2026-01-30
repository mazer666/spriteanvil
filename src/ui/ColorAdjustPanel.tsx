import React, { useState } from "react";

type Props = {
  onAdjustHue: (hueShift: number) => void;
  onAdjustSaturation: (saturationDelta: number) => void;
  onAdjustBrightness: (brightnessDelta: number) => void;
  onPreviewAdjust: (preview: { hueShift: number; saturationDelta: number; brightnessDelta: number }) => void;
  onClearPreview: () => void;
  onInvert: () => void;
  onDesaturate: () => void;
  onPosterize: (levels: number) => void;
};

export default function ColorAdjustPanel({
  onAdjustHue,
  onAdjustSaturation,
  onAdjustBrightness,
  onPreviewAdjust,
  onClearPreview,
  onInvert,
  onDesaturate,
  onPosterize,
}: Props) {
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [brightness, setBrightness] = useState(0);
  const [posterizeLevels, setPosterizeLevels] = useState(4);

  React.useEffect(() => {
    onPreviewAdjust({
      hueShift: hue,
      saturationDelta: saturation,
      brightnessDelta: brightness,
    });
  }, [hue, saturation, brightness, onPreviewAdjust]);

  React.useEffect(() => {
    return () => onClearPreview();
  }, [onClearPreview]);

  return (
    <div style={{ padding: '8px' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>
        Color Adjustments
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>
          Hue Shift: {hue}°
        </label>
        <input
          type="range"
          min="-180"
          max="180"
          value={hue}
          onChange={(e) => setHue(parseInt(e.target.value))}
          style={{ width: '100%' }}
        />
        <button
          onClick={() => {
            onAdjustHue(hue);
            setHue(0);
          }}
          style={{ width: '100%', padding: '6px', fontSize: '12px', marginTop: '4px' }}
          disabled={hue === 0}
        >
          Apply Hue Shift
        </button>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>
          Saturation: {saturation > 0 ? '+' : ''}{saturation}
        </label>
        <input
          type="range"
          min="-100"
          max="100"
          value={saturation}
          onChange={(e) => setSaturation(parseInt(e.target.value))}
          style={{ width: '100%' }}
        />
        <button
          onClick={() => {
            onAdjustSaturation(saturation);
            setSaturation(0);
          }}
          style={{ width: '100%', padding: '6px', fontSize: '12px', marginTop: '4px' }}
          disabled={saturation === 0}
        >
          Apply Saturation
        </button>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>
          Brightness: {brightness > 0 ? '+' : ''}{brightness}
        </label>
        <input
          type="range"
          min="-100"
          max="100"
          value={brightness}
          onChange={(e) => setBrightness(parseInt(e.target.value))}
          style={{ width: '100%' }}
        />
        <button
          onClick={() => {
            onAdjustBrightness(brightness);
            setBrightness(0);
          }}
          style={{ width: '100%', padding: '6px', fontSize: '12px', marginTop: '4px' }}
          disabled={brightness === 0}
        >
          Apply Brightness
        </button>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Quick Effects</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          <button onClick={onInvert} style={{ padding: '6px', fontSize: '12px' }} title="Invert all colors">
            Invert
          </button>
          <button onClick={onDesaturate} style={{ padding: '6px', fontSize: '12px' }} title="Convert to grayscale">
            Grayscale
          </button>
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>
          Posterize Levels: {posterizeLevels}
        </label>
        <input
          type="range"
          min="2"
          max="16"
          value={posterizeLevels}
          onChange={(e) => setPosterizeLevels(parseInt(e.target.value))}
          style={{ width: '100%', marginBottom: '4px' }}
        />
        <button
          onClick={() => onPosterize(posterizeLevels)}
          style={{ width: '100%', padding: '6px', fontSize: '12px' }}
        >
          Apply Posterize
        </button>
      </div>
    </div>
  );
}
