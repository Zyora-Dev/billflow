import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  ScrollView, TextInput, ActivityIndicator, Linking, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { usePreview } from '../../components/Preview';

const STATUSES = ['All', 'Active', 'Inactive'];
const TYPES: Array<'All' | 'monthly' | 'daily'> = ['All', 'monthly', 'daily'];

const AVATAR_COLORS = [
  { bg: '#dbeafe', fg: '#1d4ed8' },
  { bg: '#fce7f3', fg: '#be185d' },
  { bg: '#dcfce7', fg: '#15803d' },
  { bg: '#fef3c7', fg: '#b45309' },
  { bg: '#ede9fe', fg: '#6d28d9' },
  { bg: '#cffafe', fg: '#0e7490' },
];

function avatarColor(name: string) {
  const idx = (name?.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export default function EmployeeListScreen({ navigation }: { navigation: any }) {
  const preview = usePreview();
  const [employees, setEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [type, setType] = useState<'All' | 'monthly' | 'daily'>('All');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (oid) {
        const res = await api.get(`/api/employees?org_id=${oid}`);
        setEmployees(Array.isArray(res.data) ? res.data : []);
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => navigation.addListener('focus', fetchData), [navigation, fetchData]);

  const filtered = useMemo(() => {
    let data = employees;
    if (status !== 'All') data = data.filter(e => e.status === status);
    if (type !== 'All') data = data.filter(e => e.salary_type === type);
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(e =>
        e.name?.toLowerCase().includes(q) ||
        e.mobile?.includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.designation?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q),
      );
    }
    return data;
  }, [employees, status, type, search]);

  const stats = useMemo(() => {
    const monthlyCost = employees
      .filter(e => e.status === 'Active' && e.salary_type === 'monthly')
      .reduce((s, e) => s + (parseFloat(e.salary_amount) || 0), 0);
    return {
      total: employees.length,
      active: employees.filter(e => e.status === 'Active').length,
      inactive: employees.filter(e => e.status === 'Inactive').length,
      monthlyCost,
    };
  }, [employees]);

  const exportPDF = async () => {
    if (filtered.length === 0) { Alert.alert('Nothing to export'); return; }
    setExporting(true);
    try {
      const rows = filtered.map((e, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${e.name || ''}</td>
          <td>${e.designation || '-'}</td>
          <td>${e.department || '-'}</td>
          <td>${e.emp_type || '-'}</td>
          <td>${e.mobile || '-'}</td>
          <td>${e.salary_type || '-'}</td>
          <td style="text-align:right">₹${(parseFloat(e.salary_amount) || 0).toLocaleString('en-IN')}</td>
          <td>${e.status || '-'}</td>
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
        </style></head><body>
          <h1>Employees Report</h1>
          <div class="sub">Generated ${new Date().toLocaleString()}</div>
          <div class="stats">
            <div class="card"><div class="lbl">Total</div><div class="val">${stats.total}</div></div>
            <div class="card"><div class="lbl">Active</div><div class="val">${stats.active}</div></div>
            <div class="card"><div class="lbl">Inactive</div><div class="val">${stats.inactive}</div></div>
            <div class="card"><div class="lbl">Monthly Cost</div><div class="val">₹${stats.monthlyCost.toLocaleString('en-IN')}</div></div>
          </div>
          <table>
            <thead><tr>
              <th>#</th><th>Name</th><th>Designation</th><th>Department</th><th>Type</th>
              <th>Mobile</th><th>Salary Type</th><th style="text-align:right">Salary</th><th>Status</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch { Alert.alert('Error', 'Could not generate PDF'); } finally { setExporting(false); }
  };

  const renderItem = ({ item }: { item: any }) => {
    const a = avatarColor(item.name || '?');
    const isActive = item.status === 'Active';
    return (
      <TouchableOpacity
        style={s.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('EmployeeDetail', { id: item.id })}
        onLongPress={() => preview.show({ type: 'employee', id: item.id })}
        delayLongPress={350}
      >
        <View style={[s.avatar, { backgroundColor: a.bg }]}>
          <Text style={[s.avatarText, { color: a.fg }]}>
            {(item.name || '?')[0].toUpperCase()}
          </Text>
          <View style={[s.statusDot, { backgroundColor: isActive ? '#22c55e' : '#9ca3af' }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>{item.name}</Text>
          {(item.designation || item.department) ? (
            <View style={s.metaRow}>
              {item.designation ? (
                <View style={[s.tagChip, { backgroundColor: '#ede9fe' }]}>
                  <Text style={[s.tagText, { color: '#6d28d9' }]}>{item.designation}</Text>
                </View>
              ) : null}
              {item.department ? (
                <View style={[s.tagChip, { backgroundColor: '#dbeafe' }]}>
                  <Text style={[s.tagText, { color: '#1d4ed8' }]}>{item.department}</Text>
                </View>
              ) : null}
              {item.emp_type ? (
                <View style={[s.tagChip, { backgroundColor: item.emp_type === 'Full Time' ? '#dbeafe' : item.emp_type === 'Part Time' ? '#fef3c7' : item.emp_type === 'Contract' ? '#ede9fe' : item.emp_type === 'Freelancer' ? '#cffafe' : '#f3f4f6' }]}>
                  <Text style={[s.tagText, { color: item.emp_type === 'Full Time' ? '#1d4ed8' : item.emp_type === 'Part Time' ? '#b45309' : item.emp_type === 'Contract' ? '#6d28d9' : item.emp_type === 'Freelancer' ? '#0e7490' : '#6b7280' }]}>{item.emp_type}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <View style={s.metaRow}>
            {item.mobile ? (
              <View style={s.metaInline}>
                <Ionicons name="call-outline" size={10} color={colors.gray500} />
                <Text style={s.metaText}>{item.mobile}</Text>
              </View>
            ) : null}
            {item.email ? (
              <View style={s.metaInline}>
                <Ionicons name="mail-outline" size={10} color={colors.gray500} />
                <Text style={s.metaText} numberOfLines={1}>{item.email}</Text>
              </View>
            ) : null}
          </View>
          <View style={[s.metaRow, { marginTop: 4 }]}>
            <View style={[s.salaryChip, { backgroundColor: colors.primary + '12' }]}>
              <Ionicons name="cash-outline" size={10} color={colors.primary} />
              <Text style={[s.salaryChipText, { color: colors.primary }]}>
                ₹{Number(item.salary_amount || 0).toLocaleString('en-IN')}
                <Text style={{ fontSize: 9 }}>/{item.salary_type === 'monthly' ? 'mo' : 'day'}</Text>
              </Text>
            </View>
            {item.joining_date ? (
              <View style={s.metaInline}>
                <Ionicons name="calendar-outline" size={10} color={colors.gray500} />
                <Text style={s.metaText}>{item.joining_date}</Text>
              </View>
            ) : null}
          </View>
        </View>
        {item.mobile ? (
          <TouchableOpacity
            style={s.callBtn}
            onPress={(e) => { e.stopPropagation?.(); Linking.openURL(`tel:${item.mobile}`); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="call" size={14} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      <FlatList
        data={filtered}
        keyExtractor={(i, idx) => i?.id != null ? `emp-${i.id}` : `emp-${idx}`}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <View>
            {/* Hero */}
            <View style={s.hero}>
              <View style={s.heroAccent} />
              <View style={s.heroTopRow}>
                <View>
                  <Text style={s.heroEyebrow}>Team</Text>
                  <Text style={s.heroValue}>{stats.total}</Text>
                  <Text style={s.heroSub}>{stats.active} active • {stats.inactive} inactive</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <TouchableOpacity
                    style={s.heroIcon}
                    onPress={exportPDF}
                    disabled={exporting}
                    activeOpacity={0.85}
                  >
                    {exporting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="download-outline" size={16} color="#fff" />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.heroIcon}
                    onPress={() => (navigation as any).getParent()?.navigate('Payroll')}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="wallet-outline" size={16} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.heroIcon}
                    onPress={() => navigation.navigate('Attendance')}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="calendar-outline" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
              {stats.monthlyCost > 0 && (
                <View style={s.heroCostStrip}>
                  <Text style={s.heroCostLabel}>Monthly payroll cost</Text>
                  <Text style={s.heroCostValue}>₹{stats.monthlyCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                </View>
              )}
            </View>

            {/* Search */}
            <View style={s.searchWrap}>
              <View style={s.searchRow}>
                <Ionicons name="search" size={16} color={colors.gray400} />
                <TextInput
                  style={s.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search by name, mobile or email..."
                  placeholderTextColor={colors.placeholder}
                />
                {search ? (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Ionicons name="close-circle" size={16} color={colors.gray400} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* Status chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipScroll}>
              {STATUSES.map(st => {
                const active = status === st;
                const tone = st === 'Active' ? '#22c55e' : st === 'Inactive' ? '#9ca3af' : colors.primary;
                return (
                  <TouchableOpacity
                    key={st}
                    style={[s.chip, active && { backgroundColor: tone + '15', borderColor: tone }]}
                    onPress={() => setStatus(st)}
                    activeOpacity={0.85}
                  >
                    {st !== 'All' && <View style={[s.chipDot, { backgroundColor: tone }]} />}
                    <Text style={[s.chipText, active && { color: tone, fontWeight: '800' }]}>{st}</Text>
                  </TouchableOpacity>
                );
              })}
              <View style={{ width: 8 }} />
              {TYPES.map(t => {
                const active = type === t;
                const label = t === 'All' ? 'All types' : t === 'monthly' ? 'Monthly' : 'Daily';
                return (
                  <TouchableOpacity
                    key={t}
                    style={[s.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    onPress={() => setType(t)}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={t === 'monthly' ? 'calendar-outline' : t === 'daily' ? 'today-outline' : 'apps-outline'}
                      size={11}
                      color={active ? '#fff' : colors.gray500}
                    />
                    <Text style={[s.chipText, active && { color: '#fff', fontWeight: '800' }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={loading ? (
          <SkeletonList count={6} />
        ) : (
          <View style={{ paddingTop: 40 }}>
            <EmptyState icon="people-outline" title="No employees" subtitle="Tap + to add your first" />
          </View>
        )}
      />

      <TouchableOpacity
        style={s.fab}
        onPress={() => navigation.navigate('EmployeeForm', {})}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },

  hero: {
    backgroundColor: colors.primary,
    margin: spacing.md,
    borderRadius: 20,
    padding: spacing.md,
    overflow: 'hidden',
  },
  heroAccent: {
    position: 'absolute',
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -60, right: -50,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroEyebrow: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  heroValue: { color: '#fff', fontSize: 34, fontWeight: '900', marginTop: 2, lineHeight: 38 },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2, fontWeight: '600' },
  heroIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroCostStrip: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, marginTop: 12,
  },
  heroCostLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  heroCostValue: { color: '#fff', fontSize: 14, fontWeight: '800' },

  searchWrap: { paddingHorizontal: spacing.md },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 9,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 },

  chipScroll: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: colors.gray200,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.gray600 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff',
    marginHorizontal: spacing.md,
    marginBottom: 8,
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, elevation: 1,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  avatarText: { fontSize: 17, fontWeight: '800' },
  statusDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 2, borderColor: '#fff',
  },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 3, alignItems: 'center' },
  metaInline: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, color: colors.gray500, fontWeight: '600' },
  salaryChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  salaryChipText: { fontSize: 11, fontWeight: '800' },
  tagChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  tagText: { fontSize: 10, fontWeight: '800' },

  callBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary + '12',
    alignItems: 'center', justifyContent: 'center',
  },

  fab: {
    position: 'absolute',
    right: 18, bottom: 22,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
  },
});
