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
import CurrencyText from '../../components/CurrencyText';
import DateInput from '../../components/DateInput';

const TXN_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; sign: string }> = {
  stock_in:   { label: 'Stock In',  icon: 'arrow-down-circle',  color: '#10B981', bg: '#d1fae5', sign: '+' },
  stock_out:  { label: 'Stock Out', icon: 'arrow-up-circle',    color: '#dc2626', bg: '#fee2e2', sign: '-' },
  adjustment: { label: 'Adjust',    icon: 'swap-horizontal',    color: '#b45309', bg: '#fef3c7', sign: '±' },
};
const txnMeta = (t: string) => TXN_META[t] || TXN_META.stock_in;

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
  if (!p.from || !p.to) return 'Custom';
  return `${p.from} → ${p.to}`;
}

const escHtml = (s: any) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtAmt = (n: number) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDateShort = (d: string) => {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

export default function InventoryScreen({ navigation }: { navigation: any }) {
  const today = new Date();
  const [tab, setTab] = useState<'stock' | 'log'>('stock');

  const [orgId, setOrgId] = useState('');
  const [business, setBusiness] = useState<any>(null);
  const [stockSummary, setStockSummary] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Stock tab filters
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out' | 'in'>('all');

  // Log tab filters
  const [logSearch, setLogSearch] = useState('');
  const [logType, setLogType] = useState<'All' | 'stock_in' | 'stock_out' | 'adjustment'>('All');
  const [period, setPeriod] = useState<Period>({ type: 'all' });
  const [draftPeriod, setDraftPeriod] = useState<Period>(period);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [exporting, setExporting] = useState(false);

  // Transaction form
  const [showTxn, setShowTxn] = useState(false);
  const [txnForm, setTxnForm] = useState({
    item_id: null as number | null,
    item_name: '',
    current_stock: 0,
    type: 'stock_in' as 'stock_in' | 'stock_out' | 'adjustment',
    qty: '',
    reason: '',
    reference: '',
    notes: '',
    date: today.toISOString().split('T')[0],
  });
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Item history sheet
  const [historyItem, setHistoryItem] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (!oid) { setLoading(false); setRefreshing(false); return; }
      setOrgId(oid);
      setBusiness(biz.data[0]);
      const [ss, tx, it] = await Promise.all([
        api.get(`/api/stock-summary?org_id=${oid}`),
        api.get(`/api/stock-transactions?org_id=${oid}`),
        api.get(`/api/items?org_id=${oid}`),
      ]);
      // stock-summary returns item_id (not id); normalize so keyExtractor + history lookups work
      const ssRaw = Array.isArray(ss.data) ? ss.data : [];
      const itRaw = Array.isArray(it.data) ? it.data : [];
      const itemMap: Record<number, any> = {};
      itRaw.forEach((i: any) => { itemMap[i.id] = i; });
      setStockSummary(ssRaw.map((row: any) => {
        const full = itemMap[row.item_id] || {};
        return { ...full, ...row, id: row.item_id };
      }));
      setTransactions(Array.isArray(tx.data) ? tx.data : []);
      setItems(itRaw);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);

  // Stock derived
  const stockStats = useMemo(() => {
    const totalValue = stockSummary.reduce((s, i) => s + (Number(i.stock) || 0) * (Number(i.sale_price) || 0), 0);
    const totalCount = stockSummary.length;
    const totalUnits = stockSummary.reduce((s, i) => s + (Number(i.stock) || 0), 0);
    const lowCount = stockSummary.filter(i => i.low_stock && Number(i.stock) > 0).length;
    const outCount = stockSummary.filter(i => Number(i.stock) <= 0).length;
    return { totalValue, totalCount, totalUnits, lowCount, outCount };
  }, [stockSummary]);

  const filteredStock = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stockSummary.filter(i => {
      if (stockFilter === 'low' && !(i.low_stock && Number(i.stock) > 0)) return false;
      if (stockFilter === 'out' && Number(i.stock) > 0) return false;
      if (stockFilter === 'in' && Number(i.stock) <= 0) return false;
      if (q) {
        const hay = `${i.item_name || ''} ${i.brand_name || ''} ${i.model_number || ''} ${i.hsn_code || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      // out-of-stock first, then low, then by name
      const av = Number(a.stock) <= 0 ? 0 : a.low_stock ? 1 : 2;
      const bv = Number(b.stock) <= 0 ? 0 : b.low_stock ? 1 : 2;
      if (av !== bv) return av - bv;
      return String(a.item_name).localeCompare(String(b.item_name));
    });
  }, [stockSummary, search, stockFilter]);

  // Log derived
  const range = useMemo(() => periodRange(period), [period]);

  const filteredLog = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return transactions.filter(t => {
      if (logType !== 'All' && t.type !== logType) return false;
      if (range.from && range.to) {
        const d = (t.date || '').slice(0, 10);
        if (!d || d < range.from || d > range.to) return false;
      }
      if (q) {
        const hay = `${t.item_name || ''} ${t.reason || ''} ${t.reference || ''} ${t.notes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [transactions, logSearch, logType, range.from, range.to]);

  const logStats = useMemo(() => {
    let inQty = 0, outQty = 0, adjQty = 0;
    filteredLog.forEach(t => {
      const q = Number(t.qty) || 0;
      if (t.type === 'stock_in') inQty += q;
      else if (t.type === 'stock_out') outQty += q;
      else adjQty += q;
    });
    return { inQty, outQty, adjQty, count: filteredLog.length };
  }, [filteredLog]);

  // Per-item transaction history
  const historyTxns = useMemo(() => {
    if (!historyItem) return [];
    return transactions
      .filter(t => t.item_id === historyItem.id)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [transactions, historyItem]);

  // Form helpers
  const openTxnForm = (preset?: Partial<typeof txnForm>) => {
    setTxnForm({
      item_id: null, item_name: '', current_stock: 0,
      type: 'stock_in', qty: '', reason: '', reference: '', notes: '',
      date: today.toISOString().split('T')[0],
      ...(preset || {}),
    });
    setShowTxn(true);
  };

  const saveTxn = async () => {
    if (!txnForm.item_id) return Alert.alert('Validation', 'Select an item');
    const q = parseFloat(txnForm.qty);
    if (!q || q <= 0) return Alert.alert('Validation', 'Enter a valid quantity');
    if (txnForm.type === 'stock_out' && q > txnForm.current_stock) {
      return Alert.alert('Insufficient Stock', `Available: ${txnForm.current_stock}. Cannot remove ${q}.`);
    }
    setSaving(true);
    try {
      await api.post('/api/stock-transactions', {
        org_id: orgId,
        item_id: txnForm.item_id,
        type: txnForm.type,
        qty: q,
        reason: txnForm.reason || null,
        reference: txnForm.reference || null,
        notes: txnForm.notes || null,
        date: txnForm.date,
      });
      setShowTxn(false);
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally { setSaving(false); }
  };

  const deleteTxn = (t: any) => {
    Alert.alert('Delete Transaction?', 'This will reverse the stock change.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await api.delete(`/api/stock-transactions/${t.id}`); fetchData(); }
          catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); }
        },
      },
    ]);
  };

  // PDF
  const buildHTML = () => {
    const BASE = require('../../api/client').BASE_URL;
    const logoUrl = business?.business_logo
      ? business.business_logo.startsWith('http') ? business.business_logo : `${BASE}/assets/logos/${business.business_logo}`
      : null;
    const meta: string[] = [];
    if (business?.address) meta.push(escHtml(business.address));
    const contact: string[] = [];
    if (business?.mobile) contact.push(`Tel: ${escHtml(business.mobile)}`);
    if (business?.email) contact.push(escHtml(business.email));
    if (contact.length) meta.push(contact.join('  •  '));

    if (tab === 'stock') {
      const rows = filteredStock.map((i, idx) => {
        const bg = idx % 2 === 0 ? '#fafbfd' : '#ffffff';
        const stockColor = Number(i.stock) <= 0 ? '#dc2626' : i.low_stock ? '#b45309' : '#10B981';
        const status = Number(i.stock) <= 0 ? 'OUT' : i.low_stock ? 'LOW' : 'OK';
        const value = (Number(i.stock) || 0) * (Number(i.sale_price) || 0);
        return `<tr style="background:${bg}">
          <td>${idx + 1}</td>
          <td>${escHtml(i.item_name)}${i.model_number ? ` <span style="color:#9ca0ad">(${escHtml(i.model_number)})</span>` : ''}</td>
          <td>${escHtml(i.brand_name || '—')}</td>
          <td>${escHtml(i.unit || 'Nos')}</td>
          <td class="num">${i.stock ?? 0}</td>
          <td class="num">${i.stock_alert_qty ?? 0}</td>
          <td class="num">₹${fmtAmt(i.sale_price)}</td>
          <td class="num bold">₹${fmtAmt(value)}</td>
          <td><span style="color:${stockColor};font-weight:700">${status}</span></td>
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
  .sum-card{flex:1;border:1px solid #dcdee6;border-radius:6px;padding:10px 12px;background:#dbeafe}
  .sum-card.val{background:#d1fae5}
  .sum-card.low{background:#fef3c7}
  .sum-card.out{background:#fee2e2}
  .sum-label{font-size:9px;font-weight:700;color:#6e7382;letter-spacing:0.5px;text-transform:uppercase}
  .sum-val{font-size:16px;font-weight:800;margin-top:4px;color:#1d4ed8}
  .sum-card.val .sum-val{color:#047857}
  .sum-card.low .sum-val{color:#b45309}
  .sum-card.out .sum-val{color:#dc2626}
  table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:14px}
  thead th{background:#1a1a40;color:#fff;font-weight:700;text-align:left;padding:8px;font-size:9px;letter-spacing:0.4px;text-transform:uppercase}
  thead th.num{text-align:right}
  tbody td{padding:7px 8px;border-bottom:1px solid #ececf2;vertical-align:top}
  tbody td.num{text-align:right}
  tbody td.bold{font-weight:700}
  tfoot tr{background:#1a1a40}
  tfoot td{color:#fff;padding:9px 8px;font-weight:700;font-size:11px}
  .footer{margin-top:28px;padding-top:10px;border-top:1px solid #dcdee6;color:#6e7382;font-size:9px;font-style:italic;text-align:center}
</style></head><body>
  <div class="header">
    ${logoUrl ? `<img class="logo" src="${escHtml(logoUrl)}"/>` : ''}
    <div style="flex:1">
      <div class="biz-name">${escHtml(business?.business_name || 'Stock Report')}</div>
      <div class="biz-meta">${meta.join('<br/>')}</div>
    </div>
  </div>
  <div class="title">STOCK REPORT</div>
  <div class="subtitle">As on ${fmtDateShort(new Date().toISOString())}</div>
  <div class="summary">
    <div class="sum-card"><div class="sum-label">Items</div><div class="sum-val">${stockStats.totalCount}</div></div>
    <div class="sum-card val"><div class="sum-label">Stock Value</div><div class="sum-val">₹${fmtAmt(stockStats.totalValue)}</div></div>
    <div class="sum-card low"><div class="sum-label">Low Stock</div><div class="sum-val">${stockStats.lowCount}</div></div>
    <div class="sum-card out"><div class="sum-label">Out of Stock</div><div class="sum-val">${stockStats.outCount}</div></div>
  </div>
  <table>
    <thead><tr>
      <th>#</th><th>Item</th><th>Brand</th><th>Unit</th>
      <th class="num">Stock</th><th class="num">Alert</th>
      <th class="num">Rate</th><th class="num">Value</th><th>Status</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="9" style="text-align:center;padding:30px;color:#9ca0ad">No items</td></tr>`}</tbody>
    <tfoot><tr>
      <td colspan="7">TOTAL (${filteredStock.length} items)</td>
      <td class="num">₹${fmtAmt(filteredStock.reduce((s, i) => s + (Number(i.stock) || 0) * (Number(i.sale_price) || 0), 0))}</td>
      <td></td>
    </tr></tfoot>
  </table>
  <div class="footer">Generated on ${fmtDateShort(new Date().toISOString())} • ${escHtml(business?.business_name || '')}</div>
</body></html>`;
    }

    // Transactions PDF
    const rows = filteredLog.map((t, idx) => {
      const bg = idx % 2 === 0 ? '#fafbfd' : '#ffffff';
      const m = txnMeta(t.type);
      return `<tr style="background:${bg}">
        <td>${fmtDateShort(t.date)}</td>
        <td><span style="color:${m.color};font-weight:700">${m.label}</span></td>
        <td>${escHtml(t.item_name || '—')}</td>
        <td>${escHtml(t.reason || '—')}</td>
        <td>${escHtml(t.reference || '—')}</td>
        <td class="num bold" style="color:${m.color}">${m.sign}${t.qty}</td>
        <td class="num">${t.stock_after ?? '—'}</td>
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
  .sum-card{flex:1;border:1px solid #dcdee6;border-radius:6px;padding:10px 12px;background:#d1fae5}
  .sum-card.out{background:#fee2e2}
  .sum-card.adj{background:#fef3c7}
  .sum-card.cnt{background:#dbeafe}
  .sum-label{font-size:9px;font-weight:700;color:#6e7382;letter-spacing:0.5px;text-transform:uppercase}
  .sum-val{font-size:16px;font-weight:800;margin-top:4px;color:#047857}
  .sum-card.out .sum-val{color:#dc2626}
  .sum-card.adj .sum-val{color:#b45309}
  .sum-card.cnt .sum-val{color:#1d4ed8}
  table{width:100%;border-collapse:collapse;font-size:10px}
  thead th{background:#1a1a40;color:#fff;font-weight:700;text-align:left;padding:8px;font-size:9px;letter-spacing:0.4px;text-transform:uppercase}
  thead th.num{text-align:right}
  tbody td{padding:7px 8px;border-bottom:1px solid #ececf2}
  tbody td.num{text-align:right}
  tbody td.bold{font-weight:700}
  .footer{margin-top:28px;padding-top:10px;border-top:1px solid #dcdee6;color:#6e7382;font-size:9px;font-style:italic;text-align:center}
</style></head><body>
  <div class="header">
    ${logoUrl ? `<img class="logo" src="${escHtml(logoUrl)}"/>` : ''}
    <div style="flex:1">
      <div class="biz-name">${escHtml(business?.business_name || 'Stock Movement')}</div>
      <div class="biz-meta">${meta.join('<br/>')}</div>
    </div>
  </div>
  <div class="title">STOCK MOVEMENT</div>
  <div class="subtitle">${escHtml(periodLabel(period))}</div>
  <div class="summary">
    <div class="sum-card"><div class="sum-label">Stock In</div><div class="sum-val">+${logStats.inQty}</div></div>
    <div class="sum-card out"><div class="sum-label">Stock Out</div><div class="sum-val">-${logStats.outQty}</div></div>
    <div class="sum-card adj"><div class="sum-label">Adjusted</div><div class="sum-val">${logStats.adjQty}</div></div>
    <div class="sum-card cnt"><div class="sum-label">Entries</div><div class="sum-val">${logStats.count}</div></div>
  </div>
  <table>
    <thead><tr>
      <th>Date</th><th>Type</th><th>Item</th><th>Reason</th><th>Ref</th>
      <th class="num">Qty</th><th class="num">Stock After</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="7" style="text-align:center;padding:30px;color:#9ca0ad">No transactions</td></tr>`}</tbody>
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
          dialogTitle: tab === 'stock' ? 'Stock Report' : `Stock Movement ${periodLabel(period)}`,
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to generate PDF');
    } finally { setExporting(false); }
  };

  // ============= RENDER =============
  const renderStockCard = ({ item }: { item: any }) => {
    const out = Number(item.stock) <= 0;
    const low = item.low_stock && !out;
    const stripColor = out ? '#dc2626' : low ? '#b45309' : '#10B981';
    const value = (Number(item.stock) || 0) * (Number(item.sale_price) || 0);
    return (
      <TouchableOpacity
        style={st.stockCard}
        activeOpacity={0.85}
        onPress={() => setHistoryItem(item)}
        onLongPress={() => openTxnForm({ item_id: item.id, item_name: item.item_name, current_stock: Number(item.stock) || 0 })}
      >
        <View style={[st.cardStrip, { backgroundColor: stripColor }]} />
        <View style={{ flex: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={st.itemName} numberOfLines={1}>{item.item_name}</Text>
            {out ? (
              <View style={[st.statusBadge, { backgroundColor: '#fee2e2' }]}><Text style={[st.statusText, { color: '#dc2626' }]}>OUT</Text></View>
            ) : low ? (
              <View style={[st.statusBadge, { backgroundColor: '#fef3c7' }]}><Text style={[st.statusText, { color: '#b45309' }]}>LOW</Text></View>
            ) : null}
          </View>
          <View style={st.metaRow}>
            {item.brand_name ? <Text style={st.metaTxt} numberOfLines={1}>{item.brand_name}</Text> : null}
            {item.brand_name ? <Text style={st.dot}>•</Text> : null}
            <Text style={st.metaTxt}>₹{fmtAmt(item.sale_price)}</Text>
            <Text style={st.dot}>•</Text>
            <Text style={st.metaTxt}>{item.unit || 'Nos'}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', paddingRight: spacing.md, paddingVertical: spacing.sm + 2 }}>
          <Text style={[st.stockNum, { color: stripColor }]}>{item.stock ?? 0}</Text>
          <Text style={st.stockValue}>₹{fmtAmt(value)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderLogCard = ({ item }: { item: any }) => {
    const m = txnMeta(item.type);
    return (
      <TouchableOpacity
        style={st.logCard}
        activeOpacity={0.85}
        onLongPress={() => deleteTxn(item)}
      >
        <View style={[st.txnIconBig, { backgroundColor: m.bg }]}>
          <Ionicons name={m.icon} size={22} color={m.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={st.itemName} numberOfLines={1}>{item.item_name || `Item #${item.item_id}`}</Text>
          </View>
          <View style={st.metaRow}>
            <Text style={[st.metaTxt, { color: m.color, fontWeight: '700' }]}>{m.label}</Text>
            <Text style={st.dot}>•</Text>
            <Text style={st.metaTxt}>{fmtDateShort(item.date)}</Text>
            {item.reason ? <><Text style={st.dot}>•</Text><Text style={st.metaTxt} numberOfLines={1}>{item.reason}</Text></> : null}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[st.txnQty, { color: m.color }]}>{m.sign}{item.qty}</Text>
          {item.stock_after != null ? <Text style={st.stockAfter}>={item.stock_after}</Text> : null}
        </View>
      </TouchableOpacity>
    );
  };

  const Header = (
    <View>
      {/* Hero */}
      <View style={st.hero}>
        <View style={st.heroBgAccent} />
        <View style={st.heroBgAccent2} />
        <View style={st.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={st.heroEyebrow}>Stock Value</Text>
            <CurrencyText amount={stockStats.totalValue} style={st.heroValue} />
            <Text style={st.heroSub}>{stockStats.totalCount} items • {stockStats.totalUnits} units</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {tab === 'log' && (
              <TouchableOpacity style={st.filterPill} activeOpacity={0.8} onPress={() => { setDraftPeriod(period); setPickerOpen(true); }}>
                <Ionicons name="calendar" size={13} color="#fff" />
                <Text style={st.filterPillText}>{periodLabel(period)}</Text>
                <Ionicons name="chevron-down" size={13} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={st.iconPill} activeOpacity={0.8} onPress={handleDownloadPDF} disabled={exporting}>
              {exporting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="download-outline" size={15} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
        <View style={st.heroStatsRow}>
          <View style={st.heroStatItem}>
            <Text style={st.heroStatLabel}>Items</Text>
            <Text style={st.heroStatVal}>{stockStats.totalCount}</Text>
          </View>
          <View style={st.heroDivider} />
          <View style={st.heroStatItem}>
            <Text style={st.heroStatLabel}>Low Stock</Text>
            <Text style={[st.heroStatVal, stockStats.lowCount > 0 && { color: '#fbbf24' }]}>{stockStats.lowCount}</Text>
          </View>
          <View style={st.heroDivider} />
          <View style={st.heroStatItem}>
            <Text style={st.heroStatLabel}>Out of Stock</Text>
            <Text style={[st.heroStatVal, stockStats.outCount > 0 && { color: '#fca5a5' }]}>{stockStats.outCount}</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={st.tabRow}>
        <TouchableOpacity style={[st.tab, tab === 'stock' && st.tabActive]} onPress={() => setTab('stock')}>
          <Ionicons name="cube-outline" size={15} color={tab === 'stock' ? colors.primary : colors.gray500} />
          <Text style={[st.tabText, tab === 'stock' && st.tabTextActive]}>Stock Levels</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[st.tab, tab === 'log' && st.tabActive]} onPress={() => setTab('log')}>
          <Ionicons name="git-network-outline" size={15} color={tab === 'log' ? colors.primary : colors.gray500} />
          <Text style={[st.tabText, tab === 'log' && st.tabTextActive]}>Transactions</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={st.searchRow}>
        <Ionicons name="search" size={18} color={colors.gray400} />
        <TextInput
          style={st.searchInput}
          value={tab === 'stock' ? search : logSearch}
          onChangeText={tab === 'stock' ? setSearch : setLogSearch}
          placeholder={tab === 'stock' ? 'Search items, brand, model...' : 'Search transactions...'}
          placeholderTextColor={colors.placeholder}
        />
        {(tab === 'stock' ? search : logSearch) ? (
          <TouchableOpacity onPress={() => tab === 'stock' ? setSearch('') : setLogSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.gray400} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipsScroll}>
        {tab === 'stock' ? (
          [
            { k: 'all', label: 'All', count: stockSummary.length, color: colors.primary },
            { k: 'in', label: 'In Stock', count: stockSummary.filter(i => Number(i.stock) > 0 && !i.low_stock).length, color: '#10B981' },
            { k: 'low', label: 'Low', count: stockStats.lowCount, color: '#b45309' },
            { k: 'out', label: 'Out', count: stockStats.outCount, color: '#dc2626' },
          ].map((c: any) => {
            const active = stockFilter === c.k;
            return (
              <TouchableOpacity
                key={c.k}
                style={[st.chip, active && { backgroundColor: c.color, borderColor: c.color }]}
                onPress={() => setStockFilter(c.k)}
                activeOpacity={0.85}
              >
                <Text style={[st.chipText, active && st.chipTextActive]}>{c.label}</Text>
                <View style={[st.chipBadge, active && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                  <Text style={[st.chipBadgeText, active && { color: '#fff' }]}>{c.count}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          ['All', 'stock_in', 'stock_out', 'adjustment'].map(t => {
            const active = logType === t;
            const m = t === 'All' ? null : txnMeta(t);
            return (
              <TouchableOpacity
                key={t}
                style={[st.chip, active && (m
                  ? { backgroundColor: m.color, borderColor: m.color }
                  : { backgroundColor: colors.primary, borderColor: colors.primary }
                )]}
                onPress={() => setLogType(t as any)}
                activeOpacity={0.85}
              >
                {m ? <Ionicons name={m.icon} size={12} color={active ? '#fff' : m.color} style={{ marginRight: 4 }} /> : null}
                <Text style={[st.chipText, active && st.chipTextActive]}>
                  {t === 'All' ? 'All' : m?.label}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {tab === 'log' && (
        <View style={st.logStatsRow}>
          <View style={st.logStat}>
            <Text style={[st.logStatVal, { color: '#10B981' }]}>+{logStats.inQty}</Text>
            <Text style={st.logStatLabel}>IN</Text>
          </View>
          <View style={st.logStat}>
            <Text style={[st.logStatVal, { color: '#dc2626' }]}>-{logStats.outQty}</Text>
            <Text style={st.logStatLabel}>OUT</Text>
          </View>
          <View style={st.logStat}>
            <Text style={[st.logStatVal, { color: '#b45309' }]}>{logStats.adjQty}</Text>
            <Text style={st.logStatLabel}>ADJ</Text>
          </View>
          <View style={st.logStat}>
            <Text style={[st.logStatVal, { color: colors.primary }]}>{logStats.count}</Text>
            <Text style={st.logStatLabel}>Entries</Text>
          </View>
        </View>
      )}
    </View>
  );

  const data = tab === 'stock' ? filteredStock : filteredLog;

  return (
    <View style={st.container}>
      <FlatList
        data={data}
        keyExtractor={(i, idx) => (i?.id != null ? String(i.id) : `row-${idx}`)}
        renderItem={tab === 'stock' ? renderStockCard : renderLogCard}
        ListHeaderComponent={Header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.primary} colors={[colors.primary]} />}
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <EmptyState
              icon={tab === 'stock' ? 'cube-outline' : 'swap-horizontal-outline'}
              title={tab === 'stock' ? 'No items match' : 'No transactions'}
              subtitle={tab === 'stock' ? 'Adjust filters or add items from Items screen' : 'Tap + to record stock movement'}
            />
          )
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <TouchableOpacity style={st.fab} activeOpacity={0.85} onPress={() => openTxnForm()}>
        <Ionicons name="add" size={26} color={colors.white} />
      </TouchableOpacity>

      {/* Period Picker */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalSheet}>
            <View style={st.modalHandle} />
            <Text style={st.modalTitle}>Select Period</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={st.typeRow}>
                {(['all', 'month', 'year', 'custom'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[st.typeBtn, draftPeriod.type === t && st.typeBtnActive]}
                    onPress={() => {
                      const ty = today;
                      if (t === 'all') setDraftPeriod({ type: 'all' });
                      else if (t === 'month') setDraftPeriod({ type: 'month', month: ty.getMonth() + 1, year: ty.getFullYear() });
                      else if (t === 'year') setDraftPeriod({ type: 'year', year: ty.getFullYear() });
                      else setDraftPeriod({ type: 'custom', from: `${ty.getFullYear()}-${pad2(ty.getMonth() + 1)}-01`, to: ty.toISOString().slice(0, 10) });
                    }}
                  >
                    <Text style={[st.typeBtnText, draftPeriod.type === t && st.typeBtnTextActive]}>
                      {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {draftPeriod.type === 'month' && (
                <>
                  <Text style={st.modalLabel}>Month</Text>
                  <View style={st.gridRow}>
                    {MONTH_LABELS.map((m, i) => (
                      <TouchableOpacity key={m} style={[st.gridBtn, draftPeriod.month === i + 1 && st.gridBtnActive]} onPress={() => setDraftPeriod({ ...draftPeriod, month: i + 1 })}>
                        <Text style={[st.gridBtnText, draftPeriod.month === i + 1 && st.gridBtnTextActive]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={st.modalLabel}>Year</Text>
                  <View style={st.gridRow}>
                    {[today.getFullYear() - 2, today.getFullYear() - 1, today.getFullYear()].map(y => (
                      <TouchableOpacity key={y} style={[st.gridBtn, draftPeriod.year === y && st.gridBtnActive, { flex: 1 }]} onPress={() => setDraftPeriod({ ...draftPeriod, year: y })}>
                        <Text style={[st.gridBtnText, draftPeriod.year === y && st.gridBtnTextActive]}>{y}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              {draftPeriod.type === 'year' && (
                <>
                  <Text style={st.modalLabel}>Year</Text>
                  <View style={st.gridRow}>
                    {[today.getFullYear() - 2, today.getFullYear() - 1, today.getFullYear()].map(y => (
                      <TouchableOpacity key={y} style={[st.gridBtn, draftPeriod.year === y && st.gridBtnActive, { flex: 1 }]} onPress={() => setDraftPeriod({ ...draftPeriod, year: y })}>
                        <Text style={[st.gridBtnText, draftPeriod.year === y && st.gridBtnTextActive]}>{y}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              {draftPeriod.type === 'custom' && (
                <>
                  <Text style={st.modalLabel}>From</Text>
                  <DateInput value={draftPeriod.from} onChange={(v) => setDraftPeriod({ ...draftPeriod, from: v })} />
                  <Text style={st.modalLabel}>To</Text>
                  <DateInput value={draftPeriod.to} onChange={(v) => setDraftPeriod({ ...draftPeriod, to: v })} />
                </>
              )}
            </ScrollView>
            <View style={st.modalActions}>
              <TouchableOpacity style={st.modalCancel} onPress={() => setPickerOpen(false)}>
                <Text style={{ color: colors.gray600, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.modalConfirm} onPress={() => { setPeriod(draftPeriod); setPickerOpen(false); }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Stock Transaction Form */}
      <Modal visible={showTxn} transparent animationType="slide" onRequestClose={() => setShowTxn(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={st.modalOverlay}>
            <View style={st.formSheet}>
              <View style={st.modalHandle} />
              <Text style={st.modalTitle}>Stock Transaction</Text>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={st.formLabel}>Type</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {(['stock_in', 'stock_out', 'adjustment'] as const).map(t => {
                    const m = txnMeta(t);
                    const active = txnForm.type === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[st.txnTypeBtn, active && { backgroundColor: m.bg, borderColor: m.color }]}
                        onPress={() => setTxnForm(p => ({ ...p, type: t }))}
                      >
                        <Ionicons name={m.icon} size={18} color={active ? m.color : colors.gray500} />
                        <Text style={[st.txnTypeText, active && { color: m.color }]}>{m.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={st.formLabel}>Item *</Text>
                <TouchableOpacity style={st.itemPickerBtn} onPress={() => setShowItemPicker(true)} activeOpacity={0.85}>
                  <Ionicons name="cube-outline" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[st.itemPickerText, !txnForm.item_name && { color: colors.gray500 }]} numberOfLines={1}>
                      {txnForm.item_name || 'Select item'}
                    </Text>
                    {txnForm.item_id ? <Text style={st.itemPickerSub}>Current stock: {txnForm.current_stock}</Text> : null}
                  </View>
                  <Ionicons name="chevron-down" size={16} color={colors.gray500} />
                </TouchableOpacity>

                <Text style={st.formLabel}>Quantity *</Text>
                <View style={st.amountInputWrap}>
                  <TextInput
                    style={st.amountInput}
                    value={txnForm.qty}
                    onChangeText={v => setTxnForm(p => ({ ...p, qty: v.replace(/[^0-9.]/g, '') }))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.gray300}
                  />
                </View>
                <View style={st.quickAmtRow}>
                  {[1, 5, 10, 50, 100].map(q => (
                    <TouchableOpacity key={q} style={st.quickAmt} onPress={() => {
                      const cur = parseFloat(txnForm.qty) || 0;
                      setTxnForm(p => ({ ...p, qty: String(cur + q) }));
                    }}>
                      <Text style={st.quickAmtText}>+{q}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={st.quickAmtClear} onPress={() => setTxnForm(p => ({ ...p, qty: '' }))}>
                    <Ionicons name="refresh" size={12} color={colors.gray600} />
                  </TouchableOpacity>
                </View>

                <Text style={st.formLabel}>Date</Text>
                <DateInput value={txnForm.date} onChange={v => setTxnForm(p => ({ ...p, date: v }))} />

                <Text style={st.formLabel}>Reason</Text>
                <TextInput
                  style={st.input}
                  value={txnForm.reason}
                  onChangeText={v => setTxnForm(p => ({ ...p, reason: v }))}
                  placeholder={txnForm.type === 'stock_in' ? 'Purchase / Return / Opening' : txnForm.type === 'stock_out' ? 'Sale / Damage / Return' : 'Recount / Correction'}
                  placeholderTextColor={colors.placeholder}
                />

                <Text style={st.formLabel}>Reference</Text>
                <TextInput
                  style={st.input}
                  value={txnForm.reference}
                  onChangeText={v => setTxnForm(p => ({ ...p, reference: v }))}
                  placeholder="Bill # / PO # / Invoice #"
                  placeholderTextColor={colors.placeholder}
                />

                <Text style={st.formLabel}>Notes</Text>
                <TextInput
                  style={[st.input, { minHeight: 60 }]}
                  value={txnForm.notes}
                  onChangeText={v => setTxnForm(p => ({ ...p, notes: v }))}
                  placeholder="Optional"
                  placeholderTextColor={colors.placeholder}
                  multiline
                />
              </ScrollView>

              <View style={st.formActions}>
                <TouchableOpacity style={st.btnGhost} onPress={() => setShowTxn(false)}>
                  <Text style={st.btnGhostText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.btnPrimary, saving && { opacity: 0.6 }]}
                  onPress={saveTxn}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                    <>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={st.btnPrimaryText}>Save</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Item Picker */}
      <Modal visible={showItemPicker} transparent animationType="slide" onRequestClose={() => setShowItemPicker(false)}>
        <View style={st.modalOverlay}>
          <View style={[st.modalSheet, { maxHeight: '85%' }]}>
            <View style={st.modalHandle} />
            <Text style={st.modalTitle}>Select Item</Text>
            <View style={[st.searchRow, { marginHorizontal: 0, marginTop: 0 }]}>
              <Ionicons name="search" size={18} color={colors.gray400} />
              <TextInput
                style={st.searchInput}
                value={itemSearch}
                onChangeText={setItemSearch}
                placeholder="Search items..."
                placeholderTextColor={colors.placeholder}
              />
            </View>
            <FlatList
              data={items.filter(i => {
                const q = itemSearch.trim().toLowerCase();
                if (!q) return true;
                return `${i.item_name} ${i.brand_name || ''} ${i.model_number || ''}`.toLowerCase().includes(q);
              })}
              keyExtractor={(i, idx) => (i?.id != null ? `item-${i.id}` : `item-${idx}`)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const out = Number(item.stock) <= 0;
                const low = item.stock_alert_enabled && Number(item.stock) <= Number(item.stock_alert_qty || 0);
                return (
                  <TouchableOpacity
                    style={st.pickerItem}
                    onPress={() => {
                      setTxnForm(p => ({ ...p, item_id: item.id, item_name: item.item_name, current_stock: Number(item.stock) || 0 }));
                      setShowItemPicker(false);
                      setItemSearch('');
                    }}
                  >
                    <View style={[st.pickerItemIcon, { backgroundColor: out ? '#fee2e2' : low ? '#fef3c7' : '#dbeafe' }]}>
                      <Ionicons name="cube" size={16} color={out ? '#dc2626' : low ? '#b45309' : colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.pickerItemText} numberOfLines={1}>{item.item_name}</Text>
                      <Text style={st.pickerItemSub}>
                        {item.brand_name ? `${item.brand_name} • ` : ''}₹{fmtAmt(item.sale_price)} • {item.unit || 'Nos'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[st.pickerStock, { color: out ? '#dc2626' : low ? '#b45309' : colors.text }]}>
                        {item.stock ?? 0}
                      </Text>
                      {out ? <Text style={[st.pickerStockTag, { color: '#dc2626' }]}>OUT</Text> : low ? <Text style={[st.pickerStockTag, { color: '#b45309' }]}>LOW</Text> : null}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                  <Ionicons name="cube-outline" size={36} color={colors.gray300} />
                  <Text style={{ color: colors.gray500, marginTop: 8, fontSize: 13 }}>No items</Text>
                </View>
              }
              style={{ marginTop: spacing.sm }}
            />
            <TouchableOpacity style={[st.modalCancel, { marginTop: spacing.md }]} onPress={() => setShowItemPicker(false)}>
              <Text style={{ color: colors.gray600, fontWeight: '600' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Item history sheet */}
      <Modal visible={!!historyItem} transparent animationType="slide" onRequestClose={() => setHistoryItem(null)}>
        <View style={st.modalOverlay}>
          <View style={[st.modalSheet, { maxHeight: '85%' }]}>
            <View style={st.modalHandle} />
            {historyItem && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.sm }}>
                  <View style={[st.txnIconBig, { backgroundColor: '#dbeafe' }]}>
                    <Ionicons name="cube" size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.modalTitle}>{historyItem.item_name}</Text>
                    <Text style={{ fontSize: 12, color: colors.gray500, fontWeight: '600' }}>
                      Stock: {historyItem.stock ?? 0} {historyItem.unit || 'Nos'} • ₹{fmtAmt(historyItem.sale_price)}
                    </Text>
                  </View>
                </View>

                <View style={st.historyStatsRow}>
                  <View style={st.historyStat}>
                    <Text style={[st.historyStatVal, { color: '#10B981' }]}>+{historyTxns.filter(t => t.type === 'stock_in').reduce((s, t) => s + Number(t.qty || 0), 0)}</Text>
                    <Text style={st.historyStatLabel}>IN</Text>
                  </View>
                  <View style={st.historyStat}>
                    <Text style={[st.historyStatVal, { color: '#dc2626' }]}>-{historyTxns.filter(t => t.type === 'stock_out').reduce((s, t) => s + Number(t.qty || 0), 0)}</Text>
                    <Text style={st.historyStatLabel}>OUT</Text>
                  </View>
                  <View style={st.historyStat}>
                    <Text style={[st.historyStatVal, { color: colors.primary }]}>{historyTxns.length}</Text>
                    <Text style={st.historyStatLabel}>Entries</Text>
                  </View>
                </View>

                <Text style={[st.formLabel, { marginTop: spacing.md }]}>Transaction History</Text>
                <FlatList
                  data={historyTxns}
                  keyExtractor={(t, idx) => (t?.id != null ? `txn-${t.id}` : `txn-${idx}`)}
                  renderItem={({ item: t }) => {
                    const m = txnMeta(t.type);
                    return (
                      <View style={st.historyRow}>
                        <View style={[st.txnIconSmall, { backgroundColor: m.bg }]}>
                          <Ionicons name={m.icon} size={14} color={m.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{m.label}</Text>
                          <Text style={{ fontSize: 11, color: colors.gray500, fontWeight: '600' }}>
                            {fmtDateShort(t.date)}{t.reason ? ` • ${t.reason}` : ''}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[st.historyQty, { color: m.color }]}>{m.sign}{t.qty}</Text>
                          {t.stock_after != null && <Text style={{ fontSize: 10, color: colors.gray500 }}>={t.stock_after}</Text>}
                        </View>
                      </View>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                      <Text style={{ color: colors.gray500, fontSize: 13 }}>No transactions yet</Text>
                    </View>
                  }
                />

                <View style={st.formActions}>
                  <TouchableOpacity style={st.btnGhost} onPress={() => setHistoryItem(null)}>
                    <Text style={st.btnGhostText}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={st.btnPrimary}
                    onPress={() => {
                      const it = historyItem;
                      setHistoryItem(null);
                      openTxnForm({ item_id: it.id, item_name: it.item_name, current_stock: Number(it.stock) || 0 });
                    }}
                  >
                    <Ionicons name="add" size={16} color="#fff" />
                    <Text style={st.btnPrimaryText}>Adjust Stock</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
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
  heroBgAccent: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(16,185,129,0.18)', top: -60, right: -40 },
  heroBgAccent2: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.04)', bottom: -30, left: -20 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  heroEyebrow: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  heroValue: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  heroSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  filterPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  filterPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  iconPill: { width: 32, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' },
  heroStatItem: { flex: 1 },
  heroStatLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  heroStatVal: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 2 },
  heroDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: spacing.sm },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: spacing.md, marginTop: spacing.sm + 2,
    borderRadius: 14, padding: 4,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  tabActive: { backgroundColor: colors.primary + '12' },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.gray500 },
  tabTextActive: { color: colors.primary },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: spacing.md, marginTop: spacing.sm + 2,
    borderRadius: 14, paddingHorizontal: spacing.md, paddingVertical: 10, gap: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  searchInput: { flex: 1, fontSize: fontSize.md, color: colors.text, paddingVertical: 0 },

  chipsScroll: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: borderRadius.full, backgroundColor: '#fff',
    marginRight: 6, borderWidth: 1, borderColor: colors.border,
  },
  chipText: { fontSize: 12, color: colors.gray700, fontWeight: '700' },
  chipTextActive: { color: '#fff' },
  chipBadge: { marginLeft: 6, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, backgroundColor: colors.gray100 },
  chipBadgeText: { fontSize: 10, fontWeight: '800', color: colors.gray600 },

  logStatsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 14, paddingVertical: spacing.sm,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  logStat: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.gray100 },
  logStatVal: { fontSize: 16, fontWeight: '800' },
  logStatLabel: { fontSize: 9, fontWeight: '700', color: colors.gray500, marginTop: 2, letterSpacing: 0.4 },

  // Stock cards
  stockCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: spacing.md, marginBottom: 8,
    borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardStrip: { width: 4, alignSelf: 'stretch' },
  itemName: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  metaTxt: { fontSize: 11, color: colors.gray500, fontWeight: '600' },
  dot: { fontSize: 10, color: colors.gray400 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  stockNum: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  stockValue: { fontSize: 10, color: colors.gray500, fontWeight: '600', marginTop: 1 },

  // Log cards
  logCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: spacing.md, marginBottom: 8,
    borderRadius: 14, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md, gap: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  txnIconBig: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  txnIconSmall: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  txnQty: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  stockAfter: { fontSize: 10, color: colors.gray500, fontWeight: '600', marginTop: 1 },

  fab: { position: 'absolute', right: 18, bottom: 18, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 32, maxHeight: '85%' },
  modalHandle: { width: 40, height: 4, backgroundColor: colors.gray200, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
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

  formSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 28, maxHeight: '92%' },
  formLabel: { fontSize: 11, fontWeight: '800', color: colors.gray500, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: spacing.md, marginBottom: 6 },

  txnTypeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff',
  },
  txnTypeText: { fontSize: 12, fontWeight: '700', color: colors.gray600 },

  itemPickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: colors.border, backgroundColor: '#f6f7fb',
    borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  itemPickerText: { fontSize: 14, fontWeight: '700', color: colors.text },
  itemPickerSub: { fontSize: 11, color: colors.gray500, fontWeight: '600', marginTop: 1 },

  amountInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f6f7fb', borderRadius: 14, paddingHorizontal: spacing.md, paddingVertical: 4 },
  amountInput: { flex: 1, fontSize: 26, fontWeight: '800', color: colors.text, paddingVertical: 8, letterSpacing: -0.4 },
  quickAmtRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  quickAmt: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.primary + '12', borderRadius: 999 },
  quickAmtText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  quickAmtClear: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },

  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, fontSize: fontSize.md, color: colors.text, minHeight: 48 },

  formActions: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  btnGhost: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', backgroundColor: colors.gray100 },
  btnGhostText: { fontSize: 14, fontWeight: '700', color: colors.gray700 },
  btnPrimary: { flex: 2, flexDirection: 'row', gap: 6, paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  btnPrimaryText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  // Item picker rows
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    marginBottom: 6, backgroundColor: '#fff',
  },
  pickerItemIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pickerItemText: { fontSize: 13, fontWeight: '700', color: colors.text },
  pickerItemSub: { fontSize: 11, color: colors.gray500, fontWeight: '600', marginTop: 1 },
  pickerStock: { fontSize: 16, fontWeight: '800' },
  pickerStockTag: { fontSize: 9, fontWeight: '800', marginTop: 1 },

  // History
  historyStatsRow: { flexDirection: 'row', backgroundColor: '#f6f7fb', borderRadius: 12, paddingVertical: 10, marginTop: spacing.sm },
  historyStat: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.gray100 },
  historyStatVal: { fontSize: 16, fontWeight: '800' },
  historyStatLabel: { fontSize: 9, fontWeight: '700', color: colors.gray500, marginTop: 2, letterSpacing: 0.4 },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  historyQty: { fontSize: 14, fontWeight: '800' },
});
