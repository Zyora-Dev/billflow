import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import api from '../api/client';
import { queueAll, queueRemove, queueUpdate } from '../lib/offline';
import haptic from '../lib/haptics';

interface NetworkContextValue {
  online: boolean;
  pendingCount: number;
  flush: () => Promise<void>;
  flushing: boolean;
}

const NetworkContext = createContext<NetworkContextValue>({
  online: true, pendingCount: 0, flush: async () => {}, flushing: false,
});

export const useNetwork = () => useContext(NetworkContext);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [flushing, setFlushing] = useState(false);
  const wasOffline = useRef(false);

  const refreshCount = useCallback(async () => {
    const q = await queueAll();
    setPendingCount(q.length);
  }, []);

  const flush = useCallback(async () => {
    if (flushing) return;
    const q = await queueAll();
    if (q.length === 0) return;
    setFlushing(true);
    for (const req of q) {
      try {
        await api.request({
          method: req.method,
          url: req.url,
          data: req.data,
          headers: req.headers,
        });
        await queueRemove(req.id);
      } catch (e: any) {
        if (!e.response) break;
        if (e.response.status >= 400 && e.response.status < 500) {
          await queueRemove(req.id);
        } else {
          await queueUpdate(req.id, { retries: req.retries + 1 });
          break;
        }
      }
    }
    await refreshCount();
    setFlushing(false);
  }, [flushing, refreshCount]);

  useEffect(() => {
    refreshCount();
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      const isOnline = state.isConnected !== false;
      setOnline(isOnline);
      if (isOnline && wasOffline.current) {
        haptic.success();
        flush();
      }
      wasOffline.current = !isOnline;
    });
    return () => unsub();
  }, [flush, refreshCount]);

  return (
    <NetworkContext.Provider value={{ online, pendingCount, flush, flushing }}>
      {children}
    </NetworkContext.Provider>
  );
}
