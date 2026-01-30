import { supabase } from "../supabase/client";
import { AIProviderId } from "./providers";

export type EncryptedKeyRecord = {
  provider: AIProviderId;
  encrypted: string;
  iv: string;
  salt: string;
};

export async function loadEncryptedKeys(userId: string): Promise<EncryptedKeyRecord[]> {
  const { data, error } = await supabase
    .from("users")
    .select("ai_keys")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const raw = (data as { ai_keys?: EncryptedKeyRecord[] } | null)?.ai_keys ?? [];
  return Array.isArray(raw) ? raw : [];
}

export async function decryptKey(
  record: EncryptedKeyRecord,
  passphrase: string
): Promise<string> {
  const encryptedBytes = base64ToBytes(record.encrypted);
  const iv = base64ToBytes(record.iv);
  const salt = base64ToBytes(record.salt);

  const keyMaterial = await getKeyMaterial(passphrase);
  const key = await deriveKey(keyMaterial, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encryptedBytes
  );

  return new TextDecoder().decode(decrypted);
}

async function getKeyMaterial(passphrase: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
}

async function deriveKey(keyMaterial: CryptoKey, salt: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 120000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
