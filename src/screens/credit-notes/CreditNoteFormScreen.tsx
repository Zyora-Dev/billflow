import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView,
  KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import DateInput from '../../components/DateInput';

interface LineItem {
  item_id?: number;
  item_name: string;
  description: string;
  hsn_code: string;
  unit: string;
  qty: number;
  rate: number;
  discount_percent: number;
  tax_rate: number;
  amount: number;
}

export default function CreditNoteFormScreen({ route, navigation }: { route: any; navigation: any }) {
  const editId = route.params?.id;
  const [orgId, setOrgId] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [cnDate, setCnDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [discountValue, setDiscountValue] = useState('0');
  const [loading, setLoading] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showInvoicePicker, setShowInvoicePicker] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
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
          const cn = (await api.get(`/api/credit-notes/${editId}`)).data;
          setCustomerId(cn.customer_id);
          setCustomerName(cn.customer_name || '');
          setInvoiceId(cn.invoice_id || null);
          setInvoiceNumber(cn.invoice_number || '');
          setCnDate(cn.cn_date || '');
          setReason(cn.reason || '');
          setNotes(cn.notes || '');
          setPlaceOfSupply(cn.place_of_supply || '');
          setDiscountType(cn.discount_type || 'flat');
          setDiscountValue(String(cn.discount_value || 0));
          setLineItems((cn.items || []).map((it: any) => ({
            item_id: it.item_id, item_name: it.item_name, description: it.description || '',
            hsn_code: it.hsn_code || '', unit: it.unit || '', qty: it.qty, rate: it.rate,
            discount_percent: it.discount_percent || 0, tax_rate: it.tax_rate || 0,
            amount: it.amount,
          })));
          // Fetch invoices for the customer
          if (cn.customer_id) {
            try {
              const invRes = await api.get(`/api/invoices?org_id=${oid}&customer_id=${cn.customer_id}`);
              const invData = invRes.data?.data || invRes.data || [];
              setInvoices(Array.isArray(invData) ? invData : []);
            } catch {}
          }
        }
      } catch {}
    })();
  }, [editId]);

  // Fetch invoices when customer changes
  const fetchInvoicesForCustomer = async (custId: number) => {
    if (!orgId) return;
    try {
      const res = await api.get(`/api/invoices?org_id=${orgId}&customer_id=${custId}`);
      const data = res.data?.data || res.data || [];
      setInvoices(Array.isArray(data) ? data : []);
    } catch {
      setInvoices([]);
    }
  };

  const calcLineAmount = (li: LineItem) => {
    const base = li.qty * li.rate;
    const afterDisc = base - (base * li.discount_percent / 100);
    return afterDisc + (afterDisc * li.tax_rate / 100);
  };

  const addItem = (item: any) => {
    setLineItems(prev => [...prev, {
      item_id: item.id, item_name: item.item_name, description: item.description || '',
      hsn_code: item.hsn_code || '', unit: item.unit || 'Nos', qty: 1,
      rate: item.sale_price || 0, discount_percent: 0, tax_rate: item.tax_rate || 0, amount: 0,
    }]);
    setShowItemPicker(false);
  };

  const addCustomItem = () => {
    setLineItems(prev => [...prev, {
      item_id: undefined, item_name: '', description: '',
      hsn_code: '', unit: 'Nos', qty: 1, rate: 0,
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
  const total = subtotal - discAmt + taxAmount;

  const handleSave = async (status: 'Draft' | 'Issued' = 'Draft') => {
    if (!customerId) return Alert.alert('Error', 'Select a customer');
    if (!lineItems.length) return Alert.alert('Error', 'Add at least one item');
    setLoading(true);
    try {
      const body = {
        org_id: orgId, customer_id: customerId, invoice_id: invoiceId || null,
        cn_date: cnDate, reason, status, notes,
        place_of_supply: placeOfSupply || null,
        discount_type: discountType, discount_value: parseFloat(discountValue || '0'),
        items: lineItems.map(li => ({
          item_id: li.item_id || null, item_name: li.item_name, description: li.description,
          hsn_code: li.hsn_code || null, unit: li.unit, qty: li.qty, rate: li.rate,
          discount_percent: li.discount_percent, tax_rate: li.tax_rate,
          amount: calcLineAmount(li),
        })),
      };
      if (editId) {
        await api.put(`/api/credit-notes/${editId}`, body);
      } else {
        await api.post('/api/credit-notes', body);
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally { setLoading(false); }
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

          {/* Invoice picker (optional, filtered by customer) */}
          <Text style={styles.label}>Linked Invoice (Optional)</Text>
          <TouchableOpacity
            style={[styles.pickerBtn, !customerId && { opacity: 0.5 }]}
            onPress={() => customerId ? setShowInvoicePicker(true) : null}
            disabled={!customerId}
          >
            <Text style={invoiceId ? styles.pickerText : styles.pickerPlaceholder}>
              {invoiceNumber || 'Select invoice (optional)'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.gray400} />
          </TouchableOpacity>

          <DateInput label="Credit Note Date" value={cnDate} onChange={setCnDate} placeholder="CN Date" />

          <Text style={styles.label}>Reason</Text>
          <TextInput
            style={styles.input}
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Goods returned, pricing error"
            placeholderTextColor={colors.placeholder}
          />

          <Text style={styles.label}>Place of Supply</Text>
          <TextInput
            style={styles.input}
            value={placeOfSupply}
            onChangeText={setPlaceOfSupply}
            placeholder="e.g. 33-Tamil Nadu"
            placeholderTextColor={colors.placeholder}
          />
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
                  <Text style={styles.miniLabel}>HSN Code</Text>
                  <TextInput style={styles.miniInput} value={li.hsn_code} onChangeText={v => updateLine(idx, 'hsn_code', v)} placeholder="e.g. 8471" placeholderTextColor={colors.placeholder} />
                </View>
              </View>
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
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniLabel}>Discount %</Text>
                  <TextInput style={styles.miniInput} value={String(li.discount_percent)} onChangeText={v => updateLine(idx, 'discount_percent', parseFloat(v) || 0)} keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 2, marginLeft: 8, justifyContent: 'flex-end' }}>
                  <Text style={styles.lineAmt}>Amount: ₹{calcLineAmount(li).toFixed(2)}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Discount & Summary */}
        <View style={styles.card}>
          <Text style={styles.label}>Overall Discount</Text>
          <View style={styles.discountRow}>
            <TouchableOpacity
              style={[styles.discTypeBtn, discountType === 'flat' && styles.discTypeBtnActive]}
              onPress={() => setDiscountType('flat')}
            >
              <Text style={[styles.discTypeText, discountType === 'flat' && styles.discTypeTextActive]}>₹ Flat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.discTypeBtn, discountType === 'percentage' && styles.discTypeBtnActive]}
              onPress={() => setDiscountType('percentage')}
            >
              <Text style={[styles.discTypeText, discountType === 'percentage' && styles.discTypeTextActive]}>% Percent</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.discInput}
              value={discountValue}
              onChangeText={setDiscountValue}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.placeholder}
            />
          </View>

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
              {loading ? 'Saving...' : editId ? 'Update' : 'Save Draft'}
            </Text>
          </TouchableOpacity>
          {!editId && (
            <TouchableOpacity
              style={[styles.saveBtn, loading && { opacity: 0.6 }, { flex: 1.3 }]}
              onPress={() => handleSave('Issued')}
              disabled={loading}
            >
              <Ionicons name="checkmark-circle" size={16} color={colors.white} />
              <Text style={styles.saveBtnText}>
                {loading ? 'Saving...' : 'Issue'}
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
            <TouchableOpacity onPress={() => setShowCustomerPicker(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <TextInput style={styles.modalSearch} value={customerSearch} onChangeText={setCustomerSearch} placeholder="Search customers..." placeholderTextColor={colors.placeholder} />
          <FlatList
            data={filteredCustomers}
            keyExtractor={c => String(c.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.modalItem} onPress={() => {
                setCustomerId(item.id);
                setCustomerName(item.contact_person || item.business_name);
                setShowCustomerPicker(false);
                // Reset invoice selection when customer changes
                setInvoiceId(null);
                setInvoiceNumber('');
                fetchInvoicesForCustomer(item.id);
              }}>
                <Text style={styles.modalItemText}>{item.contact_person || item.business_name}</Text>
                <Text style={styles.modalItemSub}>{item.mobile || item.email || ''}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<View style={{ padding: spacing.lg, alignItems: 'center' }}><Ionicons name="people-outline" size={48} color={colors.gray300} /><Text style={{ color: colors.gray500, marginTop: spacing.sm }}>No customers found.</Text></View>}
          />
        </View>
      </Modal>

      {/* Invoice Picker Modal */}
      <Modal visible={showInvoicePicker} animationType="slide" onRequestClose={() => setShowInvoicePicker(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Invoice</Text>
            <TouchableOpacity onPress={() => setShowInvoicePicker(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.clearBtn} onPress={() => { setInvoiceId(null); setInvoiceNumber(''); setShowInvoicePicker(false); }}>
            <Ionicons name="close-circle-outline" size={20} color={colors.gray500} />
            <Text style={styles.clearBtnText}>No invoice (clear selection)</Text>
          </TouchableOpacity>
          <FlatList
            data={invoices}
            keyExtractor={inv => String(inv.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.modalItem} onPress={() => {
                setInvoiceId(item.id);
                setInvoiceNumber(item.invoice_number);
                setShowInvoicePicker(false);
              }}>
                <Text style={styles.modalItemText}>{item.invoice_number}</Text>
                <Text style={styles.modalItemSub}>₹{Number(item.total || 0).toLocaleString('en-IN')} • {item.invoice_date} • {item.status}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<View style={{ padding: spacing.lg, alignItems: 'center' }}><Ionicons name="document-text-outline" size={48} color={colors.gray300} /><Text style={{ color: colors.gray500, marginTop: spacing.sm }}>No invoices for this customer.</Text></View>}
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
            ListEmptyComponent={<View style={{ padding: spacing.lg, alignItems: 'center' }}><Ionicons name="cube-outline" size={48} color={colors.gray300} /><Text style={{ color: colors.gray500, marginTop: spacing.sm }}>No items found.</Text></View>}
          />
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
  row: { flexDirection: 'row', marginTop: 4 },
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

  // Discount
  discountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  discTypeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.border },
  discTypeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  discTypeText: { fontSize: fontSize.sm, color: colors.gray600 },
  discTypeTextActive: { color: colors.white, fontWeight: '600' },
  discInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, paddingHorizontal: 10, paddingVertical: 6, fontSize: fontSize.sm, color: colors.text, textAlign: 'right' },

  // Summary
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  sumLabel: { fontSize: fontSize.sm, color: colors.gray500 },
  sumVal: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text },
  totalLabel: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  totalVal: { fontSize: fontSize.lg, fontWeight: '700', color: colors.primary },

  // Save
  saveBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.sm, padding: spacing.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  saveBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
  saveBtnGhost: { flex: 1, backgroundColor: colors.white, borderRadius: borderRadius.sm, padding: spacing.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: colors.primary },
  saveBtnGhostText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
  saveRow: { flexDirection: 'row', gap: 8 },

  // Clear button for invoice picker
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: spacing.md, marginBottom: 0, padding: spacing.md, backgroundColor: colors.gray50, borderRadius: borderRadius.sm },
  clearBtnText: { fontSize: fontSize.md, color: colors.gray500 },

  // Modals
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
