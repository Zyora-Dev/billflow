import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  TextInput, Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing } from '../../theme';
import DateInput from '../../components/DateInput';

const SUPPLY_TYPES = [
  { v: 'O', label: 'Outward (Sales)' },
  { v: 'I', label: 'Inward (Purchase)' },
];
const SUB_SUPPLY_TYPES = [
  { v: '1',  label: 'Supply' },
  { v: '2',  label: 'Import' },
  { v: '3',  label: 'Export' },
  { v: '4',  label: 'Job Work' },
  { v: '5',  label: 'For Own Use' },
  { v: '6',  label: 'Job Work Returns' },
  { v: '7',  label: 'Sales Return' },
  { v: '8',  label: 'Others' },
  { v: '9',  label: 'SKD/CKD' },
  { v: '10', label: 'Line Sales' },
  { v: '11', label: 'Recipient Not Known' },
  { v: '12', label: 'Exhibition or Fairs' },
];
const TRANSACTION_TYPES = [
  { v: 1, label: 'Regular' },
  { v: 2, label: 'Bill To - Ship To' },
  { v: 3, label: 'Bill From - Dispatch From' },
  { v: 4, label: 'Combination of 2 & 3' },
];
const DOC_TYPES = [
  { v: 'INV', label: 'Tax Invoice' },
  { v: 'BIL', label: 'Bill of Supply' },
  { v: 'BOE', label: 'Bill of Entry' },
  { v: 'CHL', label: 'Delivery Challan' },
  { v: 'CNT', label: 'Credit Note' },
  { v: 'OTH', label: 'Others' },
];
const TRANSPORT_MODES = [
  { v: '1', label: 'Road' },
  { v: '2', label: 'Rail' },
  { v: '3', label: 'Air' },
  { v: '4', label: 'Ship' },
];
const VEHICLE_TYPES = [
  { v: 'R', label: 'Regular' },
  { v: 'O', label: 'ODC (Over Dimensional)' },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

interface Option { v: string | number; label: string }

export default function EwayBillFormScreen({ route, navigation }: { route: any; navigation: any }) {
  const id: number | undefined = route.params?.id;
  const prefillInvoiceId: number | undefined = route.params?.invoice_id;
  const isEdit = !!id;

  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [states, setStates] = useState<{ code: string; name: string; label: string }[]>([]);

  const [form, setForm] = useState<Record<string, any>>({
    supply_type: 'O',
    sub_supply_type: '1',
    doc_type: 'INV',
    doc_no: '',
    doc_date: todayStr(),
    transaction_type: 1,
    transport_mode: '1',
    transport_distance: 0,
    vehicle_type: 'R',
    invoice_id: null,
    purchase_bill_id: null,
    status: 'Draft',
    total_value: 0,
    cgst_value: 0,
    sgst_value: 0,
    igst_value: 0,
    cess_value: 0,
    other_value: 0,
    total_inv_value: 0,
  });

  // Picker modal state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerOptions, setPickerOptions] = useState<Option[]>([]);
  const [pickerOnSelect, setPickerOnSelect] = useState<(v: any) => void>(() => () => {});
  const [pickerTitle, setPickerTitle] = useState('');
  const [pickerSearch, setPickerSearch] = useState('');

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const openPicker = (title: string, opts: Option[], onSelect: (v: any) => void) => {
    setPickerTitle(title);
    setPickerOptions(opts);
    setPickerOnSelect(() => onSelect);
    setPickerSearch('');
    setPickerOpen(true);
  };

  const filteredPickerOpts = useMemo(() => {
    if (!pickerSearch.trim()) return pickerOptions;
    const q = pickerSearch.trim().toLowerCase();
    return pickerOptions.filter(o => o.label.toLowerCase().includes(q));
  }, [pickerOptions, pickerSearch]);

  // Load org + ref data
  useEffect(() => {
    (async () => {
      try {
        const biz = await api.get('/api/business');
        const oid = biz.data[0]?.org_id;
        setOrgId(oid);
        if (oid) {
          const [invRes, pbRes, stRes] = await Promise.all([
            api.get(`/api/invoices?org_id=${oid}`).catch(() => ({ data: [] })),
            api.get(`/api/purchase-bills?org_id=${oid}`).catch(() => ({ data: [] })),
            api.get('/api/gst/states').catch(() => ({ data: [] })),
          ]);
          setInvoices(Array.isArray(invRes.data) ? invRes.data : (invRes.data?.data || []));
          setBills(Array.isArray(pbRes.data) ? pbRes.data : (pbRes.data?.data || []));
          setStates(Array.isArray(stRes.data) ? stRes.data : []);

          if (isEdit) {
            const r = await api.get(`/api/eway-bills/${id}`);
            setForm({ ...r.data, doc_date: (r.data.doc_date || '').slice(0, 10) });
          } else if (prefillInvoiceId) {
            // Prefill from invoice
            await prefill(prefillInvoiceId);
          }
        }
      } finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prefill = async (invId: number) => {
    try {
      const r = await api.post(`/api/eway-bills/from-invoice/${invId}`);
      setForm(p => ({ ...p, ...r.data }));
    } catch {
      Alert.alert('Error', 'Could not prefill from invoice');
    }
  };

  const save = async () => {
    if (!form.doc_no) { Alert.alert('Document number is required'); return; }
    if (!form.from_state_code || !form.to_state_code) {
      Alert.alert('Missing state', 'From and To state codes are required.');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/api/eway-bills/${id}`, form);
        navigation.goBack();
      } else {
        const r = await api.post('/api/eway-bills', { org_id: orgId, ...form });
        navigation.replace('EwayBillDetail', { id: r.data.id });
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  const labelOf = (opts: Option[], v: any) => opts.find(o => String(o.v) === String(v))?.label || '—';
  const stateLabel = (code: any) => states.find(s => s.code === String(code))?.label || String(code || '—');

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
      {/* Document */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Document</Text>

        <Text style={styles.fieldLabel}>Supply Type</Text>
        <TouchableOpacity
          style={styles.selectField}
          onPress={() => openPicker('Supply Type', SUPPLY_TYPES, (v) => set('supply_type', v))}
          activeOpacity={0.7}
        >
          <Text style={styles.selectText}>{labelOf(SUPPLY_TYPES, form.supply_type)}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.gray500} />
        </TouchableOpacity>

        <Text style={styles.fieldLabel}>Sub Supply Type</Text>
        <TouchableOpacity
          style={styles.selectField}
          onPress={() => openPicker('Sub Supply Type', SUB_SUPPLY_TYPES, (v) => set('sub_supply_type', v))}
          activeOpacity={0.7}
        >
          <Text style={styles.selectText}>{labelOf(SUB_SUPPLY_TYPES, form.sub_supply_type)}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.gray500} />
        </TouchableOpacity>

        <Text style={styles.fieldLabel}>Doc Type</Text>
        <TouchableOpacity
          style={styles.selectField}
          onPress={() => openPicker('Doc Type', DOC_TYPES, (v) => set('doc_type', v))}
          activeOpacity={0.7}
        >
          <Text style={styles.selectText}>{labelOf(DOC_TYPES, form.doc_type)}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.gray500} />
        </TouchableOpacity>

        {form.supply_type === 'O' && (
          <>
            <Text style={styles.fieldLabel}>Link to Invoice (auto-prefill)</Text>
            <TouchableOpacity
              style={styles.selectField}
              onPress={() => openPicker(
                'Select Invoice',
                [{ v: '__none__' as any, label: '— None —' } as Option, ...invoices.map(i => ({ v: i.id, label: `${i.invoice_number} · ₹${i.total}` } as Option))],
                async (v: any) => {
                  if (v === '__none__' || v === null) { set('invoice_id', null); return; }
                  set('invoice_id', Number(v));
                  await prefill(Number(v));
                },
              )}
              activeOpacity={0.7}
            >
              <Text style={[styles.selectText, !form.invoice_id && { color: colors.gray400 }]}>
                {form.invoice_id ? (invoices.find(i => i.id === Number(form.invoice_id))?.invoice_number || `Invoice #${form.invoice_id}`) : 'Select invoice'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.gray500} />
            </TouchableOpacity>
          </>
        )}

        {form.supply_type === 'I' && (
          <>
            <Text style={styles.fieldLabel}>Link to Purchase Bill</Text>
            <TouchableOpacity
              style={styles.selectField}
              onPress={() => openPicker(
                'Select Bill',
                [{ v: '__none__' as any, label: '— None —' } as Option, ...bills.map(i => ({ v: i.id, label: `${i.bill_number} · ₹${i.total}` } as Option))],
                (v: any) => set('purchase_bill_id', v === '__none__' ? null : Number(v)),
              )}
              activeOpacity={0.7}
            >
              <Text style={[styles.selectText, !form.purchase_bill_id && { color: colors.gray400 }]}>
                {form.purchase_bill_id ? (bills.find(b => b.id === Number(form.purchase_bill_id))?.bill_number || `Bill #${form.purchase_bill_id}`) : 'Select bill'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.gray500} />
            </TouchableOpacity>
          </>
        )}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Doc No *</Text>
            <TextInput
              style={styles.input}
              value={String(form.doc_no || '')}
              onChangeText={(t) => set('doc_no', t)}
              placeholder="Document number"
              placeholderTextColor={colors.gray400}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Doc Date</Text>
            <DateInput
              value={String(form.doc_date || '')}
              onChange={(v) => set('doc_date', v)}
            />
          </View>
        </View>

        <Text style={styles.fieldLabel}>Transaction Type</Text>
        <TouchableOpacity
          style={styles.selectField}
          onPress={() => openPicker('Transaction Type', TRANSACTION_TYPES.map(t => ({ v: t.v, label: t.label })), (v) => set('transaction_type', Number(v)))}
          activeOpacity={0.7}
        >
          <Text style={styles.selectText}>{labelOf(TRANSACTION_TYPES.map(t => ({ v: t.v, label: t.label })), form.transaction_type)}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.gray500} />
        </TouchableOpacity>

        <View style={styles.hsnHint}>
          <Ionicons name="information-circle" size={14} color="#2563eb" />
          <Text style={styles.hsnHintText}>
            Line items with HSN codes are sourced from the linked invoice/bill when exporting the NIC JSON. No separate items editor needed.
          </Text>
        </View>
      </View>

      {/* From */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>From Party (Consignor)</Text>
        <Text style={styles.fieldLabel}>GSTIN</Text>
        <TextInput
          style={[styles.input, { fontFamily: 'Menlo' }]}
          value={String(form.from_gstin || '')}
          onChangeText={(t) => set('from_gstin', t.toUpperCase())}
          placeholder="15-char GSTIN or URP"
          placeholderTextColor={colors.gray400}
          autoCapitalize="characters"
          maxLength={15}
        />

        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput style={styles.input} value={String(form.from_name || '')} onChangeText={(t) => set('from_name', t)} placeholder="Consignor name" placeholderTextColor={colors.gray400} />

        <Text style={styles.fieldLabel}>Address Line 1</Text>
        <TextInput style={styles.input} value={String(form.from_address1 || '')} onChangeText={(t) => set('from_address1', t)} placeholderTextColor={colors.gray400} />

        <Text style={styles.fieldLabel}>Address Line 2</Text>
        <TextInput style={styles.input} value={String(form.from_address2 || '')} onChangeText={(t) => set('from_address2', t)} placeholderTextColor={colors.gray400} />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Place</Text>
            <TextInput style={styles.input} value={String(form.from_place || '')} onChangeText={(t) => set('from_place', t)} placeholderTextColor={colors.gray400} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Pincode</Text>
            <TextInput style={styles.input} value={String(form.from_pincode || '')} onChangeText={(t) => set('from_pincode', t)} keyboardType="number-pad" maxLength={6} placeholderTextColor={colors.gray400} />
          </View>
        </View>

        <Text style={styles.fieldLabel}>State *</Text>
        <TouchableOpacity
          style={styles.selectField}
          onPress={() => openPicker(
            'Select State',
            states.map(s => ({ v: s.code, label: s.label })),
            (v) => { set('from_state_code', String(v)); set('act_from_state_code', String(v)); },
          )}
          activeOpacity={0.7}
        >
          <Text style={[styles.selectText, !form.from_state_code && { color: colors.gray400 }]}>
            {form.from_state_code ? stateLabel(form.from_state_code) : 'Select state'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.gray500} />
        </TouchableOpacity>
      </View>

      {/* To */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>To Party (Consignee)</Text>
        <Text style={styles.fieldLabel}>GSTIN</Text>
        <TextInput
          style={[styles.input, { fontFamily: 'Menlo' }]}
          value={String(form.to_gstin || '')}
          onChangeText={(t) => set('to_gstin', t.toUpperCase())}
          placeholder="15-char GSTIN or URP"
          placeholderTextColor={colors.gray400}
          autoCapitalize="characters"
          maxLength={15}
        />

        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput style={styles.input} value={String(form.to_name || '')} onChangeText={(t) => set('to_name', t)} placeholder="Consignee name" placeholderTextColor={colors.gray400} />

        <Text style={styles.fieldLabel}>Address Line 1</Text>
        <TextInput style={styles.input} value={String(form.to_address1 || '')} onChangeText={(t) => set('to_address1', t)} placeholderTextColor={colors.gray400} />

        <Text style={styles.fieldLabel}>Address Line 2</Text>
        <TextInput style={styles.input} value={String(form.to_address2 || '')} onChangeText={(t) => set('to_address2', t)} placeholderTextColor={colors.gray400} />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Place</Text>
            <TextInput style={styles.input} value={String(form.to_place || '')} onChangeText={(t) => set('to_place', t)} placeholderTextColor={colors.gray400} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Pincode</Text>
            <TextInput style={styles.input} value={String(form.to_pincode || '')} onChangeText={(t) => set('to_pincode', t)} keyboardType="number-pad" maxLength={6} placeholderTextColor={colors.gray400} />
          </View>
        </View>

        <Text style={styles.fieldLabel}>State *</Text>
        <TouchableOpacity
          style={styles.selectField}
          onPress={() => openPicker(
            'Select State',
            states.map(s => ({ v: s.code, label: s.label })),
            (v) => { set('to_state_code', String(v)); set('act_to_state_code', String(v)); },
          )}
          activeOpacity={0.7}
        >
          <Text style={[styles.selectText, !form.to_state_code && { color: colors.gray400 }]}>
            {form.to_state_code ? stateLabel(form.to_state_code) : 'Select state'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.gray500} />
        </TouchableOpacity>
      </View>

      {/* Transportation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Transportation</Text>

        <Text style={styles.fieldLabel}>Mode</Text>
        <TouchableOpacity
          style={styles.selectField}
          onPress={() => openPicker('Mode', TRANSPORT_MODES, (v) => set('transport_mode', v))}
          activeOpacity={0.7}
        >
          <Text style={styles.selectText}>{labelOf(TRANSPORT_MODES, form.transport_mode)}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.gray500} />
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Distance (km)</Text>
            <TextInput
              style={styles.input}
              value={String(form.transport_distance ?? 0)}
              onChangeText={(t) => set('transport_distance', Number(t) || 0)}
              keyboardType="number-pad"
              placeholderTextColor={colors.gray400}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Vehicle Type</Text>
            <TouchableOpacity
              style={styles.selectField}
              onPress={() => openPicker('Vehicle Type', VEHICLE_TYPES, (v) => set('vehicle_type', v))}
              activeOpacity={0.7}
            >
              <Text style={styles.selectText}>{labelOf(VEHICLE_TYPES, form.vehicle_type)}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.gray500} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.fieldLabel}>Vehicle No</Text>
        <TextInput
          style={[styles.input, { fontFamily: 'Menlo' }]}
          value={String(form.vehicle_no || '')}
          onChangeText={(t) => set('vehicle_no', t.toUpperCase())}
          placeholder="TN01AB1234"
          placeholderTextColor={colors.gray400}
          autoCapitalize="characters"
        />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Transporter ID</Text>
            <TextInput
              style={[styles.input, { fontFamily: 'Menlo' }]}
              value={String(form.transporter_id || '')}
              onChangeText={(t) => set('transporter_id', t.toUpperCase())}
              autoCapitalize="characters"
              placeholderTextColor={colors.gray400}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Transporter Name</Text>
            <TextInput style={styles.input} value={String(form.transporter_name || '')} onChangeText={(t) => set('transporter_name', t)} placeholderTextColor={colors.gray400} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Transport Doc No</Text>
            <TextInput style={styles.input} value={String(form.transport_doc_no || '')} onChangeText={(t) => set('transport_doc_no', t)} placeholderTextColor={colors.gray400} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Doc Date</Text>
            <DateInput
              value={String(form.transport_doc_date || '')}
              onChange={(v) => set('transport_doc_date', v)}
            />
          </View>
        </View>
      </View>

      {/* Values */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Values</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Taxable Value</Text>
            <TextInput style={styles.input} value={String(form.total_value ?? 0)} onChangeText={(t) => set('total_value', Number(t) || 0)} keyboardType="decimal-pad" placeholderTextColor={colors.gray400} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>CGST</Text>
            <TextInput style={styles.input} value={String(form.cgst_value ?? 0)} onChangeText={(t) => set('cgst_value', Number(t) || 0)} keyboardType="decimal-pad" placeholderTextColor={colors.gray400} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>SGST</Text>
            <TextInput style={styles.input} value={String(form.sgst_value ?? 0)} onChangeText={(t) => set('sgst_value', Number(t) || 0)} keyboardType="decimal-pad" placeholderTextColor={colors.gray400} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>IGST</Text>
            <TextInput style={styles.input} value={String(form.igst_value ?? 0)} onChangeText={(t) => set('igst_value', Number(t) || 0)} keyboardType="decimal-pad" placeholderTextColor={colors.gray400} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>CESS</Text>
            <TextInput style={styles.input} value={String(form.cess_value ?? 0)} onChangeText={(t) => set('cess_value', Number(t) || 0)} keyboardType="decimal-pad" placeholderTextColor={colors.gray400} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Other</Text>
            <TextInput style={styles.input} value={String(form.other_value ?? 0)} onChangeText={(t) => set('other_value', Number(t) || 0)} keyboardType="decimal-pad" placeholderTextColor={colors.gray400} />
          </View>
        </View>

        <Text style={styles.fieldLabel}>Total Invoice Value</Text>
        <TextInput
          style={[styles.input, { fontWeight: '800', fontSize: 16 }]}
          value={String(form.total_inv_value ?? 0)}
          onChangeText={(t) => set('total_inv_value', Number(t) || 0)}
          keyboardType="decimal-pad"
          placeholderTextColor={colors.gray400}
        />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} activeOpacity={0.85} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="save-outline" size={16} color="#fff" />}
          <Text style={styles.saveText}>{isEdit ? 'Save Changes' : 'Save Draft'}</Text>
        </TouchableOpacity>
      </View>

      {/* Picker Modal */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{pickerTitle}</Text>
            {pickerOptions.length > 8 && (
              <View style={styles.modalSearch}>
                <Ionicons name="search" size={14} color={colors.gray400} />
                <TextInput
                  style={styles.modalSearchInput}
                  value={pickerSearch}
                  onChangeText={setPickerSearch}
                  placeholder="Search"
                  placeholderTextColor={colors.gray400}
                />
              </View>
            )}
            <FlatList
              data={filteredPickerOpts}
              keyExtractor={(it: any, idx: number) => `${it.v}-${idx}`}
              style={{ maxHeight: 420 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => { setPickerOpen(false); pickerOnSelect(item.v); }}
                >
                  <Text style={styles.modalOptionText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  section: {
    backgroundColor: '#fff',
    margin: spacing.md, marginBottom: 0,
    borderRadius: 14, padding: spacing.md,
    borderWidth: 1, borderColor: colors.gray200,
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: spacing.sm, letterSpacing: 0.3 },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.gray500, marginTop: 10, marginBottom: 4, letterSpacing: 0.3 },
  input: {
    backgroundColor: colors.gray50,
    borderWidth: 1, borderColor: colors.gray200, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: colors.text,
  },
  selectField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.gray200, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11,
  },
  selectText: { fontSize: 14, color: colors.text, flex: 1 },

  hsnHint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#eff6ff', borderRadius: 10, padding: 10, marginTop: 12,
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  hsnHintText: { flex: 1, fontSize: 11.5, color: '#1e40af', lineHeight: 16 },

  actions: {
    flexDirection: 'row', gap: 10, marginHorizontal: spacing.md, marginTop: spacing.md,
  },
  cancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', paddingVertical: 13, borderRadius: 12,
    borderWidth: 1, borderColor: colors.gray300,
  },
  cancelText: { fontSize: 14, fontWeight: '700', color: colors.gray700 },
  saveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.primary, paddingVertical: 13, borderRadius: 12,
  },
  saveText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: spacing.md, paddingBottom: spacing.lg, maxHeight: '80%' },
  modalHandle: { width: 40, height: 4, backgroundColor: colors.gray300, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.sm },
  modalTitle: { fontSize: 15, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  modalSearch: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.gray50, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.gray200, marginBottom: spacing.sm,
  },
  modalSearchInput: { flex: 1, fontSize: 13, color: colors.text, padding: 0 },
  modalOption: {
    paddingVertical: 12, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  modalOptionText: { fontSize: 13.5, color: colors.text },
});
