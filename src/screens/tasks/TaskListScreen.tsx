import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  ScrollView, Alert, TextInput, Share, ActivityIndicator, Modal, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import DateInput from '../../components/DateInput';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
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

const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Other'];

export default function TaskListScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [status, setStatus] = useState('All');
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'task' | 'order' | 'payments'>('task');
  const [period, setPeriod] = useState<Period>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState('');
  const [exporting, setExporting] = useState(false);

  // Service payments state
  const [servicePayments, setServicePayments] = useState<any[]>([]);
  const [spLoading, setSpLoading] = useState(false);
  const [spSearch, setSpSearch] = useState('');
  const [spDateFrom, setSpDateFrom] = useState('');
  const [spDateTo, setSpDateTo] = useState('');
  const [spExporting, setSpExporting] = useState(false);

  // Complete-with-payment dialog
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentTask, setPaymentTask] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '', payment_method: 'Cash', payment_date: new Date().toISOString().split('T')[0],
    reference_number: '', notes: '',
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      let oid = user?.org_id || '';
      if (!oid) {
        const biz = await api.get('/api/business');
        oid = biz.data[0]?.org_id || '';
      }
      if (oid) {
        setOrgId(oid);
        const res = await api.get(`/api/tasks?org_id=${oid}&task_type=${tab}`);
        setTasks(Array.isArray(res.data) ? res.data : (res.data?.data || []));
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, user?.org_id]);

  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);

  // Service payments fetch
  const fetchServicePayments = useCallback(async (oid?: string) => {
    const o = oid || orgId;
    if (!o) return;
    setSpLoading(true);
    try {
      let url = `/api/service-payments?org_id=${o}`;
      if (spDateFrom) url += `&date_from=${spDateFrom}`;
      if (spDateTo) url += `&date_to=${spDateTo}`;
      const r = await api.get(url);
      setServicePayments(Array.isArray(r.data) ? r.data : []);
    } catch {} finally { setSpLoading(false); }
  }, [orgId, spDateFrom, spDateTo]);

  useEffect(() => { if (tab === 'payments' && orgId) fetchServicePayments(); }, [tab, orgId, fetchServicePayments]);

  // Complete with payment
  const openPaymentDialog = (task: any) => {
    setPaymentTask(task);
    setPaymentForm({
      amount: task.order_amount ? String(task.order_amount) : '',
      payment_method: 'Cash',
      payment_date: new Date().toISOString().split('T')[0],
      reference_number: '', notes: '',
    });
    setPaymentDialogOpen(true);
  };

  const handleCompleteWithPayment = async () => {
    if (!paymentTask) return;
    setSubmittingPayment(true);
    try {
      const amt = parseFloat(paymentForm.amount);
      if (amt > 0) {
        await api.post('/api/service-payments', {
          task_id: paymentTask.id, org_id: orgId, amount: amt,
          payment_method: paymentForm.payment_method,
          payment_date: paymentForm.payment_date,
          reference_number: paymentForm.reference_number || null,
          notes: paymentForm.notes || null,
        });
      }
      await api.patch(`/api/tasks/${paymentTask.id}/status?status=Completed`);
      setPaymentDialogOpen(false);
      setPaymentTask(null);
      fetchData();
      if (tab === 'payments') fetchServicePayments();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally { setSubmittingPayment(false); }
  };

  const handleCompleteWithoutPayment = async () => {
    if (!paymentTask) return;
    setSubmittingPayment(true);
    try {
      await api.patch(`/api/tasks/${paymentTask.id}/status?status=Completed`);
      setPaymentDialogOpen(false);
      setPaymentTask(null);
      fetchData();
    } catch {} finally { setSubmittingPayment(false); }
  };

  const deleteServicePayment = (spId: number) => {
    Alert.alert('Delete Payment', 'Remove this service payment?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/api/service-payments/${spId}`); fetchServicePayments(); } catch {}
      }},
    ]);
  };

  // Service payments stats
  const spStats = useMemo(() => {
    const q = spSearch.toLowerCase();
    const data = spSearch ? servicePayments.filter(p =>
      p.task_title?.toLowerCase().includes(q) || p.customer_name?.toLowerCase().includes(q) ||
      p.employee_name?.toLowerCase().includes(q) || p.reference_number?.toLowerCase().includes(q)
    ) : servicePayments;
    const total = data.reduce((s, p) => s + (p.amount || 0), 0);
    const cash = data.filter(p => p.payment_method === 'Cash').reduce((s, p) => s + (p.amount || 0), 0);
    const upi = data.filter(p => p.payment_method === 'UPI').reduce((s, p) => s + (p.amount || 0), 0);
    const other = total - cash - upi;
    return { data, total, cash, upi, other, count: data.length };
  }, [servicePayments, spSearch]);

  // Service payments PDF
  const exportServicePaymentsPDF = async () => {
    if (spStats.data.length === 0) { Alert.alert('Nothing to export'); return; }
    setSpExporting(true);
    try {
      const rows = spStats.data.map((p: any, i: number) => `<tr>
        <td>${i + 1}</td><td>${p.task_title || '—'}</td><td>${p.customer_name || '—'}</td>
        <td>${p.employee_name || '—'}</td><td>${p.payment_method}</td>
        <td>${p.payment_date || '—'}</td><td>${p.reference_number || '—'}</td>
        <td class="r bold">₹${(p.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>`).join('');
      const dateRange = spDateFrom || spDateTo ? `${spDateFrom || 'Start'} to ${spDateTo || 'Today'}` : 'All Time';
      const html = `<html><head><meta charset="utf-8"/><style>
        body{font-family:-apple-system,sans-serif;padding:24px;color:#1f2937;font-size:11px}
        h1{font-size:20px;color:#1a1a40;margin:0 0 4px}
        .sub{font-size:10px;color:#6b7280;margin-bottom:14px}
        .grid{display:flex;gap:8px;margin-bottom:14px}
        .box{flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px}
        .box .l{font-size:8px;text-transform:uppercase;letter-spacing:.4px;color:#9ca3af;font-weight:700}
        .box .v{font-size:15px;font-weight:900;color:#1f2937;margin-top:2px}
        table{width:100%;border-collapse:collapse;font-size:10px}
        th{background:#065f46;color:#fff;padding:7px 6px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase}
        td{padding:6px;border-bottom:1px solid #f3f4f6}
        tr:nth-child(even){background:#fafbfc}
        .r{text-align:right}.bold{font-weight:700}
        .total td{border-top:2px solid #065f46;font-weight:800;background:#f0f1f5;padding:8px 6px}
        .footer{margin-top:16px;text-align:center;font-size:9px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:8px}
      </style></head><body>
        <h1>Service Payments Report</h1>
        <div class="sub">Period: ${dateRange} · Generated: ${new Date().toLocaleDateString('en-IN')}</div>
        <div class="grid">
          <div class="box"><div class="l">Total Collected</div><div class="v" style="color:#059669">₹${spStats.total.toLocaleString('en-IN')}</div></div>
          <div class="box"><div class="l">Cash</div><div class="v">₹${spStats.cash.toLocaleString('en-IN')}</div></div>
          <div class="box"><div class="l">UPI</div><div class="v">₹${spStats.upi.toLocaleString('en-IN')}</div></div>
          <div class="box"><div class="l">Other</div><div class="v">₹${spStats.other.toLocaleString('en-IN')}</div></div>
        </div>
        <table><thead><tr><th>#</th><th>Task</th><th>Customer</th><th>Staff</th><th>Method</th><th>Date</th><th>Ref</th><th class="r">Amount</th></tr></thead>
        <tbody>${rows}
          <tr class="total"><td colspan="7" style="text-align:right">TOTAL (${spStats.count})</td>
          <td class="r">₹${spStats.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
        </tbody></table>
        <div class="footer">Generated via BillFlow</div>
      </body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch { Alert.alert('Error', 'Could not generate PDF'); } finally { setSpExporting(false); }
  };

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
          if (s === 'Completed') {
            const t = tasks.find(t => t.id === id);
            if (t) { openPaymentDialog(t); return; }
          }
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
      {tab === 'payments' ? (
        /* ═══ SERVICE PAYMENTS TAB ═══ */
        <FlatList
          data={spStats.data}
          keyExtractor={(i, idx) => `sp-${i?.id ?? idx}`}
          refreshControl={<RefreshControl refreshing={spLoading} onRefresh={() => fetchServicePayments()} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListHeaderComponent={
            <View>
              {/* Hero card */}
              <View style={[s.hero, { backgroundColor: '#065f46' }]}>
                <View style={[s.heroAccent, { backgroundColor: '#047857' }]} />
                <View style={[s.heroAccent2, { backgroundColor: 'rgba(255,255,255,0.04)' }]} />
                <View style={s.heroTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.heroEyebrow}>Service Collections</Text>
                    <Text style={s.heroValue}>₹{spStats.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                    <Text style={s.heroSub}>{spStats.count} payments collected</Text>
                  </View>
                </View>
                <View style={s.kpiRow}>
                  <View style={s.kpi}>
                    <Text style={s.kpiLabel}>Total</Text>
                    <Text style={[s.kpiVal, { color: '#86efac' }]}>₹{spStats.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                  </View>
                  <View style={s.kpi}>
                    <Text style={s.kpiLabel}>Cash</Text>
                    <Text style={[s.kpiVal, { color: '#fbbf24' }]}>₹{spStats.cash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                  </View>
                  <View style={s.kpi}>
                    <Text style={s.kpiLabel}>UPI</Text>
                    <Text style={[s.kpiVal, { color: '#93c5fd' }]}>₹{spStats.upi.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                  </View>
                  <View style={[s.kpi, { borderRightWidth: 0 }]}>
                    <Text style={s.kpiLabel}>Other</Text>
                    <Text style={[s.kpiVal, { color: '#c4b5fd' }]}>₹{spStats.other.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                  </View>
                </View>
              </View>

              {/* Tab pills */}
              <View style={s.tabRow}>
                <TouchableOpacity style={[s.tabPill]} onPress={() => setTab('task')} activeOpacity={0.85}>
                  <Ionicons name="checkbox-outline" size={14} color={colors.gray600} />
                  <Text style={s.tabPillText}>Tasks</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.tabPill]} onPress={() => setTab('order')} activeOpacity={0.85}>
                  <Ionicons name="cube-outline" size={14} color={colors.gray600} />
                  <Text style={s.tabPillText}>Orders</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.tabPill, { backgroundColor: '#065f46', borderColor: '#065f46' }]} activeOpacity={0.85}>
                  <Ionicons name="cash-outline" size={14} color="#fff" />
                  <Text style={[s.tabPillText, s.tabPillTextActive]}>Payments</Text>
                </TouchableOpacity>
              </View>

              {/* Payment search & date filters */}
              <View style={s.searchWrap}>
                <View style={s.searchRow}>
                  <Ionicons name="search" size={18} color="#065f46" />
                  <TextInput
                    style={s.searchInput}
                    value={spSearch}
                    onChangeText={setSpSearch}
                    placeholder="Search payments..."
                    placeholderTextColor={colors.gray400}
                  />
                  {spSearch ? (
                    <TouchableOpacity onPress={() => setSpSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={18} color={colors.gray400} />
                    </TouchableOpacity>
                  ) : null}
                  <View style={s.searchDivider} />
                  <TouchableOpacity style={s.searchActionBtn} activeOpacity={0.8} onPress={exportServicePaymentsPDF} disabled={spExporting}>
                    {spExporting ? <ActivityIndicator size="small" color="#065f46" /> : <Ionicons name="download-outline" size={17} color="#065f46" />}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Date range filters */}
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: colors.gray500, fontWeight: '600', marginBottom: 2 }}>From</Text>
                  <DateInput value={spDateFrom} onChange={setSpDateFrom} placeholder="Start date" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: colors.gray500, fontWeight: '600', marginBottom: 2 }}>To</Text>
                  <DateInput value={spDateTo} onChange={setSpDateTo} placeholder="End date" />
                </View>
                {(spDateFrom || spDateTo) ? (
                  <TouchableOpacity style={{ justifyContent: 'flex-end', paddingBottom: 6 }} onPress={() => { setSpDateFrom(''); setSpDateTo(''); }}>
                    <Ionicons name="close-circle" size={20} color={colors.gray400} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          }
          renderItem={({ item: p }) => (
            <TouchableOpacity style={sp.card} activeOpacity={0.85}>
              <View style={sp.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={sp.cardTitle} numberOfLines={1}>{p.task_title || 'Task Payment'}</Text>
                  {p.task_category ? (
                    <View style={sp.catBadge}>
                      <Text style={sp.catBadgeText}>{p.task_category}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={sp.amtBadge}>
                  <Text style={sp.amtBadgeText}>₹{(p.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                </View>
              </View>
              <View style={sp.cardMeta}>
                <View style={sp.metaRow}>
                  <Ionicons name="card-outline" size={12} color={colors.gray500} />
                  <View style={[sp.methodBadge, { backgroundColor: p.payment_method === 'Cash' ? '#fef3c7' : p.payment_method === 'UPI' ? '#dbeafe' : '#f3e8ff' }]}>
                    <Text style={[sp.methodBadgeText, { color: p.payment_method === 'Cash' ? '#92400e' : p.payment_method === 'UPI' ? '#1e40af' : '#7e22ce' }]}>{p.payment_method}</Text>
                  </View>
                </View>
                {p.payment_date ? (
                  <View style={sp.metaRow}>
                    <Ionicons name="calendar-outline" size={12} color={colors.gray500} />
                    <Text style={sp.metaText}>{new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                  </View>
                ) : null}
              </View>
              <View style={sp.cardMeta}>
                {p.employee_name ? (
                  <View style={sp.metaRow}>
                    <Ionicons name="person-outline" size={12} color={colors.gray500} />
                    <Text style={sp.metaText}>{p.employee_name}</Text>
                  </View>
                ) : null}
                {p.customer_name ? (
                  <View style={sp.metaRow}>
                    <Ionicons name="business-outline" size={12} color={colors.gray500} />
                    <Text style={sp.metaText}>{p.customer_name}</Text>
                  </View>
                ) : null}
              </View>
              {p.reference_number ? (
                <View style={[sp.metaRow, { marginTop: 2 }]}>
                  <Ionicons name="document-text-outline" size={12} color={colors.gray500} />
                  <Text style={sp.metaText}>Ref: {p.reference_number}</Text>
                </View>
              ) : null}
              {p.notes ? <Text style={sp.cardNotes} numberOfLines={2}>{p.notes}</Text> : null}
              <TouchableOpacity style={sp.deleteBtn} onPress={() => deleteServicePayment(p.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="trash-outline" size={14} color="#ef4444" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListEmptyComponent={spLoading ? <SkeletonList count={4} /> : (
            <View style={{ paddingTop: 40 }}>
              <EmptyState icon="cash-outline" title="No service payments" subtitle="Payments will appear when tasks are completed with collection" />
            </View>
          )}
        />
      ) : (
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
              <TouchableOpacity
                style={[s.tabPill, tab === ('payments' as string) && { backgroundColor: '#065f46', borderColor: '#065f46' }]}
                onPress={() => setTab('payments')}
                activeOpacity={0.85}
              >
                <Ionicons name="cash-outline" size={14} color={tab === ('payments' as string) ? '#fff' : colors.gray600} />
                <Text style={[s.tabPillText, tab === ('payments' as string) && s.tabPillTextActive]}>Payments</Text>
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
      )}

      <TouchableOpacity
        style={s.fab}
        onPress={() => navigation.navigate('TaskForm', { task_type: tab === 'payments' ? 'task' : tab })}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      {/* Complete with payment dialog */}
      <Modal visible={paymentDialogOpen} transparent animationType="slide" onRequestClose={() => setPaymentDialogOpen(false)}>
        <View style={sp.overlay}>
          <View style={sp.sheet}>
            <View style={sp.handle} />
            <View style={sp.dialogHeader}>
              <View style={sp.dialogIcon}>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
              </View>
              <Text style={sp.dialogTitle}>Complete Task</Text>
              <Text style={sp.dialogSub}>{paymentTask?.title}</Text>
              {paymentTask?.customer_name ? <Text style={sp.dialogCustomer}>{paymentTask.customer_name}</Text> : null}
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <Text style={sp.label}>Collection Amount</Text>
              <View style={sp.amountBox}>
                <Text style={sp.amountPrefix}>₹</Text>
                <TextInput
                  style={sp.amountInput}
                  value={paymentForm.amount}
                  onChangeText={v => setPaymentForm(f => ({ ...f, amount: v }))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#d1d5db"
                />
              </View>

              <Text style={sp.label}>Payment Method</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
                {PAYMENT_METHODS.map(m => {
                  const active = paymentForm.payment_method === m;
                  return (
                    <TouchableOpacity key={m}
                      style={[sp.methodChip, active && { backgroundColor: '#065f46', borderColor: '#065f46' }]}
                      onPress={() => setPaymentForm(f => ({ ...f, payment_method: m }))}
                    >
                      <Text style={[sp.methodChipText, active && { color: '#fff' }]}>{m}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={sp.label}>Payment Date</Text>
              <DateInput value={paymentForm.payment_date} onChange={v => setPaymentForm(f => ({ ...f, payment_date: v }))} />

              <Text style={sp.label}>Reference Number</Text>
              <TextInput
                style={sp.input}
                value={paymentForm.reference_number}
                onChangeText={v => setPaymentForm(f => ({ ...f, reference_number: v }))}
                placeholder="UPI ref / cheque no."
                placeholderTextColor="#d1d5db"
              />

              <Text style={sp.label}>Notes</Text>
              <TextInput
                style={[sp.input, { minHeight: 60, textAlignVertical: 'top' }]}
                value={paymentForm.notes}
                onChangeText={v => setPaymentForm(f => ({ ...f, notes: v }))}
                placeholder="Optional notes..."
                placeholderTextColor="#d1d5db"
                multiline
              />
            </ScrollView>

            <View style={sp.dialogActions}>
              <TouchableOpacity style={sp.ghostBtn} onPress={handleCompleteWithoutPayment} disabled={submittingPayment}>
                <Text style={sp.ghostBtnText}>Complete Without Payment</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[sp.greenBtn, submittingPayment && { opacity: 0.6 }]}
                onPress={handleCompleteWithPayment}
                disabled={submittingPayment}
              >
                {submittingPayment ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                    <Text style={sp.greenBtnText}>Record & Complete</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

/* ═══ Service payment styles ═══ */
const sp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', alignSelf: 'center', marginBottom: 12 },
  dialogHeader: { alignItems: 'center', marginBottom: 16 },
  dialogIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  dialogTitle: { fontSize: 18, fontWeight: '800', color: '#1f2937' },
  dialogSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  dialogCustomer: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  label: { fontSize: 12, fontWeight: '700', color: '#374151', marginTop: 12, marginBottom: 4 },
  amountBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', borderWidth: 2, borderColor: '#059669', borderRadius: 10, paddingHorizontal: 12 },
  amountPrefix: { fontSize: 22, fontWeight: '900', color: '#059669' },
  amountInput: { flex: 1, fontSize: 22, fontWeight: '800', color: '#065f46', paddingVertical: Platform.OS === 'ios' ? 12 : 8, marginLeft: 6 },
  methodChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb' },
  methodChipText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 14, color: '#1f2937' },
  dialogActions: { flexDirection: 'column', gap: 8, marginTop: 16 },
  ghostBtn: { paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' },
  ghostBtnText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  greenBtn: { flexDirection: 'row', gap: 6, paddingVertical: 13, borderRadius: 8, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  greenBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Payment cards
  card: { backgroundColor: '#fff', marginHorizontal: spacing.md, marginBottom: 8, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  catBadge: { marginTop: 3, backgroundColor: '#ede9fe', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  catBadgeText: { fontSize: 9, fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.3 },
  amtBadge: { backgroundColor: '#f0fdf4', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#bbf7d0' },
  amtBadgeText: { fontSize: 14, fontWeight: '900', color: '#059669' },
  cardMeta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: '#6b7280' },
  methodBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  methodBadgeText: { fontSize: 10, fontWeight: '700' },
  cardNotes: { fontSize: 11, color: '#9ca3af', fontStyle: 'italic', marginTop: 4 },
  deleteBtn: { position: 'absolute', top: 12, right: 12 },
});
