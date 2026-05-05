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

  const renderItem = ({ item }: { item: any }) => {
    const initial = String(item.customer_name || 'C').trim().charAt(0).toUpperCase();
    return (
      <TouchableOpacity
        style={s.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('PaymentDetail', { id: item.id })}
      >
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.cardTopRow}>
            <Text style={s.custName} numberOfLines={1}>{item.customer_name || 'Customer'}</Text>
            <CurrencyText amount={item.amount} style={s.amount} />
          </View>
          <View style={s.cardMetaRow}>
            <Text style={s.metaText}>{fmtDateShort(item.payment_date)}</Text>
            {item.invoice_number ? (
              <>
                <View style={s.metaDot} />
                <Text style={s.metaText}>#{item.invoice_number}</Text>
              </>
            ) : null}
            <View style={s.metaDot} />
            <View style={s.methodChip}>
              <Text style={s.methodChipText}>{item.payment_method || 'Cash'}</Text>
            </View>
          </View>
          {item.reference_number ? (
            <Text style={s.ref} numberOfLines={1}>Ref: {item.reference_number}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

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

            {/* Highlighted Customer Search + Actions */}
            <View style={s.searchSection}>
              <View style={s.searchRow}>
                <Ionicons name="search" size={18} color={colors.primary} />
                <TextInput
                  style={s.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Type a letter to search customer..."
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
                <TouchableOpacity style={s.searchActionBtn} activeOpacity={0.8} onPress={handleDownloadPDF} disabled={exporting}>
                  {exporting ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="download-outline" size={17} color={colors.primary} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={s.searchActionBtn} activeOpacity={0.8} onPress={handleShare} disabled={exporting}>
                  <Ionicons name="share-social-outline" size={17} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Active customer chip */}
              {customerId ? (
                <View style={s.activeFilterRow}>
                  <View style={s.activeChip}>
                    <Ionicons name="person" size={11} color={colors.primary} />
                    <Text style={s.activeChipText} numberOfLines={1}>{customerName}</Text>
                    <TouchableOpacity onPress={() => setCustomerId(null)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Ionicons name="close" size={13} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {/* One-letter customer suggestions */}
              {search.trim().length > 0 && !customerId ? (() => {
                const q = search.toLowerCase().trim();
                const suggestions = customers
                  .filter(c => {
                    const n = `${c.contact_person || ''} ${c.business_name || ''}`.toLowerCase();
                    return n.includes(q);
                  })
                  .sort((a, b) => {
                    const an = String(a.contact_person || a.business_name || '').toLowerCase();
                    const bn = String(b.contact_person || b.business_name || '').toLowerCase();
                    const ap = an.startsWith(q) ? 0 : 1;
                    const bp = bn.startsWith(q) ? 0 : 1;
                    if (ap !== bp) return ap - bp;
                    return an.localeCompare(bn);
                  })
                  .slice(0, 5);
                if (!suggestions.length) return null;
                return (
                  <View style={s.suggestBox}>
                    {suggestions.map((c, idx) => {
                      const nm = c.contact_person || c.business_name || 'Customer';
                      const initial = String(nm).trim().charAt(0).toUpperCase();
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[s.suggestRow, idx === suggestions.length - 1 && { borderBottomWidth: 0 }]}
                          activeOpacity={0.7}
                          onPress={() => { setCustomerId(c.id); setSearch(''); }}
                        >
                          <View style={s.suggestAvatar}><Text style={s.suggestAvatarText}>{initial}</Text></View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.suggestName} numberOfLines={1}>{nm}</Text>
                            {c.business_name && c.contact_person ? (
                              <Text style={s.suggestSub} numberOfLines={1}>{c.business_name}</Text>
                            ) : null}
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })() : null}
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
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    overflow: 'hidden',
    shadowColor: colors.primary, shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  heroBgAccent: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.06)', top: -55, right: -35 },
  heroBgAccent2: { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.04)', bottom: -30, left: -20 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  heroEyebrow: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  heroValue: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  filterPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  filterPillText: { color: '#fff', fontSize: 10.5, fontWeight: '700' },
  iconPill: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroStatsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: spacing.sm + 2,
    paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)',
  },
  heroStatItem: { flex: 1 },
  heroStatLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  heroStatVal: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 2 },
  heroDivider: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: spacing.sm },

  // Highlighted Customer Search Section
  searchSection: { marginHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.md },
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

  activeFilterRow: { flexDirection: 'row', marginTop: 8 },
  activeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: colors.primary + '10',
    borderRadius: 999,
    borderWidth: 1, borderColor: colors.primary + '25',
  },
  activeChipText: { fontSize: 11.5, fontWeight: '700', color: colors.primary, maxWidth: 200 },

  // Suggestions dropdown
  suggestBox: {
    marginTop: 6,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1, borderColor: '#e6e9f2',
    overflow: 'hidden',
  },
  suggestRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f1f3f8',
  },
  suggestAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  suggestAvatarText: { fontSize: 12, fontWeight: '800', color: colors.primary },
  suggestName: { fontSize: 13, fontWeight: '700', color: colors.gray900 },
  suggestSub: { fontSize: 10.5, fontWeight: '500', color: colors.gray500, marginTop: 1 },

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
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary + '12',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.primary + '30',
    marginRight: 11,
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: colors.primary },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  metaText: { fontSize: 11, color: colors.gray500, fontWeight: '600' },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.gray300 },
  custName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.gray900, letterSpacing: -0.2 },
  methodChip: { paddingHorizontal: 6, paddingVertical: 1.5, backgroundColor: colors.primary + '12', borderRadius: 4 },
  methodChipText: { fontSize: 9, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.3 },
  sub: { fontSize: 11, color: colors.gray500 },
  dot: { fontSize: 11, color: colors.gray400 },
  ref: { fontSize: 10.5, color: colors.gray500, marginTop: 4, fontWeight: '500' },
  amount: { fontSize: 15.5, fontWeight: '800', color: colors.primary, letterSpacing: -0.3 },

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
