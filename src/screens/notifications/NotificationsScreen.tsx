import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  ScrollView, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing } from '../../theme';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';

const FILTERS = [
  { value: 'All',       label: 'All',         icon: 'apps' as const },
  { value: 'overdue',   label: 'Overdue',     icon: 'alert-circle' as const },
  { value: 'stock',     label: 'Stock',       icon: 'cube' as const },
  { value: 'upcoming',  label: 'Upcoming',    icon: 'time' as const },
  { value: 'task',      label: 'Tasks',       icon: 'checkbox' as const },
  { value: 'payment',   label: 'Payments',    icon: 'cash' as const },
];

const PRIO: Record<string, { color: string; bg: string; label: string }> = {
  high:   { color: '#dc2626', bg: '#fee2e2', label: 'Urgent' },
  medium: { color: '#d97706', bg: '#fef3c7', label: 'Attention' },
  low:    { color: '#2563eb', bg: '#dbeafe', label: 'Info' },
};

function getIcon(type: string): keyof typeof Ionicons.glyphMap {
  if (!type) return 'notifications';
  if (type.includes('overdue_invoice') || type.includes('upcoming_invoice')) return 'document-text';
  if (type.includes('overdue_bill') || type.includes('upcoming_bill')) return 'receipt';
  if (type.includes('stock')) return 'cube';
  if (type.includes('payment_received')) return 'arrow-down-circle';
  if (type.includes('payment_made')) return 'arrow-up-circle';
  if (type.includes('task')) return 'checkbox';
  return 'notifications';
}

function relTime(s?: string): string {
  if (!s) return '';
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dd = new Date(d);
    dd.setHours(0, 0, 0, 0);
    const diff = Math.round((dd.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 1 && diff <= 7) return `In ${diff} days`;
    if (diff < -1 && diff >= -30) return `${Math.abs(diff)}d ago`;
    const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
    return `${d.getDate()} ${m}`;
  } catch { return s; }
}

export default function NotificationsScreen({ navigation }: { navigation: any }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [counts, setCounts] = useState({ high: 0, medium: 0, low: 0, total: 0 });

  const fetchData = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (oid) {
        setOrgId(oid);
        const [nRes, cRes] = await Promise.all([
          api.get(`/api/notifications?org_id=${oid}`),
          api.get(`/api/notifications/count?org_id=${oid}`),
        ]);
        setNotifications(nRes.data || []);
        setCounts(cRes.data || { high: 0, medium: 0, low: 0, total: 0 });
        // Auto-mark all as read once the user views the screen — bell clears automatically
        if ((cRes.data?.total || 0) > 0) {
          try { await api.post('/api/notifications/mark-all-read', { org_id: oid }); } catch {}
          setCounts({ high: 0, medium: 0, low: 0, total: 0 });
        }
      }
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  const markAllRead = async () => {
    if (!orgId || counts.total === 0) return;
    Alert.alert('Mark all as read?', `This will clear ${counts.total} notification${counts.total === 1 ? '' : 's'} from your bell.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark all read',
        onPress: async () => {
          setMarking(true);
          try {
            await api.post('/api/notifications/mark-all-read', { org_id: orgId });
            await fetchData();
          } catch { Alert.alert('Error', 'Could not mark all as read'); }
          finally { setMarking(false); }
        },
      },
    ]);
  };

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);

  const filtered = useMemo(() => {
    let data = notifications;
    if (filter !== 'All') {
      data = data.filter((n: any) => n.type?.toLowerCase().includes(filter));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((n: any) =>
        n.title?.toLowerCase().includes(q) ||
        n.message?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [notifications, filter, search]);

  const navigateToEntity = (n: any) => {
    if (!n.entity_type || !n.entity_id) return;
    switch (n.entity_type) {
      case 'invoice':
        navigation.navigate('Invoices', { screen: 'InvoiceDetail', params: { id: n.entity_id } });
        break;
      case 'purchase_bill':
        navigation.navigate('Purchase', { screen: 'PBDetail', params: { id: n.entity_id } });
        break;
      case 'item':
        navigation.navigate('Inventory');
        break;
      case 'task':
        navigation.navigate('Tasks', { screen: 'TaskDetail', params: { id: n.entity_id } });
        break;
      case 'payment':
        navigation.navigate('Payments', { screen: 'PaymentDetail', params: { id: n.entity_id } });
        break;
      case 'purchase_payment':
        navigation.navigate('PurchasePayments', { screen: 'PurchasePaymentDetail', params: { id: n.entity_id } });
        break;
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const p = PRIO[item.priority] || PRIO.low;
    const icon = getIcon(item.type);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigateToEntity(item)}
      >
        <View style={[styles.iconBox, { backgroundColor: p.bg, borderColor: p.color + '40' }]}>
          <Ionicons name={icon} size={18} color={p.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.cardTopRow}>
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            <View style={[styles.prioBadge, { backgroundColor: p.bg }]}>
              <Text style={[styles.prioBadgeText, { color: p.color }]}>{p.label}</Text>
            </View>
          </View>
          {item.message ? <Text style={styles.message} numberOfLines={2}>{item.message}</Text> : null}
          {item.created_at ? (
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={11} color={colors.gray500} />
              <Text style={styles.metaText}>{relTime(item.created_at)}</Text>
            </View>
          ) : null}
        </View>
        {item.entity_type && item.entity_id ? (
          <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        contentContainerStyle={{ paddingBottom: 30 }}
        ListHeaderComponent={
          <View>
            {/* Hero */}
            <View style={styles.hero}>
              <View style={styles.heroAccent} />
              <View style={styles.heroAccent2} />
              <View style={styles.heroTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroEyebrow}>Notifications</Text>
                  <Text style={styles.heroValue}>{counts.total}</Text>
                  <Text style={styles.heroSub}>
                    {counts.high > 0 ? `${counts.high} urgent • ` : ''}{counts.medium} attention
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.heroIcon}
                  activeOpacity={0.8}
                  onPress={markAllRead}
                  disabled={marking || counts.total === 0}
                >
                  <Ionicons name={counts.total === 0 ? 'checkmark-done' : 'checkmark-done-outline'} size={22} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.kpiRow}>
                <View style={styles.kpi}>
                  <View style={[styles.kpiDot, { backgroundColor: '#fca5a5' }]} />
                  <Text style={styles.kpiLabel}>Urgent</Text>
                  <Text style={[styles.kpiVal, { color: '#fca5a5' }]}>{counts.high}</Text>
                </View>
                <View style={styles.kpi}>
                  <View style={[styles.kpiDot, { backgroundColor: '#fbbf24' }]} />
                  <Text style={styles.kpiLabel}>Attention</Text>
                  <Text style={[styles.kpiVal, { color: '#fbbf24' }]}>{counts.medium}</Text>
                </View>
                <View style={[styles.kpi, { borderRightWidth: 0 }]}>
                  <View style={[styles.kpiDot, { backgroundColor: '#93c5fd' }]} />
                  <Text style={styles.kpiLabel}>Info</Text>
                  <Text style={[styles.kpiVal, { color: '#93c5fd' }]}>{counts.low}</Text>
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
                  placeholder="Type to search notifications..."
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

            {/* Filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
              {FILTERS.map(f => {
                const active = filter === f.value;
                return (
                  <TouchableOpacity
                    key={f.value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setFilter(f.value)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name={f.icon} size={12} color={active ? '#fff' : colors.gray500} />
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={loading ? <SkeletonList count={6} /> : (
          <View style={{ paddingTop: 40 }}>
            <EmptyState icon="notifications-off-outline" title="All caught up" subtitle="No notifications right now" />
          </View>
        )}
      />
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
  kpiDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 4 },
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
  chipsScroll: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4, gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#eef0f5',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.gray600 },
  chipTextActive: { color: '#fff' },

  // Card
  card: {
    flexDirection: 'row', alignItems: 'center',
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
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontSize: 13.5, fontWeight: '700', color: colors.gray900, letterSpacing: -0.2, lineHeight: 18 },
  prioBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  prioBadgeText: { fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  message: { fontSize: 12, color: colors.gray600, marginTop: 3, fontWeight: '500', lineHeight: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  metaText: { fontSize: 11, color: colors.gray500, fontWeight: '600' },
});
