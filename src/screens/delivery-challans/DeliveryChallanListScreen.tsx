import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';
import CurrencyText from '../../components/CurrencyText';

const STATUSES = ['All', 'Draft', 'Dispatched', 'Delivered', 'Cancelled'];

function statusColor(s: string) {
  switch (s) {
    case 'Dispatched': return '#3b82f6';
    case 'Delivered': return '#10b981';
    case 'Cancelled': return '#ef4444';
    default: return '#94a3b8';
  }
}

function typeColor(t: string) {
  switch (t) {
    case 'Supply': return '#3b82f6';
    case 'Job Work': return '#8b5cf6';
    case 'Export': return '#f59e0b';
    case 'SKD/CKD': return '#06b6d4';
    default: return colors.gray400;
  }
}

export default function DeliveryChallanListScreen({ navigation }: { navigation: any }) {
  const [challans, setChallans] = useState<any[]>([]);
  const [status, setStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const debounceRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const biz = await api.get('/api/business');
        setOrgId(biz.data[0]?.org_id || null);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [search]);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await api.get(`/api/delivery-challans?org_id=${orgId}`);
      setChallans(Array.isArray(res.data) ? res.data : (res.data?.data || []));
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const filtered = challans.filter(c => {
    if (status !== 'All' && c.status !== status) return false;
    if (searchDebounced) {
      const q = searchDebounced.toLowerCase();
      return (c.dc_number || '').toLowerCase().includes(q) ||
        (c.customer_name || '').toLowerCase().includes(q) ||
        (c.vehicle_number || '').toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    total: challans.length,
    dispatched: challans.filter(c => c.status === 'Dispatched').length,
    delivered: challans.filter(c => c.status === 'Delivered').length,
  };

  const renderItem = ({ item }: { item: any }) => {
    const initial = String(item.customer_name || 'C').trim().charAt(0).toUpperCase();
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('DCDetail', { id: item.id })}
      >
        <View style={[styles.avatar, { backgroundColor: statusColor(item.status) + '20', borderColor: statusColor(item.status) + '50' }]}>
          <Text style={[styles.avatarText, { color: statusColor(item.status) }]}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.cardTopRow}>
            <Text style={styles.customerName} numberOfLines={1}>{item.customer_name || 'Customer'}</Text>
            <CurrencyText amount={item.total} style={styles.total} />
          </View>
          <View style={styles.cardMetaRow}>
            <Text style={styles.dcNum}>{item.dc_number}</Text>
            <View style={styles.metaDot} />
            <Text style={styles.date}>{item.challan_date}</Text>
            <View style={{ flex: 1 }} />
            <StatusBadge status={item.status} />
          </View>
          <View style={styles.cardBottomRow}>
            {item.challan_type ? (
              <View style={[styles.typeBadge, { backgroundColor: typeColor(item.challan_type) + '18' }]}>
                <Text style={[styles.typeBadgeText, { color: typeColor(item.challan_type) }]}>{item.challan_type}</Text>
              </View>
            ) : null}
            {item.vehicle_number ? (
              <View style={styles.vehicleChip}>
                <Ionicons name="car-outline" size={11} color={colors.gray500} />
                <Text style={styles.vehicleText}>{item.vehicle_number}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const Header = (
    <View>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroBgAccent} />
        <View style={styles.heroBgAccent2} />
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>Delivery Challans</Text>
            <Text style={styles.heroValue}>{stats.total}</Text>
          </View>
          <View style={styles.heroIcon}>
            <Ionicons name="cube-outline" size={28} color="rgba(255,255,255,0.3)" />
          </View>
        </View>
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Dispatched</Text>
            <Text style={styles.heroStatVal}>{stats.dispatched}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Delivered</Text>
            <Text style={[styles.heroStatVal, { color: '#86efac' }]}>{stats.delivered}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Draft</Text>
            <Text style={styles.heroStatVal}>{challans.filter(c => c.status === 'Draft').length}</Text>
          </View>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.gray400} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search challans..."
          placeholderTextColor={colors.placeholder}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.gray400} />
          </TouchableOpacity>
        )}
      </View>

      {/* Status tabs */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={STATUSES}
        keyExtractor={i => i}
        contentContainerStyle={styles.tabBar}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.tab, status === item && styles.tabActive]}
            onPress={() => setStatus(item)}
          >
            <Text style={[styles.tabText, status === item && styles.tabTextActive]}>{item}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={Header}
        ListEmptyComponent={<EmptyState icon="cube-outline" title="No challans" subtitle="Create your first delivery challan" />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('DCForm')}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingBottom: 100 },

  // Hero
  hero: {
    backgroundColor: '#064e3b',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  heroBgAccent: {
    position: 'absolute', top: -30, right: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroBgAccent2: {
    position: 'absolute', bottom: -20, left: -20,
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroIcon: { padding: 8 },
  heroEyebrow: { color: 'rgba(255,255,255,0.65)', fontSize: fontSize.xs, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  heroValue: { color: '#fff', fontSize: 32, fontWeight: '800' },
  heroStatsRow: { flexDirection: 'row', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatLabel: { color: 'rgba(255,255,255,0.55)', fontSize: fontSize.xs, marginBottom: 2 },
  heroStatVal: { color: '#fff', fontSize: fontSize.lg, fontWeight: '700' },
  heroDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: spacing.sm },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, marginHorizontal: spacing.md, marginTop: spacing.md,
    borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, marginLeft: spacing.sm, fontSize: fontSize.sm, color: colors.text },

  // Tabs
  tabBar: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  tab: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: borderRadius.full, marginRight: spacing.sm,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.gray500 },
  tabTextActive: { color: '#fff' },

  // Card
  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.card, marginHorizontal: spacing.md, marginBottom: spacing.sm,
    borderRadius: borderRadius.lg, padding: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    marginRight: spacing.sm, borderWidth: 1.5,
  },
  avatarText: { fontSize: fontSize.md, fontWeight: '700' },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  customerName: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, flex: 1, marginRight: 8 },
  total: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  dcNum: { fontSize: fontSize.xs, color: colors.gray500, fontWeight: '500' },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.gray300, marginHorizontal: 6 },
  date: { fontSize: fontSize.xs, color: colors.gray400 },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  vehicleChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.gray100, borderRadius: borderRadius.full },
  vehicleText: { fontSize: 10, color: colors.gray500, fontWeight: '500' },

  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
