import React, { useEffect, useMemo, useRef, useState, createContext, useContext, useCallback } from 'react';
import {
  View, Text, TextInput, Modal, Pressable, FlatList, StyleSheet, Animated, Easing,
  ActivityIndicator, KeyboardAvoidingView, Platform, TouchableOpacity, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../api/client';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import haptic from '../lib/haptics';

type ResultType = 'invoice' | 'quotation' | 'customer' | 'item' | 'vendor' | 'bill' | 'po';

interface SearchResult {
  id: number | string;
  type: ResultType;
  title: string;
  subtitle?: string;
  meta?: string;
  data: any;
}

const TYPE_META: Record<ResultType, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  invoice:   { label: 'Invoice',   icon: 'document-text', color: '#6366f1' },
  quotation: { label: 'Quotation', icon: 'pricetag',      color: '#0ea5e9' },
  customer:  { label: 'Customer',  icon: 'person',        color: '#8b5cf6' },
  item:      { label: 'Item',      icon: 'cube',          color: '#ec4899' },
  vendor:    { label: 'Vendor',    icon: 'storefront',    color: '#f59e0b' },
  bill:      { label: 'Bill',      icon: 'receipt',       color: '#10b981' },
  po:        { label: 'PO',        icon: 'cart',          color: '#0891b2' },
};

interface GlobalSearchCtx { open: () => void; close: () => void; }
const GlobalSearchContext = createContext<GlobalSearchCtx>({ open: () => {}, close: () => {} });
export const useGlobalSearch = () => useContext(GlobalSearchContext);

export function GlobalSearchProvider({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<ResultType | 'all'>('all');

  const inputRef = useRef<TextInput>(null);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(-20)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;

  const openSheet = useCallback(() => {
    haptic.medium();
    setOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(sheetY, { toValue: -20, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(sheetOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setOpen(false);
      setQuery('');
      setResults([]);
      setActiveFilter('all');
    });
  }, []);

  // Resolve org_id once
  useEffect(() => {
    if (!orgId) {
      api.get('/api/business').then(r => setOrgId(r.data?.[0]?.org_id || null)).catch(() => {});
    }
  }, [orgId]);

  // Animate on open
  useEffect(() => {
    if (open) {
      sheetY.setValue(-20);
      sheetOpacity.setValue(0);
      overlayOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(sheetY, { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
        Animated.timing(sheetOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open || !orgId) return;
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const [inv, quo, cust, itm, ven, bill, po] = await Promise.all([
          api.get(`/api/invoices?org_id=${orgId}`).catch(() => ({ data: [] })),
          api.get(`/api/quotations?org_id=${orgId}`).catch(() => ({ data: [] })),
          api.get(`/api/customers?org_id=${orgId}`).catch(() => ({ data: [] })),
          api.get(`/api/items?org_id=${orgId}`).catch(() => ({ data: [] })),
          api.get(`/api/vendors?org_id=${orgId}`).catch(() => ({ data: [] })),
          api.get(`/api/purchase-bills?org_id=${orgId}`).catch(() => ({ data: [] })),
          api.get(`/api/purchase-orders?org_id=${orgId}`).catch(() => ({ data: [] })),
        ]);

        const q = query.trim().toLowerCase();
        const matched: SearchResult[] = [];

        const matchStr = (s?: string) => (s || '').toLowerCase().includes(q);

        (inv.data || []).forEach((x: any) => {
          if (matchStr(x.invoice_number) || matchStr(x.customer_name) || matchStr(String(x.total))) {
            matched.push({
              id: x.id, type: 'invoice', title: x.invoice_number,
              subtitle: x.customer_name || 'No customer',
              meta: `₹${Number(x.total || 0).toFixed(0)} · ${x.status}`,
              data: x,
            });
          }
        });
        (quo.data || []).forEach((x: any) => {
          if (matchStr(x.quotation_number) || matchStr(x.customer_name)) {
            matched.push({
              id: x.id, type: 'quotation', title: x.quotation_number,
              subtitle: x.customer_name || 'No customer',
              meta: `₹${Number(x.total || 0).toFixed(0)} · ${x.status}`,
              data: x,
            });
          }
        });
        (cust.data || []).forEach((x: any) => {
          if (matchStr(x.contact_person) || matchStr(x.business_name) || matchStr(x.mobile) || matchStr(x.email)) {
            matched.push({
              id: x.id, type: 'customer', title: x.contact_person || x.business_name || 'Customer',
              subtitle: x.business_name || x.mobile || '',
              meta: x.mobile || '',
              data: x,
            });
          }
        });
        (itm.data || []).forEach((x: any) => {
          if (matchStr(x.item_name) || matchStr(x.model_number) || matchStr(x.description)) {
            matched.push({
              id: x.id, type: 'item', title: x.item_name,
              subtitle: x.model_number || x.description || '',
              meta: `₹${Number(x.sale_price || 0).toFixed(0)} · ${x.stock || 0} stock`,
              data: x,
            });
          }
        });
        (ven.data || []).forEach((x: any) => {
          if (matchStr(x.contact_person) || matchStr(x.business_name) || matchStr(x.mobile)) {
            matched.push({
              id: x.id, type: 'vendor', title: x.contact_person || x.business_name || 'Vendor',
              subtitle: x.business_name || x.mobile || '',
              meta: x.mobile || '',
              data: x,
            });
          }
        });
        (bill.data || []).forEach((x: any) => {
          if (matchStr(x.bill_number) || matchStr(x.vendor_name)) {
            matched.push({
              id: x.id, type: 'bill', title: x.bill_number,
              subtitle: x.vendor_name || 'No vendor',
              meta: `₹${Number(x.total || 0).toFixed(0)} · ${x.status}`,
              data: x,
            });
          }
        });
        (po.data || []).forEach((x: any) => {
          if (matchStr(x.po_number) || matchStr(x.vendor_name)) {
            matched.push({
              id: x.id, type: 'po', title: x.po_number,
              subtitle: x.vendor_name || 'No vendor',
              meta: `₹${Number(x.total || 0).toFixed(0)} · ${x.status}`,
              data: x,
            });
          }
        });

        setResults(matched);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [query, open, orgId]);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return results;
    return results.filter(r => r.type === activeFilter);
  }, [results, activeFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: results.length };
    results.forEach(r => { c[r.type] = (c[r.type] || 0) + 1; });
    return c;
  }, [results]);

  const handleResultPress = (r: SearchResult) => {
    haptic.selection();
    setRecents(prev => [r.title, ...prev.filter(x => x !== r.title)].slice(0, 5));
    closeSheet();
    setTimeout(() => {
      try {
        switch (r.type) {
          case 'invoice':   navigation.navigate('Invoices',       { screen: 'InvoiceDetail',  params: { id: r.id } }); break;
          case 'quotation': navigation.navigate('Quotations',     { screen: 'QuotationDetail', params: { id: r.id } }); break;
          case 'customer':  navigation.navigate('Customers',      { screen: 'CustomerDetail',  params: { id: r.id } }); break;
          case 'item':      navigation.navigate('Items',          { screen: 'ItemForm',        params: { id: r.id } }); break;
          case 'vendor':    navigation.navigate('Vendors',        { screen: 'VendorDetail',    params: { id: r.id } }); break;
          case 'bill':      navigation.navigate('Purchase',       { screen: 'PBDetail',        params: { id: r.id } }); break;
          case 'po':        navigation.navigate('PurchaseOrders', { screen: 'PODetail',        params: { id: r.id } }); break;
        }
      } catch {}
    }, 180);
  };

  const renderResult = ({ item }: { item: SearchResult }) => {
    const meta = TYPE_META[item.type];
    return (
      <Pressable
        onPress={() => handleResultPress(item)}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.gray100 }]}
      >
        <View style={[styles.iconDisc, { backgroundColor: meta.color + '15' }]}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.rowTopLine}>
            <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
            <View style={[styles.typePill, { backgroundColor: meta.color + '12' }]}>
              <Text style={[styles.typePillText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          </View>
          {!!item.subtitle && <Text style={styles.rowSubtitle} numberOfLines={1}>{item.subtitle}</Text>}
          {!!item.meta && <Text style={styles.rowMeta} numberOfLines={1}>{item.meta}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
      </Pressable>
    );
  };

  const filterChips: { key: ResultType | 'all'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'invoice', label: 'Invoices' },
    { key: 'quotation', label: 'Quotations' },
    { key: 'customer', label: 'Customers' },
    { key: 'item', label: 'Items' },
    { key: 'vendor', label: 'Vendors' },
    { key: 'bill', label: 'Bills' },
    { key: 'po', label: 'POs' },
  ];

  return (
    <GlobalSearchContext.Provider value={{ open: openSheet, close: closeSheet }}>
      {children}
      <Modal visible={open} transparent animationType="none" onRequestClose={closeSheet} statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable style={styles.overlayPress} onPress={closeSheet}>
            <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />
          </Pressable>
          <Animated.View
            style={[
              styles.sheet,
              { paddingTop: insets.top + 12, opacity: sheetOpacity, transform: [{ translateY: sheetY }] },
            ]}
          >
            {/* Search bar */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={colors.gray500} />
              <TextInput
                ref={inputRef}
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search invoices, customers, items…"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {query ? (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={colors.gray400} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={closeSheet} style={styles.closeBtn}>
                <Text style={styles.closeText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            {/* Filter chips (only when there are results) */}
            {results.length > 0 && (
              <View style={styles.chipsRow}>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={filterChips.filter(c => c.key === 'all' || (counts[c.key] || 0) > 0)}
                  keyExtractor={c => c.key}
                  contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}
                  renderItem={({ item: c }) => {
                    const active = activeFilter === c.key;
                    const cnt = counts[c.key] || 0;
                    return (
                      <Pressable
                        onPress={() => { haptic.selection(); setActiveFilter(c.key); }}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {c.label} {cnt > 0 ? `· ${cnt}` : ''}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              </View>
            )}

            {/* Results / states */}
            <View style={{ flex: 1 }}>
              {!query.trim() ? (
                <View style={styles.empty}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="search" size={28} color={colors.primary} />
                  </View>
                  <Text style={styles.emptyTitle}>Search your books</Text>
                  <Text style={styles.emptySub}>Find invoices, quotations, customers, items, vendors, bills and more.</Text>
                  {recents.length > 0 && (
                    <View style={styles.recents}>
                      <Text style={styles.recentsLabel}>Recent</Text>
                      <View style={styles.recentsRow}>
                        {recents.map(r => (
                          <Pressable key={r} onPress={() => setQuery(r)} style={styles.recentChip}>
                            <Ionicons name="time-outline" size={13} color={colors.gray600} />
                            <Text style={styles.recentChipText} numberOfLines={1}>{r}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              ) : loading ? (
                <View style={styles.empty}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={[styles.emptySub, { marginTop: 12 }]}>Searching…</Text>
                </View>
              ) : filtered.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="sad-outline" size={36} color={colors.gray400} />
                  <Text style={[styles.emptyTitle, { marginTop: 10 }]}>No matches</Text>
                  <Text style={styles.emptySub}>Try different keywords or check spelling.</Text>
                </View>
              ) : (
                <FlatList
                  data={filtered}
                  keyExtractor={(r) => `${r.type}-${r.id}`}
                  renderItem={renderResult}
                  keyboardShouldPersistTaps="handled"
                  ItemSeparatorComponent={() => <View style={styles.sep} />}
                  contentContainerStyle={{ paddingVertical: 4 }}
                />
              )}
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </GlobalSearchContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlayPress: { ...StyleSheet.absoluteFillObject },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    paddingVertical: 8,
  },
  closeBtn: { paddingLeft: 6 },
  closeText: { color: colors.primary, fontWeight: '700', fontSize: fontSize.sm },
  chipsRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.gray100,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: fontSize.xs, fontWeight: '700', color: colors.gray700 },
  chipTextActive: { color: '#fff' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconDisc: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTopLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  typePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  typePillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  rowSubtitle: { fontSize: fontSize.sm, color: colors.gray600, marginTop: 2 },
  rowMeta: { fontSize: fontSize.xs, color: colors.gray500, marginTop: 1 },
  sep: { height: 1, backgroundColor: colors.gray100, marginLeft: 68 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.primary + '12',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  emptySub: { fontSize: fontSize.sm, color: colors.gray500, marginTop: 6, textAlign: 'center', maxWidth: 300 },
  recents: { marginTop: 24, alignSelf: 'stretch' },
  recentsLabel: { fontSize: fontSize.xs, fontWeight: '700', color: colors.gray500, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  recentsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: colors.gray100,
    borderRadius: 999,
  },
  recentChipText: { fontSize: fontSize.xs, color: colors.gray700, fontWeight: '600', maxWidth: 200 },
});
