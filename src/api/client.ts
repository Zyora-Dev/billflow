import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';
import { cacheGet, cacheSet, queueAdd } from '../lib/offline';

const BASE_URL = 'https://books.spectrasaas.in';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Auth interceptor
api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Send stealth header when private mode is active
    const stealthActive = await SecureStore.getItemAsync('stealth_active');
    if (stealthActive === '1') {
      config.headers['X-Stealth'] = '1';
    }
  } catch {}
  return config;
});

// 401 handler - will be set by AuthContext
let onUnauthorized: (() => void) | null = null;
export const setOnUnauthorized = (cb: () => void) => {
  onUnauthorized = cb;
};

const cacheKeyFor = (config: InternalAxiosRequestConfig) => {
  const params = config.params ? JSON.stringify(config.params) : '';
  return `${config.method?.toUpperCase()}:${config.url}:${params}`;
};

const isNetworkError = (e: AxiosError) =>
  !e.response && (e.code === 'ECONNABORTED' || e.code === 'ERR_NETWORK' || e.message?.includes('Network'));

api.interceptors.response.use(
  async (res) => {
    // Cache GETs
    if (res.config.method?.toLowerCase() === 'get') {
      try { await cacheSet(cacheKeyFor(res.config as InternalAxiosRequestConfig), res.data); } catch {}
    }
    return res;
  },
  async (error: AxiosError) => {
    if (error.response?.status === 401 && onUnauthorized) {
      onUnauthorized();
      return Promise.reject(error);
    }
    const config = error.config as InternalAxiosRequestConfig | undefined;
    if (config && isNetworkError(error)) {
      // Confirm we're actually offline before queueing
      const netState = await NetInfo.fetch().catch(() => null);
      const trulyOffline = netState ? (netState.isConnected === false || netState.isInternetReachable === false) : false;
      const method = config.method?.toLowerCase();
      // Serve cached GET if available
      if (method === 'get') {
        const cached = await cacheGet(cacheKeyFor(config));
        if (cached !== null) {
          return Promise.resolve({
            data: cached,
            status: 200,
            statusText: 'OK (cached)',
            headers: {},
            config,
            request: undefined,
            __cached: true,
          } as any);
        }
      }
      // Queue mutating requests ONLY when truly offline
      if (trulyOffline && method && ['post', 'put', 'patch', 'delete'].includes(method)) {
        // Skip queueing multipart/form-data (file uploads) — they're complex to serialize
        const ct = (config.headers?.['Content-Type'] || config.headers?.['content-type'] || '') as string;
        if (!ct.includes('multipart')) {
          try {
            await queueAdd({
              method: method.toUpperCase() as any,
              url: config.url || '',
              data: config.data ? (typeof config.data === 'string' ? JSON.parse(config.data) : config.data) : undefined,
              label: `${method.toUpperCase()} ${config.url}`,
            });
            return Promise.resolve({
              data: { queued: true, message: 'Saved offline. Will sync when online.' },
              status: 202,
              statusText: 'Queued',
              headers: {},
              config,
              request: undefined,
              __queued: true,
            } as any);
          } catch {}
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
export { BASE_URL };
