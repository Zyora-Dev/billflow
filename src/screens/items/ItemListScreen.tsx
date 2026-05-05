import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  ScrollView, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing } from '../../theme';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { usePreview } from '../../components/Preview';
import CurrencyText from '../../components/CurrencyText';

const TYPE_FILTERS = [
  { value: 'all',     label: 'All',      icon: 'apps' as const,       color: colors.primary },
  { value: 'goods',   label: 'Goods',    icon: 'cube' as const,       color: '#2563eb' },
  { value: 'service', label: 'Service',  icon: 'construct' as const,  color: '#10B981' },
];

const STOCK_FILTERS = [
  { value: 'all',     label: 'All Stock',   color: colors.gray500 },
  { value: 'low',     label: 'Low Stock',   color: '#d97706' },
  { value: 'out',     label: 'Out',         color: '#dc2626' },
];

export default function ItemListScreen({ navigation }: { navigation: any }) {
  const preview = usePreview();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (oid) {
        const res = await api.get(`/api/items?org_id=${oid}`);
        setItems(Array.isArray(res.data) ? res.data : []);
      }
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const u = navigation.addListener('focus', fetchData);
    return u;
  }, [navigation, fetchData]);

  const filtered = useMemo(() => {
    let data = items.slice();
    if (typeFilter !== 'all') data = data.filter(i => i.type === typeFilter);
    if (stockFilter === 'low') {
      data = data.filter(i => i.stock_alert_enabled && i.stock > 0 && i.stock <= (i.stock_alert_qty || 0));
    } else if (stockFilter === 'out') {
      data = data.filter(i => (i.stock || 0) === 0 && i.type === 'goods');
    }
    const q = search.trim().toLowerCase();
    if (q) {
      data = data.filter((i: any) =>
        i.item_name?.toLowerCase().includes(q) ||
        i.model_number?.toLowerCase().includes(q) ||
        i.brand_name?.toLowerCase().includes(q)
      );
    }
    return data.sort((a, b) => {
      const an = String(a.item_name || '').toLowerCase();
      const bn = String(b.item_name || '').toLowerCase();
      if (q) {
        const ap = an.startsWith(q) ? 0 : 1;
        const bp = bn.startsWith(q) ? 0 : 1;
        if (ap !== bp) return ap - bp;
      }
      return an.localeCompare(bn);
    });
  }, [items, typeFilter, stockFilter, search]);

  const stats = useMemo(() => {
    const goods = items.filter(i => i.type === 'goods');
    const services = items.filter(i => i.type === 'service');
    const lowStock = goods.filter(i => i.stock_alert_enabled && i.stock > 0 && i.stock <= (i.stock_alert_qty || 0)).length;
    const outOfStock = goods.filter(i => (i.stock || 0) === 0).length;
    const totalValue = goods.reduce((s, i) => s + (Number(i.sale_price) || 0) * (Number(i.stock) || 0), 0);
    return {
      total: items.length,
      goods: goods.length,
      services: services.length,
      lowStock,
      outOfStock,
      totalValue,
    };
  }, [items]);

  const renderItem = ({ item }: { item: any }) => {
    const isGoods = item.type === 'goods';
    const accentColor = isGoods ? '#2563eb' : '#10B981';
    const accentBg = isGoods ? '#dbeafe' : '#dcfce7';
    const stock = Number(item.stock || 0);
    const alertQty = Number(item.stock_alert_qty || 0);
    const isOut = isGoods && stock === 0;
    const isLow = isGoods && item.stock_alert_enabled && stock > 0 && stock <= alertQty;
    const stockBg = isOut ? '#fee2e2' : isLow ? '#fef3c7' : '#f1f5f9';
    const stockColor = isOut ? '#dc2626' : isLow ? '#d97706' : colors.gray600;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('ItemForm', { id: item.id })}
        onLongPress={() => preview.show({ type: 'item', id: item.id })}
        delayLongPress={350}
      >
        <View style={[styles.iconBox, { backgroundColor: accentBg, borderColor: accentColor + '40' }]}>
          <Ionicons name={isGoods ? 'cube' : 'construct'} size={18} color={accentColor} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.cardTopRow}>
            <Text style={styles.name} numberOfLines={1}>{item.item_name}</Text>
            <CurrencyText amount={item.sale_price || 0} style={styles.price} />
          </View>
          <View style={styles.cardMetaRow}>
            {item.brand_name ? (
              <>
                <Text style={styles.brand} numberOfLines={1}>{item.brand_name}</Text>
                <View style={styles.metaDot} />
              </>
            ) : null}
            {item.unit ? (
              <>
                <Text style={styles.metaText}>{item.unit}</Text>
                <View style={styles.metaDot} />
              </>
            ) : null}
            <Text style={styles.metaText}>GST {item.tax_rate || 0}%</Text>
          </View>
          <View style={styles.cardBottomRow}>
            {isGoods ? (
              <View style={[styles.stockChip, { backgroundColor: stockBg }]}>
                {(isLow || isOut) ? <Ionicons name="alert-circle" size={11} color={stockColor} /> : null}
                <Text style={[styles.stockChipText, { color: stockColor }]}>
                  {isOut ? 'Out of stock' : `Stock: ${stock}`}
                </Text>
              </View>
            ) : (
              <View style={[styles.stockChip, { backgroundColor: '#dcfce7' }]}>
                <Text style={[styles.stockChipText, { color: '#10B981' }]}>Service</Text>
              </View>
            )}
            {item.offer_price && Number(item.offer_price) > 0 ? (
              <View style={styles.offerChip}>
                <Ionicons name="pricetag" size={9} color="#7c3aed" />
                <Text style={styles.offerChipText}>Offer ₹{Number(item.offer_price).toLocaleString('en-IN')}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <View>
            {/* Hero */}
            <View style={styles.hero}>
              <View style={styles.heroAccent} />
              <View style={styles.heroAccent2} />
              <View style={styles.heroTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroEyebrow}>Catalog</Text>
                  <Text style={styles.heroValue}>{stats.total}</Text>
                  <Text style={styles.heroSub}>
                    {stats.goods} goods • {stats.services} services
                  </Text>
                </View>
                <View style={styles.heroIcon}>
                  <Ionicons name="cube" size={22} color="#fff" />
                </View>
              </View>
              <View style={styles.kpiRow}>
                <View style={styles.kpi}>
                  <Text style={styles.kpiLabel}>Stock Value</Text>
                  <Text style={[styles.kpiVal, { color: '#86efac' }]}>
                    ₹{stats.totalValue >= 1000 ? `${(stats.totalValue / 1000).toFixed(1)}k` : stats.totalValue.toFixed(0)}
                  </Text>
                </View>
                <View style={styles.kpi}>
                  <Text style={styles.kpiLabel}>Low Stock</Text>
                  <Text style={[styles.kpiVal, { color: '#fbbf24' }]}>{stats.lowStock}</Text>
                </View>
                <View style={[styles.kpi, { borderRightWidth: 0 }]}>
                  <Text style={styles.kpiLabel}>Out</Text>
                  <Text style={[styles.kpiVal, { color: '#fca5a5' }]}>{stats.outOfStock}</Text>
                </View>
              </View>
            </View>

            {/* Search */}
            <View style={styles.searchSection}>
              <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color={colors.primary} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Type to search item, model or brand..."
                  placeholderTextColor={colors.gray400}
                />
                {search.trim().length > 0 ? (
                  <View style={styles.countChip}>
                    <Text style={styles.countChipText}>{filtered.length}</Text>
                  </View>
                ) : null}
                {search ? (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={colors.gray400} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* Type chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
              {TYPE_FILTERS.map(f => {
                const active = typeFilter === f.value;
                return (
                  <TouchableOpacity
                    key={f.value}
                    style={[styles.chip, active && { backgroundColor: f.color + '15', borderColor: f.color }]}
                    onPress={() => setTypeFilter(f.value)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name={f.icon} size={12} color={active ? f.color : colors.gray500} />
                    <Text style={[styles.chipText, active && { color: f.color, fontWeight: '800' }]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
              <View style={styles.chipDivider} />
              {STOCK_FILTERS.map(f => {
                const active = stockFilter === f.value;
                return (
                  <TouchableOpacity
                    key={f.value}
                    style={[styles.chip, active && { backgroundColor: f.color + '15', borderColor: f.color }]}
                    onPress={() => setStockFilter(f.value)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.chipDot, { backgroundColor: f.color }]} />
                    <Text style={[styles.chipText, active && { color: f.color, fontWeight: '800' }]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={loading ? <SkeletonList count={6} /> : (
          <View style={{ paddingTop: 40 }}>
            <EmptyState icon="cube-outline" title="No items" subtitle="Tap + to add one" />
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => navigation.navigate('ItemForm', {})}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },

  // Hero
  hero: {
    backgroundColor: colors.primary,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    overflow: 'hidden',
    shadowColor: colors.primary, shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  heroAccent: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.06)', top: -55, right: -35 },
  heroAccent2: { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.04)', bottom: -30, left: -20 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  heroEyebrow: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  heroValue: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2, fontWeight: '600' },
  heroIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },

  kpiRow: {
    flexDirection: 'row',
    marginTop: spacing.sm + 2,
    paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)',
  },
  kpi: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.18)' },
  kpiLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  kpiVal: { fontSize: 15, fontWeight: '800', marginTop: 2 },

  // Search
  searchSection: { paddingHorizontal: spacing.md, marginTop: spacing.md },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11,
    gap: 10,
    borderWidth: 1.5, borderColor: colors.primary + '30',
    shadowColor: colors.primary, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0, fontWeight: '500' },
  countChip: { backgroundColor: colors.primary + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, minWidth: 24, alignItems: 'center' },
  countChipText: { fontSize: 11, color: colors.primary, fontWeight: '800' },

  // Chips
  chipsScroll: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4, gap: 6, alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#eef0f5',
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.gray600 },
  chipDivider: { width: 1, height: 18, backgroundColor: colors.gray200, marginHorizontal: 4 },

  // Card
  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#fff',
    marginHorizontal: spacing.md, marginBottom: 10,
    borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#eef0f5',
  },
  iconBox: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 11,
    borderWidth: 1.5,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.gray900, letterSpacing: -0.2 },
  price: { fontSize: 15.5, fontWeight: '800', color: colors.gray900, letterSpacing: -0.3 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  brand: { fontSize: 11.5, color: colors.primary, fontWeight: '700' },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.gray300 },
  metaText: { fontSize: 11, color: colors.gray500, fontWeight: '600' },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  stockChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
  },
  stockChipText: { fontSize: 10.5, fontWeight: '800' },
  offerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#ede9fe',
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 999,
  },
  offerChipText: { fontSize: 10, fontWeight: '700', color: '#7c3aed' },

  fab: {
    position: 'absolute', right: 20, bottom: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
