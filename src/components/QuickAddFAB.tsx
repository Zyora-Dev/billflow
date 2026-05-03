import React, { useRef, useState, useEffect, createContext, useContext, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, Modal, TouchableWithoutFeedback, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, spacing } from '../theme';
import haptic from '../lib/haptics';

interface ActionItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
  screen?: string;
}

const ACTIONS: ActionItem[] = [
  { key: 'invoice', label: 'New Invoice', icon: 'document-text', color: '#6366f1', route: 'Invoices', screen: 'InvoiceForm' },
  { key: 'quotation', label: 'New Quotation', icon: 'pricetag', color: '#0ea5e9', route: 'Quotations', screen: 'QuotationForm' },
  { key: 'payment', label: 'Record Payment', icon: 'cash', color: '#10b981', route: 'Payments', screen: 'PaymentList' },
  { key: 'expense', label: 'Add Expense', icon: 'receipt', color: '#f59e0b', route: 'Expenses' },
  { key: 'customer', label: 'Add Customer', icon: 'person-add', color: '#8b5cf6', route: 'Customers', screen: 'CustomerForm' },
  { key: 'item', label: 'Add Item', icon: 'cube', color: '#ec4899', route: 'Items', screen: 'ItemForm' },
];

interface QuickAddCtx { open: () => void; close: () => void; isOpen: boolean; }
const QuickAddContext = createContext<QuickAddCtx>({ open: () => {}, close: () => {}, isOpen: false });
export const useQuickAdd = () => useContext(QuickAddContext);

export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const sheetY = useRef(new Animated.Value(400)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const itemAnims = useRef(ACTIONS.map(() => new Animated.Value(0))).current;

  const openSheet = useCallback(() => {
    haptic.medium();
    setOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    haptic.light();
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(sheetY, { toValue: 400, duration: 250, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ...itemAnims.map((a) => Animated.timing(a, { toValue: 0, duration: 150, useNativeDriver: true })),
    ]).start(() => setOpen(false));
  }, []);

  // Run open animation only after Modal mounts
  useEffect(() => {
    if (open) {
      sheetY.setValue(400);
      overlayOpacity.setValue(0);
      itemAnims.forEach((a) => a.setValue(0));
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(sheetY, { toValue: 0, friction: 9, tension: 70, useNativeDriver: true }),
        Animated.stagger(40, itemAnims.map((a) =>
          Animated.spring(a, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true })
        )),
      ]).start();
    }
  }, [open]);

  const handlePress = (item: ActionItem) => {
    haptic.selection();
    closeSheet();
    setTimeout(() => {
      try {
        if (item.screen) {
          navigation.navigate(item.route, { screen: item.screen });
        } else {
          navigation.navigate(item.route);
        }
      } catch {}
    }, 200);
  };

  // Swipe-down to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) sheetY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 0.6) {
          closeSheet();
        } else {
          Animated.spring(sheetY, { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(sheetY, { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }).start();
      },
    })
  ).current;

  return (
    <QuickAddContext.Provider value={{ open: openSheet, close: closeSheet, isOpen: open }}>
      {children}
      <Modal visible={open} transparent animationType="none" onRequestClose={closeSheet} statusBarTranslucent>
        <View style={styles.modalRoot}>
          <TouchableWithoutFeedback onPress={closeSheet}>
            <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />
          </TouchableWithoutFeedback>
          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: 24 + (insets.bottom || 0), transform: [{ translateY: sheetY }] },
            ]}
            {...panResponder.panHandlers}
          >
            <View style={styles.handleHitArea}>
              <View style={styles.handle} />
            </View>
            <Text style={styles.sheetTitle}>Quick Create</Text>
            <Text style={styles.sheetSub}>What would you like to add?</Text>

            <View style={styles.grid}>
              {ACTIONS.map((item, i) => {
                const scale = itemAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
                const opacity = itemAnims[i];
                const translateY = itemAnims[i].interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
                return (
                  <Animated.View
                    key={item.key}
                    style={{ width: '33.33%', opacity, transform: [{ scale }, { translateY }] }}
                  >
                    <Pressable
                      onPress={() => handlePress(item)}
                      style={({ pressed }) => [styles.tile, pressed && { transform: [{ scale: 0.94 }] }]}
                    >
                      <View style={[styles.tileIcon, { backgroundColor: item.color + '15' }]}>
                        <Ionicons name={item.icon} size={26} color={item.color} />
                      </View>
                      <Text style={styles.tileLabel} numberOfLines={2}>{item.label}</Text>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            <Pressable
              onPress={closeSheet}
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </QuickAddContext.Provider>
  );
}

// Backward-compat: keep default export as a no-op (the FAB is now embedded in the tab bar)
export default function QuickAddFAB() { return null; }

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: spacing.md,
  },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.gray300, alignSelf: 'center' },
  handleHitArea: { paddingVertical: 8, alignItems: 'center', marginBottom: spacing.sm },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.gray900, textAlign: 'center' },
  sheetSub: { fontSize: fontSize.sm, color: colors.gray500, textAlign: 'center', marginTop: 2, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  tile: { alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4 },
  tileIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  tileLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.gray700, textAlign: 'center' },
  cancelBtn: { marginTop: spacing.md, paddingVertical: 14, alignItems: 'center', borderRadius: 12, backgroundColor: colors.gray100 },
  cancelText: { fontSize: fontSize.md, fontWeight: '700', color: colors.gray700 },
});
