import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, fontSize } from '../theme';
import haptic from '../lib/haptics';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  description?: string;
}

interface ToastContextValue {
  show: (message: string, opts?: { type?: ToastType; description?: string; duration?: number }) => void;
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;
  warning: (message: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  show: () => {}, success: () => {}, error: () => {}, info: () => {}, warning: () => {},
});

export const useToast = () => useContext(ToastContext);

const ICONS: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'close-circle',
  info: 'information-circle',
  warning: 'warning',
};

const COLORS: Record<ToastType, string> = {
  success: colors.success,
  error: colors.danger,
  info: colors.info,
  warning: colors.warning,
};

interface ToastViewProps { toast: Toast; onClose: (id: number) => void; offset: number; }

function ToastView({ toast, onClose, offset }: ToastViewProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -100, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => onClose(toast.id));
  }, [onClose, toast.id]);

  useEffect(() => {
    const timer = setTimeout(dismiss, 3500);
    return () => clearTimeout(timer);
  }, [dismiss]);

  const accent = COLORS[toast.type];

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          top: insets.top + 8 + offset,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={[styles.iconWrap, { backgroundColor: accent + '15' }]}>
        <Ionicons name={ICONS[toast.type]} size={20} color={accent} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{toast.message}</Text>
        {toast.description ? <Text style={styles.desc} numberOfLines={2}>{toast.description}</Text> : null}
      </View>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const show = useCallback((message: string, opts?: { type?: ToastType; description?: string; duration?: number }) => {
    const type = opts?.type || 'info';
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, type, message, description: opts?.description }]);
    if (type === 'success') haptic.success();
    else if (type === 'error') haptic.error();
    else if (type === 'warning') haptic.warning();
  }, []);

  const close = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    show,
    success: (m, d) => show(m, { type: 'success', description: d }),
    error: (m, d) => show(m, { type: 'error', description: d }),
    info: (m, d) => show(m, { type: 'info', description: d }),
    warning: (m, d) => show(m, { type: 'warning', description: d }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {toasts.map((t, i) => (
          <ToastView key={t.id} toast={t} onClose={close} offset={i * 78} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    paddingLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
    overflow: 'hidden',
    minHeight: 64,
  },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  title: { fontSize: fontSize.sm, fontWeight: '700', color: colors.gray900 },
  desc: { fontSize: fontSize.xs, color: colors.gray600, marginTop: 2 },
});
