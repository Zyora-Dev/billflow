import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TextInput, TouchableOpacity,
  Modal, ScrollView, ActivityIndicator, Alert,
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
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtAmt = (n: number) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDateShort = (d: string) => {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

export default function PaymentListScreen({ navigation }: { navigation: any }) {
  const today = new Date();
  const [period, setPeriod] = useState<Period>({ type: 'month', month: today.getMonth() + 1, year: today.getFullYear() });
  const [draft, setDraft] = useState<Period>(period);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [orgId, setOrgId] = useState<string | null>(null);
  const [business, setBusiness] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const range = useMemo(() => periodRange(period), [period]);

  const fetchData = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (!oid) { setLoading(false); setRefreshing(false); return; }
      setOrgId(oid);
      setBusiness(biz.data[0]);
      const parts = [`org_id=${encodeURIComponent(oid)}`];
      if (customerId) parts.push(`customer_id=${customerId}`);
      const [payRes, custRes] = await Promise.all([
        api.get(`/api/payments?${parts.join('&')}`),
        api.get(`/api/customers?org_id=${oid}`),
      ]);
      setPayments(Array.isArray(payRes.data) ? payRes.data : []);
      setCustomers(Array.isArray(custRes.data) ? custRes.data : []);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [customerId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p: any) => {
      if (range.from && range.to) {
        const d = (p.payment_date || '').slice(0, 10);
        if (!d || d < range.from || d > range.to) return false;
      }
      if (q) {
        const hay = `${p.reference_number || ''} ${p.payment_method || ''} ${p.notes || ''} ${p.customer_name || ''} ${p.invoice_number || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [payments, search, range.from, range.to]);

  const stats = useMemo(() => {
    const total = filtered.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const cashAmt = filtered.filter(p => p.payment_method === 'Cash').reduce((s, p) => s + Number(p.amount || 0), 0);
    const bankAmt = filtered.filter(p => p.payment_method !== 'Cash').reduce((s, p) => s + Number(p.amount || 0), 0);
    return { total, cashAmt, bankAmt, count: filtered.length };
  }, [filtered]);

  const customerName = customerId
    ? customers.find(c => c.id === customerId)?.contact_person
      || customers.find(c => c.id === customerId)?.business_name
      || 'Customer'
    : 'All customers';

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      (c.contact_person || '').toLowerCase().includes(q) ||
      (c.business_name || '').toLowerCase().includes(q) ||
      (c.mobile || '').toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const applyDraft = () => { setPeriod(draft); setPickerOpen(false); };

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
    if (customerId) filters.push(`Customer: ${escHtml(customerName)}`);
    if (search) filters.push(`Search: "${escHtml(search)}"`);

    const rows = filtered.map((p, idx) => {
      const bg = idx % 2 === 0 ? '#fafbfd' : '#ffffff';
      return `<tr style="background:${bg}">
        <td>${fmtDateShort(p.payment_date)}</td>
        <td>${escHtml(p.customer_name || '—')}</td>
        <td>${escHtml(p.invoice_number || '—')}</td>
        <td><span class="badge">${escHtml(p.payment_method || '—')}</span></td>
        <td>${escHtml(p.reference_number || '—')}</td>
        <td class="num bold">₹${fmtAmt(p.amount)}</td>
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
  .sum-card{flex:1;border:1px solid #dcdee6;border-radius:6px;padding:10px 12px;background:#dcfce7}
  .sum-card.cash{background:#fef3c7}
  .sum-card.bank{background:#dbeafe}
  .sum-label{font-size:9px;font-weight:700;color:#6e7382;letter-spacing:0.5px;text-transform:uppercase}
  .sum-val{font-size:16px;font-weight:800;margin-top:4px;color:#15803d}
  .sum-card.cash .sum-val{color:#b45309}
  .sum-card.bank .sum-val{color:#1d4ed8}
  .filters{font-size:10px;color:#6e7382;margin-bottom:8px}
  table{width:100%;border-collapse:collapse;font-size:10px}
  thead th{background:#1a1a40;color:#fff;font-weight:700;text-align:left;padding:8px;font-size:9px;letter-spacing:0.4px;text-transform:uppercase}
  thead th.num{text-align:right}
  tbody td{padding:7px 8px;border-bottom:1px solid #ececf2}
  tbody td.num{text-align:right}
  tbody td.bold{font-weight:700;color:#15803d}
  .badge{display:inline-block;padding:2px 6px;border-radius:999px;font-size:9px;font-weight:700;background:#e0e7ff;color:#3730a3}
  tfoot tr{background:#1a1a40 !important}
  tfoot td{color:#fff !important;padding:9px 8px;font-weight:700;border:none;font-size:11px}
  .footer{margin-top:28px;padding-top:10px;border-top:1px solid #dcdee6;color:#6e7382;font-size:9px;font-style:italic;text-align:center}
</style></head><body>
  <div class="header">
    ${logoUrl ? `<img class="logo" src="${escHtml(logoUrl)}"/>` : ''}
    <div style="flex:1">
      <div class="biz-name">${escHtml(business?.business_name || 'Payment Report')}</div>
      <div class="biz-meta">${meta.join('<br/>')}</div>
    </div>
  </div>
  <div class="title">PAYMENTS RECEIVED</div>
  <div class="subtitle">${escHtml(periodLabel(period))}</div>
  <div class="summary">
    <div class="sum-card"><div class="sum-label">Total Received</div><div class="sum-val">₹${fmtAmt(stats.total)}</div></div>
    <div class="sum-card cash"><div class="sum-label">Cash</div><div class="sum-val">₹${fmtAmt(stats.cashAmt)}</div></div>
    <div class="sum-card bank"><div class="sum-label">Bank/UPI/Other</div><div class="sum-val">₹${fmtAmt(stats.bankAmt)}</div></div>
  </div>
  ${filters.length ? `<div class="filters"><strong>Filters:</strong> ${filters.join(' &nbsp;•&nbsp; ')}</div>` : ''}
  <table>
    <thead><tr>
      <th>Date</th><th>Customer</th><th>Invoice #</th><th>Method</th><th>Reference</th>
      <th class="num">Amount</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="6" style="text-align:center;padding:30px;color:#9ca0ad">No payments in this range</td></tr>`}</tbody>
    <tfoot><tr>
      <td colspan="5">TOTAL (${filtered.length} payments)</td>
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
          dialogTitle: `Payments ${periodLabel(period)}`,
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to generate PDF');
    } finally {
      setExporting(false);
    }
  };

  const handleShare = async () => {
    setExporting(true);
    try {
      const html = buildHTML();
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share Payments — ${periodLabel(period)}`,
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Share failed');
    } finally {
      setExporting(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('PaymentDetail', { id: item.id })}
    >
      <View style={s.iconBox}><Ionicons name="cash-outline" size={20} color={colors.success} /></View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={s.custName} numberOfLines={1}>{item.customer_name || 'Customer'}</Text>
          <View style={s.methodChip}>
            <Text style={s.methodChipText}>{item.payment_method || 'Cash'}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <Ionicons name="calendar-outline" size={11} color={colors.gray500} />
          <Text style={s.sub}>{fmtDateShort(item.payment_date)}</Text>
          {item.invoice_number ? (
            <>
              <Text style={s.dot}>•</Text>
              <Text style={s.sub}>#{item.invoice_number}</Text>
            </>
          ) : null}
        </View>
        {item.reference_number ? (
          <Text style={s.ref} numberOfLines={1}>Ref: {item.reference_number}</Text>
        ) : null}
      </View>
      <CurrencyText amount={item.amount} style={s.amount} />
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      <FlatList
        data={filtered}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={loading ? <SkeletonList count={6} /> : <EmptyState icon="cash-outline" title="No payments" subtitle="Adjust filters or record a payment" />}
        contentContainerStyle={!filtered.length ? { flexGrow: 1 } : { paddingBottom: 24 }}
        ListHeaderComponent={
          <>
            {/* Hero card */}
            <View style={s.hero}>
              <View style={s.heroBgAccent} />
              <View style={s.heroBgAccent2} />
              <View style={s.heroTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.heroEyebrow}>Total Received</Text>
                  <CurrencyText amount={stats.total} style={s.heroValue} />
                  <Text style={s.heroSub}>{stats.count} payment{stats.count !== 1 ? 's' : ''}</Text>
                </View>
                <TouchableOpacity style={s.filterPill} activeOpacity={0.8} onPress={() => { setDraft(period); setPickerOpen(true); }}>
                  <Ionicons name="calendar" size={13} color="#fff" />
                  <Text style={s.filterPillText}>{periodLabel(period)}</Text>
                  <Ionicons name="chevron-down" size={13} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={s.heroStatsRow}>
                <View style={s.heroStatItem}>
                  <Text style={s.heroStatLabel}>Cash</Text>
                  <CurrencyText amount={stats.cashAmt} style={[s.heroStatVal, { color: '#fcd34d' }]} />
                </View>
                <View style={s.heroDivider} />
                <View style={s.heroStatItem}>
                  <Text style={s.heroStatLabel}>Bank/UPI/Other</Text>
                  <CurrencyText amount={stats.bankAmt} style={[s.heroStatVal, { color: '#86efac' }]} />
                </View>
                <View style={s.heroDivider} />
                <View style={s.heroStatItem}>
                  <Text style={s.heroStatLabel}>Count</Text>
                  <Text style={s.heroStatVal}>{stats.count}</Text>
                </View>
              </View>
            </View>

            {/* Customer filter + actions row */}
            <View style={s.filterRow}>
              <TouchableOpacity style={s.customerPill} activeOpacity={0.85} onPress={() => setShowCustomerPicker(true)}>
                <Ionicons name="person-outline" size={14} color={colors.primary} />
                <Text style={s.customerPillText} numberOfLines={1}>{customerName}</Text>
                <Ionicons name="chevron-down" size={14} color={colors.primary} />
              </TouchableOpacity>
              {customerId ? (
                <TouchableOpacity style={s.actionPill} onPress={() => setCustomerId(null)}>
                  <Ionicons name="close" size={16} color={colors.gray600} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={s.actionPill} activeOpacity={0.85} onPress={handleDownloadPDF} disabled={exporting}>
                {exporting ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="download-outline" size={16} color={colors.primary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.actionPill} activeOpacity={0.85} onPress={handleShare} disabled={exporting}>
                <Ionicons name="share-social-outline" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={s.searchRow}>
              <Ionicons name="search" size={18} color={colors.gray400} />
              <TextInput
                style={s.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search ref, method, invoice, notes..."
                placeholderTextColor={colors.placeholder}
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color={colors.gray400} />
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        }
      />

      {/* Period Picker Modal */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Select Period</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.typeRow}>
                {(['all', 'month', 'year', 'custom'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.typeBtn, draft.type === t && s.typeBtnActive]}
                    onPress={() => {
                      const ty = today;
                      if (t === 'all') setDraft({ type: 'all' });
                      else if (t === 'month') setDraft({ type: 'month', month: ty.getMonth() + 1, year: ty.getFullYear() });
                      else if (t === 'year') setDraft({ type: 'year', year: ty.getFullYear() });
                      else setDraft({ type: 'custom', from: `${ty.getFullYear()}-${pad2(ty.getMonth() + 1)}-01`, to: ty.toISOString().slice(0, 10) });
                    }}
                  >
                    <Text style={[s.typeBtnText, draft.type === t && s.typeBtnTextActive]}>
                      {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {draft.type === 'month' && (
                <>
                  <Text style={s.modalLabel}>Month</Text>
                  <View style={s.gridRow}>
                    {MONTH_LABELS.map((m, i) => (
                      <TouchableOpacity
                        key={m}
                        style={[s.gridBtn, draft.month === i + 1 && s.gridBtnActive]}
                        onPress={() => setDraft({ ...draft, month: i + 1 })}
                      >
                        <Text style={[s.gridBtnText, draft.month === i + 1 && s.gridBtnTextActive]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={s.modalLabel}>Year</Text>
                  <View style={s.gridRow}>
                    {[today.getFullYear() - 2, today.getFullYear() - 1, today.getFullYear()].map(y => (
                      <TouchableOpacity
                        key={y}
                        style={[s.gridBtn, draft.year === y && s.gridBtnActive, { flex: 1 }]}
                        onPress={() => setDraft({ ...draft, year: y })}
                      >
                        <Text style={[s.gridBtnText, draft.year === y && s.gridBtnTextActive]}>{y}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {draft.type === 'year' && (
                <>
                  <Text style={s.modalLabel}>Year</Text>
                  <View style={s.gridRow}>
                    {[today.getFullYear() - 2, today.getFullYear() - 1, today.getFullYear()].map(y => (
                      <TouchableOpacity
                        key={y}
                        style={[s.gridBtn, draft.year === y && s.gridBtnActive, { flex: 1 }]}
                        onPress={() => setDraft({ ...draft, year: y })}
                      >
                        <Text style={[s.gridBtnText, draft.year === y && s.gridBtnTextActive]}>{y}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {draft.type === 'custom' && (
                <>
                  <Text style={s.modalLabel}>From</Text>
                  <DateInput value={draft.from} onChange={(v) => setDraft({ ...draft, from: v })} />
                  <Text style={s.modalLabel}>To</Text>
                  <DateInput value={draft.to} onChange={(v) => setDraft({ ...draft, to: v })} />
                </>
              )}
            </ScrollView>
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setPickerOpen(false)}>
                <Text style={{ color: colors.gray600, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalConfirm} onPress={applyDraft}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Customer Picker */}
      <Modal visible={showCustomerPicker} animationType="slide" onRequestClose={() => setShowCustomerPicker(false)}>
        <View style={s.fullModal}>
          <View style={s.fullModalHeader}>
            <Text style={s.modalTitle}>Filter by Customer</Text>
            <TouchableOpacity onPress={() => setShowCustomerPicker(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={[s.searchRow, { marginTop: spacing.md }]}>
            <Ionicons name="search" size={18} color={colors.gray400} />
            <TextInput
              style={s.searchInput}
              value={customerSearch}
              onChangeText={setCustomerSearch}
              placeholder="Search customers..."
              placeholderTextColor={colors.placeholder}
            />
          </View>
          <FlatList
            data={[{ id: null, label: 'All customers' }, ...filteredCustomers] as any[]}
            keyExtractor={(it: any) => String(it.id ?? 'all')}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }: any) => {
              const isSelected = customerId === item.id;
              const label = item.label || item.contact_person || item.business_name || '—';
              return (
                <TouchableOpacity
                  style={[s.customerItem, isSelected && { backgroundColor: colors.primary + '10' }]}
                  onPress={() => { setCustomerId(item.id); setShowCustomerPicker(false); setCustomerSearch(''); }}
                >
                  <Text style={s.customerItemText}>{label}</Text>
                  {isSelected ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },

  // Hero
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
  heroBgAccent: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.06)', top: -60, right: -40 },
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
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroStatsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)',
  },
  heroStatItem: { flex: 1 },
  heroStatLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  heroStatVal: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 2 },
  heroDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: spacing.sm },

  // Customer filter pill
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: spacing.md, marginTop: spacing.sm + 2 },
  customerPill: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9,
    backgroundColor: '#fff',
    borderRadius: 999,
    borderWidth: 1, borderColor: colors.border,
  },
  customerPillText: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.text },
  actionPill: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // Search
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: spacing.md, marginTop: spacing.sm + 2, marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, marginLeft: spacing.sm, fontSize: fontSize.md, color: colors.text, paddingVertical: 4 },

  // Card
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  iconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.success + '15', justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  custName: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, flexShrink: 1 },
  methodChip: { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.primary + '12', borderRadius: 4 },
  methodChipText: { fontSize: 9, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.3 },
  sub: { fontSize: 11, color: colors.gray500 },
  dot: { fontSize: 11, color: colors.gray400 },
  ref: { fontSize: 11, color: colors.gray500, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '800', color: colors.success, letterSpacing: -0.3 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, paddingBottom: 32, maxHeight: '85%' },
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

  fullModal: { flex: 1, backgroundColor: '#fff', paddingTop: 50 },
  fullModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  customerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  customerItemText: { fontSize: fontSize.md, color: colors.text, fontWeight: '500' },
});
