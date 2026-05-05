import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  TextInput, Share, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import api from '../../api/client';
import { colors, spacing } from '../../theme';
import CurrencyText from '../../components/CurrencyText';

const SUPPLY_LABEL: Record<string, string> = { O: 'Outward (Sales)', I: 'Inward (Purchase)' };
const MODE_LABEL: Record<string, string> = { '1': 'Road', '2': 'Rail', '3': 'Air', '4': 'Ship' };
const VEHICLE_TYPE_LABEL: Record<string, string> = { R: 'Regular', O: 'ODC' };
const SUB_SUPPLY_LABEL: Record<string, string> = {
  '1': 'Supply', '2': 'Import', '3': 'Export', '4': 'Job Work', '5': 'For Own Use',
  '6': 'Job Work Returns', '7': 'Sales Return', '8': 'Others', '9': 'SKD/CKD',
  '10': 'Line Sales', '11': 'Recipient Not Known', '12': 'Exhibition or Fairs',
};
const DOC_TYPE_LABEL: Record<string, string> = {
  INV: 'Tax Invoice', BIL: 'Bill of Supply', BOE: 'Bill of Entry',
  CHL: 'Delivery Challan', CNT: 'Credit Note', OTH: 'Others',
};

const STATUS_META: Record<string, { color: string; bg: string; icon: any }> = {
  Draft:     { color: '#6b7280', bg: '#f3f4f6', icon: 'create-outline' },
  Generated: { color: '#059669', bg: '#d1fae5', icon: 'checkmark-circle' },
  Cancelled: { color: '#dc2626', bg: '#fee2e2', icon: 'close-circle' },
};

function fmtDate(s?: string | null) {
  if (!s) return '—';
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return s; }
}

export default function EwayBillDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const id: number = route.params?.id;
  const [bill, setBill] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ewbNo, setEwbNo] = useState('');
  const [statusModal, setStatusModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/eway-bills/${id}`);
      setBill(res.data);
      setEwbNo(res.data.ewb_no || '');
    } catch {
      Alert.alert('Error', 'Failed to load e-way bill');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const changeStatus = async (status: string) => {
    setStatusModal(false);
    if (status === 'Generated' && !ewbNo.trim()) {
      Alert.alert(
        'No EWB number entered',
        'Mark as Generated without an NIC-issued EWB number?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Mark Anyway', onPress: () => doStatusChange(status) },
        ],
      );
      return;
    }
    doStatusChange(status);
  };

  const doStatusChange = async (status: string) => {
    setBusy(true);
    try {
      if (status === 'Generated' && ewbNo.trim()) {
        await api.put(`/api/eway-bills/${id}`, { ewb_no: ewbNo.trim() });
      }
      await api.patch(`/api/eway-bills/${id}/status?status=${status}`);
      await load();
    } catch {
      Alert.alert('Error', 'Could not update status');
    } finally { setBusy(false); }
  };

  const downloadJSON = async () => {
    if (!bill) return;
    setBusy(true);
    try {
      const res = await api.get(`/api/eway-bills/${id}/json`);
      const json = JSON.stringify(res.data, null, 2);
      const fileName = `${bill.eway_number || 'ewb'}.json`;
      const path = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Share EWB JSON' });
      } else {
        await Share.share({ message: json });
      }
    } catch {
      Alert.alert('Error', 'Failed to download JSON');
    } finally { setBusy(false); }
  };

  const remove = () => {
    Alert.alert('Delete e-way bill?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await api.delete(`/api/eway-bills/${id}`);
            navigation.goBack();
          } catch {
            Alert.alert('Error', 'Failed to delete');
          } finally { setBusy(false); }
        },
      },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  if (!bill) return <View style={styles.center}><Text style={{ color: colors.gray500 }}>Not found</Text></View>;

  const meta = STATUS_META[bill.status] || STATUS_META['Draft'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Header card */}
      <View style={styles.header}>
        <View style={[styles.accentBar, { backgroundColor: meta.color }]} />
        <Text style={styles.eyebrow}>E-WAY BILL</Text>
        <Text style={styles.ewayNum}>{bill.eway_number}</Text>
        {bill.ewb_no ? (
          <View style={styles.nicBadge}>
            <Ionicons name="shield-checkmark" size={12} color="#fff" />
            <Text style={styles.nicBadgeText}>NIC EWB# {bill.ewb_no}</Text>
          </View>
        ) : null}
        <View style={[styles.statusPill, { backgroundColor: meta.bg, marginTop: 10 }]}>
          <Ionicons name={meta.icon} size={12} color={meta.color} />
          <Text style={[styles.statusPillText, { color: meta.color }]}>{bill.status}</Text>
        </View>

        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>Total Invoice Value</Text>
          <CurrencyText amount={bill.total_inv_value} style={styles.amountValue} />
        </View>

        <View style={styles.dateRow}>
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>Doc</Text>
            <Text style={styles.dateValue}>{bill.doc_no}</Text>
            <Text style={styles.dateSub}>{fmtDate(bill.doc_date)}</Text>
          </View>
          <View style={styles.dateDiv} />
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>Distance</Text>
            <Text style={styles.dateValue}>{bill.transport_distance || 0} km</Text>
            <Text style={styles.dateSub}>{MODE_LABEL[bill.transport_mode] || '—'}</Text>
          </View>
          <View style={styles.dateDiv} />
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>Valid Till</Text>
            <Text style={styles.dateValue}>{fmtDate(bill.valid_until)}</Text>
            <Text style={styles.dateSub}>{bill.valid_until ? '' : 'Not generated'}</Text>
          </View>
        </View>
      </View>

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.qAction} onPress={downloadJSON} activeOpacity={0.7}>
          <View style={[styles.qIcon, { backgroundColor: '#dbeafe' }]}>
            <Ionicons name="download-outline" size={18} color="#2563eb" />
          </View>
          <Text style={styles.qLabel}>JSON</Text>
        </TouchableOpacity>

        {bill.status === 'Draft' && (
          <TouchableOpacity
            style={styles.qAction}
            onPress={() => navigation.navigate('EwayBillForm', { id: bill.id })}
            activeOpacity={0.7}
          >
            <View style={[styles.qIcon, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="create-outline" size={18} color="#d97706" />
            </View>
            <Text style={styles.qLabel}>Edit</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.qAction} onPress={() => setStatusModal(true)} activeOpacity={0.7}>
          <View style={[styles.qIcon, { backgroundColor: '#f3e8ff' }]}>
            <Ionicons name="swap-horizontal-outline" size={18} color="#7c3aed" />
          </View>
          <Text style={styles.qLabel}>Status</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.qAction} onPress={remove} activeOpacity={0.7}>
          <View style={[styles.qIcon, { backgroundColor: '#fee2e2' }]}>
            <Ionicons name="trash-outline" size={18} color="#dc2626" />
          </View>
          <Text style={styles.qLabel}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Mark Generated CTA + NIC EWB no entry */}
      {bill.status === 'Draft' && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>EWB Number from NIC portal (optional)</Text>
          <View style={styles.ewbInputRow}>
            <TextInput
              style={styles.ewbInput}
              placeholder="12-digit EWB number"
              placeholderTextColor={colors.gray400}
              value={ewbNo}
              onChangeText={setEwbNo}
              maxLength={12}
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={[styles.markBtn, busy && { opacity: 0.6 }]}
              onPress={() => changeStatus('Generated')}
              activeOpacity={0.85}
              disabled={busy}
            >
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
              <Text style={styles.markBtnText}>Mark Generated</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            <Ionicons name="information-circle-outline" size={11} color={colors.gray500} />
            {' '}Upload the JSON to ewaybillgst.gov.in, copy the issued EWB no, paste here.
          </Text>
        </View>
      )}

      {/* Document info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Document</Text>
        <View style={styles.kvRow}>
          <Text style={styles.kvLabel}>Doc Type</Text>
          <Text style={styles.kvValue}>{DOC_TYPE_LABEL[bill.doc_type] || bill.doc_type}</Text>
        </View>
        <View style={styles.kvRow}>
          <Text style={styles.kvLabel}>Supply</Text>
          <Text style={styles.kvValue}>{SUPPLY_LABEL[bill.supply_type] || bill.supply_type}</Text>
        </View>
        <View style={styles.kvRow}>
          <Text style={styles.kvLabel}>Sub Supply</Text>
          <Text style={styles.kvValue}>{SUB_SUPPLY_LABEL[bill.sub_supply_type] || bill.sub_supply_type}</Text>
        </View>
        {bill.invoice_number ? (
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Linked Invoice</Text>
            <Text style={styles.kvValue}>{bill.invoice_number}</Text>
          </View>
        ) : null}
        {bill.bill_number ? (
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Linked Bill</Text>
            <Text style={styles.kvValue}>{bill.bill_number}</Text>
          </View>
        ) : null}
      </View>

      {/* From */}
      <View style={styles.section}>
        <View style={styles.partyHead}>
          <View style={[styles.partyIcon, { backgroundColor: '#dbeafe' }]}>
            <Ionicons name="business" size={14} color="#2563eb" />
          </View>
          <Text style={styles.sectionTitle}>From (Consignor)</Text>
        </View>
        <Text style={styles.partyName}>{bill.from_name || '—'}</Text>
        {bill.from_gstin ? <Text style={styles.partyGstin}>{bill.from_gstin}</Text> : null}
        <Text style={styles.partyAddr}>
          {[bill.from_address1, bill.from_address2, bill.from_place, bill.from_pincode].filter(Boolean).join(', ') || '—'}
        </Text>
        <Text style={styles.partyState}>State: {bill.from_state_code || '—'}</Text>
      </View>

      {/* To */}
      <View style={styles.section}>
        <View style={styles.partyHead}>
          <View style={[styles.partyIcon, { backgroundColor: '#fef3c7' }]}>
            <Ionicons name="navigate" size={14} color="#d97706" />
          </View>
          <Text style={styles.sectionTitle}>To (Consignee)</Text>
        </View>
        <Text style={styles.partyName}>{bill.to_name || '—'}</Text>
        {bill.to_gstin ? <Text style={styles.partyGstin}>{bill.to_gstin}</Text> : null}
        <Text style={styles.partyAddr}>
          {[bill.to_address1, bill.to_address2, bill.to_place, bill.to_pincode].filter(Boolean).join(', ') || '—'}
        </Text>
        <Text style={styles.partyState}>State: {bill.to_state_code || '—'}</Text>
      </View>

      {/* Transportation */}
      <View style={styles.section}>
        <View style={styles.partyHead}>
          <View style={[styles.partyIcon, { backgroundColor: '#f3e8ff' }]}>
            <Ionicons name="car" size={14} color="#7c3aed" />
          </View>
          <Text style={styles.sectionTitle}>Transportation</Text>
        </View>
        <View style={styles.kvRow}>
          <Text style={styles.kvLabel}>Mode</Text>
          <Text style={styles.kvValue}>{MODE_LABEL[bill.transport_mode] || bill.transport_mode}</Text>
        </View>
        <View style={styles.kvRow}>
          <Text style={styles.kvLabel}>Vehicle</Text>
          <Text style={[styles.kvValue, { fontFamily: 'Menlo' }]}>{bill.vehicle_no || '—'}</Text>
        </View>
        <View style={styles.kvRow}>
          <Text style={styles.kvLabel}>Vehicle Type</Text>
          <Text style={styles.kvValue}>{VEHICLE_TYPE_LABEL[bill.vehicle_type] || bill.vehicle_type}</Text>
        </View>
        {bill.transporter_name || bill.transporter_id ? (
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Transporter</Text>
            <Text style={styles.kvValue}>{bill.transporter_name || bill.transporter_id}</Text>
          </View>
        ) : null}
        {bill.transport_doc_no ? (
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Transport Doc</Text>
            <Text style={styles.kvValue}>{bill.transport_doc_no} · {fmtDate(bill.transport_doc_date)}</Text>
          </View>
        ) : null}
      </View>

      {/* Items — HSN codes flow from linked invoice/bill at JSON export time */}
      {(bill.invoice_id || bill.purchase_bill_id) && (
        <View style={styles.section}>
          <View style={styles.partyHead}>
            <View style={[styles.partyIcon, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="cube-outline" size={14} color="#059669" />
            </View>
            <Text style={styles.sectionTitle}>Items & HSN</Text>
          </View>
          <Text style={styles.notes}>
            Line items with HSN codes are automatically sourced from the linked{' '}
            {bill.invoice_id ? `invoice ${bill.invoice_number || ''}` : `bill ${bill.bill_number || ''}`}
            {' '}when exporting the NIC EWB-01 JSON.
          </Text>
        </View>
      )}

      {/* Values */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Values</Text>
        <View style={styles.kvRow}>
          <Text style={styles.kvLabel}>Taxable</Text>
          <CurrencyText amount={bill.total_value} style={styles.kvValue} />
        </View>
        <View style={styles.kvRow}>
          <Text style={styles.kvLabel}>CGST</Text>
          <CurrencyText amount={bill.cgst_value} style={styles.kvValue} />
        </View>
        <View style={styles.kvRow}>
          <Text style={styles.kvLabel}>SGST</Text>
          <CurrencyText amount={bill.sgst_value} style={styles.kvValue} />
        </View>
        <View style={styles.kvRow}>
          <Text style={styles.kvLabel}>IGST</Text>
          <CurrencyText amount={bill.igst_value} style={styles.kvValue} />
        </View>
        {(bill.cess_value || 0) > 0 && (
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>CESS</Text>
            <CurrencyText amount={bill.cess_value} style={styles.kvValue} />
          </View>
        )}
        <View style={styles.totalStrip}>
          <Text style={styles.totalLabel}>INVOICE TOTAL</Text>
          <CurrencyText amount={bill.total_inv_value} style={styles.totalValue} />
        </View>
      </View>

      {bill.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.notes}>{bill.notes}</Text>
        </View>
      ) : null}

      {/* Status modal */}
      <Modal visible={statusModal} transparent animationType="fade" onRequestClose={() => setStatusModal(false)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setStatusModal(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Change Status</Text>
            {Object.keys(STATUS_META).map(s => {
              const m = STATUS_META[s];
              const active = bill.status === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.modalOption, active && { backgroundColor: m.bg }]}
                  onPress={() => changeStatus(s)}
                >
                  <Ionicons name={m.icon} size={18} color={m.color} />
                  <Text style={[styles.modalOptionText, { color: m.color }]}>{s}</Text>
                  {active ? <Ionicons name="checkmark" size={18} color={m.color} style={{ marginLeft: 'auto' }} /> : null}
                </TouchableOpacity>
              );
            })}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    backgroundColor: '#fff',
    margin: spacing.md,
    borderRadius: 16,
    padding: spacing.md,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1, borderColor: colors.gray200,
  },
  accentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  eyebrow: { fontSize: 10.5, fontWeight: '800', color: colors.gray500, letterSpacing: 1.4, marginTop: 6 },
  ewayNum: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4, letterSpacing: -0.5 },
  nicBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', marginTop: 6,
    backgroundColor: '#2563eb', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
  },
  nicBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700', fontFamily: 'Menlo' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
  },
  statusPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

  amountBlock: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.gray100 },
  amountLabel: { fontSize: 11, fontWeight: '700', color: colors.gray500, letterSpacing: 0.5 },
  amountValue: { fontSize: 28, fontWeight: '800', color: colors.text, marginTop: 2 },

  dateRow: { flexDirection: 'row', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.gray100 },
  dateCol: { flex: 1, alignItems: 'center' },
  dateDiv: { width: 1, backgroundColor: colors.gray200 },
  dateLabel: { fontSize: 9.5, fontWeight: '700', color: colors.gray400, letterSpacing: 0.5 },
  dateValue: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 3 },
  dateSub: { fontSize: 10.5, color: colors.gray500, marginTop: 1 },

  quickActions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: colors.gray200,
  },
  qAction: { alignItems: 'center', gap: 4, flex: 1, paddingVertical: 4 },
  qIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  qLabel: { fontSize: 11, fontWeight: '600', color: colors.gray700 },

  section: {
    backgroundColor: '#fff',
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    borderRadius: 14, padding: spacing.md,
    borderWidth: 1, borderColor: colors.gray200,
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.gray500, marginBottom: 8, letterSpacing: 0.3 },
  ewbInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ewbInput: {
    flex: 1, backgroundColor: colors.gray50,
    borderWidth: 1, borderColor: colors.gray200, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: colors.text,
    fontFamily: 'Menlo',
  },
  markBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#059669', paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10,
  },
  markBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  hint: { fontSize: 11, color: colors.gray500, marginTop: 8 },

  partyHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  partyIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  partyName: { fontSize: 14, fontWeight: '700', color: colors.text },
  partyGstin: { fontSize: 12, color: colors.info, fontFamily: 'Menlo', marginTop: 2 },
  partyAddr: { fontSize: 12, color: colors.gray600, marginTop: 4, lineHeight: 17 },
  partyState: { fontSize: 11, color: colors.gray500, marginTop: 4, fontWeight: '600' },

  kvRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  kvLabel: { fontSize: 12, color: colors.gray500, fontWeight: '600' },
  kvValue: { fontSize: 13, color: colors.text, fontWeight: '700' },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  itemName: { fontSize: 13, fontWeight: '700', color: colors.text },
  itemMeta: { fontSize: 11, color: colors.gray500, marginTop: 2 },
  itemAmount: { fontSize: 13, fontWeight: '800', color: colors.text },

  totalStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10, paddingTop: 10, borderTopWidth: 2, borderTopColor: colors.primary,
  },
  totalLabel: { fontSize: 11, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 },
  totalValue: { fontSize: 20, fontWeight: '800', color: colors.primary },

  notes: { fontSize: 12.5, color: colors.gray700, lineHeight: 18 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: spacing.md, paddingBottom: spacing.lg },
  modalHandle: { width: 40, height: 4, backgroundColor: colors.gray300, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.sm },
  modalTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: spacing.md, textAlign: 'center' },
  modalOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, marginBottom: 6,
  },
  modalOptionText: { fontSize: 14, fontWeight: '700' },
});
