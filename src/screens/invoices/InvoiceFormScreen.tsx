import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView,
  KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { useToast } from '../../components/Toast';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import DateInput from '../../components/DateInput';

interface LineItem {
  item_id?: number;
  item_name: string;
  description: string;
  unit: string;
  qty: number;
  rate: number;
  discount_percent: number;
  tax_rate: number;
  amount: number;
}

export default function InvoiceFormScreen({ route, navigation }: { route: any; navigation: any }) {
  const toast = useToast();
  const editId = route.params?.id;
  const [orgId, setOrgId] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [discountValue, setDiscountValue] = useState('0');
  const [freightCharges, setFreightCharges] = useState('0');
  const [roundOffEnabled, setRoundOffEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveAction, setSaveAction] = useState<'Draft' | 'Sent' | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [qaName, setQaName] = useState('');
  const [qaMobile, setQaMobile] = useState('');
  const [qaBusinessName, setQaBusinessName] = useState('');
  const [qaSaving, setQaSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const biz = await api.get('/api/business');
        const oid = biz.data[0]?.org_id;
        if (!oid) return;
        setOrgId(oid);
        const [custRes, itemRes] = await Promise.all([
          api.get(`/api/customers?org_id=${oid}`),
          api.get(`/api/items?org_id=${oid}`),
        ]);
        setCustomers(custRes.data);
        setItems(itemRes.data);

        if (editId) {
          const inv = (await api.get(`/api/invoices/${editId}`)).data;
          setCustomerId(inv.customer_id);
          setCustomerName(inv.customer_name || '');
          setInvoiceDate(inv.invoice_date || '');
          setDueDate(inv.due_date || '');
          setNotes(inv.notes || '');
          setDiscountType(inv.discount_type || 'flat');
          setDiscountValue(String(inv.discount_value || 0));
          setFreightCharges(String(inv.freight_charges ?? 0));
          setRoundOffEnabled(Math.abs(inv.round_off ?? 0) > 0);
          setLineItems((inv.items || []).map((it: any) => ({
            item_id: it.item_id, item_name: it.item_name, description: it.description || '',
            unit: it.unit || '', qty: it.qty, rate: it.rate,
            discount_percent: it.discount_percent || 0, tax_rate: it.tax_rate || 0,
            amount: it.amount,
          })));
        }
      } catch {}
    })();
  }, [editId]);

  const calcLineAmount = (li: LineItem) => {
    const base = li.qty * li.rate;
    const afterDisc = base - (base * li.discount_percent / 100);
    return afterDisc + (afterDisc * li.tax_rate / 100);
  };

  const addItem = (item: any) => {
    setLineItems(prev => [...prev, {
      item_id: item.id, item_name: item.item_name, description: item.description || '',
      unit: item.unit || 'Nos', qty: 1, rate: item.sale_price || 0,
      discount_percent: 0, tax_rate: item.tax_rate || 0, amount: 0,
    }]);
    setShowItemPicker(false);
  };

  const addCustomItem = () => {
    setLineItems(prev => [...prev, {
      item_id: undefined, item_name: '', description: '',
      unit: 'Nos', qty: 1, rate: 0,
      discount_percent: 0, tax_rate: 0, amount: 0,
    }]);
    setShowItemPicker(false);
  };

  const updateLine = (idx: number, key: string, val: any) => {
    setLineItems(prev => {
      const updated = [...prev];
      (updated[idx] as any)[key] = val;
      updated[idx].amount = calcLineAmount(updated[idx]);
      return updated;
    });
  };

  const removeLine = (idx: number) => setLineItems(prev => prev.filter((_, i) => i !== idx));

  const subtotal = lineItems.reduce((sum, li) => sum + (li.qty * li.rate * (1 - li.discount_percent / 100)), 0);
  const taxAmount = lineItems.reduce((sum, li) => {
    const base = li.qty * li.rate * (1 - li.discount_percent / 100);
    return sum + (base * li.tax_rate / 100);
  }, 0);
  const discAmt = discountType === 'percentage' ? subtotal * parseFloat(discountValue || '0') / 100 : parseFloat(discountValue || '0');
  const freight = parseFloat(freightCharges || '0') || 0;
  const rawTotal = subtotal - discAmt + taxAmount + freight;
  const total = roundOffEnabled ? Math.round(rawTotal) : rawTotal;
  const roundOffDelta = roundOffEnabled ? total - rawTotal : 0;

  const handleSave = async (status: 'Draft' | 'Sent' = 'Draft') => {
    if (!customerId) return Alert.alert('Error', 'Select a customer');
    if (!lineItems.length) return Alert.alert('Error', 'Add at least one item');
    setLoading(true);
    setSaveAction(status);
    try {
      const body = {
        org_id: orgId, customer_id: customerId, invoice_date: invoiceDate, due_date: dueDate || null,
        notes, discount_type: discountType, discount_value: parseFloat(discountValue || '0'),
        freight_charges: freight,
        round_off_enabled: roundOffEnabled,
        items: lineItems.map(li => ({
          item_id: li.item_id, item_name: li.item_name, description: li.description,
          unit: li.unit, qty: li.qty, rate: li.rate,
          discount_percent: li.discount_percent, tax_rate: li.tax_rate,
          amount: calcLineAmount(li),
        })),
      };
      let invId = editId;
      if (editId) {
        await api.put(`/api/invoices/${editId}`, body);
      } else {
        const res = await api.post('/api/invoices', body);
        invId = res.data?.id;
      }
      // If "Save & Send", flip status to Sent
      if (status === 'Sent' && invId) {
        try { await api.patch(`/api/invoices/${invId}/status?status=Sent`); } catch {}
      }
      toast.success(editId ? 'Invoice updated' : status === 'Sent' ? 'Invoice sent' : 'Invoice saved');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally { setLoading(false); setSaveAction(null); }
  };

  const handleQuickAddCustomer = async () => {
    const contact = qaName.trim();
    if (!contact) return Alert.alert('Error', 'Enter contact person');
    if (!orgId) return;
    setQaSaving(true);
    try {
      const res = await api.post('/api/customers', {
        org_id: orgId,
        contact_person: contact,
        business_name: qaBusinessName.trim() || null,
        type: qaBusinessName.trim() ? 'business' : 'individual',
        mobile: qaMobile.trim() || null,
      });
      const created = res.data;
      // Refresh customer list and auto-select
      const cl = await api.get(`/api/customers?org_id=${orgId}`);
      setCustomers(cl.data);
      setCustomerId(created.id);
      setCustomerName(created.business_name || created.contact_person);
      setShowQuickAdd(false);
      setShowCustomerPicker(false);
      setQaName(''); setQaMobile(''); setQaBusinessName('');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to create customer');
    } finally { setQaSaving(false); }
  };

  const filteredCustomers = customerSearch
    ? customers.filter(c => c.contact_person?.toLowerCase().includes(customerSearch.toLowerCase()) || c.business_name?.toLowerCase().includes(customerSearch.toLowerCase()))
    : customers;

  const filteredItems = itemSearch
    ? items.filter(i => i.item_name?.toLowerCase().includes(itemSearch.toLowerCase()))
    : items;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        {/* Customer */}
        <View style={styles.card}>
          <Text style={styles.label}>Customer *</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowCustomerPicker(true)}>
            <Text style={customerId ? styles.pickerText : styles.pickerPlaceholder}>
              {customerName || 'Select customer'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.gray400} />
          </TouchableOpacity>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <DateInput label="Invoice Date" value={invoiceDate} onChange={setInvoiceDate} placeholder="Invoice Date" />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <DateInput label="Due Date" value={dueDate} onChange={setDueDate} placeholder="Due Date" />
            </View>
          </View>
        </View>

        {/* Line Items */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Items</Text>
            <TouchableOpacity style={styles.addItemBtn} onPress={() => setShowItemPicker(true)}>
              <Ionicons name="add-circle" size={24} color={colors.primary} />
              <Text style={styles.addItemText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          {lineItems.map((li, idx) => (
            <View key={idx} style={styles.lineCard}>
              <View style={styles.lineHeader}>
                {li.item_id ? (
                  <Text style={styles.lineName} numberOfLines={1}>{li.item_name}</Text>
                ) : (
                  <TextInput style={[styles.miniInput, { flex: 1, fontWeight: '600', marginRight: 8 }]} value={li.item_name} onChangeText={v => updateLine(idx, 'item_name', v)} placeholder="Item name" placeholderTextColor={colors.placeholder} />
                )}
                <TouchableOpacity onPress={() => removeLine(idx)}>
                  <Ionicons name="close-circle" size={22} color={colors.danger} />
                </TouchableOpacity>
              </View>
              {!li.item_id && (
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.miniLabel}>Unit</Text>
                    <TextInput style={styles.miniInput} value={li.unit} onChangeText={v => updateLine(idx, 'unit', v)} placeholder="Nos" placeholderTextColor={colors.placeholder} />
                  </View>
                  <View style={{ flex: 2, marginLeft: 8 }}>
                    <Text style={styles.miniLabel}>Description</Text>
                    <TextInput style={styles.miniInput} value={li.description} onChangeText={v => updateLine(idx, 'description', v)} placeholder="Optional" placeholderTextColor={colors.placeholder} />
                  </View>
                </View>
              )}
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniLabel}>Qty</Text>
                  <TextInput style={styles.miniInput} value={String(li.qty)} onChangeText={v => updateLine(idx, 'qty', parseFloat(v) || 0)} keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.miniLabel}>Rate</Text>
                  <TextInput style={styles.miniInput} value={String(li.rate)} onChangeText={v => updateLine(idx, 'rate', parseFloat(v) || 0)} keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.miniLabel}>Tax %</Text>
                  <TextInput style={styles.miniInput} value={String(li.tax_rate)} onChangeText={v => updateLine(idx, 'tax_rate', parseFloat(v) || 0)} keyboardType="decimal-pad" />
                </View>
              </View>
              <Text style={styles.lineAmt}>Amount: ₹{calcLineAmount(li).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.card}>
          <Text style={styles.label}>Notes</Text>
          <TextInput style={[styles.input, { height: 60, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} multiline placeholder="Optional notes" placeholderTextColor={colors.placeholder} />

          <View style={styles.sumRow}><Text style={styles.sumLabel}>Subtotal</Text><Text style={styles.sumVal}>₹{subtotal.toFixed(2)}</Text></View>
          <View style={styles.sumRow}><Text style={styles.sumLabel}>Tax</Text><Text style={styles.sumVal}>₹{taxAmount.toFixed(2)}</Text></View>
          {discAmt > 0 && (
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Discount</Text>
              <Text style={[styles.sumVal, { color: colors.danger }]}>-₹{discAmt.toFixed(2)}</Text>
            </View>
          )}

          {/* Freight charges */}
          <View style={styles.freightRow}>
            <Text style={[styles.sumLabel, { flex: 1 }]}>Freight Charges</Text>
            <TextInput
              style={styles.freightInput}
              value={freightCharges}
              onChangeText={setFreightCharges}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.placeholder}
            />
            <Text style={[styles.sumVal, { width: 80, textAlign: 'right' }]}>+₹{freight.toFixed(2)}</Text>
          </View>

          {/* Round-off toggle */}
          <View style={styles.roundOffRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.roundOffLabel}>Round Off</Text>
              <Text style={styles.roundOffSub}>
                {roundOffEnabled
                  ? `Adjustment: ${roundOffDelta >= 0 ? '+' : ''}₹${roundOffDelta.toFixed(2)}`
                  : 'Round total to nearest rupee'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.toggleBtn, roundOffEnabled && styles.toggleBtnActive]}
              onPress={() => setRoundOffEnabled(v => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.toggleDot, roundOffEnabled && styles.toggleDotActive]} />
            </TouchableOpacity>
          </View>

          <View style={[styles.sumRow, { borderTopWidth: 1, borderTopColor: colors.gray200, paddingTop: spacing.sm }]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalVal}>₹{total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Save Actions */}
        <View style={styles.saveRow}>
          <TouchableOpacity
            style={[styles.saveBtnGhost, loading && { opacity: 0.6 }]}
            onPress={() => handleSave('Draft')}
            disabled={loading}
          >
            <Ionicons name="document-outline" size={16} color={colors.primary} />
            <Text style={styles.saveBtnGhostText}>
              {loading && saveAction === 'Draft' ? 'Saving...' : editId ? 'Update' : 'Save Draft'}
            </Text>
          </TouchableOpacity>
          {!editId && (
            <TouchableOpacity
              style={[styles.saveBtn, loading && { opacity: 0.6 }, { flex: 1.3 }]}
              onPress={() => handleSave('Sent')}
              disabled={loading}
            >
              <Ionicons name="send" size={16} color={colors.white} />
              <Text style={styles.saveBtnText}>
                {loading && saveAction === 'Sent' ? 'Saving...' : 'Save & Send'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Customer Picker Modal */}
      <Modal visible={showCustomerPicker} animationType="slide" onRequestClose={() => setShowCustomerPicker(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Customer</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <TouchableOpacity onPress={() => setShowQuickAdd(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.quickAddPill}>
                <Ionicons name="person-add" size={14} color={colors.primary} />
                <Text style={styles.quickAddPillText}>New</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowCustomerPicker(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ padding: 8 }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
          <TextInput style={styles.modalSearch} value={customerSearch} onChangeText={setCustomerSearch} placeholder="Search customers..." placeholderTextColor={colors.placeholder} />
          <FlatList
            data={filteredCustomers}
            keyExtractor={c => String(c.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.modalItem} onPress={() => { setCustomerId(item.id); setCustomerName(item.contact_person || item.business_name); setShowCustomerPicker(false); }}>
                <Text style={styles.modalItemText}>{item.contact_person || item.business_name}</Text>
                <Text style={styles.modalItemSub}>{item.mobile || item.email || ''}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<View style={{ padding: spacing.lg, alignItems: 'center' }}><Ionicons name="people-outline" size={48} color={colors.gray300} /><Text style={{ color: colors.gray500, marginTop: spacing.sm }}>{customers.length === 0 ? 'No customers found. Add customers first.' : 'No matching customers.'}</Text></View>}
          />
        </View>
      </Modal>

      {/* Item Picker Modal */}
      <Modal visible={showItemPicker} animationType="slide" onRequestClose={() => setShowItemPicker(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Item</Text>
            <TouchableOpacity onPress={() => setShowItemPicker(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.customItemBtn} onPress={addCustomItem}>
            <Ionicons name="create-outline" size={20} color={colors.primary} />
            <Text style={styles.customItemText}>Add Custom Item (not in catalog)</Text>
          </TouchableOpacity>
          <TextInput style={styles.modalSearch} value={itemSearch} onChangeText={setItemSearch} placeholder="Search items..." placeholderTextColor={colors.placeholder} />
          <FlatList
            data={filteredItems}
            keyExtractor={i => String(i.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.modalItem} onPress={() => addItem(item)}>
                <Text style={styles.modalItemText}>{item.item_name}</Text>
                <Text style={styles.modalItemSub}>₹{item.sale_price} • {item.unit} • Tax: {item.tax_rate}%</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<View style={{ padding: spacing.lg, alignItems: 'center' }}><Ionicons name="cube-outline" size={48} color={colors.gray300} /><Text style={{ color: colors.gray500, marginTop: spacing.sm }}>{items.length === 0 ? 'No items found. Add items first.' : 'No matching items.'}</Text></View>}
          />
        </View>
      </Modal>

      {/* Quick-Add Customer Modal */}
      <Modal visible={showQuickAdd} animationType="slide" transparent onRequestClose={() => setShowQuickAdd(false)}>
        <View style={styles.qaOverlay}>
          <View style={styles.qaSheet}>
            <View style={styles.qaHandle} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <Text style={styles.qaTitle}>Quick Add Customer</Text>
              <TouchableOpacity onPress={() => setShowQuickAdd(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>Contact Person *</Text>
            <TextInput style={styles.input} value={qaName} onChangeText={setQaName} placeholder="Full name" placeholderTextColor={colors.placeholder} autoFocus />
            <Text style={styles.label}>Business Name</Text>
            <TextInput style={styles.input} value={qaBusinessName} onChangeText={setQaBusinessName} placeholder="Optional" placeholderTextColor={colors.placeholder} />
            <Text style={styles.label}>Mobile</Text>
            <TextInput style={styles.input} value={qaMobile} onChangeText={setQaMobile} placeholder="Optional" placeholderTextColor={colors.placeholder} keyboardType="phone-pad" />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.lg }}>
              <TouchableOpacity style={styles.saveBtnGhost} onPress={() => setShowQuickAdd(false)}>
                <Text style={styles.saveBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, qaSaving && { opacity: 0.6 }, { flex: 1 }]} onPress={handleQuickAddCustomer} disabled={qaSaving}>
                <Ionicons name="checkmark" size={16} color={colors.white} />
                <Text style={styles.saveBtnText}>{qaSaving ? 'Saving...' : 'Add Customer'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  card: { backgroundColor: colors.white, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, padding: spacing.md, fontSize: fontSize.md, color: colors.text },
  row: { flexDirection: 'row' },
  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, padding: spacing.md },
  pickerText: { fontSize: fontSize.md, color: colors.text },
  pickerPlaceholder: { fontSize: fontSize.md, color: colors.placeholder },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addItemText: { color: colors.primary, fontWeight: '600', fontSize: fontSize.sm },
  lineCard: { backgroundColor: colors.gray50, borderRadius: borderRadius.sm, padding: spacing.sm, marginTop: spacing.sm },
  lineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  lineName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, flex: 1 },
  miniLabel: { fontSize: 11, color: colors.gray500 },
  miniInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 4, padding: 6, fontSize: fontSize.sm, color: colors.text, backgroundColor: colors.white },
  lineAmt: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary, textAlign: 'right', marginTop: 4 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  sumLabel: { fontSize: fontSize.sm, color: colors.gray500 },
  sumVal: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text },
  totalLabel: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  totalVal: { fontSize: fontSize.lg, fontWeight: '700', color: colors.primary },
  freightRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  freightInput: {
    width: 90,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 10, paddingVertical: 6,
    fontSize: fontSize.sm, color: colors.text,
    textAlign: 'right',
  },
  saveBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.sm, padding: spacing.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  saveBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
  saveBtnGhost: { flex: 1, backgroundColor: colors.white, borderRadius: borderRadius.sm, padding: spacing.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: colors.primary },
  saveBtnGhostText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
  saveRow: { flexDirection: 'row', gap: 8 },
  roundOffRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, marginTop: 4 },
  roundOffLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  roundOffSub: { fontSize: 11, color: colors.gray500, marginTop: 2 },
  toggleBtn: { width: 44, height: 26, borderRadius: 13, backgroundColor: colors.gray200, padding: 3, justifyContent: 'center' },
  toggleBtnActive: { backgroundColor: colors.primary },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white, alignSelf: 'flex-start' },
  toggleDotActive: { alignSelf: 'flex-end' },
  quickAddPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.primary + '15', borderRadius: 999 },
  quickAddPillText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  qaOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  qaSheet: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, paddingBottom: 32 },
  qaHandle: { width: 40, height: 4, backgroundColor: colors.gray200, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  qaTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  modalContainer: { flex: 1, backgroundColor: colors.white, paddingTop: 50 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  modalSearch: { margin: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, padding: spacing.md, fontSize: fontSize.md, color: colors.text },
  modalItem: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  modalItemText: { fontSize: fontSize.md, fontWeight: '500', color: colors.text },
  modalItemSub: { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },
  customItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: spacing.md, marginBottom: 0, padding: spacing.md, backgroundColor: colors.primary + '10', borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.primary + '30', borderStyle: 'dashed' },
  customItemText: { fontSize: fontSize.md, fontWeight: '600', color: colors.primary },
});
