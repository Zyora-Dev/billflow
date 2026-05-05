import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  ScrollView, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import api from '../../api/client';
import { colors, spacing } from '../../theme';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { usePreview } from '../../components/Preview';
import StatusBadge from '../../components/StatusBadge';
import CurrencyText from '../../components/CurrencyText';

const STATUSES = ['All', 'Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'];

const STATUS_COLOR: Record<string, string> = {
  Draft: '#6b7280',
  Sent: '#3b82f6',
  Accepted: '#10B981',
  Rejected: '#ef4444',
  Expired: '#f59e0b',
};

type Period = 'all' | 'month' | 'year';
const PERIODS: { value: Period; label: string }[] = [
  { value: 'all',   label: 'All time' },
  { value: 'month', label: 'This month' },
  { value: 'year',  label: 'This year' },
];

function isWithin(date: string | undefined, period: Period): boolean {
  if (!date) return period === 'all';
  if (period === 'all') return true;
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (period === 'year') return d.getFullYear() === now.getFullYear();
  return true;
}

function fmtDateShort(s?: string) {
  if (!s) return '-';
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
    return `${d.getDate()} ${m} ${String(d.getFullYear()).slice(-2)}`;
  } catch { return s; }
}

export default function QuotationListScreen({ navigation }: { navigation: any }) {
  const preview = usePreview();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [status, setStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<Period>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (oid) {
        const res = await api.get(`/api/quotations?org_id=${oid}`);
        setQuotes(Array.isArray(res.data) ? res.data : (res.data?.data || []));
      }
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);

  const filtered = useMemo(() => {
    let data = quotes.filter(q => isWithin(q.quotation_date, period));
    if (status !== 'All') data = data.filter((q: any) => q.status === status);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((i: any) =>
        i.quotation_number?.toLowerCase().includes(q) ||
        i.customer_name?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [quotes, status, search, period]);

  const stats = useMemo(() => {
    const scope = quotes.filter(q => isWithin(q.quotation_date, period));
    return {
      total: scope.length,
      value: scope.reduce((s: number, q: any) => s + (Number(q.total) || 0), 0),
      accepted: scope.filter((q: any) => q.status === 'Accepted').length,
      sent: scope.filter((q: any) => q.status === 'Sent').length,
      draft: scope.filter((q: any) => q.status === 'Draft').length,
    };
  }, [quotes, period]);

  const exportPDF = async () => {
    if (filtered.length === 0) { Alert.alert('Nothing to export'); return; }
    setExporting(true);
    try {
      const rows = filtered.map((q, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${q.quotation_number || ''}</td>
          <td>${q.customer_name || '-'}</td>
          <td>${q.quotation_date || '-'}</td>
          <td><span class="badge">${q.status || '-'}</span></td>
          <td style="text-align:right">₹${(Number(q.total) || 0).toLocaleString('en-IN')}</td>
        </tr>
      `).join('');
      const html = `
        <html><head><meta charset="utf-8"/>
        <style>
          body { font-family: -apple-system, sans-serif; padding: 24px; color: #1f2937; }
          h1 { color: #1a1a40; margin: 0 0 4px 0; font-size: 20px; }
          .sub { color: #6b7280; font-size: 11px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #1a1a40; color: #fff; padding: 8px; text-align: left; font-weight: 700; }
          td { padding: 7px 8px; border-bottom: 1px solid #e5e7eb; }
          .badge { background: #f3f4f6; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; }
        </style></head><body>
          <h1>Quotations Report</h1>
          <div class="sub">Period: ${PERIODS.find(p => p.value === period)?.label} • Generated ${new Date().toLocaleString()}</div>
          <table>
            <thead><tr><th>#</th><th>Quote #</th><th>Customer</th><th>Date</th><th>Status</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </body></html>
      `;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch {
      Alert.alert('Error', 'Could not generate PDF');
    } finally {
      setExporting(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const sc = STATUS_COLOR[item.status] || colors.gray400;
    const initial = String(item.customer_name || 'C').trim().charAt(0).toUpperCase();
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('QuotationDetail', { id: item.id })}
        onLongPress={() => preview.show({ type: 'quotation', id: item.id })}
        delayLongPress={350}
      >
        <View style={[styles.avatar, { backgroundColor: sc + '15', borderColor: sc + '40' }]}>
          <Text style={[styles.avatarText, { color: sc }]}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.cardTopRow}>
            <Text style={styles.customer} numberOfLines={1}>{item.customer_name || 'Unknown'}</Text>
            <CurrencyText amount={item.total || 0} style={styles.amount} />
          </View>
          <View style={styles.cardMetaRow}>
            <Text style={styles.quoteNum}>{item.quotation_number}</Text>
            <View style={styles.metaDot} />
            <Text style={styles.date}>{fmtDateShort(item.quotation_date)}</Text>
            <View style={{ flex: 1 }} />
            <StatusBadge status={item.status} />
          </View>
          {item.valid_until ? (
            <Text style={styles.validUntil}>Valid until {fmtDateShort(item.valid_until)}</Text>
          ) : null}
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
                  <Text style={styles.heroEyebrow}>Total Quotations</Text>
                  <Text style={styles.heroValue}>{stats.total}</Text>
                  <Text style={styles.heroSub}>
                    Worth <CurrencyText amount={stats.value} style={styles.heroSubBold} />
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.heroPill}
                  activeOpacity={0.85}
                  onPress={() => {
                    const idx = PERIODS.findIndex(p => p.value === period);
                    setPeriod(PERIODS[(idx + 1) % PERIODS.length].value);
                  }}
                >
                  <Ionicons name="calendar-outline" size={13} color="#fff" />
                  <Text style={styles.heroPillText}>{PERIODS.find(p => p.value === period)?.label}</Text>
                  <Ionicons name="chevron-down" size={13} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.kpiRow}>
                <View style={styles.kpi}>
                  <Text style={styles.kpiLabel}>Draft</Text>
                  <Text style={[styles.kpiVal, { color: '#cbd5e1' }]}>{stats.draft}</Text>
                </View>
                <View style={styles.kpi}>
                  <Text style={styles.kpiLabel}>Sent</Text>
                  <Text style={[styles.kpiVal, { color: '#60a5fa' }]}>{stats.sent}</Text>
                </View>
                <View style={[styles.kpi, { borderRightWidth: 0 }]}>
                  <Text style={styles.kpiLabel}>Accepted</Text>
                  <Text style={[styles.kpiVal, { color: '#86efac' }]}>{stats.accepted}</Text>
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
                  placeholder="Type to search quote # or customer..."
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
                <View style={styles.searchDivider} />
                <TouchableOpacity style={styles.searchActionBtn} activeOpacity={0.8} onPress={exportPDF} disabled={exporting}>
                  {exporting ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="download-outline" size={17} color={colors.primary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Status chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
              {STATUSES.map(st => {
                const active = status === st;
                const sc = st === 'All' ? colors.primary : (STATUS_COLOR[st] || colors.gray500);
                return (
                  <TouchableOpacity
                    key={st}
                    style={[styles.chip, active && { backgroundColor: sc + '15', borderColor: sc }]}
                    onPress={() => setStatus(st)}
                    activeOpacity={0.85}
                  >
                    {st !== 'All' ? <View style={[styles.chipDot, { backgroundColor: sc }]} /> : null}
                    <Text style={[styles.chipText, active && { color: sc, fontWeight: '800' }]}>{st}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={loading ? <SkeletonList count={6} /> : (
          <View style={{ paddingTop: 40 }}>
            <EmptyState icon="document-outline" title="No quotations" subtitle="Tap + to create one" />
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => navigation.navigate('QuotationForm', {})}>
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
  heroSubBold: { color: '#fff', fontSize: 12, fontWeight: '800' },
  heroPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  heroPillText: { color: '#fff', fontSize: 10.5, fontWeight: '700' },

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
  searchDivider: { width: 1, height: 22, backgroundColor: colors.gray200 },
  searchActionBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primary + '10', alignItems: 'center', justifyContent: 'center' },

  // Chips
  chipsScroll: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4, gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#eef0f5',
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.gray600 },

  // Card
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: spacing.md, marginBottom: 10,
    borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#eef0f5',
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
    marginRight: 11,
  },
  avatarText: { fontSize: 16, fontWeight: '800' },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  customer: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.gray900, letterSpacing: -0.2 },
  amount: { fontSize: 15.5, fontWeight: '800', color: colors.gray900, letterSpacing: -0.3 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  quoteNum: { fontSize: 11.5, color: colors.primary, fontWeight: '800', letterSpacing: 0.2 },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.gray300 },
  date: { fontSize: 11, color: colors.gray500, fontWeight: '600' },
  validUntil: { fontSize: 10.5, color: colors.gray500, marginTop: 4, fontWeight: '500', fontStyle: 'italic' },

  fab: {
    position: 'absolute', right: 20, bottom: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
