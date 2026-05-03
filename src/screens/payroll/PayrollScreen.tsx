import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  Alert, TextInput, Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';

const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUSES = ['All', 'Draft', 'Paid'];

const AVATAR_COLORS = [
  { bg: '#dbeafe', fg: '#1d4ed8' },
  { bg: '#fce7f3', fg: '#be185d' },
  { bg: '#dcfce7', fg: '#15803d' },
  { bg: '#fef3c7', fg: '#b45309' },
  { bg: '#ede9fe', fg: '#6d28d9' },
];

function avatarColor(name: string) {
  const idx = (name?.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export default function PayrollScreen({ navigation }: { navigation: any }) {
  const [payroll, setPayroll] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState('');
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [showGenerate, setShowGenerate] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [workingDays, setWorkingDays] = useState('26');
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (oid) {
        setOrgId(oid);
        const res = await api.get(`/api/payroll?org_id=${oid}&month=${month}&year=${year}`);
        setPayroll(Array.isArray(res.data) ? res.data : []);
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => navigation.addListener('focus', fetchData), [navigation, fetchData]);

  const filtered = useMemo(() => {
    let data = payroll;
    if (statusFilter !== 'All') data = data.filter(p => p.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(p => p.employee_name?.toLowerCase().includes(q));
    }
    return data;
  }, [payroll, statusFilter, search]);

  const stats = useMemo(() => {
    const totalNet = payroll.reduce((s, p) => s + (parseFloat(p.net_pay) || 0), 0);
    const paidAmt = payroll.filter(p => p.status === 'Paid').reduce((s, p) => s + (parseFloat(p.net_pay) || 0), 0);
    const draftAmt = payroll.filter(p => p.status === 'Draft').reduce((s, p) => s + (parseFloat(p.net_pay) || 0), 0);
    return {
      total: payroll.length,
      paid: payroll.filter(p => p.status === 'Paid').length,
      draft: payroll.filter(p => p.status === 'Draft').length,
      totalNet,
      paidAmt,
      draftAmt,
    };
  }, [payroll]);

  const generatePayroll = async () => {
    if (!workingDays || parseInt(workingDays) <= 0) return Alert.alert('Validation', 'Enter valid working days');
    setGenerating(true);
    try {
      await api.post(`/api/payroll/generate?org_id=${orgId}&month=${month}&year=${year}&working_days=${parseInt(workingDays)}`);
      setShowGenerate(false);
      fetchData();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed to generate'); } finally { setGenerating(false); }
  };

  const markPaid = (id: number, name: string) => {
    Alert.alert('Mark as Paid', `Mark payroll for ${name} as paid?`, [
      { text: 'Cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try { await api.patch(`/api/payroll/${id}/pay`); fetchData(); }
          catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); }
        },
      },
    ]);
  };

  const deletePayroll = (id: number) => {
    Alert.alert('Delete', 'Delete this payroll record?', [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { try { await api.delete(`/api/payroll/${id}`); fetchData(); } catch {} },
      },
    ]);
  };

  const prevMonth = () => month === 1 ? (setMonth(12), setYear(y => y - 1)) : setMonth(m => m - 1);
  const nextMonth = () => month === 12 ? (setMonth(1), setYear(y => y + 1)) : setMonth(m => m + 1);

  const exportPDF = async () => {
    if (filtered.length === 0) { Alert.alert('Nothing to export'); return; }
    setExporting(true);
    try {
      const rows = filtered.map((p, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${p.employee_name || `Employee #${p.employee_id}`}</td>
          <td style="text-align:center">${p.working_days}</td>
          <td style="text-align:center">${p.present_days}</td>
          <td style="text-align:right">₹${(parseFloat(p.salary_amount) || 0).toLocaleString('en-IN')}</td>
          <td style="text-align:right">₹${(parseFloat(p.earned_amount) || 0).toLocaleString('en-IN')}</td>
          <td style="text-align:right">${p.deductions > 0 ? '-₹' + Number(p.deductions).toLocaleString('en-IN') : '-'}</td>
          <td style="text-align:right; font-weight:800; color:#1a1a40">₹${(parseFloat(p.net_pay) || 0).toLocaleString('en-IN')}</td>
          <td>${p.status}</td>
        </tr>
      `).join('');
      const html = `
        <html><head><meta charset="utf-8"/>
        <style>
          body { font-family: -apple-system, sans-serif; padding: 24px; color: #1f2937; }
          h1 { color: #1a1a40; margin: 0 0 4px 0; font-size: 20px; }
          .sub { color: #6b7280; font-size: 11px; margin-bottom: 16px; }
          .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 18px; }
          .card { background: #f9fafb; border-radius: 8px; padding: 10px; }
          .card .lbl { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; }
          .card .val { font-size: 16px; font-weight: 800; color: #1a1a40; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #1a1a40; color: #fff; padding: 8px; text-align: left; font-weight: 700; }
          td { padding: 7px 8px; border-bottom: 1px solid #e5e7eb; }
        </style></head><body>
          <h1>Payroll • ${MONTHS_FULL[month - 1]} ${year}</h1>
          <div class="sub">Generated ${new Date().toLocaleString()}</div>
          <div class="stats">
            <div class="card"><div class="lbl">Total Net Pay</div><div class="val">₹${stats.totalNet.toLocaleString('en-IN')}</div></div>
            <div class="card"><div class="lbl">Paid</div><div class="val">₹${stats.paidAmt.toLocaleString('en-IN')}</div></div>
            <div class="card"><div class="lbl">Pending</div><div class="val">₹${stats.draftAmt.toLocaleString('en-IN')}</div></div>
          </div>
          <table>
            <thead><tr>
              <th>#</th><th>Employee</th>
              <th style="text-align:center">Working</th><th style="text-align:center">Present</th>
              <th style="text-align:right">Salary</th><th style="text-align:right">Earned</th>
              <th style="text-align:right">Ded.</th><th style="text-align:right">Net Pay</th>
              <th>Status</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch { Alert.alert('Error', 'Could not generate PDF'); } finally { setExporting(false); }
  };

  const renderItem = ({ item }: { item: any }) => {
    const a = avatarColor(item.employee_name || '?');
    const isPaid = item.status === 'Paid';
    const presentRatio = item.working_days > 0 ? (item.present_days / item.working_days) : 0;
    return (
      <View style={s.card}>
        <View style={[s.avatar, { backgroundColor: a.bg }]}>
          <Text style={[s.avatarText, { color: a.fg }]}>
            {((item.employee_name || '?')[0] || '?').toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={s.empName} numberOfLines={1}>
              {item.employee_name || `Employee #${item.employee_id}`}
            </Text>
            <View style={[
              s.statusPill,
              isPaid ? { backgroundColor: '#dcfce7' } : { backgroundColor: '#fef3c7' },
            ]}>
              <Ionicons
                name={isPaid ? 'checkmark-circle' : 'time-outline'}
                size={10}
                color={isPaid ? '#15803d' : '#b45309'}
              />
              <Text style={[s.statusText, { color: isPaid ? '#15803d' : '#b45309' }]}>
                {item.status}
              </Text>
            </View>
          </View>

          {/* Attendance bar */}
          <View style={s.attBar}>
            <View style={[s.attFill, { width: `${presentRatio * 100}%` }]} />
          </View>
          <View style={s.metaRow}>
            <Text style={s.metaText}>
              {item.present_days}/{item.working_days} days
            </Text>
            <Text style={s.metaText}>
              Earned ₹{Number(item.earned_amount || 0).toLocaleString('en-IN')}
            </Text>
            {item.deductions > 0 ? (
              <Text style={[s.metaText, { color: colors.danger }]}>
                Ded. -₹{Number(item.deductions).toLocaleString('en-IN')}
              </Text>
            ) : null}
          </View>

          <View style={s.netRow}>
            <Text style={s.netLabel}>Net Pay</Text>
            <Text style={s.netValue}>
              ₹{Number(item.net_pay || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </Text>
          </View>

          {!isPaid && (
            <View style={s.actionRow}>
              <TouchableOpacity
                style={s.payBtn}
                onPress={() => markPaid(item.id, item.employee_name || 'employee')}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-done" size={13} color="#fff" />
                <Text style={s.payBtnText}>Mark Paid</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.deleteMini}
                onPress={() => deletePayroll(item.id)}
                activeOpacity={0.85}
              >
                <Ionicons name="trash-outline" size={13} color={colors.danger} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  const yearOptions: number[] = [];
  for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 3; y--) yearOptions.push(y);

  return (
    <View style={s.container}>
      <FlatList
        data={filtered}
        keyExtractor={(i, idx) => i?.id != null ? `pr-${i.id}` : `pr-${idx}`}
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
                  <Text style={s.heroEyebrow}>Total Net Pay</Text>
                  <Text style={s.heroValue}>
                    ₹{stats.totalNet.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={s.heroSub}>
                    {stats.total} employees • {stats.paid} paid • {stats.draft} pending
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <TouchableOpacity
                    style={s.heroPill}
                    onPress={() => setShowMonthPicker(true)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="calendar-outline" size={11} color="#fff" />
                    <Text style={s.heroPillText}>{MONTHS_SHORT[month - 1]} {year}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.heroIcon}
                    onPress={exportPDF}
                    disabled={exporting}
                    activeOpacity={0.85}
                  >
                    {exporting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="download-outline" size={16} color="#fff" />}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Quick month nav */}
              <View style={s.heroNavRow}>
                <TouchableOpacity onPress={prevMonth} style={s.heroNavBtn} activeOpacity={0.85}>
                  <Ionicons name="chevron-back" size={14} color="#fff" />
                  <Text style={s.heroNavText}>Prev</Text>
                </TouchableOpacity>
                <View style={s.heroSplitStats}>
                  <View style={st_split.cell}>
                    <Text style={st_split.lbl}>Paid</Text>
                    <Text style={[st_split.val, { color: '#86efac' }]}>
                      ₹{stats.paidAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                  <View style={st_split.divider} />
                  <View style={st_split.cell}>
                    <Text style={st_split.lbl}>Pending</Text>
                    <Text style={[st_split.val, { color: '#fbbf24' }]}>
                      ₹{stats.draftAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={nextMonth} style={s.heroNavBtn} activeOpacity={0.85}>
                  <Text style={s.heroNavText}>Next</Text>
                  <Ionicons name="chevron-forward" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Search */}
            <View style={s.searchWrap}>
              <View style={s.searchRow}>
                <Ionicons name="search" size={16} color={colors.gray400} />
                <TextInput
                  style={s.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search employee..."
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
                const active = statusFilter === st;
                const tone = st === 'Paid' ? '#15803d' : st === 'Draft' ? '#b45309' : colors.primary;
                return (
                  <TouchableOpacity
                    key={st}
                    style={[s.chip, active && { backgroundColor: tone + '15', borderColor: tone }]}
                    onPress={() => setStatusFilter(st)}
                    activeOpacity={0.85}
                  >
                    {st !== 'All' && <View style={[s.chipDot, { backgroundColor: tone }]} />}
                    <Text style={[s.chipText, active && { color: tone, fontWeight: '800' }]}>{st}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={loading ? (
          <SkeletonList count={6} />
        ) : (
          <View style={{ paddingTop: 30 }}>
            <EmptyState icon="wallet-outline" title="No payroll" subtitle="Tap calculator to generate" />
          </View>
        )}
      />

      <TouchableOpacity
        style={s.fab}
        onPress={() => setShowGenerate(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="calculator" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Generate sheet */}
      <Modal visible={showGenerate} transparent animationType="slide" onRequestClose={() => setShowGenerate(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Generate Payroll</Text>
            <Text style={s.modalSub}>For {MONTHS_FULL[month - 1]} {year}</Text>

            <Text style={s.modalLabel}>Working Days</Text>
            <View style={s.workingDaysRow}>
              {[22, 24, 26, 28, 30].map(d => {
                const active = workingDays === String(d);
                return (
                  <TouchableOpacity
                    key={d}
                    style={[s.dayChip, active && s.dayChipActive]}
                    onPress={() => setWorkingDays(String(d))}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.dayChipText, active && s.dayChipTextActive]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={s.input}
              value={workingDays}
              onChangeText={setWorkingDays}
              keyboardType="number-pad"
              placeholder="Custom"
              placeholderTextColor={colors.placeholder}
            />
            <Text style={s.helpText}>
              Net pay is auto-calculated based on attendance. Salary advance expenses for this month are deducted automatically.
            </Text>

            <View style={s.modalActions}>
              <TouchableOpacity style={s.btnGhost} onPress={() => setShowGenerate(false)}>
                <Text style={s.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnPrimary, generating && { opacity: 0.6 }]}
                onPress={generatePayroll}
                disabled={generating}
              >
                {generating ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                    <Text style={s.btnPrimaryText}>Generate</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Month picker sheet */}
      <Modal visible={showMonthPicker} transparent animationType="slide" onRequestClose={() => setShowMonthPicker(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Select Period</Text>

            <Text style={s.modalLabel}>Year</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
              {yearOptions.map(y => {
                const active = year === y;
                return (
                  <TouchableOpacity
                    key={y}
                    style={[s.dayChip, active && s.dayChipActive, { paddingHorizontal: 14 }]}
                    onPress={() => setYear(y)}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.dayChipText, active && s.dayChipTextActive]}>{y}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={s.modalLabel}>Month</Text>
            <View style={s.monthGrid}>
              {MONTHS_SHORT.map((m, i) => {
                const active = month === i + 1;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[s.monthCell, active && s.monthCellActive]}
                    onPress={() => setMonth(i + 1)}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.monthCellText, active && s.monthCellTextActive]}>{m}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[s.btnPrimary, { marginTop: spacing.md }]}
              onPress={() => setShowMonthPicker(false)}
            >
              <Text style={s.btnPrimaryText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st_split = StyleSheet.create({
  cell: { flex: 1, alignItems: 'center' },
  lbl: { color: 'rgba(255,255,255,0.65)', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  val: { fontSize: 13, fontWeight: '900', marginTop: 1 },
  divider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },

  // Hero
  hero: {
    backgroundColor: colors.primary,
    margin: spacing.md,
    borderRadius: 20,
    padding: spacing.md,
    overflow: 'hidden',
  },
  heroAccent: {
    position: 'absolute',
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -70, right: -60,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroEyebrow: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  heroValue: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 2, lineHeight: 32 },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2, fontWeight: '600' },
  heroPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999,
  },
  heroPillText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  heroIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroNavRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  heroNavBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 10,
  },
  heroNavText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  heroSplitStats: {
    flex: 1, flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingVertical: 7,
  },

  // Search
  searchWrap: { paddingHorizontal: spacing.md },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 9,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 },

  // Chips
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

  // Card
  card: {
    flexDirection: 'row', gap: 10,
    backgroundColor: '#fff',
    marginHorizontal: spacing.md,
    marginBottom: 8,
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, elevation: 1,
  },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  empName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 10, fontWeight: '800' },

  attBar: {
    height: 4,
    backgroundColor: colors.gray100,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  attFill: { height: '100%', backgroundColor: '#22c55e', borderRadius: 2 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 5 },
  metaText: { fontSize: 11, color: colors.gray500, fontWeight: '600' },

  netRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.primary + '08',
    borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 7,
    marginTop: 8,
  },
  netLabel: { fontSize: 11, color: colors.gray600, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  netValue: { fontSize: 16, fontWeight: '900', color: colors.primary },

  actionRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  payBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: '#22c55e',
    borderRadius: 10, paddingVertical: 8,
  },
  payBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  deleteMini: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#fee2e2',
    alignItems: 'center', justifyContent: 'center',
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 18, bottom: 22,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 32 },
  modalHandle: { width: 40, height: 4, backgroundColor: colors.gray200, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  modalSub: { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2, fontWeight: '600' },
  modalLabel: {
    fontSize: 11, fontWeight: '800', color: colors.gray500,
    textTransform: 'uppercase', letterSpacing: 0.4,
    marginTop: spacing.md, marginBottom: 6,
  },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: spacing.lg },

  workingDaysRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  dayChip: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.gray100,
  },
  dayChipActive: { backgroundColor: colors.primary },
  dayChipText: { fontSize: 13, fontWeight: '700', color: colors.gray700 },
  dayChipTextActive: { color: '#fff', fontWeight: '800' },

  input: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: spacing.md - 2,
    fontSize: fontSize.md, color: colors.text,
  },
  helpText: { fontSize: 11, color: colors.gray500, marginTop: 8, fontStyle: 'italic', lineHeight: 16 },

  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  monthCell: {
    width: '23%' as any,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: colors.gray100,
  },
  monthCellActive: { backgroundColor: colors.primary },
  monthCellText: { fontSize: 12, fontWeight: '700', color: colors.gray700 },
  monthCellTextActive: { color: '#fff', fontWeight: '800' },

  btnGhost: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', backgroundColor: colors.gray100 },
  btnGhostText: { fontSize: 14, fontWeight: '700', color: colors.gray700 },
  btnPrimary: { flex: 2, flexDirection: 'row', gap: 6, paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  btnPrimaryText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
