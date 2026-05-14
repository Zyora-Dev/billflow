import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { useToast } from '../../components/Toast';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import CurrencyText from '../../components/CurrencyText';

const FREQ_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'weekly', label: 'Weekly', color: '#3b82f6' },
  { value: 'monthly', label: 'Monthly', color: '#8b5cf6' },
  { value: 'quarterly', label: 'Quarterly', color: '#f59e0b' },
  { value: 'half_yearly', label: 'Half Yearly', color: '#06b6d4' },
  { value: 'yearly', label: 'Yearly', color: '#ec4899' },
];

const freqColor = (f: string) => FREQ_OPTIONS.find(o => o.value === f)?.color || colors.gray400;
const freqLabel = (f: string) => FREQ_OPTIONS.find(o => o.value === f)?.label || f;

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; }
};

export default function RecurringInvoiceDetailScreen({ route, navigation }: any) {
  const toast = useToast();
  const { id } = route.params;
  const [ri, setRi] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get(`/api/recurring-invoices/${id}`);
      setRi(res.data);
    } catch {}
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { navigation.addListener('focus', fetchData); }, [navigation, fetchData]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post(`/api/recurring-invoices/${id}/generate`);
      const invNum = res.data?.invoice_number || '';
      toast.success(invNum ? `Invoice ${invNum} generated!` : 'Invoice generated!');
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to generate');
    } finally { setGenerating(false); }
  };

  const handleToggleStatus = async () => {
    if (!ri) return;
    const newStatus = ri.status === 'Active' ? 'Paused' : 'Active';
    try {
      await api.put(`/api/recurring-invoices/${id}`, { status: newStatus });
      toast.success(`Status changed to ${newStatus}`);
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed');
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete', 'Delete this recurring invoice template?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/api/recurring-invoices/${id}`);
          toast.success('Deleted');
          navigation.goBack();
        } catch (e: any) { Alert.alert('Error', e?.response?.data?.detail || 'Failed'); }
      }},
    ]);
  };

  if (!ri) return <View style={s.center}><ActivityIndicator color={colors.primary} /></View>;

  // Parse items
  let items: any[] = [];
  try { items = ri.items || (typeof ri.items_json === 'string' ? JSON.parse(ri.items_json) : ri.items_json) || []; } catch {}

  const lineTotal = (li: any) => {
    const base = (Number(li.qty) || 0) * (Number(li.rate) || 0);
    const disc = base * (Number(li.discount_percent) || 0) / 100;
    const taxable = base - disc;
    return taxable + taxable * (Number(li.tax_rate) || 0) / 100;
  };
  const subtotal = items.reduce((sum, li) => sum + (Number(li.qty) || 0) * (Number(li.rate) || 0) * (1 - (Number(li.discount_percent) || 0) / 100), 0);
  const taxTotal = items.reduce((sum, li) => {
    const base = (Number(li.qty) || 0) * (Number(li.rate) || 0) * (1 - (Number(li.discount_percent) || 0) / 100);
    return sum + base * (Number(li.tax_rate) || 0) / 100;
  }, 0);
  const discVal = Number(ri.discount_value) || 0;
  const overallDisc = ri.discount_type === 'percentage' ? subtotal * discVal / 100 : discVal;
  const grandTotal = subtotal - overallDisc + taxTotal;

  const isActive = ri.status === 'Active';
  const fc = freqColor(ri.frequency);

  return (
    <ScrollView style={s.container}>
      {/* Hero Card */}
      <View style={s.heroCard}>
        <View style={s.heroAccent} />
        <View style={s.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.heroName} numberOfLines={2}>{ri.name || 'Recurring Invoice'}</Text>
            <Text style={s.heroCust}>{ri.customer_name || '—'}</Text>
          </View>
          <View style={[s.statusPill, { backgroundColor: isActive ? '#10b98120' : '#f59e0b20' }]}>
            <View style={[s.statusDot, { backgroundColor: isActive ? '#10b981' : '#f59e0b' }]} />
            <Text style={[s.statusText, { color: isActive ? '#10b981' : '#f59e0b' }]}>{ri.status}</Text>
          </View>
        </View>
        <View style={s.freqRow}>
          <View style={[s.freqBadge, { backgroundColor: fc + '18' }]}>
            <Ionicons name="repeat" size={14} color={fc} />
            <Text style={[s.freqText, { color: fc }]}>{freqLabel(ri.frequency)}</Text>
          </View>
          <CurrencyText amount={grandTotal} style={s.heroTotal} />
        </View>
      </View>

      {/* Schedule Info */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Schedule</Text>
        <View style={s.infoGrid}>
          <View style={s.infoItem}>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <View>
              <Text style={s.infoLabel}>Start Date</Text>
              <Text style={s.infoValue}>{fmtDate(ri.start_date)}</Text>
            </View>
          </View>
          <View style={s.infoItem}>
            <Ionicons name="calendar" size={16} color={colors.danger} />
            <View>
              <Text style={s.infoLabel}>End Date</Text>
              <Text style={s.infoValue}>{ri.end_date ? fmtDate(ri.end_date) : 'No end'}</Text>
            </View>
          </View>
          <View style={s.infoItem}>
            <Ionicons name="arrow-forward-circle-outline" size={16} color="#8b5cf6" />
            <View>
              <Text style={s.infoLabel}>Next Invoice</Text>
              <Text style={s.infoValue}>{fmtDate(ri.next_date)}</Text>
            </View>
          </View>
          <View style={s.infoItem}>
            <Ionicons name="time-outline" size={16} color="#f59e0b" />
            <View>
              <Text style={s.infoLabel}>Due Days</Text>
              <Text style={s.infoValue}>{ri.due_days ?? 15} days after invoice</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Ionicons name="receipt-outline" size={20} color={colors.primary} />
          <Text style={s.statNum}>{ri.invoices_created || 0}</Text>
          <Text style={s.statLabel}>Generated</Text>
        </View>
        <View style={s.statCard}>
          <Ionicons name="document-text-outline" size={20} color="#10b981" />
          <Text style={s.statNum}>{ri.last_invoice_id ? `#${ri.last_invoice_id}` : '—'}</Text>
          <Text style={s.statLabel}>Last Invoice</Text>
        </View>
        <View style={s.statCard}>
          <Ionicons name="calendar-outline" size={20} color="#8b5cf6" />
          <Text style={s.statNum}>{ri.last_invoice_date ? fmtDate(ri.last_invoice_date) : '—'}</Text>
          <Text style={s.statLabel}>Last Date</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={s.actions}>
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: colors.primary }]}
          onPress={handleGenerate}
          disabled={generating || !isActive}
          activeOpacity={0.8}
        >
          {generating ? <ActivityIndicator size={16} color="#fff" /> : <Ionicons name="flash" size={18} color="#fff" />}
          <Text style={s.actionBtnText}>Generate Now</Text>
        </TouchableOpacity>
        <View style={s.actionRow}>
          <TouchableOpacity
            style={[s.actionBtnSm, { backgroundColor: isActive ? '#f59e0b15' : '#10b98115', flex: 1 }]}
            onPress={handleToggleStatus}
          >
            <Ionicons name={isActive ? 'pause-circle' : 'play-circle'} size={18} color={isActive ? '#f59e0b' : '#10b981'} />
            <Text style={{ color: isActive ? '#f59e0b' : '#10b981', fontWeight: '700', fontSize: 13 }}>{isActive ? 'Pause' : 'Resume'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtnSm, { backgroundColor: colors.primary + '12', flex: 1 }]}
            onPress={() => navigation.navigate('RecurringInvoiceForm', { id })}
          >
            <Ionicons name="create-outline" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Line Items */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Line Items ({items.length})</Text>
        {items.map((li: any, i: number) => (
          <View key={i} style={s.lineItem}>
            <View style={s.lineNum}><Text style={s.lineNumText}>{i + 1}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.itemName}>{li.item_name}</Text>
              <Text style={s.itemSub}>
                {li.qty} {li.unit || 'Nos'} × ₹{Number(li.rate).toFixed(2)}
                {li.discount_percent > 0 ? ` · ${li.discount_percent}% off` : ''}
                {li.tax_rate > 0 ? ` · Tax ${li.tax_rate}%` : ''}
              </Text>
              {li.hsn_code ? <Text style={s.hsnText}>HSN: {li.hsn_code}</Text> : null}
            </View>
            <Text style={s.itemAmt}>₹{lineTotal(li).toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {/* Summary */}
      <View style={s.section}>
        <View style={s.sumRow}><Text style={s.sumLabel}>Subtotal</Text><Text style={s.sumVal}>₹{subtotal.toFixed(2)}</Text></View>
        {overallDisc > 0 && (
          <View style={s.sumRow}>
            <Text style={s.sumLabel}>Discount ({ri.discount_type === 'percentage' ? `${discVal}%` : 'Flat'})</Text>
            <Text style={[s.sumVal, { color: colors.danger }]}>-₹{overallDisc.toFixed(2)}</Text>
          </View>
        )}
        <View style={s.sumRow}><Text style={s.sumLabel}>Tax</Text><Text style={s.sumVal}>₹{taxTotal.toFixed(2)}</Text></View>
        <View style={[s.sumRow, s.totalRow]}>
          <Text style={s.totalLabel}>Estimated Total</Text>
          <Text style={s.totalVal}>₹{grandTotal.toFixed(2)}</Text>
        </View>
      </View>

      {/* Notes */}
      {ri.notes ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Notes</Text>
          <Text style={s.notes}>{ri.notes}</Text>
        </View>
      ) : null}

      {/* Delete */}
      <View style={{ paddingHorizontal: spacing.md, marginBottom: 40 }}>
        <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={s.deleteBtnText}>Delete Template</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  heroCard: {
    backgroundColor: colors.primary, margin: spacing.md, borderRadius: 20, padding: spacing.lg, overflow: 'hidden',
  },
  heroAccent: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.05)', top: -60, right: -50 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroName: { fontSize: 20, fontWeight: '900', color: '#fff' },
  heroCust: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontWeight: '600' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },
  freqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  freqBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  freqText: { fontSize: 12, fontWeight: '700' },
  heroTotal: { fontSize: 24, fontWeight: '900', color: '#fff' },

  section: { backgroundColor: '#fff', marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: 16, padding: spacing.md },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },

  infoGrid: { gap: 12 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel: { fontSize: 11, color: colors.gray500, fontWeight: '600' },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.text },

  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: 8, marginBottom: spacing.sm },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 },
  statNum: { fontSize: 16, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.gray500 },

  actions: { paddingHorizontal: spacing.md, gap: 8, marginBottom: spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtnSm: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12 },

  lineItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  lineNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  lineNumText: { fontSize: 11, fontWeight: '700', color: colors.gray500 },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.text },
  itemSub: { fontSize: 11, color: colors.gray500, marginTop: 2 },
  hsnText: { fontSize: 10, color: colors.gray400, marginTop: 1 },
  itemAmt: { fontSize: 14, fontWeight: '600', color: colors.text },

  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  sumLabel: { fontSize: 13, color: colors.gray500 },
  sumVal: { fontSize: 13, fontWeight: '500', color: colors.text },
  totalRow: { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: spacing.sm, marginTop: 4 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  totalVal: { fontSize: 16, fontWeight: '700', color: colors.primary },

  notes: { fontSize: 13, color: colors.gray600, lineHeight: 20 },

  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.danger, borderRadius: 12, paddingVertical: 14 },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: colors.danger },
});
