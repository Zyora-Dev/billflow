import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput, Modal, Share, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import api, { BASE_URL } from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import StatusBadge from '../../components/StatusBadge';
import CurrencyText from '../../components/CurrencyText';
import { buildDocumentHTML } from '../../lib/document-templates';

const STATUS_OPTIONS = ['Draft', 'Received', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled'];

export default function PBDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const { id } = route.params;
  const [bill, setBill] = useState<any>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payRef, setPayRef] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [business, setBusiness] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [pbSettings, setPbSettings] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  const fetchBill = async () => {
    try {
      const r = await api.get(`/api/purchase-bills/${id}`);
      const billData = r.data;
      setBill(billData);
      const [bizRes, settingsRes] = await Promise.all([
        api.get('/api/business'),
        api.get(`/api/purchase-bill-settings?org_id=${billData.org_id}`).catch(() => ({ data: null })),
      ]);
      if (bizRes.data[0]) setBusiness(bizRes.data[0]);
      if (settingsRes.data) setPbSettings(settingsRes.data);
      // Fetch vendor details
      if (billData.vendor_id) {
        try { const vr = await api.get(`/api/vendors/${billData.vendor_id}`); setVendor(vr.data); } catch {}
      }
      // Fetch payment history
      try { const pr = await api.get(`/api/purchase-payments/bill/${billData.id}`); setPaymentHistory(pr.data || []); } catch {}
    } catch {}
  };

  useEffect(() => { fetchBill(); }, [id]);
  useEffect(() => { navigation.addListener('focus', fetchBill); }, [navigation]);

  const changeStatus = async (status: string) => {
    try {
      await api.patch(`/api/purchase-bills/${id}/status?status=${status}`);
      setShowStatusPicker(false);
      fetchBill();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); }
  };

  const recordPayment = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return Alert.alert('Error', 'Enter valid amount');
    if (amt > (bill.balance_due || 0)) return Alert.alert('Error', 'Amount exceeds balance');
    setPayLoading(true);
    try {
      await api.patch(`/api/purchase-bills/${id}/payment?amount=${amt}`);
      setShowPayment(false);
      setPayAmount('');
      fetchBill();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally { setPayLoading(false); }
  };

  const handleDuplicate = () => {
    Alert.alert('Duplicate', 'Create a copy of this purchase bill?', [
      { text: 'Cancel' },
      { text: 'Duplicate', onPress: () => navigation.navigate('PBForm', { duplicate: id }) },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Delete', 'Delete this purchase bill?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/api/purchase-bills/${id}`); navigation.goBack(); } catch {}
      }},
    ]);
  };

  const generateHTML = () => {
    if (!bill) return '';
    return buildDocumentHTML({
      doc: {
        bill_number: bill.bill_number,
        bill_date: bill.bill_date,
        vendor_bill_number: bill.vendor_bill_number,
        due_date: bill.due_date,
        status: bill.status,
        subtotal: bill.subtotal,
        discount_type: bill.discount_type,
        discount_value: bill.discount_value,
        tax_amount: bill.tax_amount,
        freight_charges: bill.freight_charges,
        round_off: bill.round_off,
        total: bill.total,
        amount_paid: bill.amount_paid,
        balance_due: bill.balance_due,
        notes: bill.notes,
        items: bill.items || [],
        customer_name: bill.vendor_name,
      },
      business: business ? {
        business_name: business.business_name,
        business_logo: business.business_logo,
        address: business.address,
        mobile: business.mobile,
        email: business.email,
        gst_number: business.gst_number,
        pan: business.pan,
      } : null,
      customer: vendor ? {
        contact_person: vendor.contact_person,
        business_name: vendor.business_name,
        address: vendor.address,
        mobile: vendor.mobile,
        email: vendor.email,
        gst_number: vendor.gst_number,
      } : null,
      settings: pbSettings ? {
        bill_title: pbSettings.bill_title,
        template: pbSettings.template,
        header_logo: pbSettings.header_logo,
        font_family: pbSettings.font_family,
        font_size: pbSettings.font_size,
        footer_text: pbSettings.footer_text,
        signature_image: pbSettings.signature_image,
        bank_name: pbSettings.bank_name,
        bank_account: pbSettings.bank_account,
        bank_ifsc: pbSettings.bank_ifsc,
        bank_branch: pbSettings.bank_branch,
        qr_code_image: pbSettings.qr_code_image,
        terms_and_conditions: pbSettings.terms_and_conditions,
      } : null,
      payments: paymentHistory.map((p: any) => ({
        payment_date: p.payment_date,
        amount: p.amount,
        payment_method: p.payment_method,
        reference_number: p.reference_number,
      })),
      baseUrl: BASE_URL,
      assetDir: 'purchase',
      isPurchaseBill: true,
    });
  };

  const handleDownloadPDF = async () => {
    try {
      const { uri } = await Print.printToFileAsync({ html: generateHTML() });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Bill ${bill.bill_number}` });
    } catch (e: any) { Alert.alert('Error', 'Failed to generate PDF'); }
  };

  const handleShareWhatsApp = () => {
    const greet = bill.vendor_name || 'there';
    const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const dateStr = bill.bill_date ? new Date(bill.bill_date).toLocaleDateString('en-IN') : '';
    const lines = [
      `Hi ${greet},`,
      ``,
      `🧾 *Purchase Bill ${bill.bill_number}*`,
      `📅 Date: ${dateStr}`,
      `💰 Total: ${fmt(bill.total)}`,
    ];
    if (bill.balance_due > 0) lines.push(`⚠️ Balance Due: ${fmt(bill.balance_due)}`);
    if (bill.due_date) lines.push(`🗓️ Due: ${new Date(bill.due_date).toLocaleDateString('en-IN')}`);
    lines.push(``, `Thank you.`, business?.business_name ? `— ${business.business_name}` : '');
    const text = lines.filter(Boolean).join('\n');
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'WhatsApp not installed'));
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Purchase Bill ${bill.bill_number}\nVendor: ${bill.vendor_name}\nAmount: ₹${bill.total?.toFixed(2)}\nBalance Due: ₹${bill.balance_due?.toFixed(2)}\nStatus: ${bill.status}`,
        title: `Bill ${bill.bill_number}`,
      });
    } catch {}
  };

  if (!bill) return <View style={s.center}><Text>Loading...</Text></View>;

  return (
    <ScrollView style={s.container}>
      {/* Header Card */}
      <View style={s.headerCard}>
        <View style={s.headerRow}>
          <Text style={s.invNum}>{bill.bill_number}</Text>
          <StatusBadge status={bill.status} />
        </View>
        <Text style={s.custName}>{bill.vendor_name || 'N/A'}</Text>
        {bill.vendor_bill_number ? (
          <Text style={[s.dateLabel, { marginTop: 4 }]}>Vendor Bill #: <Text style={{ fontWeight: '600', color: colors.text }}>{bill.vendor_bill_number}</Text></Text>
        ) : null}
        <View style={s.dateRow}>
          <Text style={s.dateLabel}>Date: {bill.bill_date}</Text>
          <Text style={s.dateLabel}>Due: {bill.due_date || 'N/A'}</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={s.quickActions}>
        <TouchableOpacity style={s.qAction} onPress={() => setShowStatusPicker(true)}>
          <View style={[s.qIcon, { backgroundColor: colors.warning + '20' }]}><Ionicons name="flag-outline" size={20} color={colors.warning} /></View>
          <Text style={s.qLabel}>Status</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.qAction} onPress={() => navigation.navigate('PBForm', { id })}>
          <View style={[s.qIcon, { backgroundColor: colors.primary + '20' }]}><Ionicons name="create-outline" size={20} color={colors.primary} /></View>
          <Text style={s.qLabel}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.qAction} onPress={handleDownloadPDF}>
          <View style={[s.qIcon, { backgroundColor: colors.success + '20' }]}><Ionicons name="download-outline" size={20} color={colors.success} /></View>
          <Text style={s.qLabel}>PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.qAction} onPress={handleShareWhatsApp}>
          <View style={[s.qIcon, { backgroundColor: '#25D366' + '20' }]}><Ionicons name="logo-whatsapp" size={20} color="#25D366" /></View>
          <Text style={s.qLabel}>WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.qAction} onPress={handleShare}>
          <View style={[s.qIcon, { backgroundColor: colors.info + '20' }]}><Ionicons name="share-outline" size={20} color={colors.info || colors.primary} /></View>
          <Text style={s.qLabel}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Payment button */}
      {bill.balance_due > 0 && (
        <TouchableOpacity style={s.payBtn} onPress={() => { setPayAmount(String(bill.balance_due)); setShowPayment(true); }}>
          <Ionicons name="cash-outline" size={20} color={colors.white} />
          <Text style={s.payText}>Record Payment — ₹{bill.balance_due?.toFixed(2)} due</Text>
        </TouchableOpacity>
      )}

      {/* Line Items */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Items ({(bill.items || []).length})</Text>
        {(bill.items || []).map((item: any, i: number) => (
          <View key={i} style={s.lineItem}>
            <View style={s.lineNum}><Text style={s.lineNumText}>{i + 1}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.itemName}>{item.item_name}</Text>
              {item.serial_numbers ? <Text style={{ fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#2563eb', marginTop: 1 }}>S/N: {item.serial_numbers}</Text> : null}
              <Text style={s.itemSub}>
                {item.qty} {item.unit || 'Nos'} × ₹{item.rate?.toFixed(2)}
                {item.discount_percent > 0 ? ` • ${item.discount_percent}% off` : ''}
                {item.tax_rate > 0 ? ` • Tax ${item.tax_rate}%` : ''}
              </Text>
            </View>
            <CurrencyText amount={item.amount} style={s.itemAmt} />
          </View>
        ))}
      </View>

      {/* Summary */}
      <View style={s.section}>
        <View style={s.sumRow}><Text style={s.sumLabel}>Subtotal</Text><CurrencyText amount={bill.subtotal} style={s.sumValue} /></View>
        {bill.discount_value > 0 && <View style={s.sumRow}><Text style={s.sumLabel}>Discount ({bill.discount_type === 'percentage' ? `${bill.discount_value}%` : 'Flat'})</Text><Text style={s.sumValue}>-₹{(bill.discount_type === 'percentage' ? (bill.subtotal * bill.discount_value / 100) : bill.discount_value)?.toFixed(2)}</Text></View>}
        <View style={s.sumRow}><Text style={s.sumLabel}>Tax</Text><CurrencyText amount={bill.tax_amount} style={s.sumValue} /></View>
        <View style={[s.sumRow, s.totalRow]}><Text style={s.totalLabel}>Total</Text><CurrencyText amount={bill.total} style={s.totalValue} /></View>
        <View style={s.sumRow}><Text style={s.sumLabel}>Amount Paid</Text><CurrencyText amount={bill.amount_paid} style={[s.sumValue, { color: colors.success }]} /></View>
        <View style={s.sumRow}><Text style={[s.sumLabel, { fontWeight: '700' }]}>Balance Due</Text><CurrencyText amount={bill.balance_due} style={[s.sumValue, { color: colors.danger, fontWeight: '700' }]} /></View>
      </View>

      {/* Notes */}
      {bill.notes ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Notes</Text>
          <Text style={s.notes}>{bill.notes}</Text>
        </View>
      ) : null}

      {/* More Actions */}
      <View style={s.moreActions}>
        <TouchableOpacity style={s.moreBtn} onPress={handleDuplicate}>
          <Ionicons name="copy-outline" size={18} color={colors.gray600} />
          <Text style={s.moreBtnText}>Duplicate Purchase Bill</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.moreBtn, { borderColor: colors.danger }]} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={[s.moreBtnText, { color: colors.danger }]}>Delete Purchase Bill</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />

      {/* Status Picker Modal */}
      <Modal visible={showStatusPicker} transparent animationType="fade" onRequestClose={() => setShowStatusPicker(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowStatusPicker(false)}>
          <View style={s.statusModal}>
            <Text style={s.modalTitle}>Change Status</Text>
            {STATUS_OPTIONS.map(st => (
              <TouchableOpacity key={st} style={[s.statusOption, bill.status === st && { backgroundColor: colors.primary + '10' }]} onPress={() => changeStatus(st)}>
                <StatusBadge status={st} />
                {bill.status === st && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Payment Modal */}
      <Modal visible={showPayment} transparent animationType="slide" onRequestClose={() => setShowPayment(false)}>
        <View style={s.modalOverlay}>
          <View style={s.payModal}>
            <Text style={s.modalTitle}>Record Payment</Text>
            <Text style={s.modalSub}>Balance Due: ₹{bill.balance_due?.toLocaleString('en-IN')}</Text>
            <Text style={s.fieldLabel}>Amount</Text>
            <TextInput style={s.modalInput} value={payAmount} onChangeText={setPayAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.placeholder} />
            <Text style={s.fieldLabel}>Payment Method</Text>
            <View style={s.methodRow}>
              {['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card'].map(m => (
                <TouchableOpacity key={m} style={[s.methodBtn, payMethod === m && s.methodActive]} onPress={() => setPayMethod(m)}>
                  <Text style={[s.methodText, payMethod === m && s.methodActiveText]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.fieldLabel}>Reference (Optional)</Text>
            <TextInput style={s.modalInput} value={payRef} onChangeText={setPayRef} placeholder="Txn ID / Cheque #" placeholderTextColor={colors.placeholder} />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setShowPayment(false)}>
                <Text style={{ color: colors.gray600 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalConfirm, payLoading && { opacity: 0.6 }]} onPress={recordPayment} disabled={payLoading}>
                <Text style={{ color: colors.white, fontWeight: '600' }}>{payLoading ? 'Saving...' : 'Confirm Payment'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerCard: { backgroundColor: colors.white, padding: spacing.lg, marginBottom: spacing.sm },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invNum: { fontSize: fontSize.xl, fontWeight: '700', color: colors.primary },
  custName: { fontSize: fontSize.md, color: colors.text, marginTop: spacing.xs },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  dateLabel: { fontSize: fontSize.sm, color: colors.gray500 },

  quickActions: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.white, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, marginBottom: spacing.sm },
  qAction: { width: '20%', alignItems: 'center', paddingVertical: spacing.sm },
  qIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  qLabel: { fontSize: 10, color: colors.gray600, fontWeight: '500' },

  payBtn: { flexDirection: 'row', backgroundColor: colors.success, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.md, padding: spacing.md, justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  payText: { color: colors.white, fontWeight: '700', fontSize: fontSize.md },

  section: { backgroundColor: colors.white, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.md, padding: spacing.md },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  lineItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  lineNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.gray100, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
  lineNumText: { fontSize: 11, fontWeight: '600', color: colors.gray500 },
  itemName: { fontSize: fontSize.md, fontWeight: '500', color: colors.text },
  itemSub: { fontSize: fontSize.xs, color: colors.gray500, marginTop: 2 },
  itemAmt: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },

  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  sumLabel: { fontSize: fontSize.sm, color: colors.gray500 },
  sumValue: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.gray200, paddingTop: spacing.sm, marginTop: spacing.xs },
  totalLabel: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: fontSize.lg, fontWeight: '700', color: colors.primary },

  notes: { fontSize: fontSize.sm, color: colors.gray600, lineHeight: 20 },

  moreActions: { paddingHorizontal: spacing.md, gap: spacing.sm },
  moreBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.gray200, borderRadius: borderRadius.md, padding: spacing.md },
  moreBtnText: { fontSize: fontSize.md, color: colors.gray600, fontWeight: '500' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  statusModal: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg },
  statusOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: spacing.sm, borderRadius: borderRadius.sm },
  payModal: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg },
  modalTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  modalSub: { fontSize: fontSize.sm, color: colors.gray500, marginBottom: spacing.md },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700, marginTop: spacing.md, marginBottom: spacing.xs },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, padding: spacing.md, fontSize: fontSize.md, color: colors.text },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  methodBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.border },
  methodActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  methodText: { fontSize: fontSize.sm, color: colors.gray600 },
  methodActiveText: { color: colors.white, fontWeight: '600' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.lg, gap: spacing.md },
  modalCancel: { padding: spacing.md },
  modalConfirm: { flexDirection: 'row', backgroundColor: colors.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: 'center' },
});
