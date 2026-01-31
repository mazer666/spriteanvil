/**
 * src/lib/ai/keys.ts
 * -----------------------------------------------------------------------------
 * ## AI SECURITY (Noob Guide)
 * 
 * This file is the "Vault". It handles encrypting and decrypting 
 * your private AI API keys.
 * 
 * ## JARGON GLOSSARY
 * 1. AES-GCM: A standard way to encrypt data that also checks if the data 
 *    was tampered with.
 * 2. IV (Initialization Vector): A random "starting number" added to encryption.
 *    Even if you encrypt the same key twice, it looks different because of the IV.
 * 3. SALT: A random piece of data added to your passphrase to make it harder 
 *    for hackers to guess via "Rainbow Tables" (pre-computed lists).
 * 4. DERIVE: Creating a formal "Crypto Key" from a simple "Passphrase" string.
 * 
 * ## VAR TRACE
 * ...
 */
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
  const encryptedBytes = base64ToArrayBuffer(record.encrypted);
  const iv = base64ToArrayBuffer(record.iv);
  const salt = base64ToArrayBuffer(record.salt);

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

async function deriveKey(keyMaterial: CryptoKey, salt: ArrayBuffer): Promise<CryptoKey> {
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

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const binary = atob(value);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return buffer;
}
