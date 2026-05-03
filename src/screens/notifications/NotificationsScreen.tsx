import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import EmptyState from '../../components/EmptyState';

const FILTERS = ['All', 'Overdue', 'Low Stock', 'Upcoming', 'Tasks', 'Payments'];

const priorityColors: Record<string, string> = { high: colors.danger, medium: colors.warning, low: colors.info };

export default function NotificationsScreen({ navigation }: { navigation: any }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [filter, setFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ high: 0, medium: 0, low: 0, total: 0 });

  const fetchData = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (oid) {
        const [nRes, cRes] = await Promise.all([
          api.get(`/api/notifications?org_id=${oid}`),
          api.get(`/api/notifications/count?org_id=${oid}`),
        ]);
        setNotifications(nRes.data);
        setCounts(cRes.data);
      }
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    if (filter === 'All') setFiltered(notifications);
    else setFiltered(notifications.filter((n: any) => n.type?.toLowerCase().includes(filter.toLowerCase())));
  }, [filter, notifications]);

  const getIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    if (type?.includes('overdue')) return 'alert-circle';
    if (type?.includes('stock')) return 'cube';
    if (type?.includes('payment')) return 'cash';
    if (type?.includes('task')) return 'checkbox';
    return 'notifications';
  };

  return (
    <View style={s.container}>
      {/* Summary cards */}
      <View style={s.statsRow}>
        <View style={[s.stat, { backgroundColor: colors.danger + '15' }]}><Text style={[s.statVal, { color: colors.danger }]}>{counts.high}</Text><Text style={s.statLabel}>Urgent</Text></View>
        <View style={[s.stat, { backgroundColor: colors.warning + '15' }]}><Text style={[s.statVal, { color: colors.warning }]}>{counts.medium}</Text><Text style={s.statLabel}>Attention</Text></View>
        <View style={[s.stat, { backgroundColor: colors.info + '15' }]}><Text style={[s.statVal, { color: colors.info }]}>{counts.low}</Text><Text style={s.statLabel}>Info</Text></View>
        <View style={[s.stat, { backgroundColor: colors.gray100 }]}><Text style={s.statVal}>{counts.total}</Text><Text style={s.statLabel}>Total</Text></View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow}>
        {FILTERS.map(f => (<TouchableOpacity key={f} style={[s.chip, filter === f && s.chipActive]} onPress={() => setFilter(f)}><Text style={[s.chipText, filter === f && s.chipTextActive]}>{f}</Text></TouchableOpacity>))}
      </ScrollView>

      <FlatList data={filtered} keyExtractor={(_, i) => String(i)} renderItem={({ item }) => (
        <View style={[s.card, { borderLeftColor: priorityColors[item.priority] || colors.gray300 }]}>
          <Ionicons name={getIcon(item.type)} size={22} color={priorityColors[item.priority] || colors.gray500} style={{ marginRight: spacing.md }} />
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{item.title || item.message}</Text>
            <Text style={s.sub}>{item.description || item.type}</Text>
          </View>
        </View>
      )} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        ListEmptyComponent={loading ? null : <EmptyState icon="notifications-off-outline" title="No notifications" subtitle="You're all caught up!" />}
        contentContainerStyle={!filtered.length ? { flex: 1 } : { paddingBottom: 20 }} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  statsRow: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm },
  stat: { flex: 1, borderRadius: borderRadius.md, padding: spacing.sm, alignItems: 'center' },
  statVal: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 10, color: colors.gray500, marginTop: 2 },
  filterRow: { flexGrow: 0, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.border, marginRight: spacing.xs, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, color: colors.gray600 },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.md, padding: spacing.md, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  title: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  sub: { fontSize: fontSize.xs, color: colors.gray500, marginTop: 2 },
});
