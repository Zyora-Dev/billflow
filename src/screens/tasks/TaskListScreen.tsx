import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  ScrollView, Alert, TextInput, Share, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';

const STATUS_META: Record<string, { color: string; bg: string }> = {
  Pending:        { color: '#475569', bg: '#f1f5f9' },
  Assigned:       { color: '#1d4ed8', bg: '#dbeafe' },
  'In Progress':  { color: '#b45309', bg: '#fef3c7' },
  Completed:      { color: '#15803d', bg: '#dcfce7' },
  Delayed:        { color: '#dc2626', bg: '#fee2e2' },
  Cancelled:      { color: '#6b7280', bg: '#f3f4f6' },
};

const STATUSES = ['All', 'Pending', 'Assigned', 'In Progress', 'Completed', 'Delayed', 'Cancelled'];

const PRIO_COLORS: Record<string, string> = {
  Low: '#3b82f6',
  Medium: '#0ea5e9',
  High: '#f97316',
  Urgent: '#ef4444',
};

const CATEGORIES = [
  { value: 'All',         label: 'All',         icon: 'apps' as const,                color: colors.gray600 },
  { value: 'AMC',         label: 'AMC',         icon: 'repeat' as const,              color: '#7c3aed' },
  { value: 'Repair',      label: 'Repair',      icon: 'construct' as const,           color: '#dc2626' },
  { value: 'Replacement', label: 'Replacement', icon: 'swap-horizontal' as const,     color: '#1d4ed8' },
  { value: 'Others',      label: 'Others',      icon: 'ellipsis-horizontal' as const, color: '#6b7280' },
];

const CAT_META: Record<string, { color: string; bg: string; icon: any }> = {
  AMC:         { color: '#7c3aed', bg: '#ede9fe', icon: 'repeat' },
  Repair:      { color: '#dc2626', bg: '#fee2e2', icon: 'construct' },
  Replacement: { color: '#1d4ed8', bg: '#dbeafe', icon: 'swap-horizontal' },
  Others:      { color: '#6b7280', bg: '#f3f4f6', icon: 'ellipsis-horizontal' },
};

type Period = 'all' | 'month' | 'today';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'all',   label: 'All time' },
  { value: 'month', label: 'This month' },
  { value: 'today', label: 'Today' },
];

function isWithin(taskDate: string | null | undefined, period: Period): boolean {
  if (!taskDate) return period === 'all';
  if (period === 'all') return true;
  const d = new Date(taskDate);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  if (period === 'today') {
    return d.toDateString() === now.toDateString();
  }
  if (period === 'month') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  return true;
}

export default function TaskListScreen({ navigation }: { navigation: any }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [status, setStatus] = useState('All');
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'task' | 'order'>('task');
  const [period, setPeriod] = useState<Period>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState('');
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (oid) {
        setOrgId(oid);
        const res = await api.get(`/api/tasks?org_id=${oid}&task_type=${tab}`);
        setTasks(Array.isArray(res.data) ? res.data : (res.data?.data || []));
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);

  const filtered = useMemo(() => {
    let data = tasks.filter(t => isWithin(t.task_date, period));
    if (status !== 'All') data = data.filter(t => t.status === status);
    if (category !== 'All') data = data.filter(t => (t.category || '') === category);
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.customer_name?.toLowerCase().includes(q) ||
        t.employee_name?.toLowerCase().includes(q) ||
        t.mobile?.toLowerCase().includes(q),
      );
    }
    return data;
  }, [tasks, period, status, category, search]);

  const stats = useMemo(() => {
    const periodScope = tasks.filter(t => isWithin(t.task_date, period));
    const today = new Date().toISOString().split('T')[0];
    return {
      total: periodScope.length,
      pending: periodScope.filter(t => t.status === 'Pending' || t.status === 'Assigned').length,
      inProgress: periodScope.filter(t => t.status === 'In Progress').length,
      completed: periodScope.filter(t => t.status === 'Completed').length,
      delayed: periodScope.filter(t => t.status === 'Delayed').length,
      todayCount: tasks.filter(t => t.task_date === today).length,
      orderValue: periodScope.reduce((s, t) => s + (parseFloat(t.order_amount) || 0), 0),
    };
  }, [tasks, period]);

  const quickStatus = (id: number, current: string) => {
    const opts = ['Pending', 'Assigned', 'In Progress', 'Completed', 'Delayed', 'Cancelled'].filter(s => s !== current);
    Alert.alert('Change status', '', [
      ...opts.map(s => ({
        text: s,
        onPress: async () => {
          try { await api.patch(`/api/tasks/${id}/status?status=${s}`); fetchData(); } catch {}
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const exportPDF = async () => {
    if (filtered.length === 0) { Alert.alert('Nothing to export'); return; }
    setExporting(true);
    try {
      const rows = filtered.map((t, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${t.title || ''}</td>
          <td>${t.category || '-'}</td>
          <td>${t.customer_name || '-'}</td>
          <td>${t.employee_name || '-'}</td>
          <td>${t.task_date || '-'}</td>
          <td><span class="badge">${t.priority || '-'}</span></td>
          <td><span class="badge">${t.status || '-'}</span></td>
          ${tab === 'order' ? `<td style="text-align:right">₹${(parseFloat(t.order_amount) || 0).toLocaleString('en-IN')}</td>` : ''}
        </tr>
      `).join('');

      const html = `
        <html><head><meta charset="utf-8"/>
        <style>
          body { font-family: -apple-system, sans-serif; padding: 24px; color: #1f2937; }
          h1 { color: #1a1a40; margin: 0 0 4px 0; font-size: 20px; }
          .sub { color: #6b7280; font-size: 11px; margin-bottom: 16px; }
          .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 18px; }
          .card { background: #f9fafb; border-radius: 8px; padding: 10px; }
          .card .lbl { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; }
          .card .val { font-size: 16px; font-weight: 800; color: #1a1a40; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #1a1a40; color: #fff; padding: 8px; text-align: left; font-weight: 700; }
          td { padding: 7px 8px; border-bottom: 1px solid #e5e7eb; }
          .badge { background: #f3f4f6; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; }
        </style></head><body>
          <h1>${tab === 'order' ? 'Orders' : 'Tasks'} Report</h1>
          <div class="sub">Period: ${PERIODS.find(p => p.value === period)?.label} • Generated ${new Date().toLocaleString()}</div>
          <div class="stats">
            <div class="card"><div class="lbl">Total</div><div class="val">${stats.total}</div></div>
            <div class="card"><div class="lbl">Pending</div><div class="val">${stats.pending}</div></div>
            <div class="card"><div class="lbl">In Progress</div><div class="val">${stats.inProgress}</div></div>
            <div class="card"><div class="lbl">Completed</div><div class="val">${stats.completed}</div></div>
          </div>
          <table>
            <thead><tr>
              <th>#</th><th>Title</th><th>Category</th><th>Customer</th><th>Assigned</th>
              <th>Date</th><th>Priority</th><th>Status</th>
              ${tab === 'order' ? '<th style="text-align:right">Amount</th>' : ''}
            </tr></thead>
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

  const renderTask = ({ item }: { item: any }) => {
    const sm = STATUS_META[item.status] || STATUS_META.Pending;
    const pColor = PRIO_COLORS[item.priority] || colors.gray400;
    const cm = item.category ? CAT_META[item.category] : null;
    const isOverdue = item.due_date && item.status !== 'Completed' && new Date(item.due_date) < new Date(new Date().toDateString());

    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => navigation.navigate('TaskDetail', { id: item.id })}
        onLongPress={() => quickStatus(item.id, item.status)}
        activeOpacity={0.85}
      >
        <View style={[s.prioStrip, { backgroundColor: pColor }]} />
        <View style={{ flex: 1, paddingLeft: 10 }}>
          <View style={s.cardTop}>
            <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
            <View style={[s.statusBadge, { backgroundColor: sm.bg }]}>
              <Text style={[s.statusBadgeText, { color: sm.color }]}>{item.status}</Text>
            </View>
          </View>

          <View style={s.metaRow}>
            {cm && (
              <View style={[s.metaChip, { backgroundColor: cm.bg }]}>
                <Ionicons name={cm.icon} size={10} color={cm.color} />
                <Text style={[s.metaChipText, { color: cm.color }]}>{item.category}</Text>
              </View>
            )}
            <View style={[s.metaChip, { backgroundColor: pColor + '15' }]}>
              <View style={[s.dot, { backgroundColor: pColor }]} />
              <Text style={[s.metaChipText, { color: pColor }]}>{item.priority}</Text>
            </View>
            {item.task_date && (
              <View style={s.metaInline}>
                <Ionicons name="calendar-outline" size={10} color={colors.gray500} />
                <Text style={s.metaInlineText}>{item.task_date}{item.task_time ? ` • ${item.task_time}` : ''}</Text>
              </View>
            )}
          </View>

          <View style={[s.metaRow, { marginTop: 6 }]}>
            {item.customer_name ? (
              <View style={s.metaInline}>
                <Ionicons name="person" size={10} color={colors.gray500} />
                <Text style={s.metaInlineText} numberOfLines={1}>{item.customer_name}</Text>
              </View>
            ) : null}
            {item.employee_name ? (
              <View style={s.metaInline}>
                <Ionicons name="briefcase-outline" size={10} color={colors.gray500} />
                <Text style={s.metaInlineText} numberOfLines={1}>{item.employee_name}</Text>
              </View>
            ) : null}
          </View>

          {(item.task_type === 'order' && item.order_amount > 0) || isOverdue ? (
            <View style={[s.metaRow, { marginTop: 6 }]}>
              {item.task_type === 'order' && item.order_amount > 0 && (
                <View style={[s.metaChip, { backgroundColor: colors.primary + '12' }]}>
                  <Ionicons name="cube" size={10} color={colors.primary} />
                  <Text style={[s.metaChipText, { color: colors.primary }]}>
                    ₹{Number(item.order_amount).toLocaleString('en-IN')}
                  </Text>
                </View>
              )}
              {isOverdue ? (
                <View style={[s.metaChip, { backgroundColor: '#fee2e2' }]}>
                  <Ionicons name="warning" size={10} color="#dc2626" />
                  <Text style={[s.metaChipText, { color: '#dc2626' }]}>Overdue</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      <FlatList
        data={filtered}
        keyExtractor={(i, idx) => i?.id != null ? `task-${i.id}` : `task-${idx}`}
        renderItem={renderTask}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <View>
            {/* Hero card */}
            <View style={s.hero}>
              <View style={s.heroAccent} />
              <View style={s.heroAccent2} />
              <View style={s.heroTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.heroEyebrow}>{tab === 'order' ? 'Orders' : 'Service Tasks'}</Text>
                  <Text style={s.heroValue}>{stats.total}</Text>
                  <Text style={s.heroSub}>
                    {stats.pending} pending • {stats.completed} done
                  </Text>
                </View>
                <TouchableOpacity
                  style={s.heroPill}
                  onPress={() => {
                    const idx = PERIODS.findIndex(p => p.value === period);
                    setPeriod(PERIODS[(idx + 1) % PERIODS.length].value);
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="calendar-outline" size={13} color="#fff" />
                  <Text style={s.heroPillText}>{PERIODS.find(p => p.value === period)?.label}</Text>
                  <Ionicons name="chevron-down" size={13} color="#fff" />
                </TouchableOpacity>
              </View>

              {tab === 'order' && stats.orderValue > 0 && (
                <View style={s.heroOrderTotal}>
                  <Text style={s.heroOrderLabel}>Order value</Text>
                  <Text style={s.heroOrderValue}>₹{stats.orderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                </View>
              )}

              <View style={s.kpiRow}>
                <View style={s.kpi}>
                  <Text style={s.kpiLabel}>Pending</Text>
                  <Text style={[s.kpiVal, { color: '#fbbf24' }]}>{stats.pending}</Text>
                </View>
                <View style={s.kpi}>
                  <Text style={s.kpiLabel}>Active</Text>
                  <Text style={[s.kpiVal, { color: '#60a5fa' }]}>{stats.inProgress}</Text>
                </View>
                <View style={s.kpi}>
                  <Text style={s.kpiLabel}>Done</Text>
                  <Text style={[s.kpiVal, { color: '#86efac' }]}>{stats.completed}</Text>
                </View>
                <View style={[s.kpi, { borderRightWidth: 0 }]}>
                  <Text style={s.kpiLabel}>Delayed</Text>
                  <Text style={[s.kpiVal, { color: '#fca5a5' }]}>{stats.delayed}</Text>
                </View>
              </View>
            </View>

            {/* Tab pills */}
            <View style={s.tabRow}>
              <TouchableOpacity
                style={[s.tabPill, tab === 'task' && s.tabPillActive]}
                onPress={() => setTab('task')}
                activeOpacity={0.85}
              >
                <Ionicons name="checkbox-outline" size={14} color={tab === 'task' ? '#fff' : colors.gray600} />
                <Text style={[s.tabPillText, tab === 'task' && s.tabPillTextActive]}>Tasks</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.tabPill, tab === 'order' && s.tabPillActive]}
                onPress={() => setTab('order')}
                activeOpacity={0.85}
              >
                <Ionicons name="cube-outline" size={14} color={tab === 'order' ? '#fff' : colors.gray600} />
                <Text style={[s.tabPillText, tab === 'order' && s.tabPillTextActive]}>Orders</Text>
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={s.searchWrap}>
              <View style={s.searchRow}>
                <Ionicons name="search" size={18} color={colors.primary} />
                <TextInput
                  style={s.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder={`Type to search ${tab === 'order' ? 'orders' : 'tasks'}...`}
                  placeholderTextColor={colors.gray400}
                />
                {search.trim().length > 0 ? (
                  <View style={s.countChip}>
                    <Text style={s.countChipText}>{filtered.length}</Text>
                  </View>
                ) : null}
                {search ? (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={colors.gray400} />
                  </TouchableOpacity>
                ) : null}
                <View style={s.searchDivider} />
                <TouchableOpacity style={s.searchActionBtn} activeOpacity={0.8} onPress={exportPDF} disabled={exporting}>
                  {exporting ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="download-outline" size={17} color={colors.primary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Status chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipScroll}>
              {STATUSES.map(st => {
                const m = st === 'All' ? null : STATUS_META[st];
                const active = status === st;
                return (
                  <TouchableOpacity
                    key={st}
                    style={[
                      s.chip,
                      active && (m
                        ? { backgroundColor: m.bg, borderColor: m.color }
                        : { backgroundColor: colors.primary, borderColor: colors.primary }),
                    ]}
                    onPress={() => setStatus(st)}
                    activeOpacity={0.85}
                  >
                    {m && <View style={[s.chipDot, { backgroundColor: m.color }]} />}
                    <Text style={[
                      s.chipText,
                      active && (m ? { color: m.color, fontWeight: '800' } : { color: '#fff', fontWeight: '800' }),
                    ]}>{st}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Category chips (tasks only) */}
            {tab === 'task' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.chipScroll, { paddingTop: 0 }]}>
                {CATEGORIES.map(c => {
                  const active = category === c.value;
                  return (
                    <TouchableOpacity
                      key={c.value}
                      style={[
                        s.catChip,
                        active && { backgroundColor: c.color + '15', borderColor: c.color },
                      ]}
                      onPress={() => setCategory(c.value)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name={c.icon} size={12} color={active ? c.color : colors.gray500} />
                      <Text style={[
                        s.catChipText,
                        active && { color: c.color, fontWeight: '800' },
                      ]}>{c.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        }
        ListEmptyComponent={loading ? (
          <SkeletonList count={6} />
        ) : (
          <View style={{ paddingTop: 40 }}>
            <EmptyState
              icon={tab === 'order' ? 'cube-outline' : 'checkbox-outline'}
              title={`No ${tab === 'order' ? 'orders' : 'tasks'}`}
              subtitle="Tap + to create one"
            />
          </View>
        )}
      />

      <TouchableOpacity
        style={s.fab}
        onPress={() => navigation.navigate('TaskForm', { task_type: tab })}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },

  // Hero
  hero: {
    backgroundColor: '#065f46',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    overflow: 'hidden',
    shadowColor: '#065f46', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  heroAccent: {
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -55, right: -35,
  },
  heroAccent2: {
    position: 'absolute',
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -30, left: -20,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  heroEyebrow: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  heroValue: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2, fontWeight: '600' },
  heroPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  heroPillText: { color: '#fff', fontSize: 10.5, fontWeight: '700' },
  heroIcon: {
    width: 32, height: 32, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  heroOrderTotal: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10,
    marginTop: spacing.sm + 2,
  },
  heroOrderLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  heroOrderValue: { color: '#fff', fontSize: 14, fontWeight: '800' },

  kpiRow: {
    flexDirection: 'row',
    marginTop: spacing.sm + 2,
    paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)',
  },
  kpi: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.18)' },
  kpiLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  kpiVal: { fontSize: 15, fontWeight: '800', marginTop: 2 },

  // Tabs
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, marginTop: spacing.md },
  tabPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eef0f5',
  },
  tabPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabPillText: { fontSize: 13, fontWeight: '700', color: colors.gray600 },
  tabPillTextActive: { color: '#fff' },

  // Search
  searchWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
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
  countChip: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 999,
    minWidth: 24, alignItems: 'center',
  },
  countChipText: { fontSize: 11, color: colors.primary, fontWeight: '800' },
  searchDivider: { width: 1, height: 22, backgroundColor: colors.gray200 },
  searchActionBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.primary + '10',
    alignItems: 'center', justifyContent: 'center',
  },

  // Chips
  chipScroll: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4, gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#eef0f5',
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.gray600 },

  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#eef0f5',
  },
  catChipText: { fontSize: 12, fontWeight: '700', color: colors.gray600 },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: spacing.md,
    marginBottom: 10,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1, borderColor: '#eef0f5',
  },
  prioStrip: { width: 4, borderRadius: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.gray900, letterSpacing: -0.2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 2.5,
    borderRadius: 999,
  },
  metaChipText: { fontSize: 10, fontWeight: '700' },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  metaInline: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '100%' },
  metaInlineText: { fontSize: 11, color: colors.gray500, fontWeight: '600' },

  // FAB
  fab: {
    position: 'absolute',
    right: 18, bottom: 22,
    width: 54, height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
