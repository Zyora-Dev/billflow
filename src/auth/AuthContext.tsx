import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import api, { setOnUnauthorized, BASE_URL } from '../api/client';
import {
  encryptBlob, decryptBlob, saveStealth as saveStealthBlob, getStoredBlob,
  clearStealth as clearStealthBlob, hasStealth as hasStealthBlob,
  enterStealth as enterStealthSwap, exitStealth as exitStealthSwap,
  isStealthActive as isStealthActiveStored, recordFailure, clearFailures,
  pushStealthToServer, pullStealthFromServer,
  StealthBlob,
} from '../lib/stealth';
import { registerPushTokenWithBackend, unregisterPushToken } from '../lib/push';

interface User {
  id: string;
  email: string;
  role: string;
  org_id?: string;
  employee_id?: number;
  is_private?: boolean;
}

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // stealth
  stealthActive: boolean;
  stealthConfigured: boolean;
  configureStealth: (email: string, password: string, pin: string) => Promise<void>;
  enterStealth: (pin: string) => Promise<void>;
  exitStealth: () => Promise<void>;
  removeStealth: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({} as AuthState);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stealthActive, setStealthActive] = useState(false);
  const [stealthConfigured, setStealthConfigured] = useState(false);

  const refreshStealthFlags = useCallback(async () => {
    setStealthActive(await isStealthActiveStored());
    setStealthConfigured(await hasStealthBlob());
  }, []);

  const logout = useCallback(async () => {
    try { await unregisterPushToken(); } catch {}
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('business_id');
    await SecureStore.deleteItemAsync('stealth_active');
    await SecureStore.deleteItemAsync('stealth_primary');
    setToken(null);
    setUser(null);
    setStealthActive(false);
    await refreshStealthFlags();
  }, [refreshStealthFlags]);

  useEffect(() => {
    setOnUnauthorized(logout);
  }, [logout]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const stored = await SecureStore.getItemAsync('token');
      if (stored) {
        setToken(stored);
        const res = await api.get('/api/auth/me');
        setUser(res.data);
        // Sync server-stored stealth blob into local secure-store (silent best-effort)
        if ((await isStealthActiveStored()) === false) {
          await pullStealthFromServer();
        }
        // Register push token (best-effort)
        registerPushTokenWithBackend().catch(() => {});
      }
    } catch {
      await SecureStore.deleteItemAsync('token');
    } finally {
      await refreshStealthFlags();
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password });
    const { access_token } = res.data;
    await SecureStore.setItemAsync('token', access_token);
    setToken(access_token);
    const me = await api.get('/api/auth/me');
    setUser(me.data);
    // Pull the encrypted shortcut so triple-tap works on this device
    await pullStealthFromServer();
    await refreshStealthFlags();
    // Register push token for this user (best-effort, non-blocking)
    registerPushTokenWithBackend().catch(() => {});
  };

  const register = async (email: string, password: string) => {
    await api.post('/api/auth/register', { email, password });
  };

  // ── stealth ──────────────────────────────────────────────────────────────
  const configureStealth = async (altEmail: string, altPassword: string, pin: string) => {
    if (!altEmail.trim() || !altPassword || !pin) throw new Error('All fields required');
    if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN must be 4–8 digits');
    const r = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: altEmail.trim().toLowerCase(), password: altPassword }),
    });
    if (!r.ok) throw new Error('Invalid email or password');
    const data = await r.json();
    const meR = await fetch(`${BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${data.access_token}` } });
    const me = meR.ok ? await meR.json() : null;
    const blob: StealthBlob = {
      email: data.email,
      token: data.access_token,
      user_id: String(data.user_id ?? me?.id ?? ''),
      business_id: me?.org_id ?? null,
      org_id: me?.org_id ?? null,
    };
    const payload = encryptBlob(pin, blob);
    await saveStealthBlob(payload);
    // Sync to server so the shortcut is available on every device this user logs in on
    await pushStealthToServer(payload);
    await refreshStealthFlags();
  };

  const enterStealth = async (pin: string) => {
    const stored = await getStoredBlob();
    if (!stored) throw new Error('No private account configured');
    let blob: StealthBlob;
    try {
      blob = decryptBlob(pin, stored);
    } catch {
      const fails = await recordFailure();
      if (fails >= 5) {
        await clearStealthBlob();
        await refreshStealthFlags();
        throw new Error('Too many failed attempts. Private account removed for safety.');
      }
      throw new Error(`Wrong PIN. ${5 - fails} attempt${5 - fails === 1 ? '' : 's'} remaining.`);
    }
    await clearFailures();
    const primaryToken = await SecureStore.getItemAsync('token');
    const primaryBiz = await SecureStore.getItemAsync('business_id');
    await enterStealthSwap(blob, primaryToken, primaryBiz);
    setToken(blob.token);
    const me = await api.get('/api/auth/me');
    setUser(me.data);
    await refreshStealthFlags();
  };

  const exitStealth = async () => {
    const restored = await exitStealthSwap();
    if (!restored?.token) {
      await logout();
      return;
    }
    setToken(restored.token);
    const me = await api.get('/api/auth/me');
    setUser(me.data);
    await refreshStealthFlags();
  };

  const removeStealth = async () => {
    if (await isStealthActiveStored()) {
      await exitStealth();
    }
    await clearStealthBlob();
    await pushStealthToServer(null);
    await refreshStealthFlags();
  };

  return (
    <AuthContext.Provider value={{
      token, user, loading, login, register, logout,
      stealthActive, stealthConfigured,
      configureStealth, enterStealth, exitStealth, removeStealth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
