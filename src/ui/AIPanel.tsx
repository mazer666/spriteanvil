import React, { useMemo, useState } from "react";
import { PIXEL_ART_PROMPTS } from "../lib/ai/prompts";
import { AIProviderId, PROVIDERS } from "../lib/ai/providers";
import { decryptKey, loadEncryptedKeys } from "../lib/ai/keys";

type Props = {
  enabled?: boolean;
  canvasSpec?: { width: number; height: number };
  selectionMask?: Uint8Array | null;
  layerPixels?: Uint8ClampedArray | null;
  onInpaint?: (payload: { prompt: string; denoiseStrength: number; promptInfluence: number }) => Promise<string>;
  onImageToImage?: (payload: { prompt: string; denoiseStrength: number; promptInfluence: number }) => Promise<string>;
};

const EMPTY_KEYS: Record<AIProviderId, string> = {
  "openai-dalle3": "",
  "stability-ai": "",
  "hugging-face": "",
  "openrouter": "",
};

export default function AIPanel({
  enabled = false,
  onInpaint,
  onImageToImage,
}: Props) {
  const [userId, setUserId] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<AIProviderId>("openai-dalle3");
  const [selectedPrompt, setSelectedPrompt] = useState(PIXEL_ART_PROMPTS[0]?.prompt ?? "");
  const [customPrompt, setCustomPrompt] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [keys, setKeys] = useState<Record<AIProviderId, string>>(() => ({ ...EMPTY_KEYS }));
  const [denoiseStrength, setDenoiseStrength] = useState(0.6);
  const [promptInfluence, setPromptInfluence] = useState(0.8);

  const providerOptions = useMemo(() => PROVIDERS, []);

/**
 * WHAT: Decrypts your saved API keys using a local passphrase.
 * WHY: We never want to store your private keys (OpenAI, Stability) in plain text.
 * HOW: It loads the "Encrypted" blob from Supabase and runs the decryption algorithm.
 * USE: The "Unlock API Keys" button.
 */
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

/**
 * WHAT: Sends a "Hole" in your image to the AI to be filled.
 * WHY: For removing mistakes or generating new parts of a character based on a text description.
 * HOW: It converts your "Selection" into a mask, sends the image + mask to the AI, and waits for a response.
 * 
 * 🛠️ NOOB CHALLENGE: Can you find the `PIXEL_ART_PROMPTS` file? 
 * How would you add a new "Steampunk" prompt template?
 */
  async function handleInpaint() {
    if (!onInpaint) return;
    setStatus("Preparing inpainting request...");
    try {
      const message = await onInpaint({
        prompt: resolvedPrompt,
        denoiseStrength,
        promptInfluence,
      });
      setStatus(message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Inpainting failed.");
    }
  }

  async function handleImageToImage() {
    if (!onImageToImage) return;
    setStatus("Preparing image-to-image request...");
    try {
      const message = await onImageToImage({
        prompt: resolvedPrompt,
        denoiseStrength,
        promptInfluence,
      });
      setStatus(message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Image-to-image failed.");
    }
  }

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
          <label className="option-row">
            <span>Denoising Strength</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={denoiseStrength}
              onChange={(e) => setDenoiseStrength(Number(e.target.value))}
              disabled={!enabled}
            />
            <span className="mono">{denoiseStrength.toFixed(2)}</span>
          </label>
          <label className="option-row">
            <span>Prompt Influence</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={promptInfluence}
              onChange={(e) => setPromptInfluence(Number(e.target.value))}
              disabled={!enabled}
            />
            <span className="mono">{promptInfluence.toFixed(2)}</span>
          </label>
          <button className="uiBtn uiBtn--full" disabled={!enabled} onClick={handleInpaint}>
            Inpaint Selection
          </button>
          <button className="uiBtn uiBtn--full" disabled={!enabled} onClick={handleImageToImage}>
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
