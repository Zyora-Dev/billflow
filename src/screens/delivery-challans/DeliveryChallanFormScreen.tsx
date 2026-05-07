import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView,
  KeyboardAvoidingView, Platform, Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import DateInput from '../../components/DateInput';

const CHALLAN_TYPES = ['Supply', 'Job Work', 'Export', 'SKD/CKD'];

function typeColor(t: string) {
  switch (t) {
    case 'Supply': return '#3b82f6';
    case 'Job Work': return '#8b5cf6';
    case 'Export': return '#f59e0b';
    case 'SKD/CKD': return '#06b6d4';
    default: return colors.gray400;
  }
}

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

export default function DeliveryChallanFormScreen({ route, navigation }: { route: any; navigation: any }) {
  const editId = route.params?.id;
  const [orgId, setOrgId] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [challanDate, setChallanDate] = useState(new Date().toISOString().split('T')[0]);
  const [challanType, setChallanType] = useState('Supply');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [discountValue, setDiscountValue] = useState('0');
  const [loading, setLoading] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
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
        setCatalogItems(itemRes.data);

        if (editId) {
          const dc = (await api.get(`/api/delivery-challans/${editId}`)).data;
          setCustomerId(dc.customer_id);
          setCustomerName(dc.customer_name || '');
          setChallanDate(dc.challan_date || '');
          setChallanType(dc.challan_type || 'Supply');
          setVehicleNumber(dc.vehicle_number || '');
          setTransporterName(dc.transporter_name || '');
          setShippingAddress(dc.shipping_address || '');
          setNotes(dc.notes || '');
          setDiscountType(dc.discount_type || 'flat');
          setDiscountValue(String(dc.discount_value || 0));
          setLineItems((dc.items || []).map((it: any) => ({
            item_id: it.item_id, item_name: it.item_name, description: it.description || '',
            hsn_code: it.hsn_code || '', unit: it.unit || '', qty: it.qty, rate: it.rate,
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
      hsn_code: item.hsn_code || '', unit: item.unit || 'Nos', qty: 1, rate: item.sale_price || 0,
      discount_percent: 0, tax_rate: item.tax_rate || 0, amount: 0,
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

  const handleSave = async () => {
    if (!customerId) return Alert.alert('Error', 'Select a customer');
    if (!lineItems.length) return Alert.alert('Error', 'Add at least one item');
    setLoading(true);
    try {
      const body = {
        org_id: orgId,
        customer_id: customerId,
        challan_date: challanDate,
        challan_type: challanType,
        vehicle_number: vehicleNumber || null,
        transporter_name: transporterName || null,
        shipping_address: shippingAddress || null,
        notes: notes || null,
        status: 'Draft',
        discount_type: discountType,
        discount_value: parseFloat(discountValue || '0'),
        items: lineItems.map(li => ({
          item_id: li.item_id || null,
          item_name: li.item_name,
          description: li.description,
          hsn_code: li.hsn_code || null,
          unit: li.unit,
          qty: li.qty,
          rate: li.rate,
          discount_percent: li.discount_percent,
          tax_rate: li.tax_rate,
          amount: calcLineAmount(li),
        })),
      };
      if (editId) {
        await api.put(`/api/delivery-challans/${editId}`, body);
      } else {
        await api.post('/api/delivery-challans', body);
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to save');
    } finally { setLoading(false); }
  };

  const filteredCustomers = customerSearch
    ? customers.filter(c => c.contact_person?.toLowerCase().includes(customerSearch.toLowerCase()) || c.business_name?.toLowerCase().includes(customerSearch.toLowerCase()))
    : customers;

  const filteredItems = itemSearch
    ? catalogItems.filter(i => i.item_name?.toLowerCase().includes(itemSearch.toLowerCase()))
    : catalogItems;

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

          <DateInput label="Challan Date" value={challanDate} onChange={setChallanDate} placeholder="Challan Date" />
        </View>

        {/* Challan Type */}
        <View style={styles.card}>
          <Text style={styles.label}>Challan Type</Text>
          <View style={styles.typeRow}>
            {CHALLAN_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, challanType === t && { backgroundColor: typeColor(t) + '20', borderColor: typeColor(t) }]}
                onPress={() => setChallanType(t)}
              >
                <Text style={[styles.typeChipText, challanType === t && { color: typeColor(t) }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Transport Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Transport Details</Text>
          <Text style={styles.label}>Vehicle Number</Text>
          <TextInput
            style={styles.input}
            value={vehicleNumber}
            onChangeText={setVehicleNumber}
            placeholder="e.g. TN-01-AB-1234"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Transporter Name</Text>
          <TextInput
            style={styles.input}
            value={transporterName}
            onChangeText={setTransporterName}
            placeholder="Transporter name"
            placeholderTextColor={colors.placeholder}
          />

          <Text style={styles.label}>Shipping Address</Text>
          <TextInput
            style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
            value={shippingAddress}
            onChangeText={setShippingAddress}
            placeholder="Delivery address"
            placeholderTextColor={colors.placeholder}
            multiline
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
                  <Text style={styles.miniLabel}>HSN</Text>
                  <TextInput style={styles.miniInput} value={li.hsn_code} onChangeText={v => updateLine(idx, 'hsn_code', v)} placeholder="HSN" placeholderTextColor={colors.placeholder} />
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
              <Text style={styles.lineAmt}>Amount: ₹{calcLineAmount(li).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Discount + Notes */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Discount</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.discToggle, discountType === 'flat' && styles.discToggleActive]}
              onPress={() => setDiscountType('flat')}
            >
              <Text style={[styles.discToggleText, discountType === 'flat' && styles.discToggleTextActive]}>₹ Flat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.discToggle, discountType === 'percentage' && styles.discToggleActive]}
              onPress={() => setDiscountType('percentage')}
            >
              <Text style={[styles.discToggleText, discountType === 'percentage' && styles.discToggleTextActive]}>% Percent</Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.miniInput, { flex: 1, marginLeft: 8 }]}
              value={discountValue}
              onChangeText={setDiscountValue}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.placeholder}
            />
          </View>

          <Text style={[styles.label, { marginTop: spacing.md }]}>Notes</Text>
          <TextInput
            style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes"
            placeholderTextColor={colors.placeholder}
            multiline
          />
        </View>

        {/* Summary */}
        <View style={styles.card}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
          {discAmt > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount</Text>
              <Text style={[styles.summaryValue, { color: colors.danger }]}>-₹{discAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax</Text>
            <Text style={styles.summaryValue}>₹{taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
        </View>

        {/* Save */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>{editId ? 'Update Challan' : 'Save as Draft'}</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Customer Picker Modal */}
      <Modal visible={showCustomerPicker} animationType="slide" transparent>
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Customer</Text>
              <TouchableOpacity onPress={() => { setShowCustomerPicker(false); setCustomerSearch(''); }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Ionicons name="search" size={16} color={colors.gray400} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search customers..."
                placeholderTextColor={colors.placeholder}
                value={customerSearch}
                onChangeText={setCustomerSearch}
              />
            </View>
            <FlatList
              data={filteredCustomers}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setCustomerId(item.id);
                    setCustomerName(item.business_name || item.contact_person);
                    setShowCustomerPicker(false);
                    setCustomerSearch('');
                  }}
                >
                  <View style={styles.modalAvatar}>
                    <Text style={styles.modalAvatarText}>{(item.contact_person || 'C').charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemTitle}>{item.business_name || item.contact_person}</Text>
                    {item.business_name && item.contact_person ? <Text style={styles.modalItemSub}>{item.contact_person}</Text> : null}
                  </View>
                  {customerId === item.id && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No customers found</Text>}
            />
          </View>
        </View>
      </Modal>

      {/* Item Picker Modal */}
      <Modal visible={showItemPicker} animationType="slide" transparent>
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Item</Text>
              <TouchableOpacity onPress={() => { setShowItemPicker(false); setItemSearch(''); }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.customItemBtn} onPress={addCustomItem}>
              <Ionicons name="create-outline" size={18} color={colors.primary} />
              <Text style={styles.customItemText}>Add Custom Item</Text>
            </TouchableOpacity>
            <View style={styles.modalSearch}>
              <Ionicons name="search" size={16} color={colors.gray400} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search items..."
                placeholderTextColor={colors.placeholder}
                value={itemSearch}
                onChangeText={setItemSearch}
              />
            </View>
            <FlatList
              data={filteredItems}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => addItem(item)}>
                  <View style={[styles.modalAvatar, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="cube-outline" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemTitle}>{item.item_name}</Text>
                    <Text style={styles.modalItemSub}>₹{Number(item.sale_price || 0).toLocaleString('en-IN')} · {item.unit || 'Nos'}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No items found</Text>}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Card
  card: {
    backgroundColor: colors.card, marginHorizontal: spacing.md, marginTop: spacing.sm,
    borderRadius: borderRadius.lg, padding: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  label: { fontSize: fontSize.xs, fontWeight: '600', color: colors.gray500, marginBottom: 4, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 10,
    fontSize: fontSize.sm, color: colors.text,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },

  // Type chips
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 4 },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.gray50,
  },
  typeChipText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.gray500 },

  // Picker
  pickerBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  pickerText: { fontSize: fontSize.sm, color: colors.text, fontWeight: '500' },
  pickerPlaceholder: { fontSize: fontSize.sm, color: colors.placeholder },

  // Line items
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addItemText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  lineCard: {
    backgroundColor: colors.gray50, borderRadius: borderRadius.md,
    padding: spacing.sm, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  lineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  lineName: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, flex: 1, marginRight: 8 },
  lineAmt: { fontSize: fontSize.xs, fontWeight: '700', color: colors.primary, textAlign: 'right', marginTop: 6 },
  row: { flexDirection: 'row', marginTop: spacing.sm },
  miniLabel: { fontSize: 10, fontWeight: '600', color: colors.gray400, marginBottom: 2 },
  miniInput: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.sm, paddingHorizontal: 8, paddingVertical: 6,
    fontSize: fontSize.xs, color: colors.text,
  },

  // Discount
  discToggle: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.gray50,
  },
  discToggleActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
  discToggleText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.gray500 },
  discToggleTextActive: { color: colors.primary },

  // Summary
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontSize: fontSize.sm, color: colors.gray500 },
  summaryValue: { fontSize: fontSize.sm, color: colors.text, fontWeight: '500' },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: spacing.sm },
  totalLabel: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: fontSize.md, fontWeight: '800', color: colors.primary },

  // Save
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, marginHorizontal: spacing.md, marginTop: spacing.md,
    paddingVertical: 16, borderRadius: borderRadius.md, gap: 8,
  },
  saveBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: '700' },

  // Modal
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.card, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%', paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  modalSearch: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.gray50, marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    borderRadius: borderRadius.md, paddingHorizontal: spacing.sm, paddingVertical: 8,
  },
  modalSearchInput: { flex: 1, marginLeft: spacing.sm, fontSize: fontSize.sm, color: colors.text },
  modalItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  modalAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.gray100,
    justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm,
  },
  modalAvatarText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.gray600 },
  modalItemTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  modalItemSub: { fontSize: fontSize.xs, color: colors.gray400, marginTop: 1 },
  emptyText: { textAlign: 'center', color: colors.gray400, padding: spacing.lg },
  customItemBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: colors.primary + '10', borderRadius: borderRadius.md,
  },
  customItemText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
});
