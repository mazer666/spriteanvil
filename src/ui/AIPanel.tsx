import React, { useMemo, useState } from "react";
import { PIXEL_ART_PROMPTS } from "../lib/ai/prompts";
import { AIProviderId, PROVIDERS } from "../lib/ai/providers";
import { decryptKey, loadEncryptedKeys } from "../lib/ai/keys";

type Props = {
  enabled?: boolean;
};

const EMPTY_KEYS: Record<AIProviderId, string> = {
  "openai-dalle3": "",
  "stability-ai": "",
  "hugging-face": "",
};

export default function AIPanel({ enabled = false }: Props) {
  const [userId, setUserId] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<AIProviderId>("openai-dalle3");
  const [selectedPrompt, setSelectedPrompt] = useState(PIXEL_ART_PROMPTS[0]?.prompt ?? "");
  const [customPrompt, setCustomPrompt] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [keys, setKeys] = useState<Record<AIProviderId, string>>(() => ({ ...EMPTY_KEYS }));

  const providerOptions = useMemo(() => PROVIDERS, []);

  async function handleUnlockKeys() {
    if (!userId || !passphrase) {
      setStatus("Enter user ID and passphrase.");
      return;
    }
    setStatus("Loading encrypted keys...");
    try {
      const encrypted = await loadEncryptedKeys(userId);
      const nextKeys: Record<AIProviderId, string> = { ...EMPTY_KEYS };
      for (const record of encrypted) {
        nextKeys[record.provider] = await decryptKey(record, passphrase);
      }
      setKeys(nextKeys);
      setStatus("Keys unlocked.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to unlock keys.");
    }
  }

  const resolvedPrompt = customPrompt.trim() ? customPrompt : selectedPrompt;

  return (
    <div className="panel">
      <div className="panel__header">
        <div className="panel__title">AI Tools</div>
        {!enabled && <span className="panel__badge">Coming Soon</span>}
      </div>

      <div className="panel__body">
        <div className="option-group">
          <div className="option-label">Provider Setup</div>
          <input
            className="uiInput"
            type="text"
            placeholder="User ID"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
          <input
            className="uiInput"
            type="password"
            placeholder="Passphrase"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
          <button className="uiBtn uiBtn--full" onClick={handleUnlockKeys} disabled={!enabled}>
            Unlock API Keys
          </button>
          {status && <div className="muted" style={{ fontSize: "11px" }}>{status}</div>}
        </div>

        <div className="option-group">
          <div className="option-label">Prompt Templates</div>
          <select
            className="uiInput"
            value={selectedPrompt}
            onChange={(e) => setSelectedPrompt(e.target.value)}
          >
            {PIXEL_ART_PROMPTS.map((template) => (
              <option key={template.label} value={template.prompt}>
                {template.label}
              </option>
            ))}
          </select>
          <textarea
            className="uiInput"
            rows={4}
            placeholder="Custom prompt"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
          />
          <div className="muted" style={{ fontSize: "11px" }}>
            Selected prompt: {resolvedPrompt.slice(0, 120)}
            {resolvedPrompt.length > 120 ? "…" : ""}
          </div>
        </div>

        <div className="option-group">
          <div className="option-label">Provider</div>
          <select
            className="uiInput"
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value as AIProviderId)}
          >
            {providerOptions.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
          <div className="muted" style={{ fontSize: "11px" }}>
            API key {keys[selectedProvider] ? "loaded" : "not loaded"}.
          </div>
        </div>

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
