import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  ScrollView, TextInput, Modal, ActivityIndicator, Alert,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
// Receivables flow uses dedicated stack screens (Receivables / CustomerLedger)
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { usePreview } from '../../components/Preview';
import StatusBadge from '../../components/StatusBadge';
import CurrencyText from '../../components/CurrencyText';
import DateInput from '../../components/DateInput';

const STATUSES = ['All', 'Draft', 'Sent', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled'];
const PAGE_SIZE = 20;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n: number) => String(n).padStart(2, '0');

type Period =
  | { type: 'month'; month: number; year: number }
  | { type: 'year'; year: number }
  | { type: 'custom'; from: string; to: string };

function periodRange(p: Period): { from: string; to: string } {
  if (p.type === 'month') {
    const last = new Date(p.year, p.month, 0).getDate();
    return { from: `${p.year}-${pad2(p.month)}-01`, to: `${p.year}-${pad2(p.month)}-${pad2(last)}` };
  }
  if (p.type === 'year') return { from: `${p.year}-01-01`, to: `${p.year}-12-31` };
  return { from: p.from, to: p.to };
}

function periodLabel(p: Period): string {
  if (p.type === 'month') return `${MONTH_LABELS[p.month - 1]} ${p.year}`;
  if (p.type === 'year') return `Year ${p.year}`;
  if (!p.from || !p.to) return 'Custom range';
  return `${p.from} → ${p.to}`;
}

function statusColor(s: string) {
  switch (s) {
    case 'Paid': return '#10B981';
    case 'Sent': return '#3b82f6';
    case 'Partially Paid': return '#f59e0b';
    case 'Overdue': return '#ef4444';
    case 'Cancelled': return colors.gray400;
    default: return colors.gray300;
  }
}

export default function InvoiceListScreen({ navigation }: { navigation: any }) {
  const preview = usePreview();
  const today = new Date();
  const [period, setPeriod] = useState<Period>({ type: 'month', month: today.getMonth() + 1, year: today.getFullYear() });
  const [draft, setDraft] = useState<Period>(period);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ invoiced: 0, received: 0, receivable: 0 });
  const [overallReceivable, setOverallReceivable] = useState(0);
  const [status, setStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const debounceRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const biz = await api.get('/api/business');
        setOrgId(biz.data[0]?.org_id || null);
      } catch {}
    })();
  }, []);

  // Fetch overall receivables (NOT affected by date filter)
  const fetchOverallReceivable = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await api.get(`/api/reports/summary?org_id=${orgId}`);
      setOverallReceivable(Number(res.data?.total_outstanding || 0));
    } catch {}
  }, [orgId]);

  useEffect(() => { fetchOverallReceivable(); }, [fetchOverallReceivable]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [search]);

  useEffect(() => { setPage(1); }, [status, searchDebounced, period]);

  const range = useMemo(() => periodRange(period), [period]);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    try {
      const parts = [
        `org_id=${encodeURIComponent(orgId)}`,
        `page=${page}`,
        `limit=${PAGE_SIZE}`,
        `date_from=${range.from}`,
        `date_to=${range.to}`,
      ];
      if (status !== 'All') parts.push(`status=${encodeURIComponent(status)}`);
      if (searchDebounced) parts.push(`search=${encodeURIComponent(searchDebounced)}`);
      const res = await api.get(`/api/invoices?${parts.join('&')}`);
      const d = res.data || {};
      setInvoices(Array.isArray(d.data) ? d.data : []);
      setTotal(d.total || 0);
      setPages(d.pages || 1);
      setStats(d.stats || { invoiced: 0, received: 0, receivable: 0 });
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId, page, range.from, range.to, status, searchDebounced]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };
  const applyDraft = () => { setPeriod(draft); setPickerOpen(false); };
  const resetDraft = () => {
    const t = new Date();
    setDraft({ type: 'month', month: t.getMonth() + 1, year: t.getFullYear() });
  };

  const [exporting, setExporting] = useState(false);
  const handleDownloadPDF = async () => {
    if (!orgId) return;
    setExporting(true);
    try {
      // Fetch ALL invoices for the period (override pagination)
      const parts = [
        `org_id=${encodeURIComponent(orgId)}`,
        `page=1`,
        `limit=10000`,
        `date_from=${range.from}`,
        `date_to=${range.to}`,
      ];
      if (status !== 'All') parts.push(`status=${encodeURIComponent(status)}`);
      if (searchDebounced) parts.push(`search=${encodeURIComponent(searchDebounced)}`);
      const [invRes, bizRes] = await Promise.all([
        api.get(`/api/invoices?${parts.join('&')}`),
        api.get('/api/business'),
      ]);
      const allInv = Array.isArray(invRes.data?.data) ? invRes.data.data : [];
      const biz = bizRes.data?.[0] || null;
      const html = buildInvoiceListHTML({
        business: biz,
        invoices: allInv,
        stats: invRes.data?.stats || stats,
        period_label: periodLabel(period),
        date_from: range.from,
        date_to: range.to,
        status,
        search: searchDebounced,
      });
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Invoices ${periodLabel(period)}`,
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to generate PDF');
    } finally {
      setExporting(false);
    }
  };

  // Insight slider cards
  const insights = useMemo<any[]>(() => {
    if (!invoices.length) return [];
    // Most frequent customer
    const counts: Record<string, number> = {};
    invoices.forEach(i => {
      const n = (i.customer_name || '').trim();
      if (!n) return;
      counts[n] = (counts[n] || 0) + 1;
    });
    const topCust = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    // Highest due customer
    const dueByCust: Record<string, number> = {};
    invoices.forEach(i => {
      const n = (i.customer_name || '').trim();
      const d = Number(i.balance_due) || 0;
      if (!n || d <= 0) return;
      dueByCust[n] = (dueByCust[n] || 0) + d;
    });
    const topDue = Object.entries(dueByCust).sort((a, b) => b[1] - a[1])[0];
    // Biggest invoice
    const biggest = [...invoices].sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0))[0];
    // Latest
    const latest = invoices[0];

    const arr: any[] = [];
    if (topCust) {
      arr.push({
        icon: 'star',
        color: '#f59e0b',
        label: 'TOP CUSTOMER',
        value: topCust[0],
        sub: `${topCust[1]} invoice${topCust[1] > 1 ? 's' : ''}`,
        onPress: () => setSearch(topCust[0]),
      });
    }
    if (topDue) {
      arr.push({
        icon: 'alert-circle',
        color: '#dc2626',
        label: 'HIGHEST DUE',
        value: `₹ ${topDue[1].toLocaleString('en-IN')}`,
        sub: topDue[0],
        onPress: () => setSearch(topDue[0]),
      });
    }
    if (biggest) {
      arr.push({
        icon: 'trending-up',
        color: '#059669',
        label: 'BIGGEST INVOICE',
        value: `₹ ${Number(biggest.total).toLocaleString('en-IN')}`,
        sub: biggest.customer_name || biggest.invoice_number,
        onPress: () => navigation.navigate('InvoiceDetail', { id: biggest.id }),
      });
    }
    if (latest) {
      arr.push({
        icon: 'time',
        color: colors.primary,
        label: 'LATEST',
        value: latest.invoice_number,
        sub: latest.customer_name || latest.invoice_date,
        onPress: () => navigation.navigate('InvoiceDetail', { id: latest.id }),
      });
    }
    return arr;
  }, [invoices, navigation]);

  const renderItem = ({ item }: { item: any }) => {
    const sColor = statusColor(item.status);
    const initial = (item.customer_name || 'NA').trim().charAt(0).toUpperCase();
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('InvoiceDetail', { id: item.id })}
        onLongPress={() => preview.show({ type: 'invoice', id: item.id })}
        delayLongPress={350}
      >
        <View style={[styles.cardAvatar, { backgroundColor: sColor + '18', borderColor: sColor + '40' }]}>
          <Text style={[styles.cardAvatarText, { color: sColor }]}>{initial}</Text>
        </View>
        <View style={styles.cardMid}>
          <View style={styles.cardTopRow}>
            <Text style={styles.custName} numberOfLines={1}>{item.customer_name || 'N/A'}</Text>
            <CurrencyText amount={item.total} style={styles.total} />
          </View>
          <View style={styles.cardBotRow}>
            <View style={styles.cardMetaInline}>
              <Text style={styles.invNum}>{item.invoice_number}</Text>
              <View style={styles.metaDot} />
              <Text style={styles.date}>{item.invoice_date}</Text>
            </View>
            {item.balance_due > 0 ? (
              <View style={styles.dueChip}>
                <Ionicons name="alert-circle" size={10} color="#dc2626" />
                <Text style={styles.dueText}>₹{Number(item.balance_due).toLocaleString('en-IN')}</Text>
              </View>
            ) : (
              <StatusBadge status={item.status} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const Header = (
    <View>
      <View style={styles.hero}>
        <View style={styles.heroBgAccent} />
        <View style={styles.heroBgAccent2} />
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>Total Receivables</Text>
            <CurrencyText amount={stats.receivable} style={styles.heroValue} />
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity style={styles.filterPill} activeOpacity={0.8} onPress={() => { setDraft(period); setPickerOpen(true); }}>
              <Ionicons name="calendar" size={13} color="#ffffff" />
              <Text style={styles.filterPillText}>{periodLabel(period)}</Text>
              <Ionicons name="chevron-down" size={13} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconPill} activeOpacity={0.8} onPress={handleDownloadPDF} disabled={exporting}>
              {exporting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="download-outline" size={15} color="#ffffff" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconPill}
              activeOpacity={0.7}
              onPress={() => navigation.getParent()?.navigate('Settings', { screen: 'InvoiceSettings' })}
            >
              <Ionicons name="settings-outline" size={15} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Invoiced</Text>
            <CurrencyText amount={stats.invoiced} style={styles.heroStatVal} />
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Received</Text>
            <CurrencyText amount={stats.received} style={[styles.heroStatVal, { color: '#86efac' }]} />
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Count</Text>
            <Text style={styles.heroStatVal}>{total}</Text>
          </View>
        </View>
      </View>

      {/* Overall Receivables + Payments — twin elegant cards */}
      <View style={styles.stripRow}>
        <TouchableOpacity style={styles.dualCard} activeOpacity={0.85} onPress={() => navigation.navigate('Receivables')}>
          <View style={[styles.dualIcon, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
            <Ionicons name="wallet" size={15} color="#059669" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.dualLabel}>OVERALL DUE</Text>
            <CurrencyText amount={overallReceivable} style={[styles.dualValue, { color: '#059669' }]} />
          </View>
          <Ionicons name="chevron-forward" size={15} color={colors.gray400} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dualCard, { flex: 0, paddingHorizontal: 12 }]}
          activeOpacity={0.85}
          onPress={() => navigation.getParent()?.navigate('Payments')}
        >
          <View style={[styles.dualIcon, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '35' }]}>
            <Ionicons name="cash" size={15} color={colors.primary} />
          </View>
          <Text style={[styles.dualLabel, { color: colors.primary, marginRight: 4 }]}>PAYMENTS</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.gray400} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search invoice # or customer..."
          placeholderTextColor={colors.placeholder}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.gray400} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
        {STATUSES.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, status === s && styles.chipActive]}
            onPress={() => setStatus(s)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, status === s && styles.chipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Insight slider cards */}
      {insights.length > 0 && <Text style={styles.sectionLabel}>Highlights</Text>}
      {insights.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={212}
          contentContainerStyle={styles.insightRow}
        >
          {insights.map((ins, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.insightCard, { backgroundColor: ins.color }]}
              activeOpacity={0.88}
              onPress={() => ins.onPress?.()}
            >
              <View style={styles.insightTop}>
                <View style={styles.insightIconBig}>
                  <Ionicons name={ins.icon} size={13} color="#ffffff" />
                </View>
                <Text style={styles.insightLabel} numberOfLines={1}>{ins.label}</Text>
              </View>

              <Text style={styles.insightValue} numberOfLines={1}>
                {ins.value || '—'}
              </Text>

              <Text style={styles.insightSub} numberOfLines={1}>{ins.sub || '—'}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Section label for list */}
      <Text style={styles.sectionLabel}>All Invoices</Text>
      <View style={styles.listSpacer} />
    </View>
  );

  const Footer = total > 0 ? (
    <View style={styles.pager}>
      <TouchableOpacity
        style={[styles.pagerBtn, page <= 1 && styles.pagerBtnDisabled]}
        disabled={page <= 1}
        activeOpacity={0.8}
        onPress={() => setPage(p => Math.max(1, p - 1))}
      >
        <Ionicons name="chevron-back" size={16} color={page <= 1 ? colors.gray400 : colors.primary} />
        <Text style={[styles.pagerBtnText, page <= 1 && { color: colors.gray400 }]}>Prev</Text>
      </TouchableOpacity>
      <View style={styles.pagerInfo}>
        <Text style={styles.pagerInfoText}>Page {page} of {pages}</Text>
        <Text style={styles.pagerInfoSub}>{total} total</Text>
      </View>
      <TouchableOpacity
        style={[styles.pagerBtn, page >= pages && styles.pagerBtnDisabled]}
        disabled={page >= pages}
        activeOpacity={0.8}
        onPress={() => setPage(p => Math.min(pages, p + 1))}
      >
        <Text style={[styles.pagerBtnText, page >= pages && { color: colors.gray400 }]}>Next</Text>
        <Ionicons name="chevron-forward" size={16} color={page >= pages ? colors.gray400 : colors.primary} />
      </TouchableOpacity>
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <FlatList
        data={invoices}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        ListHeaderComponent={Header}
        ListFooterComponent={Footer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        ListEmptyComponent={
          loading ? (
            <SkeletonList count={6} />
          ) : (
            <EmptyState icon="document-text-outline" title="No invoices found" subtitle="Try a different filter or tap + to create one" />
          )
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />
      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => navigation.navigate('InvoiceForm', {})}>
        <Ionicons name="add" size={26} color={colors.white} />
      </TouchableOpacity>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Filter Period</Text>

            <View style={styles.tabRow}>
              {(['month', 'year', 'custom'] as const).map(t => {
                const active = draft.type === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tab, active && styles.tabActive]}
                    onPress={() => {
                      const tNow = new Date();
                      if (t === 'month') setDraft({ type: 'month', month: tNow.getMonth() + 1, year: tNow.getFullYear() });
                      else if (t === 'year') setDraft({ type: 'year', year: tNow.getFullYear() });
                      else setDraft({ type: 'custom', from: '', to: '' });
                    }}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>
                      {t === 'month' ? 'Month' : t === 'year' ? 'Year' : 'Custom'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {draft.type === 'month' && (
              <>
                <View style={styles.yearStepRow}>
                  <TouchableOpacity onPress={() => setDraft(d => d.type === 'month' ? { ...d, year: d.year - 1 } : d)} style={styles.stepBtn}>
                    <Ionicons name="chevron-back" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.yearText}>{draft.year}</Text>
                  <TouchableOpacity onPress={() => setDraft(d => d.type === 'month' ? { ...d, year: d.year + 1 } : d)} style={styles.stepBtn}>
                    <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.monthGrid}>
                  {MONTH_LABELS.map((m, i) => {
                    const active = draft.month === i + 1;
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[styles.monthChip, active && styles.monthChipActive]}
                        onPress={() => setDraft(d => d.type === 'month' ? { ...d, month: i + 1 } : d)}
                      >
                        <Text style={[styles.monthChipText, active && styles.monthChipTextActive]}>{m}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {draft.type === 'year' && (
              <View style={styles.yearStepRow}>
                <TouchableOpacity onPress={() => setDraft(d => d.type === 'year' ? { ...d, year: d.year - 1 } : d)} style={styles.stepBtn}>
                  <Ionicons name="chevron-back" size={18} color={colors.primary} />
                </TouchableOpacity>
                <Text style={styles.yearText}>{draft.year}</Text>
                <TouchableOpacity onPress={() => setDraft(d => d.type === 'year' ? { ...d, year: d.year + 1 } : d)} style={styles.stepBtn}>
                  <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}

            {draft.type === 'custom' && (
              <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                <DateInput
                  label="From"
                  value={draft.type === 'custom' ? draft.from : ''}
                  onChange={(v) => setDraft(d => d.type === 'custom' ? { ...d, from: v } : d)}
                />
                <DateInput
                  label="To"
                  value={draft.type === 'custom' ? draft.to : ''}
                  onChange={(v) => setDraft(d => d.type === 'custom' ? { ...d, to: v } : d)}
                />
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnGhost} onPress={resetDraft}>
                <Text style={styles.btnGhostText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={applyDraft}>
                <Text style={styles.btnPrimaryText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

// ==================== PDF HTML BUILDER ====================
const escHtml = (s: any) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fmtAmt = (n: number) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDateShort = (d: string) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
};

function buildInvoiceListHTML(opts: {
  business: any;
  invoices: any[];
  stats: { invoiced: number; received: number; receivable: number };
  period_label: string;
  date_from: string;
  date_to: string;
  status: string;
  search: string;
}): string {
  const { business, invoices, stats, period_label, date_from, date_to, status, search } = opts;
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
  const ids: string[] = [];
  if (business?.gst_number) ids.push(`GSTIN: ${escHtml(business.gst_number)}`);
  if (business?.pan) ids.push(`PAN: ${escHtml(business.pan)}`);
  if (ids.length) meta.push(ids.join('  •  '));

  const filters: string[] = [];
  if (status && status !== 'All') filters.push(`Status: ${escHtml(status)}`);
  if (search) filters.push(`Search: "${escHtml(search)}"`);

  const rows = invoices.map((inv, idx) => {
    const bg = idx % 2 === 0 ? '#fafbfd' : '#ffffff';
    const balColor = inv.balance_due > 0 ? '#dc2626' : '#059669';
    return `<tr style="background:${bg}">
      <td>${escHtml(inv.invoice_number || '')}</td>
      <td>${fmtDateShort(inv.invoice_date)}</td>
      <td>${escHtml(inv.customer_name || '—')}</td>
      <td style="text-align:center"><span class="badge badge-${escHtml((inv.status || '').toLowerCase().replace(/\s/g, '-'))}">${escHtml(inv.status || '')}</span></td>
      <td class="num">${fmtAmt(inv.total)}</td>
      <td class="num">${fmtAmt(inv.amount_paid)}</td>
      <td class="num bold" style="color:${balColor}">${fmtAmt(inv.balance_due)}</td>
    </tr>`;
  }).join('');

  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total || 0), 0);
  const totalPaid = invoices.reduce((s, i) => s + Number(i.amount_paid || 0), 0);
  const totalDue = invoices.reduce((s, i) => s + Number(i.balance_due || 0), 0);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; color: #161620; font-size: 11px; line-height: 1.4; }
  .header { display: flex; align-items: flex-start; gap: 14px; padding-bottom: 12px; border-bottom: 2px solid #1a1a40; }
  .logo { width: 60px; height: 60px; object-fit: contain; }
  .biz-name { font-size: 20px; font-weight: 800; color: #1a1a40; letter-spacing: -0.3px; margin: 0; }
  .biz-meta { color: #6e7382; font-size: 10px; margin-top: 4px; line-height: 1.5; }
  .title { text-align: center; font-size: 16px; font-weight: 800; color: #1a1a40; letter-spacing: 1px; margin: 16px 0 6px; }
  .subtitle { text-align: center; font-size: 10px; color: #6e7382; font-weight: 600; margin-bottom: 14px; }
  .summary { display: flex; gap: 8px; margin-bottom: 14px; }
  .sum-card { flex: 1; border: 1px solid #dcdee6; border-radius: 6px; padding: 10px 12px; }
  .sum-card.invoiced { background: #eff6ff; }
  .sum-card.received { background: #dcfce7; }
  .sum-card.receivable { background: #fef3c7; }
  .sum-label { font-size: 9px; font-weight: 700; color: #6e7382; letter-spacing: 0.5px; text-transform: uppercase; }
  .sum-val { font-size: 16px; font-weight: 800; margin-top: 4px; letter-spacing: -0.3px; }
  .sum-val.invoiced { color: #1d4ed8; }
  .sum-val.received { color: #15803d; }
  .sum-val.receivable { color: #b45309; }
  .filters { font-size: 10px; color: #6e7382; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  thead th { background: #1a1a40; color: #ffffff; font-weight: 700; text-align: left; padding: 8px; font-size: 9px; letter-spacing: 0.4px; text-transform: uppercase; }
  thead th.num { text-align: right; }
  thead th.center { text-align: center; }
  tbody td { padding: 7px 8px; border-bottom: 1px solid #ececf2; vertical-align: top; }
  tbody td.num { text-align: right; }
  tbody td.bold { font-weight: 700; }
  .badge { display: inline-block; padding: 2px 6px; border-radius: 999px; font-size: 9px; font-weight: 700; }
  .badge-paid { background: #dcfce7; color: #15803d; }
  .badge-sent { background: #dbeafe; color: #1d4ed8; }
  .badge-draft { background: #f3f4f6; color: #6b7280; }
  .badge-overdue { background: #fee2e2; color: #dc2626; }
  .badge-partially-paid { background: #fef3c7; color: #b45309; }
  .badge-cancelled { background: #f3f4f6; color: #9ca3af; }
  tfoot tr { background: #1a1a40 !important; }
  tfoot td { color: #ffffff !important; padding: 9px 8px; font-weight: 700; border: none; font-size: 11px; }
  .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #dcdee6; color: #6e7382; font-size: 9px; font-style: italic; text-align: center; }
</style></head>
<body>
  <div class="header">
    ${logoUrl ? `<img class="logo" src="${escHtml(logoUrl)}" />` : ''}
    <div style="flex:1">
      <div class="biz-name">${escHtml(business?.business_name || 'Invoice Report')}</div>
      <div class="biz-meta">${meta.join('<br/>')}</div>
    </div>
  </div>
  <div class="title">INVOICE REPORT</div>
  <div class="subtitle">${escHtml(period_label)} &nbsp;•&nbsp; ${fmtDateShort(date_from)} to ${fmtDateShort(date_to)}</div>
  <div class="summary">
    <div class="sum-card invoiced"><div class="sum-label">Invoiced</div><div class="sum-val invoiced">₹${fmtAmt(stats.invoiced)}</div></div>
    <div class="sum-card received"><div class="sum-label">Received</div><div class="sum-val received">₹${fmtAmt(stats.received)}</div></div>
    <div class="sum-card receivable"><div class="sum-label">Receivable</div><div class="sum-val receivable">₹${fmtAmt(stats.receivable)}</div></div>
  </div>
  ${filters.length ? `<div class="filters"><strong>Filters:</strong> ${filters.join(' &nbsp;•&nbsp; ')}</div>` : ''}
  <table>
    <thead><tr>
      <th>Invoice #</th><th>Date</th><th>Customer</th>
      <th class="center">Status</th>
      <th class="num">Total</th><th class="num">Paid</th><th class="num">Balance</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="7" style="text-align:center;padding:30px;color:#9ca0ad">No invoices in this period</td></tr>`}</tbody>
    <tfoot><tr>
      <td colspan="4">TOTAL (${invoices.length} invoices)</td>
      <td class="num">₹${fmtAmt(totalInvoiced)}</td>
      <td class="num">₹${fmtAmt(totalPaid)}</td>
      <td class="num">₹${fmtAmt(totalDue)}</td>
    </tr></tfoot>
  </table>
  <div class="footer">Generated on ${fmtDateShort(new Date().toISOString())} • ${escHtml(business?.business_name || '')}</div>
</body></html>`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },

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
  heroBgAccent: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.05)', top: -50, right: -30 },
  heroBgAccent2: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.04)', bottom: -25, left: -15 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  heroEyebrow: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  heroValue: { color: '#ffffff', fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 4 },
  filterPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  filterPillText: { color: '#ffffff', fontSize: 10.5, fontWeight: '700' },
  heroStatsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: spacing.sm + 2,
    paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)',
  },
  heroStatItem: { flex: 1 },
  heroStatLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  heroStatVal: { color: '#ffffff', fontSize: 13, fontWeight: '700', marginTop: 2, letterSpacing: -0.2 },
  heroDivider: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: spacing.sm },
  iconPill: {
    width: 30, height: 30,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },

  // Compact Overall Receivables strip
  overallStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm + 2,
    borderRadius: 999,
    paddingVertical: 8, paddingHorizontal: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  overallStripIcon: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#dcfce7',
    alignItems: 'center', justifyContent: 'center',
  },
  overallStripLabel: { fontSize: 11, color: colors.gray500, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  overallStripValue: { flex: 1, fontSize: 14, fontWeight: '800', color: '#059669', letterSpacing: -0.3 },
  overallStripHint: { fontSize: 10, color: colors.gray400, fontWeight: '600' },
  // Twin overall cards
  stripRow: {
    flexDirection: 'row', alignItems: 'stretch', gap: 8,
    marginHorizontal: spacing.md, marginTop: spacing.md,
  },
  dualCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderWidth: 1.5,
    borderColor: '#dde1ee',
    shadowColor: '#0f172a', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  dualIcon: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  dualLabel: {
    fontSize: 9.5, color: colors.gray500, fontWeight: '800',
    letterSpacing: 0.7, textTransform: 'uppercase',
  },
  dualValue: {
    fontSize: 14, fontWeight: '800', letterSpacing: -0.3,
    marginTop: 1,
  },
  paymentsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primary + '12',
    borderRadius: 999,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  paymentsPillText: { fontSize: 12, fontWeight: '800', color: colors.primary, letterSpacing: 0.2 },

  // Customer outstanding modal
  outHero: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
    marginBottom: spacing.sm,
  },
  outHeroIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#dcfce7',
    alignItems: 'center', justifyContent: 'center',
  },
  outHeroLabel: { fontSize: 11, color: colors.gray500, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  outHeroValue: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 2, letterSpacing: -0.5 },
  outClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center' },
  searchRow2: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.gray100,
    borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: spacing.sm,
  },
  outListHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 4, paddingBottom: 6,
  },
  outListHeaderText: { fontSize: 10, color: colors.gray400, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  outRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  outAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  outAvatarText: { fontSize: 14, fontWeight: '800', color: colors.primary },
  outName: { fontSize: 14, fontWeight: '700', color: colors.text },
  outSub: { fontSize: 11, color: colors.gray500, marginTop: 2 },
  outAmount: { fontSize: 15, fontWeight: '800', color: '#dc2626', letterSpacing: -0.3 },
  outAmountSub: { fontSize: 10, color: colors.gray400, marginTop: 2 },

  // Customer ledger sheet
  ledgerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
    marginBottom: spacing.sm,
  },
  ledgerName: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  ledgerSub: { fontSize: 11, color: colors.gray500, marginTop: 2, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  ledgerSummaryGrid: { flexDirection: 'row', gap: 6, marginBottom: spacing.sm },
  ledgerSumCard: { flex: 1, padding: 10, borderRadius: 12 },
  ledgerSumLabel: { fontSize: 10, fontWeight: '700', color: colors.gray500, textTransform: 'uppercase', letterSpacing: 0.3 },
  ledgerSumVal: { fontSize: 14, fontWeight: '800', marginTop: 4, letterSpacing: -0.3 },
  ledgerSumSub: { fontSize: 9, color: colors.gray500, marginTop: 2, fontWeight: '600' },
  ledgerEntry: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.gray100,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  ledgerTopLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  typeTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  typeTagText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  ledgerDate: { fontSize: 11, color: colors.gray500, fontWeight: '600' },
  ledgerRef: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 1 },
  ledgerAmt: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  ledgerBal: { fontSize: 11, color: colors.gray500, fontWeight: '600', marginTop: 2 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    marginTop: spacing.md + 4,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  searchInput: { flex: 1, fontSize: fontSize.md, color: colors.text, paddingVertical: 0 },

  chipsScroll: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4 },

  // Insight slider cards
  insightRow: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm,
    gap: 12,
  },
  insightCard: {
    width: 200,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 6,
  },
  insightBlob: { display: 'none' },
  insightBlob2: { display: 'none' },
  insightTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  insightIconBig: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  insightLabel: {
    flex: 1,
    fontSize: 9.5, fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  insightValue: {
    fontSize: 16, fontWeight: '800', letterSpacing: -0.3,
    color: '#ffffff',
  },
  insightSub: {
    fontSize: 11, color: 'rgba(255,255,255,0.92)', fontWeight: '600',
    letterSpacing: 0.1,
  },
  insightFoot: { display: 'none' },
  insightArrow: { display: 'none' },
  insightFootText: { display: 'none' },
  listSpacer: { height: 16 },
  sectionLabel: {
    fontSize: 10.5, fontWeight: '800',
    color: colors.gray500, letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginHorizontal: spacing.md,
    marginTop: spacing.md + 4,
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.white,
    marginRight: 6,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, color: colors.gray600, fontWeight: '600' },
  chipTextActive: { color: colors.white },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    marginBottom: 10,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#eef0f5',
    shadowColor: '#0f172a', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  cardAvatar: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  cardAvatarText: {
    fontSize: 16, fontWeight: '800', letterSpacing: -0.2,
  },
  cardMid: { flex: 1, minWidth: 0, gap: 4 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardBotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardMetaInline: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.gray300 },
  custName: { flex: 1, fontSize: 14, color: colors.gray900, fontWeight: '700', letterSpacing: -0.2 },
  invNum: { fontSize: 11, fontWeight: '700', color: colors.primary, letterSpacing: 0.2 },
  date: { fontSize: 11, color: colors.gray500, fontWeight: '500' },
  total: { fontSize: 14.5, fontWeight: '800', color: colors.gray900, letterSpacing: -0.3 },
  dueChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1, borderColor: '#fecaca',
  },
  dueText: { fontSize: 10.5, color: '#dc2626', fontWeight: '800' },

  pager: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    marginTop: 6,
    borderRadius: 14,
    padding: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  pagerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.primary + '12',
  },
  pagerBtnDisabled: { backgroundColor: colors.gray100 },
  pagerBtnText: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  pagerInfo: { alignItems: 'center' },
  pagerInfoText: { fontSize: 12, fontWeight: '700', color: colors.text },
  pagerInfoSub: { fontSize: 10, color: colors.gray500, marginTop: 1 },

  fab: {
    position: 'absolute', right: 18, bottom: 18,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.md + 4, paddingBottom: spacing.xl,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.gray300, alignSelf: 'center', marginBottom: spacing.sm },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  tabRow: { flexDirection: 'row', backgroundColor: colors.gray100, borderRadius: 12, padding: 4, marginBottom: spacing.md },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: colors.white, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.gray500 },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  yearStepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, marginBottom: spacing.sm },
  stepBtn: { padding: 8, borderRadius: 999, backgroundColor: colors.primary + '10' },
  yearText: { fontSize: 18, fontWeight: '800', color: colors.text, minWidth: 60, textAlign: 'center' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  monthChip: {
    width: '23%', paddingVertical: 10, alignItems: 'center',
    backgroundColor: colors.gray100, borderRadius: 10,
  },
  monthChipActive: { backgroundColor: colors.primary },
  monthChipText: { fontSize: 12, fontWeight: '700', color: colors.gray600 },
  monthChipTextActive: { color: colors.white },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  btnGhost: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: colors.gray100 },
  btnGhostText: { fontSize: 14, fontWeight: '700', color: colors.gray700 },
  btnPrimary: { flex: 2, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: colors.primary },
  btnPrimaryText: { fontSize: 14, fontWeight: '800', color: colors.white },
});
