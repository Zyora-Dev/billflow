import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  ScrollView, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing } from '../../theme';
import EmptyState from '../../components/EmptyState';
import CurrencyText from '../../components/CurrencyText';

const STATUSES = ['All', 'Draft', 'Generated', 'Cancelled'];

const STATUS_META: Record<string, { color: string; bg: string; icon: any }> = {
  Draft:     { color: '#6b7280', bg: '#f3f4f6', icon: 'create-outline' },
  Generated: { color: '#059669', bg: '#d1fae5', icon: 'checkmark-circle' },
  Cancelled: { color: '#dc2626', bg: '#fee2e2', icon: 'close-circle' },
};

function fmtDateShort(s?: string) {
  if (!s) return '-';
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
    return `${d.getDate()} ${m} ${String(d.getFullYear()).slice(-2)}`;
  } catch { return s; }
}

export default function EwayBillListScreen({ navigation }: { navigation: any }) {
  const [bills, setBills] = useState<any[]>([]);
  const [status, setStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (oid) {
        const res = await api.get(`/api/eway-bills?org_id=${oid}`);
        setBills(Array.isArray(res.data) ? res.data : (res.data?.data || []));
      }
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);

  const filtered = useMemo(() => {
    let data = bills;
    if (status !== 'All') data = data.filter((b: any) => b.status === status);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((b: any) =>
        b.eway_number?.toLowerCase().includes(q) ||
        (b.ewb_no || '').toLowerCase().includes(q) ||
        b.doc_no?.toLowerCase().includes(q) ||
        (b.to_name || '').toLowerCase().includes(q) ||
        (b.vehicle_no || '').toLowerCase().includes(q)
      );
    }
    return data;
  }, [bills, status, search]);

  const stats = useMemo(() => ({
    total: bills.length,
    value: bills.reduce((s: number, b: any) => s + (Number(b.total_inv_value) || 0), 0),
    generated: bills.filter((b: any) => b.status === 'Generated').length,
    draft: bills.filter((b: any) => b.status === 'Draft').length,
  }), [bills]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <View style={styles.container}>
      {/* Hero stats */}
      <View style={styles.hero}>
        <View style={styles.heroOrb1} />
        <View style={styles.heroOrb2} />
        <View style={styles.heroTopRow}>
          <View style={styles.heroBadge}>
            <Ionicons name="car" size={11} color="#fff" />
            <Text style={styles.heroBadgeText}>E-WAY BILLS</Text>
          </View>
          <TouchableOpacity
            style={styles.heroAction}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('EwayBillForm', {})}
          >
            <Ionicons name="add" size={14} color="#fff" />
            <Text style={styles.heroActionText}>New EWB</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroValueRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroValueLabel}>Total Invoice Value</Text>
            <CurrencyText amount={stats.value} style={styles.heroValue} />
          </View>
        </View>

        <View style={styles.heroMiniRow}>
          <View style={styles.heroMini}>
            <View style={[styles.heroMiniDot, { backgroundColor: '#a1a1aa' }]} />
            <Text style={styles.heroMiniNum}>{stats.draft}</Text>
            <Text style={styles.heroMiniLabel}>Draft</Text>
          </View>
          <View style={styles.heroMiniSep} />
          <View style={styles.heroMini}>
            <View style={[styles.heroMiniDot, { backgroundColor: '#34d399' }]} />
            <Text style={styles.heroMiniNum}>{stats.generated}</Text>
            <Text style={styles.heroMiniLabel}>Generated</Text>
          </View>
          <View style={styles.heroMiniSep} />
          <View style={styles.heroMini}>
            <View style={[styles.heroMiniDot, { backgroundColor: '#60a5fa' }]} />
            <Text style={styles.heroMiniNum}>{stats.total}</Text>
            <Text style={styles.heroMiniLabel}>Total</Text>
          </View>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.gray400} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search EWB / doc / consignee / vehicle"
          placeholderTextColor={colors.gray400}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={colors.gray400} />
          </TouchableOpacity>
        )}
      </View>

      {/* Status tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
        style={styles.tabsScroll}
      >
        {STATUSES.map(s => {
          const active = status === s;
          const count = s === 'All' ? bills.length : bills.filter((b: any) => b.status === s).length;
          return (
            <TouchableOpacity
              key={s}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setStatus(s)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{s}</Text>
              <View style={[styles.tabCount, active && styles.tabCountActive]}>
                <Text style={[styles.tabCountText, active && { color: '#fff' }]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(it: any) => String(it.id)}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <EmptyState
            icon="car-outline"
            title="No e-way bills"
            subtitle="Generate your first EWB JSON for the NIC portal"
            actionLabel="New E-way Bill"
            onAction={() => navigation.navigate('EwayBillForm', {})}
          />
        }
        renderItem={({ item }) => {
          const meta = STATUS_META[item.status] || STATUS_META['Draft'];
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('EwayBillDetail', { id: item.id })}
            >
              <View style={styles.cardTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardEwayNo}>{item.eway_number}</Text>
                  {item.ewb_no ? (
                    <Text style={styles.cardEwbNic}>EWB# {item.ewb_no}</Text>
                  ) : (
                    <Text style={styles.cardDoc}>{item.doc_no} · {fmtDateShort(item.doc_date)}</Text>
                  )}
                </View>
                <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon} size={11} color={meta.color} />
                  <Text style={[styles.statusText, { color: meta.color }]}>{item.status}</Text>
                </View>
              </View>

              <View style={styles.cardMidRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardLabel}>Consignee</Text>
                  <Text style={styles.cardValue} numberOfLines={1}>{item.to_name || '—'}</Text>
                </View>
                {item.vehicle_no ? (
                  <View style={styles.vehicleChip}>
                    <Ionicons name="car-outline" size={11} color={colors.primary} />
                    <Text style={styles.vehicleChipText}>{item.vehicle_no}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.cardFootLabel}>{item.supply_type === 'O' ? 'Outward' : 'Inward'}</Text>
                <CurrencyText amount={item.total_inv_value} style={styles.cardAmount} />
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hero: {
    margin: spacing.md,
    backgroundColor: '#1e1b4b',
    borderRadius: 20,
    padding: spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },
  heroOrb1: { position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: '#7c3aed', opacity: 0.35 },
  heroOrb2: { position: 'absolute', bottom: -50, left: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: '#a855f7', opacity: 0.18 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  heroBadgeText: { fontSize: 9.5, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  heroAction: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999,
  },
  heroActionText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  heroValueRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  heroValueLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '600', letterSpacing: 0.5 },
  heroValue: { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 2 },
  heroMiniRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: spacing.md, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)',
  },
  heroMini: { flex: 1, alignItems: 'center', gap: 2 },
  heroMiniDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 2 },
  heroMiniNum: { fontSize: 15, fontWeight: '800', color: '#fff' },
  heroMiniLabel: { fontSize: 9.5, color: 'rgba(255,255,255,0.55)', fontWeight: '600', letterSpacing: 0.4 },
  heroMiniSep: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.1)' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12, borderWidth: 1, borderColor: colors.gray200,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },

  tabsScroll: { flexGrow: 0, flexShrink: 0, marginBottom: spacing.xs },
  tabsRow: { paddingHorizontal: spacing.md, gap: 8, paddingVertical: 4, alignItems: 'center' },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#fff', borderRadius: 999,
    borderWidth: 1, borderColor: colors.gray200,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 12.5, fontWeight: '700', color: colors.gray700 },
  tabTextActive: { color: '#fff' },
  tabCount: { backgroundColor: colors.gray100, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, minWidth: 22, alignItems: 'center' },
  tabCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabCountText: { fontSize: 10.5, fontWeight: '800', color: colors.gray700 },

  card: {
    backgroundColor: '#fff', borderRadius: 14,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.gray200,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardEwayNo: { fontSize: 15, fontWeight: '800', color: colors.text },
  cardEwbNic: { fontSize: 12, fontFamily: 'Menlo', color: colors.info, marginTop: 2 },
  cardDoc: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },

  cardMidRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  cardLabel: { fontSize: 9.5, fontWeight: '700', color: colors.gray400, letterSpacing: 0.5, textTransform: 'uppercase' },
  cardValue: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 2 },
  vehicleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.gray100, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8,
  },
  vehicleChipText: { fontSize: 11, fontWeight: '700', color: colors.primary, fontFamily: 'Menlo' },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.gray100,
  },
  cardFootLabel: { fontSize: 11, fontWeight: '600', color: colors.gray500 },
  cardAmount: { fontSize: 15, fontWeight: '800', color: colors.text },
});
