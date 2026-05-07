import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  ScrollView, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';
import CurrencyText from '../../components/CurrencyText';

const STATUSES = ['All', 'Draft', 'Issued', 'Cancelled'];

function statusColor(s: string) {
  switch (s) {
    case 'Issued': return '#10b981';
    case 'Cancelled': return '#ef4444';
    default: return '#94a3b8';
  }
}

export default function DebitNoteListScreen({ navigation }: { navigation: any }) {
  const [debitNotes, setDebitNotes] = useState<any[]>([]);
  const [status, setStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const debounceRef = useRef<any>(null);

  const [stats, setStats] = useState({ count: 0, totalValue: 0, issuedCount: 0 });

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
      const res = await api.get(`/api/debit-notes?org_id=${orgId}`);
      let data = Array.isArray(res.data) ? res.data : (res.data?.data || []);

      const totalValue = data.reduce((s: number, dn: any) => s + Number(dn.total || 0), 0);
      const issuedCount = data.filter((dn: any) => dn.status === 'Issued').length;
      setStats({ count: data.length, totalValue, issuedCount });

      if (status !== 'All') {
        data = data.filter((dn: any) => dn.status === status);
      }
      if (searchDebounced) {
        const q = searchDebounced.toLowerCase();
        data = data.filter((dn: any) =>
          (dn.dn_number || '').toLowerCase().includes(q) ||
          (dn.vendor_name || '').toLowerCase().includes(q) ||
          (dn.reason || '').toLowerCase().includes(q)
        );
      }
      setDebitNotes(data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId, status, searchDebounced]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const completionPct = stats.count > 0 ? Math.round((stats.issuedCount / stats.count) * 100) : 0;

  const renderItem = ({ item }: { item: any }) => {
    const sColor = statusColor(item.status);
    const initial = (item.vendor_name || 'DN').trim().charAt(0).toUpperCase();
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('DebitNoteDetail', { id: item.id })}
      >
        <View style={[styles.cardAvatar, { backgroundColor: sColor + '18', borderColor: sColor + '40' }]}>
          <Text style={[styles.cardAvatarText, { color: sColor }]}>{initial}</Text>
        </View>
        <View style={styles.cardMid}>
          <View style={styles.cardTopRow}>
            <Text style={styles.vendorName} numberOfLines={1}>{item.vendor_name || 'N/A'}</Text>
            <CurrencyText amount={item.total} style={styles.total} />
          </View>
          <View style={styles.cardBotRow}>
            <View style={styles.cardMetaInline}>
              <Text style={styles.dnNum}>{item.dn_number}</Text>
              <View style={styles.metaDot} />
              <Text style={styles.date}>{item.dn_date}</Text>
            </View>
            <StatusBadge status={item.status} />
          </View>
          {item.reason ? (
            <Text style={styles.reasonText} numberOfLines={1}>{item.reason}</Text>
          ) : null}
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
            <Text style={styles.heroEyebrow}>Debit Notes</Text>
            <CurrencyText amount={stats.totalValue} style={styles.heroValue} />
          </View>
          <View style={styles.ringContainer}>
            <View style={styles.ringBg}>
              <Text style={styles.ringText}>{completionPct}%</Text>
              <Text style={styles.ringLabel}>Issued</Text>
            </View>
          </View>
        </View>
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Total</Text>
            <Text style={styles.heroStatVal}>{stats.count}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Issued</Text>
            <Text style={[styles.heroStatVal, { color: '#86efac' }]}>{stats.issuedCount}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Total Value</Text>
            <CurrencyText amount={stats.totalValue} style={styles.heroStatVal} />
          </View>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.gray400} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search DN # or vendor..."
          placeholderTextColor={colors.placeholder}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.gray400} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Status Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
        {STATUSES.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, status === s && styles.chipActive]}
            onPress={() => setStatus(s)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, status === s && styles.chipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.sectionLabel}>All Debit Notes</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={debitNotes}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        ListHeaderComponent={Header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
          ) : (
            <EmptyState icon="document-text-outline" title="No debit notes found" subtitle="Tap + to create one" />
          )
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />
      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => navigation.navigate('DebitNoteForm', {})}>
        <Ionicons name="add" size={26} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },

  // Hero
  hero: {
    backgroundColor: '#064e3b',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    overflow: 'hidden',
    shadowColor: '#064e3b', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  heroBgAccent: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.05)', top: -50, right: -30 },
  heroBgAccent2: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.04)', bottom: -25, left: -15 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  heroEyebrow: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  heroValue: { color: '#ffffff', fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 4 },
  heroStatsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: spacing.sm + 2,
    paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)',
  },
  heroStatItem: { flex: 1 },
  heroStatLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  heroStatVal: { color: '#ffffff', fontSize: 13, fontWeight: '700', marginTop: 2, letterSpacing: -0.2 },
  heroDivider: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: spacing.sm },

  // Completion ring
  ringContainer: { alignItems: 'center', justifyContent: 'center' },
  ringBg: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 3, borderColor: 'rgba(16,185,129,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  ringText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  ringLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },

  // Search
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: spacing.md, marginTop: spacing.md,
    backgroundColor: colors.white, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  searchInput: { flex: 1, fontSize: fontSize.sm, color: colors.text, padding: 0 },

  // Chips
  chipsScroll: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs, gap: 6 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.gray200,
    marginRight: 6,
  },
  chipActive: { backgroundColor: '#064e3b', borderColor: '#064e3b' },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.gray600 },
  chipTextActive: { color: '#ffffff' },

  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: colors.gray500,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.xs,
  },

  // Card
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.white, borderRadius: 16,
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    padding: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  cardAvatar: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  cardAvatarText: { fontSize: 16, fontWeight: '800' },
  cardMid: { flex: 1 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vendorName: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1, marginRight: 8 },
  total: { fontSize: 15, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  cardBotRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cardMetaInline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dnNum: { fontSize: 11, fontWeight: '600', color: colors.gray500 },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.gray300 },
  date: { fontSize: 11, color: colors.gray400 },
  reasonText: { fontSize: 11, color: colors.gray400, marginTop: 3, fontStyle: 'italic' },

  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#064e3b',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#064e3b', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
