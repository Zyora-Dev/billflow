import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
  TextInput, Modal, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { useToast } from '../../components/Toast';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import DateInput from '../../components/DateInput';

const FREQ_OPTIONS: { value: string; label: string; color: string; icon: string }[] = [
  { value: 'weekly', label: 'Weekly', color: '#3b82f6', icon: 'calendar-outline' },
  { value: 'monthly', label: 'Monthly', color: '#8b5cf6', icon: 'calendar' },
  { value: 'quarterly', label: 'Quarterly', color: '#f59e0b', icon: 'albums-outline' },
  { value: 'half_yearly', label: 'Half Yearly', color: '#06b6d4', icon: 'layers-outline' },
  { value: 'yearly', label: 'Yearly', color: '#ec4899', icon: 'earth-outline' },
];

const todayStr = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

export default function RecurringInvoiceFormScreen({ route, navigation }: any) {
  const toast = useToast();
  const editId = route.params?.id;
  const isEdit = !!editId;

  const [orgId, setOrgId] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [frequency, setFrequency] = useState('monthly');
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState('');
  const [dueDays, setDueDays] = useState('15');
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [discountValue, setDiscountValue] = useState('0');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<any[]>([]);

  // Pickers
  const [custPickerOpen, setCustPickerOpen] = useState(false);
  const [custSearch, setCustSearch] = useState('');
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState('');

  const fetchBase = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (!oid) { setLoading(false); return; }
      setOrgId(oid);
      const [custRes, itemRes] = await Promise.all([
        api.get(`/api/customers?org_id=${oid}`),
        api.get(`/api/items?org_id=${oid}`),
      ]);
      setCustomers(Array.isArray(custRes.data) ? custRes.data : []);
      setItems(Array.isArray(itemRes.data) ? itemRes.data : []);

      // Load existing for edit
      if (editId) {
        const res = await api.get(`/api/recurring-invoices/${editId}`);
        const d = res.data;
        setName(d.name || '');
        setCustomerId(d.customer_id);
        setFrequency(d.frequency || 'monthly');
        setStartDate(d.start_date ? String(d.start_date).slice(0, 10) : todayStr());
        setEndDate(d.end_date ? String(d.end_date).slice(0, 10) : '');
        setDueDays(String(d.due_days ?? 15));
        setDiscountType(d.discount_type === 'percentage' ? 'percentage' : 'flat');
        setDiscountValue(String(d.discount_value ?? 0));
        setNotes(d.notes || '');
        const its = d.items || (typeof d.items_json === 'string' ? JSON.parse(d.items_json) : d.items_json) || [];
        setLineItems(its);
      }
    } catch {} finally { setLoading(false); }
  }, [editId]);

  useEffect(() => { fetchBase(); }, [fetchBase]);

  const selectedCustomer = useMemo(() => customers.find(c => c.id === customerId), [customers, customerId]);

  // Line item helpers
  const addItemFromCatalog = (item: any) => {
    const existing = lineItems.find(li => li.item_id === item.id);
    if (existing) {
      setLineItems(prev => prev.map(li => li.item_id === item.id ? { ...li, qty: li.qty + 1 } : li));
    } else {
      setLineItems(prev => [...prev, {
        item_id: item.id, item_name: item.item_name, description: item.description || '',
        unit: item.unit || 'Nos', qty: 1, rate: Number(item.sale_price) || 0,
        discount_percent: 0, tax_rate: Number(item.tax_rate) || 0, hsn_code: item.hsn_code || '',
      }]);
    }
    setItemPickerOpen(false);
    setItemSearch('');
  };

  const addCustomItem = () => {
    setLineItems(prev => [...prev, {
      item_id: null, item_name: '', description: '', unit: 'Nos', qty: 1, rate: 0,
      discount_percent: 0, tax_rate: 0, hsn_code: '',
    }]);
  };

  const updateLI = (idx: number, field: string, value: any) => {
    setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, [field]: value } : li));
  };

  const removeLI = (idx: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  };

  const lineTotal = (li: any) => {
    const base = (Number(li.qty) || 0) * (Number(li.rate) || 0);
    const disc = base * (Number(li.discount_percent) || 0) / 100;
    const taxable = base - disc;
    return taxable + taxable * (Number(li.tax_rate) || 0) / 100;
  };

  const subtotal = lineItems.reduce((s, li) => s + (Number(li.qty) || 0) * (Number(li.rate) || 0) * (1 - (Number(li.discount_percent) || 0) / 100), 0);
  const taxTotal = lineItems.reduce((s, li) => {
    const base = (Number(li.qty) || 0) * (Number(li.rate) || 0) * (1 - (Number(li.discount_percent) || 0) / 100);
    return s + base * (Number(li.tax_rate) || 0) / 100;
  }, 0);
  const dv = Number(discountValue) || 0;
  const overallDisc = discountType === 'percentage' ? subtotal * dv / 100 : dv;
  const grandTotal = subtotal - overallDisc + taxTotal;

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Validation', 'Enter a template name');
    if (!customerId) return Alert.alert('Validation', 'Select a customer');
    if (lineItems.length === 0) return Alert.alert('Validation', 'Add at least one line item');
    for (const li of lineItems) {
      if (!li.item_name?.trim()) return Alert.alert('Validation', 'All items must have a name');
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/api/recurring-invoices/${editId}`, {
          name: name.trim(),
          customer_id: customerId,
          frequency,
          start_date: startDate,
          end_date: endDate || null,
          due_days: parseInt(dueDays) || 15,
          items: lineItems,
          discount_type: discountType,
          discount_value: dv,
          notes: notes.trim() || null,
        });
        toast.success('Template updated');
      } else {
        await api.post('/api/recurring-invoices', {
          org_id: orgId,
          name: name.trim(),
          customer_id: customerId,
          frequency,
          start_date: startDate,
          end_date: endDate || null,
          due_days: parseInt(dueDays) || 15,
          items: lineItems,
          discount_type: discountType,
          discount_value: dv,
          notes: notes.trim() || null,
        });
        toast.success('Template created');
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} keyboardShouldPersistTaps="handled">

        {/* Template Name */}
        <View style={s.card}>
          <Text style={s.label}>Template Name *</Text>
          <TextInput style={s.input} placeholder="e.g. Monthly Retainer - Acme" value={name} onChangeText={setName} placeholderTextColor={colors.gray400} />
        </View>

        {/* Customer */}
        <View style={s.card}>
          <Text style={s.label}>Customer *</Text>
          <TouchableOpacity style={s.pickerBtn} onPress={() => setCustPickerOpen(true)}>
            <Ionicons name="person-outline" size={18} color={customerId ? colors.primary : colors.gray400} />
            <Text style={[s.pickerText, !customerId && { color: colors.gray400 }]}>
              {selectedCustomer ? (selectedCustomer.business_name || selectedCustomer.contact_person) : 'Select Customer'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.gray400} />
          </TouchableOpacity>
        </View>

        {/* Frequency */}
        <View style={s.card}>
          <Text style={s.label}>Frequency</Text>
          <View style={s.freqRow}>
            {FREQ_OPTIONS.map(f => {
              const sel = frequency === f.value;
              return (
                <TouchableOpacity
                  key={f.value}
                  style={[s.freqChip, sel && { backgroundColor: f.color + '18', borderColor: f.color }]}
                  onPress={() => setFrequency(f.value)}
                >
                  <Text style={[s.freqChipText, sel && { color: f.color, fontWeight: '700' }]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Dates */}
        <View style={s.card}>
          <Text style={s.label}>Schedule</Text>
          <View style={{ gap: 12 }}>
            <View>
              <Text style={s.subLabel}>Start Date *</Text>
              <DateInput value={startDate} onChange={setStartDate} />
            </View>
            <View>
              <Text style={s.subLabel}>End Date (optional)</Text>
              <DateInput value={endDate} onChange={setEndDate} />
              {!endDate && <Text style={s.hint}>No end date — runs indefinitely</Text>}
            </View>
            <View>
              <Text style={s.subLabel}>Payment Due Days</Text>
              <TextInput
                style={[s.input, { width: 120 }]}
                value={dueDays}
                onChangeText={setDueDays}
                keyboardType="number-pad"
                placeholder="15"
                placeholderTextColor={colors.gray400}
              />
              <Text style={s.hint}>Days after invoice date</Text>
            </View>
          </View>
        </View>

        {/* Line Items */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={s.label}>Line Items ({lineItems.length})</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={s.addBtn} onPress={() => setItemPickerOpen(true)}>
                <Ionicons name="cube-outline" size={14} color={colors.primary} />
                <Text style={s.addBtnText}>Catalog</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.addBtn, { borderColor: '#10b981' }]} onPress={addCustomItem}>
                <Ionicons name="create-outline" size={14} color="#10b981" />
                <Text style={[s.addBtnText, { color: '#10b981' }]}>Custom</Text>
              </TouchableOpacity>
            </View>
          </View>

          {lineItems.map((li, idx) => (
            <View key={idx} style={s.liCard}>
              <View style={s.liTop}>
                {li.item_id ? (
                  <Text style={s.liName} numberOfLines={1}>{li.item_name}</Text>
                ) : (
                  <TextInput
                    style={[s.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="Item name"
                    value={li.item_name}
                    onChangeText={v => updateLI(idx, 'item_name', v)}
                    placeholderTextColor={colors.gray400}
                  />
                )}
                <TouchableOpacity onPress={() => removeLI(idx)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={colors.danger} />
                </TouchableOpacity>
              </View>
              <View style={s.liGrid}>
                <View style={{ flex: 1 }}>
                  <Text style={s.liFieldLabel}>Qty</Text>
                  <TextInput
                    style={s.liInput}
                    value={String(li.qty)}
                    onChangeText={v => updateLI(idx, 'qty', Number(v) || 0)}
                    keyboardType="numeric"
                    placeholderTextColor={colors.gray400}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.liFieldLabel}>Rate</Text>
                  <TextInput
                    style={s.liInput}
                    value={String(li.rate)}
                    onChangeText={v => updateLI(idx, 'rate', Number(v) || 0)}
                    keyboardType="numeric"
                    placeholderTextColor={colors.gray400}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.liFieldLabel}>Tax %</Text>
                  <TextInput
                    style={s.liInput}
                    value={String(li.tax_rate)}
                    onChangeText={v => updateLI(idx, 'tax_rate', Number(v) || 0)}
                    keyboardType="numeric"
                    placeholderTextColor={colors.gray400}
                  />
                </View>
              </View>
              <View style={s.liBottom}>
                <Text style={s.liUnit}>{li.unit || 'Nos'}</Text>
                <Text style={s.liTotal}>₹{lineTotal(li).toFixed(2)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Discount */}
        <View style={s.card}>
          <Text style={s.label}>Discount</Text>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TouchableOpacity
              style={[s.discChip, discountType === 'flat' && s.discChipActive]}
              onPress={() => setDiscountType('flat')}
            >
              <Text style={[s.discChipText, discountType === 'flat' && s.discChipTextActive]}>₹ Flat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.discChip, discountType === 'percentage' && s.discChipActive]}
              onPress={() => setDiscountType('percentage')}
            >
              <Text style={[s.discChipText, discountType === 'percentage' && s.discChipTextActive]}>% Percent</Text>
            </TouchableOpacity>
            <TextInput
              style={[s.input, { flex: 1, marginBottom: 0 }]}
              value={discountValue}
              onChangeText={setDiscountValue}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.gray400}
            />
          </View>
        </View>

        {/* Notes */}
        <View style={s.card}>
          <Text style={s.label}>Notes</Text>
          <TextInput
            style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
            placeholder="Internal notes..."
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholderTextColor={colors.gray400}
          />
        </View>

        {/* Summary */}
        <View style={s.card}>
          <Text style={s.label}>Summary</Text>
          <View style={s.sumRow}><Text style={s.sumLabel}>Subtotal</Text><Text style={s.sumVal}>₹{subtotal.toFixed(2)}</Text></View>
          {overallDisc > 0 && (
            <View style={s.sumRow}>
              <Text style={s.sumLabel}>Discount</Text>
              <Text style={[s.sumVal, { color: colors.danger }]}>-₹{overallDisc.toFixed(2)}</Text>
            </View>
          )}
          <View style={s.sumRow}><Text style={s.sumLabel}>Tax</Text><Text style={s.sumVal}>₹{taxTotal.toFixed(2)}</Text></View>
          <View style={[s.sumRow, { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 8, marginTop: 4 }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Estimated Total</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.primary }}>₹{grandTotal.toFixed(2)}</Text>
          </View>
        </View>

        {/* Save */}
        <View style={{ paddingHorizontal: spacing.md, marginBottom: 40 }}>
          <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
            {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle" size={20} color="#fff" />}
            <Text style={s.saveBtnText}>{isEdit ? 'Update Template' : 'Create Template'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Customer Picker Modal */}
      <Modal visible={custPickerOpen} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>Select Customer</Text>
            <TouchableOpacity onPress={() => { setCustPickerOpen(false); setCustSearch(''); }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={s.searchBar}>
            <Ionicons name="search" size={16} color={colors.gray400} />
            <TextInput
              style={s.searchInput}
              placeholder="Search customers..."
              value={custSearch}
              onChangeText={setCustSearch}
              autoFocus
              placeholderTextColor={colors.gray400}
            />
          </View>
          <FlatList
            data={customers.filter(c => {
              if (!custSearch.trim()) return true;
              const hay = `${c.business_name || ''} ${c.contact_person || ''} ${c.mobile || ''}`.toLowerCase();
              return hay.includes(custSearch.trim().toLowerCase());
            })}
            keyExtractor={c => String(c.id)}
            renderItem={({ item: c }) => (
              <TouchableOpacity
                style={[s.pickRow, customerId === c.id && { backgroundColor: colors.primary + '10' }]}
                onPress={() => { setCustomerId(c.id); setCustPickerOpen(false); setCustSearch(''); }}
              >
                <View style={s.pickAvatar}>
                  <Text style={s.pickAvatarText}>{(c.contact_person || c.business_name || '?')[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.pickName}>{c.business_name || c.contact_person}</Text>
                  {c.mobile ? <Text style={s.pickSub}>{c.mobile}</Text> : null}
                </View>
                {customerId === c.id && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={s.emptyList}>No customers found</Text>}
          />
        </View>
      </Modal>

      {/* Item Picker Modal */}
      <Modal visible={itemPickerOpen} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>Add from Catalog</Text>
            <TouchableOpacity onPress={() => { setItemPickerOpen(false); setItemSearch(''); }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={s.searchBar}>
            <Ionicons name="search" size={16} color={colors.gray400} />
            <TextInput
              style={s.searchInput}
              placeholder="Search items..."
              value={itemSearch}
              onChangeText={setItemSearch}
              autoFocus
              placeholderTextColor={colors.gray400}
            />
          </View>
          <FlatList
            data={items.filter(it => {
              if (!itemSearch.trim()) return true;
              return (it.item_name || '').toLowerCase().includes(itemSearch.trim().toLowerCase());
            })}
            keyExtractor={it => String(it.id)}
            renderItem={({ item: it }) => (
              <TouchableOpacity style={s.pickRow} onPress={() => addItemFromCatalog(it)}>
                <View style={[s.pickAvatar, { backgroundColor: '#dbeafe' }]}>
                  <Ionicons name="cube" size={16} color="#3b82f6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.pickName}>{it.item_name}</Text>
                  <Text style={s.pickSub}>₹{Number(it.sale_price || 0).toFixed(2)} · Tax {it.tax_rate || 0}%</Text>
                </View>
                <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={s.emptyList}>No items found</Text>}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: { backgroundColor: '#fff', marginHorizontal: spacing.md, marginTop: spacing.sm, borderRadius: 16, padding: spacing.md },
  label: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 },
  subLabel: { fontSize: 12, fontWeight: '600', color: colors.gray500, marginBottom: 4 },
  hint: { fontSize: 11, color: colors.gray400, marginTop: 2 },
  input: {
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, marginBottom: 0,
  },

  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f9fafb',
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12,
  },
  pickerText: { flex: 1, fontSize: 14, color: colors.text },

  freqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  freqChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
  },
  freqChipText: { fontSize: 12, fontWeight: '500', color: colors.gray500 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, borderColor: colors.primary,
  },
  addBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },

  liCard: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  liTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  liName: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 },
  liGrid: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  liFieldLabel: { fontSize: 10, fontWeight: '600', color: colors.gray400, marginBottom: 2 },
  liInput: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, color: colors.text,
  },
  liBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liUnit: { fontSize: 11, color: colors.gray500 },
  liTotal: { fontSize: 14, fontWeight: '700', color: colors.primary },

  discChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  discChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  discChipText: { fontSize: 12, color: colors.gray500 },
  discChipTextActive: { color: colors.primary, fontWeight: '700' },

  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  sumLabel: { fontSize: 13, color: colors.gray500 },
  sumVal: { fontSize: 13, fontWeight: '500', color: colors.text },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Modals
  modal: { flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'ios' ? 60 : 20 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.md,
    backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },

  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  pickAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center' },
  pickAvatarText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  pickName: { fontSize: 14, fontWeight: '600', color: colors.text },
  pickSub: { fontSize: 12, color: colors.gray500 },
  emptyList: { textAlign: 'center', color: colors.gray400, marginTop: 40, fontSize: 14 },
});
