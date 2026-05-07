import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import EmptyState from '../../components/EmptyState';

const fmtDate = (d: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};
const fmtAmt = (n: number) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const METHODS = ['All', 'Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Other'];
const methodColor = (m: string) => {
  switch (m) {
    case 'Cash': return { bg: '#dcfce7', fg: '#15803d' };
    case 'UPI': return { bg: '#ede9fe', fg: '#7c3aed' };
    case 'Bank Transfer': return { bg: '#dbeafe', fg: '#1d4ed8' };
    case 'Cheque': return { bg: '#fef3c7', fg: '#b45309' };
    case 'Card': return { bg: '#fce7f3', fg: '#be185d' };
    default: return { bg: '#f3f4f6', fg: '#4b5563' };
  }
};

export default function PaymentVoucherListScreen({ navigation }: { navigation: any }) {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (!oid) { setLoading(false); setRefreshing(false); return; }
      setOrgId(oid);
      let url = `/api/purchase-payments?org_id=${encodeURIComponent(oid)}`;
      if (method !== 'All') url += `&payment_method=${encodeURIComponent(method)}`;
      const res = await api.get(url);
      setPayments(Array.isArray(res.data) ? res.data : []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [method]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((p: any) => {
      const hay = `${p.vendor_name || ''} ${p.reference_number || ''} ${p.bill_number || ''} ${p.notes || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [payments, search]);

  const totalPaid = useMemo(() =>
    filtered.reduce((s, p) => s + Number(p.amount || 0), 0), [filtered]);

  const renderCard = ({ item }: { item: any }) => {
    const mc = methodColor(item.payment_method);
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => navigation.navigate('PaymentVoucherDetail', { id: item.id })}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.vendor_name || 'Unknown Vendor'}
            </Text>
            <Text style={styles.cardDate}>{fmtDate(item.payment_date)}</Text>
          </View>
          <Text style={styles.cardAmount}>₹{fmtAmt(item.amount)}</Text>
        </View>
        <View style={styles.cardBottom}>
          <View style={[styles.badge, { backgroundColor: mc.bg }]}>
            <Text style={[styles.badgeText, { color: mc.fg }]}>{item.payment_method || '—'}</Text>
          </View>
          {item.reference_number ? (
            <Text style={styles.cardRef} numberOfLines={1}>Ref: {item.reference_number}</Text>
          ) : null}
          {item.bill_number ? (
            <Text style={styles.cardBill} numberOfLines={1}>{item.bill_number}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Hero */}
      <View style={styles.hero}>
        <Ionicons name="wallet-outline" size={24} color="rgba(255,255,255,0.8)" />
        <View style={{ flex: 1 }}>
          <Text style={styles.heroLabel}>Total Paid Out</Text>
          <Text style={styles.heroAmount}>₹{fmtAmt(totalPaid)}</Text>
        </View>
        <Text style={styles.heroCount}>{filtered.length} voucher{filtered.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.gray400} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search vendor, reference..."
          placeholderTextColor={colors.placeholder}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.gray400} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Method Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {METHODS.map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.chip, method === m && styles.chipActive]}
            onPress={() => { setMethod(m); setLoading(true); }}
          >
            <Text style={[styles.chipText, method === m && styles.chipTextActive]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={renderCard}
          contentContainerStyle={filtered.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
          ListEmptyComponent={<EmptyState icon="wallet-outline" title="No payment vouchers" subtitle="Vendor payments will appear here" />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  hero: {
    backgroundColor: '#064e3b', flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, margin: spacing.md, borderRadius: borderRadius.lg, gap: 12,
  },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.xs, fontWeight: '600' },
  heroAmount: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 2 },
  heroCount: { color: 'rgba(255,255,255,0.6)', fontSize: fontSize.xs },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    marginHorizontal: spacing.md, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, gap: 8,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: fontSize.sm, color: colors.text },

  chipRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: '#fff' },

  card: {
    backgroundColor: colors.card, marginHorizontal: spacing.md, marginBottom: spacing.sm,
    borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardName: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  cardDate: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  cardAmount: { fontSize: fontSize.md, fontWeight: '800', color: '#dc2626' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, gap: 8, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardRef: { fontSize: fontSize.xs, color: colors.textSecondary },
  cardBill: { fontSize: fontSize.xs, color: colors.info, fontWeight: '600' },
});
