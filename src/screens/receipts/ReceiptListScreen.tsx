import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Modal, Alert,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import EmptyState from '../../components/EmptyState';
import CurrencyText from '../../components/CurrencyText';
import DateInput from '../../components/DateInput';

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

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n: number) => String(n).padStart(2, '0');

type Period =
  | { type: 'all' }
  | { type: 'month'; month: number; year: number }
  | { type: 'year'; year: number }
  | { type: 'custom'; from: string; to: string };

function periodRange(p: Period): { from: string; to: string } {
  if (p.type === 'all') return { from: '', to: '' };
  if (p.type === 'month') {
    const last = new Date(p.year, p.month, 0).getDate();
    return { from: `${p.year}-${pad2(p.month)}-01`, to: `${p.year}-${pad2(p.month)}-${pad2(last)}` };
  }
  if (p.type === 'year') return { from: `${p.year}-01-01`, to: `${p.year}-12-31` };
  return { from: p.from, to: p.to };
}

function periodLabel(p: Period): string {
  if (p.type === 'all') return 'All Time';
  if (p.type === 'month') return `${MONTH_LABELS[p.month - 1]} ${p.year}`;
  if (p.type === 'year') return `Year ${p.year}`;
  if (!p.from || !p.to) return 'Custom range';
  return `${p.from} → ${p.to}`;
}

const escHtml = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function buildReportHTML(opts: {
  business: any; receipts: any[]; totalReceived: number;
  period_label: string; method: string;
}) {
  const { business, receipts, totalReceived, period_label, method } = opts;
  const rows = receipts.map((r, i) => `
    <tr style="${i % 2 === 0 ? '' : 'background:#f9fafb'}">
      <td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #e5e7eb">RCT-${String(r.id).padStart(5, '0')}</td>
      <td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #e5e7eb">${fmtDate(r.payment_date)}</td>
      <td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #e5e7eb">${escHtml(r.customer_name || '—')}</td>
      <td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #e5e7eb">${escHtml(r.payment_method || '—')}</td>
      <td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #e5e7eb">${escHtml(r.invoice_number || '—')}</td>
      <td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #e5e7eb">${escHtml(r.reference_number || '—')}</td>
      <td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">₹${fmtAmt(r.amount)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,Helvetica,sans-serif;padding:24px;color:#161620;font-size:12px}</style>
</head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #059669;padding-bottom:12px;margin-bottom:16px">
    <div>
      <div style="font-size:18px;font-weight:800;color:#059669">${escHtml(business?.business_name || 'Receipts Report')}</div>
      ${business?.address ? `<div style="font-size:10px;color:#6e7382;margin-top:2px">${escHtml(business.address)}</div>` : ''}
      ${business?.gst_number ? `<div style="font-size:10px;color:#6e7382">GSTIN: ${escHtml(business.gst_number)}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div style="font-size:16px;font-weight:800;color:#059669">RECEIPTS REPORT</div>
      <div style="font-size:10px;color:#6e7382;margin-top:2px">${escHtml(period_label)}${method !== 'All' ? ` · ${escHtml(method)}` : ''}</div>
      <div style="font-size:10px;color:#6e7382">Generated: ${fmtDate(new Date().toISOString())}</div>
    </div>
  </div>
  <div style="display:flex;gap:12px;margin-bottom:16px">
    <div style="flex:1;background:#dcfce7;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center">
      <div style="font-size:9px;font-weight:700;color:#15803d;text-transform:uppercase">Total Received</div>
      <div style="font-size:18px;font-weight:800;color:#15803d;margin-top:2px">₹${fmtAmt(totalReceived)}</div>
    </div>
    <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center">
      <div style="font-size:9px;font-weight:700;color:#059669;text-transform:uppercase">Total Receipts</div>
      <div style="font-size:18px;font-weight:800;color:#059669;margin-top:2px">${receipts.length}</div>
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:#064e3b;color:#fff">
        <th style="padding:8px;font-size:10px;text-align:left;font-weight:700">Receipt #</th>
        <th style="padding:8px;font-size:10px;text-align:left;font-weight:700">Date</th>
        <th style="padding:8px;font-size:10px;text-align:left;font-weight:700">Customer</th>
        <th style="padding:8px;font-size:10px;text-align:left;font-weight:700">Method</th>
        <th style="padding:8px;font-size:10px;text-align:left;font-weight:700">Invoice</th>
        <th style="padding:8px;font-size:10px;text-align:left;font-weight:700">Reference</th>
        <th style="padding:8px;font-size:10px;text-align:right;font-weight:700">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr style="background:#f0fdf4;font-weight:700">
        <td colspan="6" style="padding:8px;font-size:11px;text-align:right">Total</td>
        <td style="padding:8px;font-size:12px;text-align:right;color:#059669">₹${fmtAmt(totalReceived)}</td>
      </tr>
    </tfoot>
  </table>
  <div style="margin-top:20px;text-align:center;font-size:9px;color:#9ca3af;font-style:italic">
    This is a computer-generated report.
  </div>
</body></html>`;
}

export default function ReceiptListScreen({ navigation }: { navigation: any }) {
  const today = new Date();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [method, setMethod] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const debounceRef = useRef<any>(null);

  // Period filter
  const [period, setPeriod] = useState<Period>({ type: 'all' });
  const [draft, setDraft] = useState<Period>(period);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const biz = await api.get('/api/business');
        setOrgId(biz.data[0]?.org_id || null);
      } catch {}
    })();
  }, []);

  // Debounce search — server-side filtering
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [search]);

  const range = useMemo(() => periodRange(period), [period]);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    try {
      const parts = [`org_id=${encodeURIComponent(orgId)}`];
      if (range.from) parts.push(`date_from=${range.from}`);
      if (range.to) parts.push(`date_to=${range.to}`);
      if (method !== 'All') parts.push(`payment_method=${encodeURIComponent(method)}`);
      if (searchDebounced) parts.push(`search=${encodeURIComponent(searchDebounced)}`);
      const res = await api.get(`/api/payments?${parts.join('&')}`);
      setPayments(Array.isArray(res.data) ? res.data : []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId, method, range.from, range.to, searchDebounced]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };
  const applyDraft = () => { setPeriod(draft); setPickerOpen(false); };

  const totalReceived = useMemo(() =>
    payments.reduce((s, p) => s + Number(p.amount || 0), 0), [payments]);

  // PDF Report
  const handleDownloadPDF = async () => {
    if (!orgId) return;
    setExporting(true);
    try {
      const parts = [`org_id=${encodeURIComponent(orgId)}`];
      if (range.from) parts.push(`date_from=${range.from}`);
      if (range.to) parts.push(`date_to=${range.to}`);
      if (method !== 'All') parts.push(`payment_method=${encodeURIComponent(method)}`);
      if (searchDebounced) parts.push(`search=${encodeURIComponent(searchDebounced)}`);
      const [payRes, bizRes] = await Promise.all([
        api.get(`/api/payments?${parts.join('&')}`),
        api.get('/api/business'),
      ]);
      const allPmts = Array.isArray(payRes.data) ? payRes.data : [];
      const biz = bizRes.data?.[0] || null;
      const html = buildReportHTML({
        business: biz, receipts: allPmts,
        totalReceived: allPmts.reduce((s: number, p: any) => s + Number(p.amount || 0), 0),
        period_label: periodLabel(period), method,
      });
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Receipts Report', UTI: 'com.adobe.pdf' });
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to generate PDF');
    } finally { setExporting(false); }
  };

  const renderCard = ({ item }: { item: any }) => {
    const mc = methodColor(item.payment_method);
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => navigation.navigate('ReceiptDetail', { id: item.id })}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.customer_name || 'Unknown Customer'}
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
          {item.invoice_number ? (
            <Text style={styles.cardInv} numberOfLines={1}>{item.invoice_number}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <View style={styles.heroTopRow}>
            <Ionicons name="receipt-outline" size={20} color="rgba(255,255,255,0.8)" />
            <Text style={styles.heroLabel}>Total Received</Text>
          </View>
          <Text style={styles.heroAmount}>₹{fmtAmt(totalReceived)}</Text>
        </View>
        <View style={styles.heroRight}>
          <TouchableOpacity style={styles.periodPill} onPress={() => { setDraft(period); setPickerOpen(true); }}>
            <Ionicons name="calendar-outline" size={13} color="#fff" />
            <Text style={styles.periodPillText}>{periodLabel(period)}</Text>
            <Ionicons name="chevron-down" size={13} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.pdfBtn} onPress={handleDownloadPDF} disabled={exporting}>
            {exporting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="download-outline" size={16} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.gray400} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search customer, invoice, reference..."
          placeholderTextColor={colors.placeholder}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.gray400} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Method Filter Chips */}
      <View style={styles.chipContainer}>
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
      </View>

      {/* Count strip */}
      <View style={styles.countStrip}>
        <Text style={styles.countText}>{payments.length} receipt{payments.length !== 1 ? 's' : ''}</Text>
        {method !== 'All' && <Text style={styles.countFilter}>· {method}</Text>}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={item => String(item.id)}
          renderItem={renderCard}
          contentContainerStyle={payments.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
          ListEmptyComponent={<EmptyState icon="receipt-outline" title="No receipts found" subtitle="Customer payments will appear here" />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}

      {/* Period Picker Modal */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Period</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)}>
                <Ionicons name="close" size={24} color={colors.gray500} />
              </TouchableOpacity>
            </View>

            {/* Period type chips */}
            <View style={styles.periodTypeRow}>
              {(['all', 'month', 'year', 'custom'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.periodTypeChip, draft.type === t && styles.periodTypeChipActive]}
                  onPress={() => {
                    if (t === 'all') setDraft({ type: 'all' });
                    else if (t === 'month') setDraft({ type: 'month', month: today.getMonth() + 1, year: today.getFullYear() });
                    else if (t === 'year') setDraft({ type: 'year', year: today.getFullYear() });
                    else setDraft({ type: 'custom', from: '', to: '' });
                  }}
                >
                  <Text style={[styles.periodTypeText, draft.type === t && styles.periodTypeTextActive]}>
                    {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Month picker */}
            {draft.type === 'month' && (
              <View>
                <View style={styles.yearRow}>
                  <TouchableOpacity onPress={() => setDraft(d => d.type === 'month' ? { ...d, year: d.year - 1 } : d)}>
                    <Ionicons name="chevron-back" size={22} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.yearLabel}>{(draft as any).year}</Text>
                  <TouchableOpacity onPress={() => setDraft(d => d.type === 'month' ? { ...d, year: d.year + 1 } : d)}>
                    <Ionicons name="chevron-forward" size={22} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <View style={styles.monthGrid}>
                  {MONTH_LABELS.map((m, i) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.monthCell, draft.type === 'month' && (draft as any).month === i + 1 && styles.monthCellActive]}
                      onPress={() => setDraft(d => d.type === 'month' ? { ...d, month: i + 1 } : d)}
                    >
                      <Text style={[styles.monthText, draft.type === 'month' && (draft as any).month === i + 1 && styles.monthTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Year picker */}
            {draft.type === 'year' && (
              <View style={styles.yearRow}>
                <TouchableOpacity onPress={() => setDraft(d => d.type === 'year' ? { ...d, year: d.year - 1 } : d)}>
                  <Ionicons name="chevron-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.yearLabel}>{(draft as any).year}</Text>
                <TouchableOpacity onPress={() => setDraft(d => d.type === 'year' ? { ...d, year: d.year + 1 } : d)}>
                  <Ionicons name="chevron-forward" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>
            )}

            {/* Custom date range */}
            {draft.type === 'custom' && (
              <View style={styles.customDates}>
                <DateInput label="From" value={(draft as any).from || ''} onChange={(v) => setDraft(d => d.type === 'custom' ? { ...d, from: v } : d)} />
                <DateInput label="To" value={(draft as any).to || ''} onChange={(v) => setDraft(d => d.type === 'custom' ? { ...d, to: v } : d)} />
              </View>
            )}

            <TouchableOpacity style={styles.applyBtn} onPress={applyDraft}>
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.xs, fontWeight: '600' },
  heroAmount: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 4 },
  heroRight: { alignItems: 'flex-end', gap: 8 },
  periodPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  periodPillText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  pdfBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    marginHorizontal: spacing.md, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, gap: 8,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: fontSize.sm, color: colors.text },

  chipContainer: {
    borderBottomWidth: 1, borderBottomColor: colors.border,
    marginTop: spacing.xs,
  },
  chipRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 8 },
  chip: {
    height: 34, paddingHorizontal: 16, borderRadius: 17,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: '#fff' },

  countStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: 6,
  },
  countText: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '600' },
  countFilter: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '600' },

  card: {
    backgroundColor: colors.card, marginHorizontal: spacing.md, marginBottom: spacing.sm,
    borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardName: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  cardDate: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  cardAmount: { fontSize: fontSize.md, fontWeight: '800', color: colors.primary },
  cardBottom: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, gap: 8, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardRef: { fontSize: fontSize.xs, color: colors.textSecondary },
  cardInv: { fontSize: fontSize.xs, color: colors.info, fontWeight: '600' },

  // Period Picker Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: spacing.lg, paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },

  periodTypeRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  periodTypeChip: {
    flex: 1, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
  },
  periodTypeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  periodTypeText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary },
  periodTypeTextActive: { color: '#fff' },

  yearRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 20, marginBottom: spacing.md,
  },
  yearLabel: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },

  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  monthCell: {
    width: '22%' as any, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
  },
  monthCellActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  monthText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary },
  monthTextActive: { color: '#fff' },

  customDates: { gap: 12, marginBottom: spacing.md },

  applyBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm,
  },
  applyBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '700' },
});
