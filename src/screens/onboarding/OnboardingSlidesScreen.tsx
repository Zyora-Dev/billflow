import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions, Animated, FlatList, TouchableOpacity,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { colors, fontSize, spacing, borderRadius } from '../../theme';

const { width, height } = Dimensions.get('window');
export const ONBOARDING_KEY = 'onboarding_seen';

interface Slide {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bg: string;
  title: string;
  description: string;
  bullets: string[];
}

const SLIDES: Slide[] = [
  {
    key: 'invoicing',
    icon: 'receipt',
    iconColor: '#059669',
    bg: '#D1FAE5',
    title: 'GST Invoices in Seconds',
    description: 'Create professional, GST-compliant invoices and send them on WhatsApp or email instantly.',
    bullets: ['Auto CGST / SGST / IGST', 'Custom branding & QR codes', 'PDF + WhatsApp share'],
  },
  {
    key: 'payments',
    icon: 'wallet',
    iconColor: '#047857',
    bg: '#ECFDF5',
    title: 'Track Every Rupee',
    description: 'Record payments, monitor receivables and payables, and never miss a follow-up.',
    bullets: ['FIFO auto-allocation', 'Customer & vendor ledgers', 'Overdue alerts'],
  },
  {
    key: 'business',
    icon: 'analytics',
    iconColor: '#10B981',
    bg: '#D1FAE5',
    title: 'Run Your Whole Business',
    description: 'Inventory, expenses, employees, GST returns and Tally sync — all in one place.',
    bullets: ['Live stock & expenses', 'Payroll & attendance', 'GSTR-1 / 3B / 2B + Tally'],
  },
];

interface Props {
  onDone: () => void;
}

export default function OnboardingScreen({ onDone }: Props) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);

  const finish = async () => {
    try { await SecureStore.setItemAsync(ONBOARDING_KEY, '1'); } catch {}
    onDone();
  };

  const next = () => {
    if (index < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      finish();
    }
  };

  const skip = () => finish();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.topBar}>
        <Text style={styles.brand}>SpectraBooks</Text>
        {index < SLIDES.length - 1 ? (
          <TouchableOpacity onPress={skip} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.skip}>Skip</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
      </View>

      <Animated.FlatList
        ref={flatRef as any}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        scrollEventThrottle={16}
        renderItem={({ item, index: i }) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const iconScale = scrollX.interpolate({ inputRange, outputRange: [0.6, 1, 0.6], extrapolate: 'clamp' });
          const iconRotate = scrollX.interpolate({ inputRange, outputRange: ['-25deg', '0deg', '25deg'], extrapolate: 'clamp' });
          const titleTranslate = scrollX.interpolate({ inputRange, outputRange: [60, 0, -60], extrapolate: 'clamp' });
          const descOpacity = scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: 'clamp' });
          return (
            <View style={[styles.slide, { width }]}>
              <Animated.View
                style={[
                  styles.iconCircle,
                  { backgroundColor: item.bg, transform: [{ scale: iconScale }, { rotate: iconRotate }] },
                ]}
              >
                <Ionicons name={item.icon} size={84} color={item.iconColor} />
              </Animated.View>
              <Animated.Text style={[styles.title, { transform: [{ translateX: titleTranslate }] }]}>
                {item.title}
              </Animated.Text>
              <Animated.Text style={[styles.description, { opacity: descOpacity }]}>
                {item.description}
              </Animated.Text>
              <Animated.View style={[styles.bulletsWrap, { opacity: descOpacity }]}>
                {item.bullets.map((b, j) => (
                  <View key={j} style={styles.bulletRow}>
                    <View style={[styles.bulletDot, { backgroundColor: item.iconColor }]}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
              </Animated.View>
            </View>
          );
        }}
      />

      <View style={styles.bottomBar}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotScaleX = scrollX.interpolate({ inputRange, outputRange: [1, 3.5, 1], extrapolate: 'clamp' });
            const dotOpacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
            return (
              <Animated.View
                key={i}
                style={[styles.dot, { opacity: dotOpacity, transform: [{ scaleX: dotScaleX }] }]}
              />
            );
          })}
        </View>
        <TouchableOpacity activeOpacity={0.85} onPress={next} style={styles.cta}>
          <Text style={styles.ctaText}>{index === SLIDES.length - 1 ? 'Get Started' : 'Next'}</Text>
          <Ionicons
            name={index === SLIDES.length - 1 ? 'rocket' : 'arrow-forward'}
            size={18}
            color={colors.white}
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ICON_SIZE = Math.min(width * 0.44, 200);
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  topBar: { paddingTop: 56, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: fontSize.lg, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 },
  skip: { fontSize: fontSize.md, color: colors.gray500, fontWeight: '600' },
  slide: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: 32 },
  iconCircle: { width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  title: { fontSize: 26, fontWeight: '800', color: colors.gray900, textAlign: 'center', marginBottom: spacing.md, letterSpacing: 0.2 },
  description: { fontSize: fontSize.md, color: colors.gray600, textAlign: 'center', lineHeight: 22, paddingHorizontal: spacing.md, marginBottom: spacing.xl },
  bulletsWrap: { width: '100%', paddingHorizontal: spacing.md, gap: 12 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bulletDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  bulletText: { fontSize: fontSize.md, color: colors.gray700, fontWeight: '500', flex: 1 },
  bottomBar: { paddingHorizontal: spacing.lg, paddingBottom: 36, paddingTop: spacing.md, gap: spacing.md },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  cta: { backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  ctaText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700', letterSpacing: 0.3 },
});
