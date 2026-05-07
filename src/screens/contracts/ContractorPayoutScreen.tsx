import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  Alert, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import EmptyState from '../../components/EmptyState';
import CurrencyText from '../../components/CurrencyText';
import DateInput from '../../components/DateInput';

const fmt = (n: number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string) => {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; }
};
const today = () => new Date().toISOString().slice(0, 10);

const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Other'] as const;
const METHOD_COLORS: Record<string, string> = {
  Cash: '#10b981',
  UPI: '#8b5cf6',
  'Bank Transfer': '#3b82f6',
  Cheque: '#f59e0b',
  Card: '#ec4899',
  Other: '#94a3b8',
};

const EMPTY_FORM = {
  amount: '',
  payment_date: today(),
  payment_method: 'Cash' as string,
  reference_number: '',
  notes: '',
};

export default function ContractorPayoutScreen({ route, navigation }: { route: any; navigation: any }) {
  const { contractor_id, contractor_name } = route.params;

  const [orgId, setOrgId] = useState('');
  const [summary, setSummary] = useState<any>({ total_commission: 0, total_paid: 0, balance: 0 });
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: contractor_name || 'Payouts' });
  }, [contractor_name]);

  /* ── bootstrap ── */
  useEffect(() => {
    (async () => {
      try {
        const { data: me } = await api.get('/api/auth/me');
        const { data: biz } = await api.get('/api/business', { params: { user_id: me.user_id } });
        if (biz.length) setOrgId(biz[0].org_id);
      } catch {}
    })();
  }, []);

  const fetchAll = useCallback(async () => {
    if (!orgId) return;
    try {
      const [payRes, sumRes] = await Promise.all([
        api.get('/api/contractor-payouts', { params: { org_id: orgId, contractor_id } }),
        api.get(`/api/contractors/${contractor_id}/summary`),
      ]);
      setPayouts(payRes.data);
      setSummary(sumRes.data);
    } catch {}
  }, [orgId, contractor_id]);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [orgId, fetchAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  /* ── CRUD ── */
  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      amount: String(p.amount ?? ''),
      payment_date: p.payment_date || today(),
      payment_method: p.payment_method || 'Cash',
      reference_number: p.reference_number || '',
      notes: p.notes || '',
    });
    setModalOpen(true);
  };

  const setFullPayable = () => {
    const bal = summary.balance || 0;
    if (bal <= 0) return Alert.alert('Info', 'No outstanding balance');
    setForm({ ...form, amount: String(bal) });
  };

  const save = async () => {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return Alert.alert('Error', 'Enter a valid amount');
    setSaving(true);
    try {
      const body: any = {
        org_id: orgId,
        contractor_id,
        amount: amt,
        payment_date: form.payment_date,
        payment_method: form.payment_method,
        reference_number: form.reference_number.trim(),
        notes: form.notes.trim(),
      };
      if (editing) {
        await api.put(`/api/contractor-payouts/${editing.id}`, body);
      } else {
        await api.post('/api/contractor-payouts', body);
      }
      setModalOpen(false);
      fetchAll();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (p: any) => {
    Alert.alert('Delete Payout', `Delete payout of ₹${fmt(p.amount)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/api/contractor-payouts/${p.id}`);
            fetchAll();
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.detail || 'Failed to delete');
          }
        },
      },
    ]);
  };

  /* ── render ── */
  const renderPayout = ({ item: p }: { item: any }) => {
    const mc = METHOD_COLORS[p.payment_method] || '#94a3b8';
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.methodDot, { backgroundColor: mc }]} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.cardAmount}>₹{fmt(p.amount)}</Text>
            <Text style={styles.cardDate}>{fmtDate(p.payment_date)}</Text>
          </View>
          <View style={[styles.methodBadge, { backgroundColor: mc + '18' }]}>
            <Text style={[styles.methodText, { color: mc }]}>{p.payment_method}</Text>
          </View>
        </View>

        {(!!p.reference_number || !!p.invoice_number) && (
          <View style={styles.detailRow}>
            {!!p.reference_number && (
              <View style={styles.detailChip}>
                <Ionicons name="document-text-outline" size={12} color="#6b7280" />
                <Text style={styles.detailText}>Ref: {p.reference_number}</Text>
              </View>
            )}
            {!!p.invoice_number && (
              <View style={styles.detailChip}>
                <Ionicons name="receipt-outline" size={12} color="#6b7280" />
                <Text style={styles.detailText}>{p.invoice_number}</Text>
              </View>
            )}
          </View>
        )}

        {!!p.notes && <Text style={styles.notesText}>{p.notes}</Text>}

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(p)}>
            <Ionicons name="create-outline" size={16} color={colors.primary} />
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => confirmDelete(p)}>
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
            <Text style={[styles.actionText, { color: '#ef4444' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* hero */}
      <View style={styles.hero}>
        <View style={[styles.orb, { top: -30, right: -30 }]} />
        <View style={[styles.orb, { bottom: -20, left: -20, width: 100, height: 100 }]} />
        <Text style={styles.heroName}>{contractor_name}</Text>
        <View style={styles.heroStats}>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Commission</Text>
            <Text style={styles.heroStatVal}>₹{fmt(summary.total_commission)}</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Paid</Text>
            <Text style={styles.heroStatVal}>₹{fmt(summary.total_paid)}</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Balance</Text>
            <Text style={[styles.heroStatVal, { color: summary.balance > 0 ? '#fca5a5' : '#86efac' }]}>
              ₹{fmt(summary.balance)}
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={payouts}
          keyExtractor={(p) => String(p.id)}
          renderItem={renderPayout}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="wallet-outline" title="No payouts" subtitle="Tap + to record a payout" />}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={openAdd}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add / Edit Payout Modal */}
      <Modal visible={modalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Edit Payout' : 'Record Payout'}</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              {/* amount + set full payable */}
              <Text style={styles.fieldLabel}>Amount *</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="0.00"
                  placeholderTextColor="#9ca3af"
                  keyboardType="decimal-pad"
                  value={form.amount}
                  onChangeText={(v) => setForm({ ...form, amount: v })}
                />
                <TouchableOpacity style={styles.fullPayBtn} onPress={setFullPayable}>
                  <Ionicons name="cash-outline" size={16} color="#fff" />
                  <Text style={styles.fullPayText}>Full Payable</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Payment Date</Text>
              <DateInput
                value={form.payment_date}
                onChange={(d) => setForm({ ...form, payment_date: d })}
                placeholder="Select date"
              />

              {/* payment method chips */}
              <Text style={styles.fieldLabel}>Payment Method</Text>
              <View style={styles.chipRow}>
                {PAYMENT_METHODS.map((m) => {
                  const active = form.payment_method === m;
                  const mc = METHOD_COLORS[m];
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[styles.chip, active && { backgroundColor: mc + '20', borderColor: mc }]}
                      onPress={() => setForm({ ...form, payment_method: m })}
                    >
                      <Text style={[styles.chipText, active && { color: mc, fontWeight: '600' }]}>{m}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Reference Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Transaction / cheque no."
                placeholderTextColor="#9ca3af"
                value={form.reference_number}
                onChangeText={(v) => setForm({ ...form, reference_number: v })}
              />

              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[styles.input, { height: 72, textAlignVertical: 'top', paddingTop: 12 }]}
                placeholder="Optional notes"
                placeholderTextColor="#9ca3af"
                multiline
                value={form.notes}
                onChangeText={(v) => setForm({ ...form, notes: v })}
              />
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>{editing ? 'Update Payout' : 'Record Payout'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },

  /* hero */
  hero: {
    backgroundColor: '#064e3b',
    paddingHorizontal: spacing.lg,
    paddingTop: 16,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroName: { color: '#fff', fontSize: fontSize.lg, fontWeight: '700' },
  heroStats: {
    flexDirection: 'row',
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
  },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 2 },
  heroStatVal: { color: '#fff', fontSize: fontSize.sm, fontWeight: '700' },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 4 },

  /* card */
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  methodDot: { width: 10, height: 10, borderRadius: 5 },
  cardAmount: { fontSize: fontSize.md, fontWeight: '700', color: '#111827' },
  cardDate: { fontSize: fontSize.xs, color: '#6b7280', marginTop: 2 },
  methodBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  methodText: { fontSize: 12, fontWeight: '600' },

  detailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  detailText: { fontSize: 11, color: '#6b7280' },
  notesText: { fontSize: fontSize.xs, color: '#6b7280', fontStyle: 'italic', marginTop: 8 },

  /* actions */
  actionRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    justifyContent: 'flex-end',
    gap: 16,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: fontSize.xs, fontWeight: '500', color: colors.primary },

  /* fab */
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },

  /* modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: '#111827' },
  fieldLabel: { fontSize: fontSize.xs, fontWeight: '600', color: '#374151', marginBottom: 4, marginTop: 12 },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    height: 44,
    fontSize: fontSize.sm,
    color: '#111827',
  },

  /* full payable button */
  fullPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    gap: 4,
    height: 44,
  },
  fullPayText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  /* chips */
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  chipText: { fontSize: 13, color: '#6b7280' },

  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: '600' },
});
