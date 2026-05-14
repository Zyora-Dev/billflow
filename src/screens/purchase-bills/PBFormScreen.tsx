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
  hsn_code: string;
  unit: string;
  qty: number;
  rate: number;
  discount_percent: number;
  tax_rate: number;
  amount: number;
  serial_numbers: string;
}

export default function PBFormScreen({ route, navigation }: { route: any; navigation: any }) {
  const toast = useToast();
  const editId = route.params?.id;
  const [orgId, setOrgId] = useState('');
  const [vendors, setVendors] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [vendorId, setVendorId] = useState<number | null>(null);
  const [vendorName, setVendorName] = useState('');
  const [vendorBillNumber, setVendorBillNumber] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [discountValue, setDiscountValue] = useState('0');
  const [freightCharges, setFreightCharges] = useState('0');
  const [freightGst, setFreightGst] = useState(false);
  const [roundOffEnabled, setRoundOffEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showVendorPicker, setShowVendorPicker] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const biz = await api.get('/api/business');
        const oid = biz.data[0]?.org_id;
        if (!oid) return;
        setOrgId(oid);
        const [vRes, iRes] = await Promise.all([
          api.get(`/api/vendors?org_id=${oid}`),
          api.get(`/api/items?org_id=${oid}`),
        ]);
        setVendors(vRes.data);
        setItems(iRes.data);

        if (editId) {
          const bill = (await api.get(`/api/purchase-bills/${editId}`)).data;
          setVendorId(bill.vendor_id);
          setVendorName(bill.vendor_name || '');
          setVendorBillNumber(bill.vendor_bill_number || '');
          setBillDate(bill.bill_date || '');
          setDueDate(bill.due_date || '');
          setNotes(bill.notes || '');
          setDiscountType(bill.discount_type || 'flat');
          setDiscountValue(String(bill.discount_value || 0));
          setFreightCharges(String(bill.freight_charges ?? 0));
          setRoundOffEnabled(Math.abs(bill.round_off ?? 0) > 0);
          setLineItems((bill.items || []).map((it: any) => ({
            item_id: it.item_id, item_name: it.item_name, description: it.description || '',
            hsn_code: it.hsn_code || '',
            unit: it.unit || '', qty: it.qty, rate: it.rate,
            discount_percent: it.discount_percent || 0, tax_rate: it.tax_rate || 0,
            amount: it.amount, serial_numbers: it.serial_numbers || '',
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
    const usePurchase = item.purchase_unit && item.conversion_factor && item.purchase_price != null;
    setLineItems(prev => [...prev, {
      item_id: item.id, item_name: item.item_name, description: item.description || '',
      hsn_code: item.hsn_code || '',
      unit: usePurchase ? item.purchase_unit : (item.unit || 'Nos'),
      qty: 1,
      rate: usePurchase ? item.purchase_price : (item.sale_price || 0),
      discount_percent: 0, tax_rate: item.tax_rate || 0, amount: 0, serial_numbers: '',
      _purchase_unit: item.purchase_unit || null,
      _conversion_factor: item.conversion_factor || null,
      _original_unit: item.unit || 'Nos',
    }]);
    setShowItemPicker(false);
  };

  const addCustomItem = () => {
    setLineItems(prev => [...prev, {
      item_id: undefined, item_name: '', description: '',
      hsn_code: '',
      unit: 'Nos', qty: 1, rate: 0,
      discount_percent: 0, tax_rate: 0, amount: 0, serial_numbers: '',
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

  const subtotalRaw = lineItems.reduce((sum, li) => sum + (li.qty * li.rate * (1 - li.discount_percent / 100)), 0);
  const taxAmount = lineItems.reduce((sum, li) => {
    const base = li.qty * li.rate * (1 - li.discount_percent / 100);
    return sum + (base * li.tax_rate / 100);
  }, 0);
  const discAmt = discountType === 'percentage' ? subtotalRaw * parseFloat(discountValue || '0') / 100 : parseFloat(discountValue || '0');
  const freight = parseFloat(freightCharges || '0') || 0;
  const freightTax = freightGst ? freight * 0.18 : 0;
  const rawTotal = subtotalRaw - discAmt + taxAmount + freight + freightTax;
  const total = roundOffEnabled ? Math.round(rawTotal) : rawTotal;
  const roundOffDelta = roundOffEnabled ? total - rawTotal : 0;
  const subtotal = subtotalRaw;

  const handleSave = async () => {
    if (!vendorId) return Alert.alert('Error', 'Select a vendor');
    if (!lineItems.length) return Alert.alert('Error', 'Add at least one item');
    setLoading(true);
    try {
      const body = {
        org_id: orgId, vendor_id: vendorId, vendor_bill_number: vendorBillNumber || null,
        bill_date: billDate, due_date: dueDate || null,
        notes, discount_type: discountType, discount_value: parseFloat(discountValue || '0'),
        freight_charges: freight,
        round_off_enabled: roundOffEnabled,
        items: lineItems.map(li => ({
          item_id: li.item_id, item_name: li.item_name, description: li.description,
          hsn_code: li.hsn_code || null,
          unit: li.unit, qty: li.qty, rate: li.rate,
          discount_percent: li.discount_percent, tax_rate: li.tax_rate,
          amount: calcLineAmount(li),
          serial_numbers: li.serial_numbers || null,
        })),
      };
      if (editId) await api.put(`/api/purchase-bills/${editId}`, body);
      else await api.post('/api/purchase-bills', body);
      toast.success(editId ? 'Bill updated' : 'Bill created');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally { setLoading(false); }
  };

  const filteredVendors = vendorSearch
    ? vendors.filter(v => v.contact_person?.toLowerCase().includes(vendorSearch.toLowerCase()) || v.business_name?.toLowerCase().includes(vendorSearch.toLowerCase()))
    : vendors;

  const filteredItems = itemSearch
    ? items.filter(i => i.item_name?.toLowerCase().includes(itemSearch.toLowerCase()))
    : items;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        {/* Vendor */}
        <View style={styles.card}>
          <Text style={styles.label}>Vendor *</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowVendorPicker(true)}>
            <Text style={vendorId ? styles.pickerText : styles.pickerPlaceholder}>
              {vendorName || 'Select vendor'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.gray400} />
          </TouchableOpacity>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <DateInput label="Bill Date" value={billDate} onChange={setBillDate} placeholder="Select date" />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <DateInput label="Due Date" value={dueDate} onChange={setDueDate} placeholder="Select date" />
            </View>
          </View>

          <Text style={styles.label}>Vendor Bill # <Text style={{ fontSize: 11, color: colors.gray500, fontWeight: '400' }}>(reference from vendor)</Text></Text>
          <TextInput
            style={styles.input}
            value={vendorBillNumber}
            onChangeText={setVendorBillNumber}
            placeholder="e.g. V-INV-1234"
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
              {(li as any)._purchase_unit && (li as any)._conversion_factor ? (
                <Text style={{ fontSize: 11, color: '#2563eb', marginBottom: 4 }}>1 {((li as any)._purchase_unit || '').toUpperCase()} = {(li as any)._conversion_factor} {((li as any)._original_unit || li.unit || '').toUpperCase()}</Text>
              ) : null}
              {!li.item_id && (
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.miniLabel}>Unit</Text>
                    <TextInput style={styles.miniInput} value={li.unit} onChangeText={v => updateLine(idx, 'unit', v)} placeholder="Nos" placeholderTextColor={colors.placeholder} />
                  </View>
                </View>
              )}
              <View style={{ marginTop: 6 }}>
                <Text style={styles.miniLabel}>Description</Text>
                <TextInput style={[styles.miniInput, { minHeight: 48, textAlignVertical: 'top' }]} value={li.description} onChangeText={v => updateLine(idx, 'description', v)} placeholder="Item description" placeholderTextColor={colors.placeholder} multiline numberOfLines={2} />
              </View>
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
              <View style={{ marginTop: 6 }}>
                <Text style={styles.miniLabel}>Serial Numbers</Text>
                <TextInput style={[styles.miniInput, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, color: '#2563eb' }]} value={li.serial_numbers} onChangeText={v => updateLine(idx, 'serial_numbers', v)} placeholder="Serial nos (comma separated)" placeholderTextColor="#93c5fd" />
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
          {discAmt > 0 && (
            <View style={styles.sumRow}><Text style={styles.sumLabel}>Discount</Text><Text style={styles.sumVal}>−₹{discAmt.toFixed(2)}</Text></View>
          )}
          <View style={styles.sumRow}><Text style={styles.sumLabel}>Tax</Text><Text style={styles.sumVal}>₹{taxAmount.toFixed(2)}</Text></View>

          {/* Freight charges */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
            <Text style={[styles.sumLabel, { flex: 1 }]}>Freight Charges</Text>
            <TextInput
              style={{ width: 90, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, paddingHorizontal: 10, paddingVertical: 6, fontSize: fontSize.sm, color: colors.text, textAlign: 'right' }}
              value={freightCharges}
              onChangeText={setFreightCharges}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.placeholder}
            />
            <Text style={[styles.sumVal, { width: 80, textAlign: 'right' }]}>+₹{freight.toFixed(2)}</Text>
          </View>

          {/* Freight GST toggle */}
          {freight > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 }}>
              <TouchableOpacity
                style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: freightGst ? '#10b981' : colors.gray200, padding: 3, justifyContent: 'center' }}
                onPress={() => setFreightGst(v => !v)}
                activeOpacity={0.8}
              >
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: freightGst ? 'flex-end' : 'flex-start' }} />
              </TouchableOpacity>
              <Text style={{ fontSize: fontSize.sm, color: colors.text, fontWeight: '500' }}>GST on Freight (18%)</Text>
              {freightGst && <Text style={{ marginLeft: 'auto', fontSize: fontSize.sm, fontWeight: '600', color: colors.text }}>+₹{freightTax.toFixed(2)}</Text>}
            </View>
          )}

          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: 8 }}
            onPress={() => setRoundOffEnabled(v => !v)}
          >
            <View style={{ width: 22, height: 22, borderWidth: 2, borderColor: roundOffEnabled ? colors.primary : colors.gray400, borderRadius: 4, backgroundColor: roundOffEnabled ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {roundOffEnabled && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
            <Text style={{ fontSize: fontSize.sm, color: colors.text, fontWeight: '600' }}>Round Off</Text>
            {roundOffEnabled && (
              <Text style={{ marginLeft: 'auto', fontSize: fontSize.sm, color: roundOffDelta >= 0 ? colors.success : colors.danger, fontWeight: '600' }}>
                {roundOffDelta >= 0 ? '+' : '−'}₹{Math.abs(roundOffDelta).toFixed(2)}
              </Text>
            )}
          </TouchableOpacity>

          <View style={[styles.sumRow, { borderTopWidth: 1, borderTopColor: colors.gray200, paddingTop: spacing.sm, marginTop: spacing.sm }]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalVal}>₹{total.toFixed(2)}</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.saveBtn, loading && { opacity: 0.6 }]} onPress={handleSave} disabled={loading}>
          <Text style={styles.saveBtnText}>{loading ? 'Saving...' : editId ? 'Update Bill' : 'Create Purchase Bill'}</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Vendor Picker Modal */}
      <Modal visible={showVendorPicker} animationType="slide" onRequestClose={() => setShowVendorPicker(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Vendor</Text>
            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ padding: 8 }} onPress={() => setShowVendorPicker(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <TextInput style={[styles.modalSearch, { color: colors.text }]} value={vendorSearch} onChangeText={setVendorSearch} placeholder="Search..." placeholderTextColor={colors.placeholder} />
          <FlatList
            data={filteredVendors}
            keyExtractor={v => String(v.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.modalItem} onPress={() => { setVendorId(item.id); setVendorName(item.contact_person || item.business_name); setShowVendorPicker(false); }}>
                <Text style={styles.modalItemText}>{item.contact_person || item.business_name}</Text>
                <Text style={styles.modalItemSub}>{item.mobile || item.email || ''}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<View style={{ padding: 16, alignItems: 'center' }}><Ionicons name="people-outline" size={32} color={colors.gray400} /><Text style={{ color: colors.gray500, marginTop: 8 }}>No vendors found.</Text></View>}
          />
        </View>
      </Modal>

      {/* Item Picker Modal */}
      <Modal visible={showItemPicker} animationType="slide" onRequestClose={() => setShowItemPicker(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Item</Text>
            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ padding: 8 }} onPress={() => setShowItemPicker(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.customItemBtn} onPress={addCustomItem}>
            <Ionicons name="create-outline" size={20} color={colors.primary} />
            <Text style={styles.customItemText}>Add Custom Item (not in catalog)</Text>
          </TouchableOpacity>
          <TextInput style={[styles.modalSearch, { color: colors.text }]} value={itemSearch} onChangeText={setItemSearch} placeholder="Search items..." placeholderTextColor={colors.placeholder} />
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
            ListEmptyComponent={<View style={{ padding: 16, alignItems: 'center' }}><Ionicons name="cube-outline" size={32} color={colors.gray400} /><Text style={{ color: colors.gray500, marginTop: 8 }}>No items found.</Text></View>}
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
  saveBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.sm, padding: spacing.md, alignItems: 'center' },
  saveBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
  modalContainer: { flex: 1, backgroundColor: colors.white, paddingTop: 50 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  modalSearch: { margin: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, padding: spacing.md, fontSize: fontSize.md },
  modalItem: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  modalItemText: { fontSize: fontSize.md, fontWeight: '500', color: colors.text },
  modalItemSub: { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },
  customItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: spacing.md, marginBottom: 0, padding: spacing.md, backgroundColor: colors.primary + '10', borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.primary + '30', borderStyle: 'dashed' },
  customItemText: { fontSize: fontSize.md, fontWeight: '600', color: colors.primary },
});
