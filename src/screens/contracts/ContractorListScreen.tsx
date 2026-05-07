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

const fmt = (n: number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EMPTY_FORM = {
  name: '',
  mobile: '',
  email: '',
  business_name: '',
  commission_percent: '',
};

export default function ContractorListScreen({ navigation }: { navigation: any }) {
  const [orgId, setOrgId] = useState('');
  const [contractors, setContractors] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

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
      const params: any = { org_id: orgId };
      if (search.trim()) params.search = search.trim();
      const { data } = await api.get('/api/contractors', { params });
      setContractors(data);
      // fetch summaries
      const sums: Record<number, any> = {};
      await Promise.all(
        data.map(async (c: any) => {
          try {
            const { data: s } = await api.get(`/api/contractors/${c.id}/summary`);
            sums[c.id] = s;
          } catch {
            sums[c.id] = { total_commission: 0, total_paid: 0, balance: 0 };
          }
        }),
      );
      setSummaries(sums);
    } catch {}
  }, [orgId, search]);

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

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      name: c.name || '',
      mobile: c.mobile || '',
      email: c.email || '',
      business_name: c.business_name || '',
      commission_percent: String(c.commission_percent ?? ''),
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return Alert.alert('Error', 'Name is required');
    setSaving(true);
    try {
      const body: any = {
        org_id: orgId,
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim(),
        business_name: form.business_name.trim(),
        commission_percent: parseFloat(form.commission_percent) || 0,
      };
      if (editing) {
        await api.put(`/api/contractors/${editing.id}`, body);
      } else {
        await api.post('/api/contractors', body);
      }
      setModalOpen(false);
      fetchAll();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (c: any) => {
    Alert.alert('Delete Contractor', `Delete "${c.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/api/contractors/${c.id}`);
            fetchAll();
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.detail || 'Failed to delete');
          }
        },
      },
    ]);
  };

  /* ── render ── */
  const renderCard = ({ item: c }: { item: any }) => {
    const s = summaries[c.id] || { total_commission: 0, total_paid: 0, balance: 0 };
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('ContractorPayouts', { contractor_id: c.id, contractor_name: c.name })}
      >
        <View style={styles.cardTop}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{(c.name || '?')[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.cardName}>{c.name}</Text>
            {!!c.business_name && <Text style={styles.cardSub}>{c.business_name}</Text>}
            {!!c.mobile && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <Ionicons name="call-outline" size={12} color="#6b7280" />
                <Text style={[styles.cardSub, { marginLeft: 4 }]}>{c.mobile}</Text>
              </View>
            )}
          </View>
          <View style={styles.commBadge}>
            <Text style={styles.commText}>{c.commission_percent ?? 0}%</Text>
          </View>
        </View>

        {/* summary row */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Commission</Text>
            <Text style={styles.summaryVal}>₹{fmt(s.total_commission)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Paid</Text>
            <Text style={[styles.summaryVal, { color: '#10b981' }]}>₹{fmt(s.total_paid)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Balance</Text>
            <Text style={[styles.summaryVal, { color: s.balance > 0 ? '#ef4444' : '#10b981' }]}>₹{fmt(s.balance)}</Text>
          </View>
        </View>

        {/* action row */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(c)}>
            <Ionicons name="create-outline" size={16} color={colors.primary} />
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => confirmDelete(c)}>
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
            <Text style={[styles.actionText, { color: '#ef4444' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* hero */}
      <View style={styles.hero}>
        <View style={[styles.orb, { top: -30, right: -30 }]} />
        <View style={[styles.orb, { bottom: -20, left: -20, width: 100, height: 100 }]} />
        <Text style={styles.heroLabel}>Total Contractors</Text>
        <Text style={styles.heroValue}>{contractors.length}</Text>
      </View>

      {/* search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#9ca3af" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search contractors..."
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={contractors}
          keyExtractor={(c) => String(c.id)}
          renderItem={renderCard}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="people-outline" title="No contractors" subtitle="Tap + to add a contractor" />}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={openAdd}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add / Edit Modal */}
      <Modal visible={modalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Edit Contractor' : 'Add Contractor'}</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Contractor name"
                placeholderTextColor="#9ca3af"
                value={form.name}
                onChangeText={(v) => setForm({ ...form, name: v })}
              />

              <Text style={styles.fieldLabel}>Mobile</Text>
              <TextInput
                style={styles.input}
                placeholder="Mobile number"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                value={form.mobile}
                onChangeText={(v) => setForm({ ...form, mobile: v })}
              />

              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.email}
                onChangeText={(v) => setForm({ ...form, email: v })}
              />

              <Text style={styles.fieldLabel}>Business Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Business name"
                placeholderTextColor="#9ca3af"
                value={form.business_name}
                onChangeText={(v) => setForm({ ...form, business_name: v })}
              />

              <Text style={styles.fieldLabel}>Commission %</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 5"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
                value={form.commission_percent}
                onChangeText={(v) => setForm({ ...form, commission_percent: v })}
              />
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>{editing ? 'Update' : 'Add Contractor'}</Text>
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
    paddingTop: 20,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.sm },
  heroValue: { color: '#fff', fontSize: 32, fontWeight: '700', marginTop: 4 },

  /* search */
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: spacing.md,
    marginBottom: 0,
    borderRadius: borderRadius.lg,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: { flex: 1, fontSize: fontSize.sm, color: '#111827' },

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
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#059669' },
  cardName: { fontSize: fontSize.md, fontWeight: '600', color: '#111827' },
  cardSub: { fontSize: fontSize.xs, color: '#6b7280', marginTop: 1 },
  commBadge: {
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  commText: { fontSize: fontSize.sm, fontWeight: '700', color: '#059669' },

  /* summary */
  summaryRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 11, color: '#9ca3af', marginBottom: 2 },
  summaryVal: { fontSize: fontSize.sm, fontWeight: '600', color: '#111827' },

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
