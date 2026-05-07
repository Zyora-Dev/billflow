import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import StatusBadge from '../../components/StatusBadge';
import CurrencyText from '../../components/CurrencyText';

const STATUS_OPTIONS = ['Draft', 'Issued', 'Cancelled'];

export default function DebitNoteDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const { id } = route.params;
  const [dn, setDn] = useState<any>(null);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  const fetchDN = async () => {
    try {
      const r = await api.get(`/api/debit-notes/${id}`);
      setDn(r.data);
    } catch {}
  };

  useEffect(() => { fetchDN(); }, [id]);
  useEffect(() => { navigation.addListener('focus', fetchDN); }, [navigation]);

  const changeStatus = async (status: string) => {
    try {
      await api.patch(`/api/debit-notes/${id}/status?status=${status}`);
      setShowStatusPicker(false);
      fetchDN();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Debit Note', 'Are you sure? This will reverse any purchase bill adjustments.', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/api/debit-notes/${id}`); navigation.goBack(); } catch (e: any) {
          Alert.alert('Error', e.response?.data?.detail || 'Failed');
        }
      }},
    ]);
  };

  const dateFmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  if (!dn) return <View style={s.center}><Text style={{ color: colors.gray500 }}>Loading...</Text></View>;

  const statusAccent: Record<string, string> = {
    Draft: '#94a3b8',
    Issued: '#10b981',
    Cancelled: '#ef4444',
  };
  const accent = statusAccent[dn.status] || colors.primary;

  const discAmt = dn.discount_type === 'percentage'
    ? (dn.subtotal || 0) * (dn.discount_value || 0) / 100
    : (dn.discount_value || 0);

  return (
    <ScrollView style={s.container}>
      {/* HEADER */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View style={[s.accentBar, { backgroundColor: accent }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.headerLabel}>DEBIT NOTE</Text>
            <Text style={s.headerNumber}>{dn.dn_number}</Text>
          </View>
          <View style={[s.statusPill, { backgroundColor: accent + '15', borderColor: accent + '40' }]}>
            <View style={[s.statusDot, { backgroundColor: accent }]} />
            <Text style={[s.statusText, { color: accent }]}>{dn.status}</Text>
          </View>
        </View>

        <View style={s.amountBlock}>
          <Text style={s.amountLabel}>Total Amount</Text>
          <Text style={s.amountValue}>₹{Number(dn.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        </View>

        <View style={s.dateRow}>
          <View style={s.dateCol}>
            <Text style={s.dateLabel}>Date</Text>
            <Text style={s.dateValue}>{dateFmt(dn.dn_date)}</Text>
          </View>
          <View style={s.dateDiv} />
          <View style={s.dateCol}>
            <Text style={s.dateLabel}>Items</Text>
            <Text style={s.dateValue}>{(dn.items || []).length}</Text>
          </View>
          <View style={s.dateDiv} />
          <View style={s.dateCol}>
            <Text style={s.dateLabel}>Status</Text>
            <Text style={[s.dateValue, { color: accent }]}>{dn.status}</Text>
          </View>
        </View>
      </View>

      {/* QUICK ACTIONS */}
      <View style={s.quickActions}>
        <TouchableOpacity style={s.qAction} onPress={() => setShowStatusPicker(true)}>
          <View style={[s.qIcon, { backgroundColor: colors.warning + '20' }]}>
            <Ionicons name="flag-outline" size={20} color={colors.warning} />
          </View>
          <Text style={s.qLabel}>Status</Text>
        </TouchableOpacity>
        {dn.status === 'Draft' && (
          <TouchableOpacity style={s.qAction} onPress={() => navigation.navigate('DebitNoteForm', { id })}>
            <View style={[s.qIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="create-outline" size={20} color={colors.primary} />
            </View>
            <Text style={s.qLabel}>Edit</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.qAction} onPress={handleDelete}>
          <View style={[s.qIcon, { backgroundColor: colors.danger + '20' }]}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </View>
          <Text style={s.qLabel}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* REASON */}
      {dn.reason ? (
        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={s.sectionTitleRow}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
              <Text style={s.sectionTitle}>Reason</Text>
            </View>
          </View>
          <Text style={s.reasonText}>{dn.reason}</Text>
        </View>
      ) : null}

      {/* VENDOR */}
      <View style={s.section}>
        <View style={s.sectionHead}>
          <View style={s.sectionTitleRow}>
            <Ionicons name="business-outline" size={18} color={colors.primary} />
            <Text style={s.sectionTitle}>Vendor</Text>
          </View>
        </View>
        <View style={s.vendorCard}>
          <View style={s.vendorAvatar}>
            <Text style={s.vendorAvatarText}>{(dn.vendor_name || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.vendorName}>{dn.vendor_name || 'N/A'}</Text>
          </View>
        </View>
      </View>

      {/* LINKED PURCHASE BILL */}
      {dn.bill_number ? (
        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={s.sectionTitleRow}>
              <Ionicons name="link-outline" size={18} color={colors.primary} />
              <Text style={s.sectionTitle}>Linked Purchase Bill</Text>
            </View>
          </View>
          <View style={s.linkedCard}>
            <View style={s.linkedIcon}>
              <Ionicons name="receipt" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.linkedNumber}>{dn.bill_number}</Text>
              <Text style={s.linkedSub}>Purchase bill linked to this debit note</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={colors.gray400} />
          </View>
        </View>
      ) : null}

      {/* PLACE OF SUPPLY */}
      {dn.place_of_supply ? (
        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={s.sectionTitleRow}>
              <Ionicons name="location-outline" size={18} color={colors.primary} />
              <Text style={s.sectionTitle}>Place of Supply</Text>
            </View>
          </View>
          <Text style={s.posText}>{dn.place_of_supply}</Text>
        </View>
      ) : null}

      {/* ITEMS */}
      <View style={s.section}>
        <View style={s.sectionHead}>
          <View style={s.sectionTitleRow}>
            <Ionicons name="cube-outline" size={18} color={colors.primary} />
            <Text style={s.sectionTitle}>Items</Text>
          </View>
          <View style={s.itemCountChip}>
            <Text style={s.itemCountText}>{(dn.items || []).length}</Text>
          </View>
        </View>
        {(dn.items || []).map((item: any, i: number) => (
          <View key={i} style={[s.lineItem, i === (dn.items || []).length - 1 && { borderBottomWidth: 0 }]}>
            <View style={s.lineHeaderRow}>
              <View style={s.lineNum}><Text style={s.lineNumText}>{i + 1}</Text></View>
              <Text style={s.itemName} numberOfLines={2}>{item.item_name}</Text>
              <CurrencyText amount={item.amount} style={s.itemAmt} />
            </View>
            {item.description ? <Text style={s.itemDesc} numberOfLines={2}>{item.description}</Text> : null}
            <View style={s.itemMetaRow}>
              <View style={s.metaChip}>
                <Ionicons name="layers-outline" size={10} color={colors.gray600} />
                <Text style={s.metaChipValue}>{item.qty}{item.unit ? ` ${item.unit}` : ''}</Text>
              </View>
              <View style={s.metaChip}>
                <Ionicons name="pricetag-outline" size={10} color={colors.gray600} />
                <Text style={s.metaChipValue}>₹{Number(item.rate || 0).toFixed(2)}</Text>
              </View>
              {item.discount_percent > 0 ? (
                <View style={[s.metaChip, { backgroundColor: '#fef3c7' }]}>
                  <Ionicons name="trending-down" size={10} color="#b45309" />
                  <Text style={[s.metaChipValue, { color: '#b45309' }]}>{item.discount_percent}%</Text>
                </View>
              ) : null}
              {item.tax_rate > 0 ? (
                <View style={[s.metaChip, { backgroundColor: colors.primary + '12' }]}>
                  <Ionicons name="receipt-outline" size={10} color={colors.primary} />
                  <Text style={[s.metaChipValue, { color: colors.primary }]}>GST {item.tax_rate}%</Text>
                </View>
              ) : null}
              {item.hsn_code ? (
                <View style={s.metaChip}>
                  <Text style={s.metaChipLabel}>HSN</Text>
                  <Text style={s.metaChipValue}>{item.hsn_code}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {/* SUMMARY */}
      <View style={s.section}>
        <View style={s.sectionHead}>
          <View style={s.sectionTitleRow}>
            <Ionicons name="calculator-outline" size={18} color={colors.primary} />
            <Text style={s.sectionTitle}>Summary</Text>
          </View>
        </View>
        <View style={s.sumRow}><Text style={s.sumLabel}>Subtotal</Text><CurrencyText amount={dn.subtotal} style={s.sumValue} /></View>
        {dn.discount_value > 0 && (
          <View style={s.sumRow}>
            <Text style={s.sumLabel}>Discount {dn.discount_type === 'percentage' ? `(${dn.discount_value}%)` : ''}</Text>
            <Text style={[s.sumValue, { color: colors.danger }]}>−₹{discAmt.toFixed(2)}</Text>
          </View>
        )}
        {dn.tax_amount > 0 && <View style={s.sumRow}><Text style={s.sumLabel}>Tax (CGST + SGST)</Text><CurrencyText amount={dn.tax_amount} style={s.sumValue} /></View>}
        <View style={[s.sumRow, s.totalRow]}><Text style={s.totalLabel}>Total</Text><CurrencyText amount={dn.total} style={s.totalValue} /></View>
      </View>

      {/* NOTES */}
      {dn.notes ? (
        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={s.sectionTitleRow}>
              <Ionicons name="document-text-outline" size={18} color={colors.primary} />
              <Text style={s.sectionTitle}>Notes</Text>
            </View>
          </View>
          <Text style={s.notes}>{dn.notes}</Text>
        </View>
      ) : null}

      {/* MORE ACTIONS */}
      <View style={s.moreActions}>
        {dn.status === 'Draft' && (
          <TouchableOpacity style={s.moreBtn} onPress={() => navigation.navigate('DebitNoteForm', { id })}>
            <Ionicons name="create-outline" size={18} color={colors.gray600} />
            <Text style={s.moreBtnText}>Edit Debit Note</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[s.moreBtn, { borderColor: colors.danger + '40' }]} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={[s.moreBtnText, { color: colors.danger }]}>Delete Debit Note</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />

      {/* Status Picker Modal */}
      <Modal visible={showStatusPicker} transparent animationType="fade" onRequestClose={() => setShowStatusPicker(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowStatusPicker(false)}>
          <View style={s.statusModal}>
            <Text style={s.modalTitle}>Change Status</Text>
            {STATUS_OPTIONS.map(st => (
              <TouchableOpacity key={st} style={[s.statusOption, dn.status === st && { backgroundColor: colors.primary + '10' }]} onPress={() => changeStatus(st)}>
                <StatusBadge status={st} />
                {dn.status === st && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: { backgroundColor: '#fff', paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md, marginBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accentBar: { width: 3, height: 36, borderRadius: 2 },
  headerLabel: { fontSize: 9, fontWeight: '800', color: colors.gray500, letterSpacing: 1.5 },
  headerNumber: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3, marginTop: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

  amountBlock: { marginTop: 16 },
  amountLabel: { fontSize: 10, fontWeight: '700', color: colors.gray500, letterSpacing: 0.8, textTransform: 'uppercase' },
  amountValue: { fontSize: 28, fontWeight: '900', color: colors.text, letterSpacing: -0.6, marginTop: 2 },

  dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.gray100 },
  dateCol: { flex: 1 },
  dateDiv: { width: 1, height: 28, backgroundColor: colors.gray200, marginHorizontal: 4 },
  dateLabel: { fontSize: 9, fontWeight: '700', color: colors.gray500, letterSpacing: 0.5, textTransform: 'uppercase' },
  dateValue: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 2 },

  // Quick Actions
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.white, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: 12 },
  qAction: { width: '25%', alignItems: 'center', paddingVertical: spacing.sm },
  qIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  qLabel: { fontSize: 10, color: colors.gray600, fontWeight: '500' },

  // Sections
  section: { backgroundColor: colors.white, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: 12, padding: spacing.md },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.text, letterSpacing: -0.1 },

  reasonText: { fontSize: 13, color: colors.gray600, lineHeight: 20, fontStyle: 'italic' },
  posText: { fontSize: 13, color: colors.gray600 },

  // Vendor
  vendorCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vendorAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' },
  vendorAvatarText: { fontSize: 18, fontWeight: '800', color: colors.primary },
  vendorName: { fontSize: 15, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },

  // Linked bill
  linkedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.gray50, borderRadius: 10, padding: 12 },
  linkedIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' },
  linkedNumber: { fontSize: 14, fontWeight: '700', color: colors.text },
  linkedSub: { fontSize: 11, color: colors.gray500, marginTop: 2 },

  // Line items
  lineItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  lineHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  lineNum: { width: 24, height: 24, borderRadius: 8, backgroundColor: colors.primary + '12', justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  lineNumText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  itemName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text, letterSpacing: -0.1, lineHeight: 19 },
  itemDesc: { fontSize: 12, color: colors.gray500, marginTop: 4, marginLeft: 34, lineHeight: 17 },
  itemAmt: { fontSize: 15, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  itemMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginLeft: 34 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.gray100, borderRadius: 6 },
  metaChipLabel: { fontSize: 9, fontWeight: '700', color: colors.gray600, textTransform: 'uppercase', letterSpacing: 0.3 },
  metaChipValue: { fontSize: 11, fontWeight: '700', color: colors.text },
  itemCountChip: { paddingHorizontal: 9, paddingVertical: 2, backgroundColor: colors.primary + '15', borderRadius: 999 },
  itemCountText: { fontSize: 11, fontWeight: '800', color: colors.primary },

  // Summary
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  sumLabel: { fontSize: 13, color: colors.gray600 },
  sumValue: { fontSize: 13, fontWeight: '600', color: colors.text },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.gray200, paddingTop: 10, marginTop: 6 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: colors.text },
  totalValue: { fontSize: 18, fontWeight: '900', color: colors.primary, letterSpacing: -0.4 },

  notes: { fontSize: 13, color: colors.gray600, lineHeight: 20 },

  // More actions
  moreActions: { paddingHorizontal: spacing.md, gap: spacing.sm },
  moreBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.gray200, borderRadius: 12, padding: spacing.md, backgroundColor: '#fff' },
  moreBtnText: { fontSize: fontSize.md, color: colors.gray600, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  statusModal: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg },
  statusOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: spacing.sm, borderRadius: borderRadius.sm },
  modalTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
});
