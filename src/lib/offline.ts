import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'cache:';
const QUEUE_KEY = 'offline:queue';

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
}

export async function cacheGet<T = any>(key: string, maxAgeMs = 1000 * 60 * 60 * 24): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > maxAgeMs) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export async function cacheSet<T = any>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {}
}

export async function cacheClear(prefix?: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const target = keys.filter((k) => k.startsWith(PREFIX + (prefix || '')));
    if (target.length) await AsyncStorage.multiRemove(target);
  } catch {}
}

// Offline queue for write operations (POST/PUT/DELETE)
export interface QueuedRequest {
  id: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  data?: any;
  headers?: Record<string, string>;
  createdAt: number;
  retries: number;
  label?: string;
}

export async function queueAdd(req: Omit<QueuedRequest, 'id' | 'createdAt' | 'retries'>): Promise<QueuedRequest> {
  const queue = await queueAll();
  const item: QueuedRequest = {
    ...req,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    retries: 0,
  };
  queue.push(item);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return item;
}

export async function queueAll(): Promise<QueuedRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function queueRemove(id: string): Promise<void> {
  const queue = await queueAll();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.filter((q) => q.id !== id)));
}

export async function queueUpdate(id: string, patch: Partial<QueuedRequest>): Promise<void> {
  const queue = await queueAll();
  const idx = queue.findIndex((q) => q.id === id);
  if (idx >= 0) {
    queue[idx] = { ...queue[idx], ...patch };
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
}

export async function queueClear(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
