import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView,
  KeyboardAvoidingView, Platform, Modal, FlatList, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { useToast } from '../../components/Toast';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import DateInput from '../../components/DateInput';

interface LineItem {
  item_id?: number; item_name: string; description: string; hsn_code: string;
  unit: string; qty: number; rate: number; discount_percent: number;
  tax_rate: number; amount: number; serial_numbers: string;
}

const SERVICE_TYPES = ['Repair', 'AMC', 'Installation', 'Maintenance', 'Inspection', 'Other'];

export default function EstimateFormScreen({ route, navigation }: { route: any; navigation: any }) {
  const toast = useToast();
  const editId = route.params?.id;
  const duplicateId = route.params?.duplicate;
  const [orgId, setOrgId] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [estimateDate, setEstimateDate] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [estimatedDays, setEstimatedDays] = useState('');
  const [warrantyTerms, setWarrantyTerms] = useState('');
  const [gstEnabled, setGstEnabled] = useState(true);
  const [notes, setNotes] = useState('');
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [discountValue, setDiscountValue] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCustPicker, setShowCustPicker] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [showSvcPicker, setShowSvcPicker] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const biz = await api.get('/api/business');
        const oid = biz.data[0]?.org_id;
        if (!oid) return;
        setOrgId(oid);
        const [c, i] = await Promise.all([
          api.get(`/api/customers?org_id=${oid}`),
          api.get(`/api/items?org_id=${oid}`),
        ]);
        setCustomers(c.data);
        setItems(i.data);

        const loadId = editId || duplicateId;
        if (loadId) {
          const e = (await api.get(`/api/estimates/${loadId}`)).data;
          setCustomerId(e.customer_id);
          setCustomerName(e.customer_name || '');
          if (editId) {
            setEstimateDate(e.estimate_date || '');
          }
          setValidUntil(e.valid_until || '');
          setServiceType(e.service_type || '');
          setEstimatedDays(e.estimated_days ? String(e.estimated_days) : '');
          setWarrantyTerms(e.warranty_terms || '');
          setGstEnabled(e.gst_enabled !== false);
          setNotes(e.notes || '');
          setDiscountType(e.discount_type || 'flat');
          setDiscountValue(e.discount_value ? String(e.discount_value) : '');
          setLineItems((e.items || []).map((it: any) => ({
            item_id: it.item_id,
            item_name: it.item_name,
            description: it.description || '',
            hsn_code: it.hsn_code || '',
            unit: it.unit || '',
            qty: it.qty,
            rate: it.rate,
            discount_percent: it.discount_percent || 0,
            tax_rate: it.tax_rate || 0,
            amount: it.amount,
            serial_numbers: it.serial_numbers || '',
          })));
        }
      } catch {}
    })();
  }, [editId, duplicateId]);

  const calc = (li: LineItem) => {
    const b = li.qty * li.rate;
    const d = b - (b * li.discount_percent / 100);
    const tax = gstEnabled ? (d * li.tax_rate / 100) : 0;
    return d + tax;
  };

  const calcAfterDisc = (li: LineItem) => {
    const b = li.qty * li.rate;
    return b - (b * li.discount_percent / 100);
  };

  const addItem = (item: any) => {
    setLineItems(p => [...p, {
      item_id: item.id, item_name: item.item_name, description: item.description || '',
      hsn_code: item.hsn_code || '', unit: item.unit || 'Nos', qty: 1,
      rate: item.sale_price || 0, discount_percent: 0, tax_rate: item.tax_rate || 0,
      amount: 0, serial_numbers: '',
    }]);
    setShowItemPicker(false);
  };

  const addCustomItem = () => {
    setLineItems(prev => [...prev, {
      item_id: undefined, item_name: '', description: '', hsn_code: '',
      unit: 'Nos', qty: 1, rate: 0, discount_percent: 0, tax_rate: 0,
      amount: 0, serial_numbers: '',
    }]);
    setShowItemPicker(false);
  };

  const updateLine = (idx: number, key: string, val: any) => {
    setLineItems(p => {
      const u = [...p];
      (u[idx] as any)[key] = val;
      u[idx].amount = calc(u[idx]);
      return u;
    });
  };

  const removeLine = (idx: number) => setLineItems(p => p.filter((_, i) => i !== idx));

  const handleGstToggle = (val: boolean) => {
    setGstEnabled(val);
    if (!val) {
      setLineItems(p => p.map(li => ({ ...li, tax_rate: 0, amount: calcAfterDisc(li) })));
    }
  };

  const subtotal = lineItems.reduce((s, l) => s + calcAfterDisc(l), 0);
  const dv = parseFloat(discountValue) || 0;
  const overallDiscount = discountType === 'percentage' ? (subtotal * dv / 100) : dv;
  const taxAmt = gstEnabled ? lineItems.reduce((s, l) => {
    const ad = calcAfterDisc(l);
    return s + (ad * l.tax_rate / 100);
  }, 0) : 0;
  const total = subtotal - overallDiscount + taxAmt;

  const handleSave = async () => {
    if (!customerId) return Alert.alert('Error', 'Select a customer');
    if (!lineItems.length) return Alert.alert('Error', 'Add at least one item');
    setLoading(true);
    try {
      const body = {
        org_id: orgId,
        customer_id: customerId,
        estimate_date: estimateDate,
        valid_until: validUntil || null,
        service_type: serviceType || null,
        estimated_days: estimatedDays ? parseInt(estimatedDays) : null,
        warranty_terms: warrantyTerms || null,
        gst_enabled: gstEnabled,
        notes,
        discount_type: discountType,
        discount_value: dv,
        items: lineItems.map(l => ({
          item_id: l.item_id || null,
          item_name: l.item_name,
          description: l.description,
          hsn_code: l.hsn_code,
          unit: l.unit,
          qty: l.qty,
          rate: l.rate,
          discount_percent: l.discount_percent,
          tax_rate: gstEnabled ? l.tax_rate : 0,
          serial_numbers: l.serial_numbers || null,
        })),
      };
      if (editId) {
        await api.put(`/api/estimates/${editId}`, body);
      } else {
        await api.post('/api/estimates', body);
      }
      toast.success(editId ? 'Estimate updated' : 'Estimate created');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        {/* Customer & Dates */}
        <View style={styles.card}>
          <Text style={styles.label}>Customer *</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => { setSearch(''); setShowCustPicker(true); }}>
            <Text style={customerId ? styles.pickerText : styles.placeholder}>{customerName || 'Select customer'}</Text>
            <Ionicons name="chevron-down" size={20} color={colors.gray400} />
          </TouchableOpacity>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <DateInput label="Estimate Date" value={estimateDate} onChange={setEstimateDate} placeholder="Select date" />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <DateInput label="Valid Until" value={validUntil} onChange={setValidUntil} placeholder="Select date" />
            </View>
          </View>
        </View>

        {/* Service Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Service Details</Text>
          <Text style={styles.label}>Service Type</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowSvcPicker(true)}>
            <Text style={serviceType ? styles.pickerText : styles.placeholder}>{serviceType || 'Select type'}</Text>
            <Ionicons name="chevron-down" size={20} color={colors.gray400} />
          </TouchableOpacity>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Estimated Days</Text>
              <TextInput style={styles.input} value={estimatedDays} onChangeText={setEstimatedDays} keyboardType="number-pad" placeholder="e.g. 7" placeholderTextColor={colors.placeholder} />
            </View>
            <View style={{ flex: 2, marginLeft: spacing.sm }}>
              <Text style={styles.label}>Warranty Terms</Text>
              <TextInput style={styles.input} value={warrantyTerms} onChangeText={setWarrantyTerms} placeholder="e.g. 6 months parts warranty" placeholderTextColor={colors.placeholder} />
            </View>
          </View>

          {/* GST Toggle */}
          <View style={styles.gstRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.gstLabel}>GST Enabled</Text>
              <Text style={styles.gstSub}>{gstEnabled ? 'Tax will be applied to line items' : 'No tax will be applied'}</Text>
            </View>
            <Switch
              value={gstEnabled}
              onValueChange={handleGstToggle}
              trackColor={{ false: colors.gray300, true: colors.primary + '60' }}
              thumbColor={gstEnabled ? colors.primary : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Line Items */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Items</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => { setSearch(''); setShowItemPicker(true); }}>
              <Ionicons name="add-circle" size={24} color={colors.primary} />
              <Text style={styles.addText}>Add</Text>
            </TouchableOpacity>
          </View>

          {lineItems.map((li, idx) => (
            <View key={idx} style={styles.lineCard}>
              <View style={styles.lineHeader}>
                {li.item_id ? (
                  <Text style={styles.lineName} numberOfLines={1}>{li.item_name}</Text>
                ) : (
                  <TextInput
                    style={[styles.miniInput, { flex: 1, fontWeight: '600', marginRight: 8 }]}
                    value={li.item_name}
                    onChangeText={v => updateLine(idx, 'item_name', v)}
                    placeholder="Item name"
                    placeholderTextColor={colors.placeholder}
                  />
                )}
                <TouchableOpacity onPress={() => removeLine(idx)}>
                  <Ionicons name="close-circle" size={22} color={colors.danger} />
                </TouchableOpacity>
              </View>

              {!li.item_id && (
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mini}>Unit</Text>
                    <TextInput style={styles.miniInput} value={li.unit} onChangeText={v => updateLine(idx, 'unit', v)} placeholder="Nos" placeholderTextColor={colors.placeholder} />
                  </View>
                  <View style={{ flex: 2, marginLeft: 8 }}>
                    <Text style={styles.mini}>Description</Text>
                    <TextInput style={styles.miniInput} value={li.description} onChangeText={v => updateLine(idx, 'description', v)} placeholder="Optional" placeholderTextColor={colors.placeholder} />
                  </View>
                </View>
              )}

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mini}>Qty</Text>
                  <TextInput style={styles.miniInput} value={String(li.qty)} onChangeText={v => updateLine(idx, 'qty', parseFloat(v) || 0)} keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.mini}>Rate</Text>
                  <TextInput style={styles.miniInput} value={String(li.rate)} onChangeText={v => updateLine(idx, 'rate', parseFloat(v) || 0)} keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.mini}>Disc%</Text>
                  <TextInput style={styles.miniInput} value={String(li.discount_percent)} onChangeText={v => updateLine(idx, 'discount_percent', parseFloat(v) || 0)} keyboardType="decimal-pad" />
                </View>
                {gstEnabled && (
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.mini}>Tax%</Text>
                    <TextInput style={styles.miniInput} value={String(li.tax_rate)} onChangeText={v => updateLine(idx, 'tax_rate', parseFloat(v) || 0)} keyboardType="decimal-pad" />
                  </View>
                )}
              </View>

              {/* Serial Numbers */}
              <View style={{ marginTop: 4 }}>
                <Text style={styles.mini}>Serial Numbers</Text>
                <TextInput style={styles.miniInput} value={li.serial_numbers} onChangeText={v => updateLine(idx, 'serial_numbers', v)} placeholder="Optional (comma-separated)" placeholderTextColor={colors.placeholder} />
              </View>

              <Text style={styles.lineAmt}>₹{calc(li).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.card}>
          <Text style={styles.label}>Notes</Text>
          <TextInput style={[styles.input, { height: 60, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} multiline placeholder="Optional" placeholderTextColor={colors.placeholder} />

          {/* Discount */}
          <Text style={styles.label}>Overall Discount</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.discChip, discountType === 'flat' && styles.discChipActive]}
              onPress={() => setDiscountType('flat')}
            >
              <Text style={[styles.discChipText, discountType === 'flat' && { color: colors.white }]}>₹ Flat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.discChip, discountType === 'percentage' && styles.discChipActive]}
              onPress={() => setDiscountType('percentage')}
            >
              <Text style={[styles.discChipText, discountType === 'percentage' && { color: colors.white }]}>% Percent</Text>
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

          <View style={styles.sumRow}><Text style={styles.sumLabel}>Subtotal</Text><Text style={styles.sumVal}>₹{subtotal.toFixed(2)}</Text></View>
          {overallDiscount > 0 && (
            <View style={styles.sumRow}><Text style={styles.sumLabel}>Discount</Text><Text style={[styles.sumVal, { color: colors.danger }]}>-₹{overallDiscount.toFixed(2)}</Text></View>
          )}
          {gstEnabled ? (
            <View style={styles.sumRow}><Text style={styles.sumLabel}>Tax</Text><Text style={styles.sumVal}>₹{taxAmt.toFixed(2)}</Text></View>
          ) : (
            <View style={styles.sumRow}><Text style={[styles.sumLabel, { color: '#f59e0b' }]}>No GST applied</Text><Text style={styles.sumVal}>—</Text></View>
          )}
          <View style={[styles.sumRow, { borderTopWidth: 1, borderTopColor: colors.gray200, paddingTop: spacing.sm }]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalVal}>₹{total.toFixed(2)}</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.saveBtn, loading && { opacity: 0.6 }]} onPress={handleSave} disabled={loading}>
          <Text style={styles.saveBtnText}>{loading ? 'Saving...' : editId ? 'Update Estimate' : 'Create Estimate'}</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Customer Picker Modal */}
      <Modal visible={showCustPicker} animationType="slide" onRequestClose={() => setShowCustPicker(false)}>
        <View style={styles.modalC}>
          <View style={styles.modalH}>
            <Text style={styles.modalT}>Select Customer</Text>
            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ padding: 8 }} onPress={() => setShowCustPicker(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <TextInput style={[styles.modalS, { color: colors.text }]} value={search} onChangeText={setSearch} placeholder="Search..." placeholderTextColor={colors.placeholder} />
          <FlatList
            data={customers.filter(c => !search || c.contact_person?.toLowerCase().includes(search.toLowerCase()) || c.business_name?.toLowerCase().includes(search.toLowerCase()))}
            keyExtractor={c => String(c.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.modalI} onPress={() => { setCustomerId(item.id); setCustomerName(item.contact_person || item.business_name); setShowCustPicker(false); }}>
                <Text style={styles.modalIT}>{item.contact_person || item.business_name}</Text>
                <Text style={styles.modalIS}>{item.mobile || ''}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<View style={{ padding: 16, alignItems: 'center' }}><Ionicons name="people-outline" size={32} color={colors.gray400} /><Text style={{ color: colors.gray500, marginTop: 8 }}>No customers found.</Text></View>}
          />
        </View>
      </Modal>

      {/* Item Picker Modal */}
      <Modal visible={showItemPicker} animationType="slide" onRequestClose={() => setShowItemPicker(false)}>
        <View style={styles.modalC}>
          <View style={styles.modalH}>
            <Text style={styles.modalT}>Add Item</Text>
            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ padding: 8 }} onPress={() => setShowItemPicker(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.customItemBtn} onPress={addCustomItem}>
            <Ionicons name="create-outline" size={20} color={colors.primary} />
            <Text style={styles.customItemText}>Add Custom Item (not in catalog)</Text>
          </TouchableOpacity>
          <TextInput style={[styles.modalS, { color: colors.text }]} value={search} onChangeText={setSearch} placeholder="Search items..." placeholderTextColor={colors.placeholder} />
          <FlatList
            data={items.filter(i => !search || i.item_name?.toLowerCase().includes(search.toLowerCase()))}
            keyExtractor={i => String(i.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.modalI} onPress={() => addItem(item)}>
                <Text style={styles.modalIT}>{item.item_name}</Text>
                <Text style={styles.modalIS}>₹{item.sale_price} • {item.tax_rate}%</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<View style={{ padding: 16, alignItems: 'center' }}><Ionicons name="cube-outline" size={32} color={colors.gray400} /><Text style={{ color: colors.gray500, marginTop: 8 }}>No items found.</Text></View>}
          />
        </View>
      </Modal>

      {/* Service Type Picker Modal */}
      <Modal visible={showSvcPicker} transparent animationType="fade" onRequestClose={() => setShowSvcPicker(false)}>
        <TouchableOpacity style={styles.svcOverlay} activeOpacity={1} onPress={() => setShowSvcPicker(false)}>
          <View style={styles.svcModal}>
            <Text style={styles.svcModalTitle}>Select Service Type</Text>
            {SERVICE_TYPES.map(st => (
              <TouchableOpacity
                key={st}
                style={[styles.svcOption, serviceType === st && { backgroundColor: colors.primary + '10' }]}
                onPress={() => { setServiceType(st); setShowSvcPicker(false); }}
              >
                <Text style={[styles.svcOptionText, serviceType === st && { color: colors.primary, fontWeight: '700' }]}>{st}</Text>
                {serviceType === st && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            {serviceType ? (
              <TouchableOpacity style={styles.svcOption} onPress={() => { setServiceType(''); setShowSvcPicker(false); }}>
                <Text style={[styles.svcOptionText, { color: colors.danger }]}>Clear</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </TouchableOpacity>
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
  placeholder: { fontSize: fontSize.md, color: colors.placeholder },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addText: { color: colors.primary, fontWeight: '600', fontSize: fontSize.sm },

  gstRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.gray100 },
  gstLabel: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  gstSub: { fontSize: 11, color: colors.gray500, marginTop: 2 },

  lineCard: { backgroundColor: colors.gray50, borderRadius: borderRadius.sm, padding: spacing.sm, marginTop: spacing.sm },
  lineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  lineName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, flex: 1 },
  mini: { fontSize: 11, color: colors.gray500 },
  miniInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 4, padding: 6, fontSize: fontSize.sm, color: colors.text, backgroundColor: colors.white },
  lineAmt: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary, textAlign: 'right', marginTop: 4 },

  discChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.gray100, marginRight: 6 },
  discChipActive: { backgroundColor: colors.primary },
  discChipText: { fontSize: 12, fontWeight: '700', color: colors.gray600 },

  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  sumLabel: { fontSize: fontSize.sm, color: colors.gray500 },
  sumVal: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text },
  totalLabel: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  totalVal: { fontSize: fontSize.lg, fontWeight: '700', color: colors.primary },

  saveBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.sm, padding: spacing.md, alignItems: 'center' },
  saveBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },

  modalC: { flex: 1, backgroundColor: colors.white, paddingTop: 50 },
  modalH: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalT: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  modalS: { margin: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, padding: spacing.md, fontSize: fontSize.md },
  modalI: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  modalIT: { fontSize: fontSize.md, fontWeight: '500', color: colors.text },
  modalIS: { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },
  customItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: spacing.md, marginBottom: 0, padding: spacing.md, backgroundColor: colors.primary + '10', borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.primary + '30', borderStyle: 'dashed' },
  customItemText: { fontSize: fontSize.md, fontWeight: '600', color: colors.primary },

  svcOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  svcModal: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg },
  svcModalTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  svcOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.sm, borderRadius: borderRadius.sm },
  svcOptionText: { fontSize: fontSize.md, color: colors.text, fontWeight: '500' },
});
