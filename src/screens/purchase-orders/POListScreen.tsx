import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { usePreview } from '../../components/Preview';
import StatusBadge from '../../components/StatusBadge';
import CurrencyText from '../../components/CurrencyText';

const STATUSES = ['All', 'Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'];

export default function POListScreen({ navigation }: { navigation: any }) {
  const preview = usePreview();
  const [pos, setPos] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [status, setStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (oid) { const res = await api.get(`/api/purchase-orders?org_id=${oid}`); setPos(Array.isArray(res.data) ? res.data : (res.data?.data || [])); }
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { navigation.addListener('focus', fetchData); }, [navigation]);
  useEffect(() => {
    let data = pos;
    if (status !== 'All') data = data.filter((p: any) => p.status === status);
    if (search) {
      const q = search.toLowerCase();
      data = data.filter((p: any) => p.po_number?.toLowerCase().includes(q) || p.vendor_name?.toLowerCase().includes(q));
    }
    setFiltered(data);
  }, [status, pos, search]);

  const statsData = useMemo(() => ({
    count: pos.length,
    totalValue: pos.reduce((s: number, p: any) => s + (p.total || 0), 0),
    accepted: pos.filter((p: any) => p.status === 'Accepted').length,
  }), [pos]);

  return (
    <View style={styles.container}>
      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statLabel}>Total POs</Text><Text style={styles.statVal}>{statsData.count}</Text></View>
        <View style={styles.stat}><Text style={styles.statLabel}>Value</Text><CurrencyText amount={statsData.totalValue} style={styles.statVal} /></View>
        <View style={styles.stat}><Text style={styles.statLabel}>Accepted</Text><Text style={[styles.statVal, { color: colors.success }]}>{statsData.accepted}</Text></View>
      </View>
      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={20} color={colors.gray400} />
        <TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Search POs..." placeholderTextColor={colors.placeholder} />
        {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={20} color={colors.gray400} /></TouchableOpacity> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {STATUSES.map(s => (<TouchableOpacity key={s} style={[styles.chip, status === s && styles.chipActive]} onPress={() => setStatus(s)}><Text style={[styles.chipText, status === s && styles.chipTextActive]}>{s}</Text></TouchableOpacity>))}
      </ScrollView>
      <FlatList data={filtered} keyExtractor={i => String(i.id)} renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('PODetail', { id: item.id })} onLongPress={() => preview.show({ type: 'po', id: item.id })} delayLongPress={350}>
          <View style={{ flex: 1 }}><Text style={styles.num}>{item.po_number}</Text><Text style={styles.cust}>{item.vendor_name || 'N/A'}</Text><Text style={styles.date}>{item.po_date}</Text></View>
          <View style={{ alignItems: 'flex-end' }}><CurrencyText amount={item.total} style={styles.total} /><StatusBadge status={item.status} /></View>
        </TouchableOpacity>
      )} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        ListEmptyComponent={loading ? <SkeletonList count={6} /> : <EmptyState icon="cart-outline" title="No purchase orders" subtitle="Tap + to create" />}
        contentContainerStyle={!filtered.length ? { flex: 1 } : { paddingBottom: 80 }} />
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('POForm', {})}><Ionicons name="add" size={28} color={colors.white} /></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filterRow: { flexGrow: 0, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.border, marginRight: spacing.xs, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, color: colors.gray600 },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  statsRow: { flexDirection: 'row', padding: spacing.md, paddingBottom: 0, gap: spacing.xs },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: borderRadius.md, padding: spacing.sm, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  statLabel: { fontSize: 10, color: colors.gray500 },
  statVal: { fontSize: fontSize.sm, fontWeight: '700', color: colors.primary, marginTop: 2 },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, margin: spacing.md, marginBottom: 0, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  searchInput: { flex: 1, marginLeft: spacing.sm, fontSize: fontSize.md, color: colors.text, paddingVertical: 4 },
  card: { flexDirection: 'row', backgroundColor: colors.white, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.md, padding: spacing.md, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  num: { fontSize: fontSize.md, fontWeight: '700', color: colors.primary },
  cust: { fontSize: fontSize.sm, color: colors.text, marginTop: 2 },
  date: { fontSize: fontSize.xs, color: colors.gray400, marginTop: 2 },
  total: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: 4 },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
});
