import React from "react";

type Props = {
  enabled?: boolean;
};

export default function AIPanel({ enabled = false }: Props) {
  return (
    <div className="panel">
      <div className="panel__header">
        <div className="panel__title">AI Tools</div>
        {!enabled && <span className="panel__badge">Coming Soon</span>}
      </div>

      <div className="panel__body">
        <div className="option-group">
          <div className="option-label">AI Generation</div>
          <button className="uiBtn uiBtn--full" disabled={!enabled}>
            Generate Sprite from Text
          </button>
          <button className="uiBtn uiBtn--full" disabled={!enabled}>
            Generate Variations
          </button>
          <button className="uiBtn uiBtn--full" disabled={!enabled}>
            Upscale Sprite
          </button>
        </div>

        <div className="option-group">
          <div className="option-label">AI Editing</div>
          <button className="uiBtn uiBtn--full" disabled={!enabled}>
            Inpaint Selection
          </button>
          <button className="uiBtn uiBtn--full" disabled={!enabled}>
            Remove Background
          </button>
          <button className="uiBtn uiBtn--full" disabled={!enabled}>
            Auto-Outline
          </button>
        </div>

        <div className="option-group">
          <div className="option-label">AI Animation</div>
          <button className="uiBtn uiBtn--full" disabled={!enabled}>
            Generate In-between Frames
          </button>
          <button className="uiBtn uiBtn--full" disabled={!enabled}>
            Animate Still Image
          </button>
        </div>

        {!enabled && (
          <div className="ai-coming-soon">
            <div className="ai-coming-soon__icon">🤖</div>
            <div className="ai-coming-soon__title">AI Features Coming Soon</div>
            <div className="ai-coming-soon__text">
              Powerful AI tools for sprite generation, editing, and animation
              will be available in a future update.
            </div>
            <div className="ai-coming-soon__features">
              <div className="feature-item">✨ Text-to-sprite generation</div>
              <div className="feature-item">🎨 Intelligent inpainting</div>
              <div className="feature-item">🎬 Auto frame interpolation</div>
              <div className="feature-item">🔮 Style transfer</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
