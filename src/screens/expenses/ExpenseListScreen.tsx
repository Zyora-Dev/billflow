import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  Alert, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import CurrencyText from '../../components/CurrencyText';
import DateInput from '../../components/DateInput';

const CATEGORIES = ['Fuel', 'Grocery', 'Snacks', 'Food', 'Travel', 'Salary Advance', 'Others'];

const CAT_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  Fuel:            { icon: 'car',                  color: '#dc2626', bg: '#fee2e2' },
  Grocery:         { icon: 'cart',                 color: '#15803d', bg: '#dcfce7' },
  Snacks:          { icon: 'cafe',                 color: '#b45309', bg: '#fef3c7' },
  Food:            { icon: 'restaurant',           color: '#c2410c', bg: '#ffedd5' },
  Travel:          { icon: 'airplane',             color: '#1d4ed8', bg: '#dbeafe' },
  'Salary Advance':{ icon: 'wallet',               color: '#7c3aed', bg: '#ede9fe' },
  Others:          { icon: 'ellipsis-horizontal',  color: '#6b7280', bg: '#f3f4f6' },
};
const catMeta = (c: string) => CAT_META[c] || CAT_META.Others;

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n: number) => String(n).padStart(2, '0');

type Period =
  | { type: 'all' }
  | { type: 'month'; month: number; year: number }
  | { type: 'year'; year: number }
  | { type: 'custom'; from: string; to: string };

function periodRange(p: Period): { from: string | null; to: string | null } {
  if (p.type === 'all') return { from: null, to: null };
  if (p.type === 'month') {
    const last = new Date(p.year, p.month, 0).getDate();
    return { from: `${p.year}-${pad2(p.month)}-01`, to: `${p.year}-${pad2(p.month)}-${pad2(last)}` };
  }
  if (p.type === 'year') return { from: `${p.year}-01-01`, to: `${p.year}-12-31` };
  return { from: p.from, to: p.to };
}

function periodLabel(p: Period): string {
  if (p.type === 'all') return 'All time';
  if (p.type === 'month') return `${MONTH_LABELS[p.month - 1]} ${p.year}`;
  if (p.type === 'year') return `Year ${p.year}`;
  if (!p.from || !p.to) return 'Custom range';
  return `${p.from} → ${p.to}`;
}

const escHtml = (s: any) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtAmt = (n: number) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDateShort = (d: string) => {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; }
};

export default function ExpenseListScreen({ navigation }: { navigation: any }) {
  const today = new Date();
  const [period, setPeriod] = useState<Period>({ type: 'month', month: today.getMonth() + 1, year: today.getFullYear() });
  const [draft, setDraft] = useState<Period>(period);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [orgId, setOrgId] = useState<string>('');
  const [business, setBusiness] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [exporting, setExporting] = useState(false);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState<{ category: string; amount: string; expense_date: string; remarks: string; employee_id: number | null }>({
    category: 'Others',
    amount: '',
    expense_date: today.toISOString().split('T')[0],
    remarks: '',
    employee_id: null,
  });
  const [empPickerOpen, setEmpPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (!oid) { setLoading(false); setRefreshing(false); return; }
      setOrgId(oid);
      setBusiness(biz.data[0]);
      const [exp, emp] = await Promise.all([
        api.get(`/api/expenses?org_id=${oid}`),
        api.get(`/api/employees?org_id=${oid}&status=Active`).catch(() => ({ data: [] })),
      ]);
      setExpenses(Array.isArray(exp.data) ? exp.data : []);
      setEmployees(Array.isArray(emp.data) ? emp.data : []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);

  const range = useMemo(() => periodRange(period), [period]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e: any) => {
      if (range.from && range.to) {
        const d = (e.expense_date || '').slice(0, 10);
        if (!d || d < range.from || d > range.to) return false;
      }
      if (catFilter !== 'All' && e.category !== catFilter) return false;
      if (q) {
        const hay = `${e.category || ''} ${e.remarks || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [expenses, search, catFilter, range.from, range.to]);

  // Sort newest first
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      String(b.expense_date || '').localeCompare(String(a.expense_date || ''))
    );
  }, [filtered]);

  const stats = useMemo(() => {
    const total = filtered.reduce((s, e) => s + Number(e.amount || 0), 0);
    const count = filtered.length;
    const byCat: Record<string, number> = {};
    filtered.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0); });
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    let days = 1;
    if (range.from && range.to) {
      const from = new Date(range.from); const to = new Date(range.to);
      days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
    } else if (filtered.length) {
      const dates = filtered.map(e => new Date(e.expense_date).getTime()).filter(Boolean);
      days = Math.max(1, Math.round((Math.max(...dates) - Math.min(...dates)) / 86400000) + 1);
    }
    const avgPerDay = total / days;
    return { total, count, byCat, top, avgPerDay };
  }, [filtered, range.from, range.to]);

  const applyDraft = () => { setPeriod(draft); setPickerOpen(false); };

  const openForm = (item?: any) => {
    if (item) {
      setEditItem(item);
      setForm({
        category: item.category,
        amount: String(item.amount),
        expense_date: item.expense_date,
        remarks: item.remarks || '',
        employee_id: item.employee_id || null,
      });
    } else {
      setEditItem(null);
      setForm({
        category: 'Others',
        amount: '',
        expense_date: today.toISOString().split('T')[0],
        remarks: '',
        employee_id: null,
      });
    }
    setShowForm(true);
  };

  const handleSave = async () => {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return Alert.alert('Validation', 'Enter a valid amount');
    if (!form.expense_date) return Alert.alert('Validation', 'Select a date');
    if (form.category === 'Salary Advance' && !form.employee_id) {
      return Alert.alert('Validation', 'Select an employee for the salary advance');
    }
    setSaving(true);
    try {
      const body: any = {
        category: form.category,
        amount: amt,
        expense_date: form.expense_date,
        remarks: form.remarks,
        employee_id: form.category === 'Salary Advance' ? form.employee_id : null,
        org_id: orgId,
      };
      if (editItem) await api.put(`/api/expenses/${editItem.id}`, body);
      else await api.post('/api/expenses', body);
      setShowForm(false);
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = (item: any) => {
    Alert.alert('Delete Expense?', `${item.category} • ₹${Number(item.amount).toLocaleString('en-IN')}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await api.delete(`/api/expenses/${item.id}`); fetchData(); }
          catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); }
        },
      },
    ]);
  };

  const buildHTML = () => {
    const BASE = require('../../api/client').BASE_URL;
    const logoUrl = business?.business_logo
      ? business.business_logo.startsWith('http')
        ? business.business_logo
        : `${BASE}/assets/logos/${business.business_logo}`
      : null;
    const meta: string[] = [];
    if (business?.address) meta.push(escHtml(business.address));
    const contact: string[] = [];
    if (business?.mobile) contact.push(`Tel: ${escHtml(business.mobile)}`);
    if (business?.email) contact.push(escHtml(business.email));
    if (contact.length) meta.push(contact.join('  •  '));

    const filters: string[] = [];
    if (catFilter !== 'All') filters.push(`Category: ${escHtml(catFilter)}`);
    if (search) filters.push(`Search: "${escHtml(search)}"`);

    const catRows = Object.entries(stats.byCat)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => {
        const m = catMeta(cat);
        const pct = stats.total > 0 ? (amt / stats.total) * 100 : 0;
        return `<tr>
          <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${m.color};margin-right:6px;"></span>${escHtml(cat)}</td>
          <td class="num">${pct.toFixed(1)}%</td>
          <td class="num bold">₹${fmtAmt(amt)}</td>
        </tr>`;
      }).join('');

    const rows = sorted.map((e, idx) => {
      const bg = idx % 2 === 0 ? '#fafbfd' : '#ffffff';
      const m = catMeta(e.category);
      return `<tr style="background:${bg}">
        <td>${fmtDateShort(e.expense_date)}</td>
        <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${m.color};margin-right:6px;"></span>${escHtml(e.category)}</td>
        <td>${escHtml(e.remarks || '—')}</td>
        <td class="num bold">₹${fmtAmt(e.amount)}</td>
      </tr>`;
    }).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,Helvetica,Arial,sans-serif;margin:0;padding:24px;color:#161620;font-size:11px;line-height:1.4}
  .header{display:flex;align-items:flex-start;gap:14px;padding-bottom:12px;border-bottom:2px solid #1a1a40}
  .logo{width:60px;height:60px;object-fit:contain}
  .biz-name{font-size:20px;font-weight:800;color:#1a1a40;margin:0}
  .biz-meta{color:#6e7382;font-size:10px;margin-top:4px;line-height:1.5}
  .title{text-align:center;font-size:16px;font-weight:800;color:#1a1a40;letter-spacing:1px;margin:16px 0 6px}
  .subtitle{text-align:center;font-size:10px;color:#6e7382;font-weight:600;margin-bottom:14px}
  .summary{display:flex;gap:8px;margin-bottom:14px}
  .sum-card{flex:1;border:1px solid #dcdee6;border-radius:6px;padding:10px 12px;background:#fee2e2}
  .sum-card.cnt{background:#dbeafe}
  .sum-card.avg{background:#fef3c7}
  .sum-label{font-size:9px;font-weight:700;color:#6e7382;letter-spacing:0.5px;text-transform:uppercase}
  .sum-val{font-size:16px;font-weight:800;margin-top:4px;color:#dc2626}
  .sum-card.cnt .sum-val{color:#1d4ed8}
  .sum-card.avg .sum-val{color:#b45309}
  .filters{font-size:10px;color:#6e7382;margin-bottom:8px}
  h3{font-size:11px;color:#1a1a40;letter-spacing:0.5px;text-transform:uppercase;margin:18px 0 6px;font-weight:800}
  table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:14px}
  thead th{background:#1a1a40;color:#fff;font-weight:700;text-align:left;padding:8px;font-size:9px;letter-spacing:0.4px;text-transform:uppercase}
  thead th.num{text-align:right}
  tbody td{padding:7px 8px;border-bottom:1px solid #ececf2;vertical-align:top}
  tbody td.num{text-align:right}
  tbody td.bold{font-weight:700;color:#dc2626}
  tfoot tr{background:#1a1a40 !important}
  tfoot td{color:#fff !important;padding:9px 8px;font-weight:700;border:none;font-size:11px}
  .footer{margin-top:28px;padding-top:10px;border-top:1px solid #dcdee6;color:#6e7382;font-size:9px;font-style:italic;text-align:center}
</style></head><body>
  <div class="header">
    ${logoUrl ? `<img class="logo" src="${escHtml(logoUrl)}"/>` : ''}
    <div style="flex:1">
      <div class="biz-name">${escHtml(business?.business_name || 'Expense Report')}</div>
      <div class="biz-meta">${meta.join('<br/>')}</div>
    </div>
  </div>
  <div class="title">EXPENSE REPORT</div>
  <div class="subtitle">${escHtml(periodLabel(period))}</div>
  <div class="summary">
    <div class="sum-card"><div class="sum-label">Total Spent</div><div class="sum-val">₹${fmtAmt(stats.total)}</div></div>
    <div class="sum-card cnt"><div class="sum-label">Entries</div><div class="sum-val">${stats.count}</div></div>
    <div class="sum-card avg"><div class="sum-label">Avg/Day</div><div class="sum-val">₹${fmtAmt(stats.avgPerDay)}</div></div>
  </div>
  ${filters.length ? `<div class="filters"><strong>Filters:</strong> ${filters.join(' &nbsp;•&nbsp; ')}</div>` : ''}

  <h3>Category Breakdown</h3>
  <table>
    <thead><tr><th>Category</th><th class="num">Share</th><th class="num">Amount</th></tr></thead>
    <tbody>${catRows || `<tr><td colspan="3" style="text-align:center;padding:20px;color:#9ca0ad">No data</td></tr>`}</tbody>
  </table>

  <h3>All Entries</h3>
  <table>
    <thead><tr>
      <th>Date</th><th>Category</th><th>Remarks</th>
      <th class="num">Amount</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="4" style="text-align:center;padding:30px;color:#9ca0ad">No expenses in this period</td></tr>`}</tbody>
    <tfoot><tr>
      <td colspan="3">TOTAL (${sorted.length} entries)</td>
      <td class="num">₹${fmtAmt(stats.total)}</td>
    </tr></tfoot>
  </table>
  <div class="footer">Generated on ${fmtDateShort(new Date().toISOString())} • ${escHtml(business?.business_name || '')}</div>
</body></html>`;
  };

  const handleDownloadPDF = async () => {
    setExporting(true);
    try {
      const html = buildHTML();
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Expenses ${periodLabel(period)}`,
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to generate PDF');
    } finally { setExporting(false); }
  };

  const renderItem = ({ item }: { item: any }) => {
    const m = catMeta(item.category);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => openForm(item)}
        onLongPress={() => handleDelete(item)}
      >
        <View style={[styles.cardStrip, { backgroundColor: m.color }]} />
        <View style={[styles.iconBox, { backgroundColor: m.bg }]}>
          <Ionicons name={m.icon} size={20} color={m.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.category} numberOfLines={1}>{item.category}</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.date}>{fmtDateShort(item.expense_date)}</Text>
          </View>
          {item.employee_name ? (
            <View style={styles.empBadge}>
              <Ionicons name="person" size={10} color="#7c3aed" />
              <Text style={styles.empBadgeText}>{item.employee_name}</Text>
            </View>
          ) : null}
          {item.remarks ? (
            <Text style={styles.remarks} numberOfLines={1}>{item.remarks}</Text>
          ) : null}
        </View>
        <CurrencyText amount={item.amount} style={styles.amount} />
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
            <Text style={styles.heroEyebrow}>Total Expenses</Text>
            <CurrencyText amount={stats.total} style={styles.heroValue} />
            <Text style={styles.heroSub}>{stats.count} entr{stats.count === 1 ? 'y' : 'ies'}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity style={styles.filterPill} activeOpacity={0.8} onPress={() => { setDraft(period); setPickerOpen(true); }}>
              <Ionicons name="calendar" size={13} color="#fff" />
              <Text style={styles.filterPillText}>{periodLabel(period)}</Text>
              <Ionicons name="chevron-down" size={13} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconPill} activeOpacity={0.8} onPress={handleDownloadPDF} disabled={exporting}>
              {exporting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="download-outline" size={15} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Top Category</Text>
            <Text style={styles.heroStatVal} numberOfLines={1}>{stats.top?.[0] || '—'}</Text>
            {stats.top ? (
              <Text style={styles.heroStatSub}>₹{Number(stats.top[1]).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
            ) : null}
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Avg / Day</Text>
            <CurrencyText amount={stats.avgPerDay} style={styles.heroStatVal} />
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Categories</Text>
            <Text style={styles.heroStatVal}>{Object.keys(stats.byCat).length}</Text>
          </View>
        </View>
      </View>

      {/* Category breakdown bars */}
      {Object.keys(stats.byCat).length > 0 && (
        <View style={styles.breakCard}>
          <View style={styles.breakHeader}>
            <Ionicons name="pie-chart-outline" size={14} color={colors.gray500} />
            <Text style={styles.breakTitle}>Category Breakdown</Text>
          </View>
          {Object.entries(stats.byCat)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([cat, amt]) => {
              const m = catMeta(cat);
              const pct = stats.total > 0 ? (amt / stats.total) * 100 : 0;
              return (
                <View key={cat} style={styles.breakRow}>
                  <View style={[styles.breakDot, { backgroundColor: m.color }]} />
                  <Text style={styles.breakCat} numberOfLines={1}>{cat}</Text>
                  <View style={styles.breakBarTrack}>
                    <View style={[styles.breakBarFill, { width: `${pct}%`, backgroundColor: m.color }]} />
                  </View>
                  <Text style={styles.breakAmt}>₹{Number(amt).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                </View>
              );
            })}
        </View>
      )}

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.gray400} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search remarks or category..."
          placeholderTextColor={colors.placeholder}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.gray400} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
        {['All', ...CATEGORIES].map(c => {
          const active = catFilter === c;
          const m = c === 'All' ? null : catMeta(c);
          return (
            <TouchableOpacity
              key={c}
              style={[
                styles.chip,
                active && (m
                  ? { backgroundColor: m.color, borderColor: m.color }
                  : { backgroundColor: colors.primary, borderColor: colors.primary }
                ),
              ]}
              onPress={() => setCatFilter(c)}
              activeOpacity={0.85}
            >
              {m ? (
                <Ionicons
                  name={m.icon}
                  size={12}
                  color={active ? '#fff' : m.color}
                  style={{ marginRight: 4 }}
                />
              ) : null}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={sorted}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        ListHeaderComponent={Header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.primary} colors={[colors.primary]} />}
        ListEmptyComponent={
          loading ? (
            <SkeletonList count={6} />
          ) : (
            <EmptyState icon="receipt-outline" title="No expenses" subtitle="Tap + to add one" />
          )
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => openForm()}>
        <Ionicons name="add" size={26} color={colors.white} />
      </TouchableOpacity>

      {/* Period Picker */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Period</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.typeRow}>
                {(['all', 'month', 'year', 'custom'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeBtn, draft.type === t && styles.typeBtnActive]}
                    onPress={() => {
                      const ty = today;
                      if (t === 'all') setDraft({ type: 'all' });
                      else if (t === 'month') setDraft({ type: 'month', month: ty.getMonth() + 1, year: ty.getFullYear() });
                      else if (t === 'year') setDraft({ type: 'year', year: ty.getFullYear() });
                      else setDraft({ type: 'custom', from: `${ty.getFullYear()}-${pad2(ty.getMonth() + 1)}-01`, to: ty.toISOString().slice(0, 10) });
                    }}
                  >
                    <Text style={[styles.typeBtnText, draft.type === t && styles.typeBtnTextActive]}>
                      {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {draft.type === 'month' && (
                <>
                  <Text style={styles.modalLabel}>Month</Text>
                  <View style={styles.gridRow}>
                    {MONTH_LABELS.map((m, i) => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.gridBtn, draft.month === i + 1 && styles.gridBtnActive]}
                        onPress={() => setDraft({ ...draft, month: i + 1 })}
                      >
                        <Text style={[styles.gridBtnText, draft.month === i + 1 && styles.gridBtnTextActive]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.modalLabel}>Year</Text>
                  <View style={styles.gridRow}>
                    {[today.getFullYear() - 2, today.getFullYear() - 1, today.getFullYear()].map(y => (
                      <TouchableOpacity
                        key={y}
                        style={[styles.gridBtn, draft.year === y && styles.gridBtnActive, { flex: 1 }]}
                        onPress={() => setDraft({ ...draft, year: y })}
                      >
                        <Text style={[styles.gridBtnText, draft.year === y && styles.gridBtnTextActive]}>{y}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {draft.type === 'year' && (
                <>
                  <Text style={styles.modalLabel}>Year</Text>
                  <View style={styles.gridRow}>
                    {[today.getFullYear() - 2, today.getFullYear() - 1, today.getFullYear()].map(y => (
                      <TouchableOpacity
                        key={y}
                        style={[styles.gridBtn, draft.year === y && styles.gridBtnActive, { flex: 1 }]}
                        onPress={() => setDraft({ ...draft, year: y })}
                      >
                        <Text style={[styles.gridBtnText, draft.year === y && styles.gridBtnTextActive]}>{y}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {draft.type === 'custom' && (
                <>
                  <Text style={styles.modalLabel}>From</Text>
                  <DateInput value={draft.from} onChange={(v) => setDraft({ ...draft, from: v })} />
                  <Text style={styles.modalLabel}>To</Text>
                  <DateInput value={draft.to} onChange={(v) => setDraft({ ...draft, to: v })} />
                </>
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setPickerOpen(false)}>
                <Text style={{ color: colors.gray600, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={applyDraft}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Form Modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.formSheet}>
              <View style={styles.modalHandle} />
              <View style={styles.formHeader}>
                <Text style={styles.modalTitle}>{editItem ? 'Edit Expense' : 'New Expense'}</Text>
                {editItem ? (
                  <TouchableOpacity onPress={() => { setShowForm(false); handleDelete(editItem); }}>
                    <Ionicons name="trash-outline" size={22} color={colors.danger} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.formLabel}>Amount *</Text>
                <View style={styles.amountInputWrap}>
                  <Text style={styles.amountCurrency}>₹</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={form.amount}
                    onChangeText={v => setForm(p => ({ ...p, amount: v.replace(/[^0-9.]/g, '') }))}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.gray300}
                    autoFocus={!editItem}
                  />
                </View>
                <View style={styles.quickAmtRow}>
                  {[100, 500, 1000, 2000, 5000].map(q => (
                    <TouchableOpacity
                      key={q}
                      style={styles.quickAmt}
                      onPress={() => {
                        const cur = parseFloat(form.amount) || 0;
                        setForm(p => ({ ...p, amount: String(cur + q) }));
                      }}
                    >
                      <Text style={styles.quickAmtText}>+{q}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={styles.quickAmtClear} onPress={() => setForm(p => ({ ...p, amount: '' }))}>
                    <Ionicons name="refresh" size={12} color={colors.gray600} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.formLabel}>Category</Text>
                <View style={styles.catGrid}>
                  {CATEGORIES.map(c => {
                    const m = catMeta(c);
                    const active = form.category === c;
                    return (
                      <TouchableOpacity
                        key={c}
                        style={[
                          styles.catTile,
                          active && { backgroundColor: m.bg, borderColor: m.color },
                        ]}
                        onPress={() => setForm(p => ({ ...p, category: c }))}
                        activeOpacity={0.85}
                      >
                        <Ionicons name={m.icon} size={18} color={active ? m.color : colors.gray500} />
                        <Text style={[styles.catTileText, active && { color: m.color, fontWeight: '800' }]}>{c}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {form.category === 'Salary Advance' && (
                  <>
                    <Text style={styles.formLabel}>Employee *</Text>
                    <TouchableOpacity
                      style={styles.empPickerBtn}
                      onPress={() => setEmpPickerOpen(true)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="person-circle-outline" size={20} color="#7c3aed" />
                      <Text style={[styles.empPickerText, !form.employee_id && { color: colors.gray500, fontWeight: '600' }]} numberOfLines={1}>
                        {form.employee_id
                          ? (employees.find(e => e.id === form.employee_id)?.name || 'Selected')
                          : (employees.length ? 'Select employee' : 'No active employees')}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={colors.gray500} />
                    </TouchableOpacity>
                    <Text style={styles.empHint}>Auto-deducted from this employee’s payroll for the selected month.</Text>
                  </>
                )}

                <Text style={styles.formLabel}>Date</Text>
                <DateInput value={form.expense_date} onChange={v => setForm(p => ({ ...p, expense_date: v }))} placeholder="Select date" />

                <Text style={styles.formLabel}>Remarks</Text>
                <TextInput
                  style={styles.input}
                  value={form.remarks}
                  onChangeText={v => setForm(p => ({ ...p, remarks: v }))}
                  placeholder="Optional notes..."
                  placeholderTextColor={colors.placeholder}
                  multiline
                />
              </ScrollView>

              <View style={styles.formActions}>
                <TouchableOpacity style={styles.btnGhost} onPress={() => setShowForm(false)}>
                  <Text style={styles.btnGhostText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnPrimary, saving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={styles.btnPrimaryText}>{editItem ? 'Update' : 'Save'}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Employee picker */}
      <Modal visible={empPickerOpen} transparent animationType="slide" onRequestClose={() => setEmpPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '70%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Employee</Text>
            {employees.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Ionicons name="people-outline" size={36} color={colors.gray300} />
                <Text style={{ color: colors.gray500, marginTop: 8, fontSize: 13 }}>No active employees</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {employees.map(emp => {
                  const active = form.employee_id === emp.id;
                  return (
                    <TouchableOpacity
                      key={emp.id}
                      style={[styles.empRow, active && { backgroundColor: '#ede9fe', borderColor: '#7c3aed' }]}
                      onPress={() => {
                        setForm(p => ({ ...p, employee_id: emp.id }));
                        setEmpPickerOpen(false);
                      }}
                      activeOpacity={0.85}
                    >
                      <View style={styles.empAvatar}>
                        <Text style={styles.empAvatarText}>{(emp.name || '?').charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.empName}>{emp.name}</Text>
                        <Text style={styles.empMeta}>
                          {emp.salary_type === 'daily' ? 'Daily' : 'Monthly'} • ₹{Number(emp.salary_amount || 0).toLocaleString('en-IN')}
                        </Text>
                      </View>
                      {active && <Ionicons name="checkmark-circle" size={20} color="#7c3aed" />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity style={[styles.modalCancel, { marginTop: spacing.md }]} onPress={() => setEmpPickerOpen(false)}>
              <Text style={{ color: colors.gray600, fontWeight: '600' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },

  hero: {
    backgroundColor: colors.primary,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: 22,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md + 4,
    overflow: 'hidden',
    shadowColor: colors.primary, shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  heroBgAccent: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(220,38,38,0.18)', top: -60, right: -40 },
  heroBgAccent2: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.04)', bottom: -30, left: -20 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  heroEyebrow: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  heroValue: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  heroSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  filterPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  filterPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  iconPill: {
    width: 32, height: 32, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  heroStatsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)',
  },
  heroStatItem: { flex: 1 },
  heroStatLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  heroStatVal: { color: '#fff', fontSize: 13, fontWeight: '800', marginTop: 2 },
  heroStatSub: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600', marginTop: 1 },
  heroDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: spacing.sm },

  breakCard: {
    backgroundColor: '#fff',
    marginHorizontal: spacing.md, marginTop: spacing.sm + 2,
    borderRadius: 16, padding: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  breakHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  breakTitle: { fontSize: 11, color: colors.gray500, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  breakRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  breakDot: { width: 8, height: 8, borderRadius: 4 },
  breakCat: { width: 90, fontSize: 11, fontWeight: '700', color: colors.text },
  breakBarTrack: { flex: 1, height: 6, backgroundColor: colors.gray100, borderRadius: 999, overflow: 'hidden' },
  breakBarFill: { height: '100%', borderRadius: 999 },
  breakAmt: { fontSize: 11, fontWeight: '800', color: colors.text, minWidth: 60, textAlign: 'right' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: spacing.md, marginTop: spacing.sm + 2,
    borderRadius: 14,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    gap: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  searchInput: { flex: 1, fontSize: fontSize.md, color: colors.text, paddingVertical: 0 },

  chipsScroll: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.white,
    marginRight: 6,
    borderWidth: 1, borderColor: colors.border,
  },
  chipText: { fontSize: 12, color: colors.gray700, fontWeight: '700' },
  chipTextActive: { color: colors.white },

  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: spacing.md, marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  cardStrip: { width: 4, alignSelf: 'stretch' },
  iconBox: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: spacing.md, marginRight: spacing.sm,
  },
  category: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  dot: { fontSize: 11, color: colors.gray400 },
  date: { fontSize: 11, color: colors.gray500, fontWeight: '600' },
  remarks: { fontSize: 12, color: colors.gray600, marginTop: 2 },
  amount: {
    fontSize: 16, fontWeight: '800', color: colors.danger,
    marginRight: spacing.md, letterSpacing: -0.3,
  },

  fab: {
    position: 'absolute', right: 18, bottom: 18,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },

  // Period picker modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 32, maxHeight: '85%' },
  modalHandle: { width: 40, height: 4, backgroundColor: colors.gray200, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  modalLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700, marginTop: spacing.md, marginBottom: spacing.xs },
  typeRow: { flexDirection: 'row', gap: 6 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: borderRadius.sm, backgroundColor: colors.gray100, alignItems: 'center' },
  typeBtnActive: { backgroundColor: colors.primary },
  typeBtnText: { fontSize: 12, fontWeight: '700', color: colors.gray600 },
  typeBtnTextActive: { color: '#fff' },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  gridBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: borderRadius.sm, backgroundColor: colors.gray100, minWidth: '22%', alignItems: 'center' },
  gridBtnActive: { backgroundColor: colors.primary },
  gridBtnText: { fontSize: 12, fontWeight: '700', color: colors.gray600 },
  gridBtnTextActive: { color: '#fff' },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  modalCancel: { flex: 1, paddingVertical: 12, borderRadius: borderRadius.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  modalConfirm: { flex: 1, paddingVertical: 12, borderRadius: borderRadius.sm, alignItems: 'center', backgroundColor: colors.primary },

  // Form sheet
  formSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: 28,
    maxHeight: '90%',
  },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  formLabel: { fontSize: 11, fontWeight: '800', color: colors.gray500, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: spacing.md, marginBottom: 6 },
  amountInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f6f7fb',
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  amountCurrency: { fontSize: 24, fontWeight: '800', color: colors.gray500, marginRight: 6 },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '800', color: colors.text, paddingVertical: 8, letterSpacing: -0.4 },
  quickAmtRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  quickAmt: {
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: colors.primary + '12',
    borderRadius: 999,
  },
  quickAmtText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  quickAmtClear: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 'auto',
  },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catTile: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: '#fff',
  },
  catTileText: { fontSize: 12, fontWeight: '600', color: colors.gray700 },
  input: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: fontSize.md, color: colors.text,
    minHeight: 48,
  },
  formActions: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  btnGhost: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', backgroundColor: colors.gray100 },
  btnGhostText: { fontSize: 14, fontWeight: '700', color: colors.gray700 },
  btnPrimary: {
    flex: 2, flexDirection: 'row', gap: 6,
    paddingVertical: 13, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  btnPrimaryText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  // Employee badge on cards + picker
  empBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#ede9fe',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, marginTop: 3,
  },
  empBadgeText: { fontSize: 10, fontWeight: '700', color: '#7c3aed' },
  empPickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#c4b5fd',
    backgroundColor: '#f5f3ff',
    borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  empPickerText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#5b21b6' },
  empHint: { fontSize: 10, color: colors.gray500, marginTop: 4, fontStyle: 'italic' },
  empRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: 6,
    backgroundColor: '#fff',
  },
  empAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#ede9fe',
    alignItems: 'center', justifyContent: 'center',
  },
  empAvatarText: { color: '#7c3aed', fontWeight: '800', fontSize: 14 },
  empName: { fontSize: 14, fontWeight: '700', color: colors.text },
  empMeta: { fontSize: 11, color: colors.gray500, marginTop: 1, fontWeight: '600' },
});
