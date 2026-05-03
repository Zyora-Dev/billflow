// Stealth (private) account storage for mobile.
// Encrypts a second-account credential blob with a user-chosen PIN
// using PBKDF2 (SHA-256, 200k iterations) + AES-256-CBC (crypto-js, pure JS).
// Ciphertext is stored in expo-secure-store; PIN is never persisted.

import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'crypto-js';

const BLOB_KEY = 'stealth_blob';
const ACTIVE_KEY = 'stealth_active';            // '1' while signed in as stealth
const PRIMARY_BACKUP_KEY = 'stealth_primary';   // backup of primary token + business_id
const FAILS_KEY = 'stealth_fails';

export interface StealthBlob {
  email: string;
  token: string;
  user_id: string;
  business_id: string | null;
  org_id?: string | null;
}

// ── crypto helpers ─────────────────────────────────────────────────────────
function deriveKey(pin: string, salt: CryptoJS.lib.WordArray): CryptoJS.lib.WordArray {
  return CryptoJS.PBKDF2(pin, salt, { keySize: 256 / 32, iterations: 200_000, hasher: CryptoJS.algo.SHA256 });
}

export function encryptBlob(pin: string, blob: StealthBlob): string {
  const salt = CryptoJS.lib.WordArray.random(16);
  const iv = CryptoJS.lib.WordArray.random(16);
  const key = deriveKey(pin, salt);
  const ct = CryptoJS.AES.encrypt(JSON.stringify(blob), key, {
    iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7,
  });
  return JSON.stringify({
    s: salt.toString(CryptoJS.enc.Base64),
    i: iv.toString(CryptoJS.enc.Base64),
    c: ct.toString(),
    v: 1,
  });
}

export function decryptBlob(pin: string, payload: string): StealthBlob {
  const obj = JSON.parse(payload);
  const salt = CryptoJS.enc.Base64.parse(obj.s);
  const iv = CryptoJS.enc.Base64.parse(obj.i);
  const key = deriveKey(pin, salt);
  const dec = CryptoJS.AES.decrypt(obj.c, key, {
    iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7,
  });
  const txt = dec.toString(CryptoJS.enc.Utf8);
  if (!txt) throw new Error('Invalid PIN');
  return JSON.parse(txt);
}

// ── storage api ────────────────────────────────────────────────────────────
export async function hasStealth(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(BLOB_KEY);
  return !!v;
}

export async function saveStealth(payload: string) {
  await SecureStore.setItemAsync(BLOB_KEY, payload);
  await SecureStore.deleteItemAsync(FAILS_KEY);
}

export async function getStoredBlob(): Promise<string | null> {
  return await SecureStore.getItemAsync(BLOB_KEY);
}

export async function clearStealth() {
  await SecureStore.deleteItemAsync(BLOB_KEY);
  await SecureStore.deleteItemAsync(FAILS_KEY);
}

export async function recordFailure(): Promise<number> {
  const cur = parseInt((await SecureStore.getItemAsync(FAILS_KEY)) || '0', 10) + 1;
  await SecureStore.setItemAsync(FAILS_KEY, String(cur));
  return cur;
}
export async function clearFailures() { await SecureStore.deleteItemAsync(FAILS_KEY); }

// ── server sync ────────────────────────────────────────────────────────────
// Server stores ONLY ciphertext (cannot decrypt). Lets the same private-account
// shortcut work across devices without re-configuring.
import { BASE_URL } from '../api/client';

export async function pushStealthToServer(payload: string | null): Promise<void> {
  const token = await SecureStore.getItemAsync('token');
  if (!token) return;
  try {
    if (payload === null) {
      await fetch(`${BASE_URL}/api/auth/stealth-blob`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } else {
      await fetch(`${BASE_URL}/api/auth/stealth-blob`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ blob: payload }),
      });
    }
  } catch {}
}

export async function pullStealthFromServer(): Promise<void> {
  const token = await SecureStore.getItemAsync('token');
  if (!token) return;
  try {
    const r = await fetch(`${BASE_URL}/api/auth/stealth-blob`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return;
    const data = await r.json();
    if (data?.blob && typeof data.blob === 'string') {
      await SecureStore.setItemAsync(BLOB_KEY, data.blob);
    } else if ((await SecureStore.getItemAsync(ACTIVE_KEY)) !== '1') {
      // server has no blob and we're not currently in stealth — clear local mirror
      await SecureStore.deleteItemAsync(BLOB_KEY);
    }
  } catch {}
}

// ── stealth session swap ───────────────────────────────────────────────────
export async function isStealthActive(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ACTIVE_KEY)) === '1';
}

export async function enterStealth(blob: StealthBlob, primaryToken: string | null, primaryBusinessId: string | null) {
  // Back up primary creds (token + business_id only — user/email come from /me)
  await SecureStore.setItemAsync(
    PRIMARY_BACKUP_KEY,
    JSON.stringify({ token: primaryToken, business_id: primaryBusinessId })
  );
  // Swap to stealth token
  await SecureStore.setItemAsync('token', blob.token);
  if (blob.business_id) await SecureStore.setItemAsync('business_id', blob.business_id);
  else await SecureStore.deleteItemAsync('business_id');
  await SecureStore.setItemAsync(ACTIVE_KEY, '1');
}

export async function exitStealth(): Promise<{ token: string | null; business_id: string | null } | null> {
  const raw = await SecureStore.getItemAsync(PRIMARY_BACKUP_KEY);
  if (!raw) return null;
  let parsed: { token: string | null; business_id: string | null };
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (parsed.token) await SecureStore.setItemAsync('token', parsed.token);
  else await SecureStore.deleteItemAsync('token');
  if (parsed.business_id) await SecureStore.setItemAsync('business_id', parsed.business_id);
  else await SecureStore.deleteItemAsync('business_id');
  await SecureStore.deleteItemAsync(PRIMARY_BACKUP_KEY);
  await SecureStore.deleteItemAsync(ACTIVE_KEY);
  return parsed;
}
