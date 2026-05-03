import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, spacing, borderRadius } from '../theme';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Pastel background tint for the icon disc */
  tint?: string;
  /** Optional accent color for the disc icon (defaults to primary) */
  iconColor?: string;
}

export default function EmptyState({
  icon = 'document-text-outline',
  title,
  subtitle,
  actionLabel,
  onAction,
  tint = colors.primary + '12',
  iconColor = colors.primary,
}: Props) {
  const float = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(translate, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const y = float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const ringScale = float.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });

  return (
    <Animated.View style={[styles.container, { opacity: fade, transform: [{ translateY: translate }] }]}>
      <View style={styles.discWrap}>
        <Animated.View style={[styles.ringOuter, { transform: [{ scale: ringScale }], backgroundColor: tint }]} />
        <Animated.View style={[styles.ringMid, { backgroundColor: tint, opacity: 0.6 }]} />
        <Animated.View style={[styles.disc, { backgroundColor: tint, transform: [{ translateY: y }] }]}>
          <Ionicons name={icon} size={56} color={iconColor} />
        </Animated.View>
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.btnText}>{actionLabel}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  discWrap: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  ringOuter: { position: 'absolute', width: 160, height: 160, borderRadius: 80, opacity: 0.35 },
  ringMid: { position: 'absolute', width: 124, height: 124, borderRadius: 62 },
  disc: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: colors.gray800, textAlign: 'center' },
  subtitle: { fontSize: fontSize.sm, color: colors.gray500, marginTop: 6, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.lg, backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 11, borderRadius: borderRadius.md, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  btnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '700' },
});
