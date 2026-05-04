import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput, Modal, Share, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import api, { BASE_URL } from '../../api/client';
import { useToast } from '../../components/Toast';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import StatusBadge from '../../components/StatusBadge';
import CurrencyText from '../../components/CurrencyText';

const STATUS_OPTIONS = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'];

export default function QuotationDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const toast = useToast();
  const { id } = route.params;
  const [quote, setQuote] = useState<any>(null);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [business, setBusiness] = useState<any>(null);

  const fetchQuote = async () => {
    try {
      const r = await api.get(`/api/quotations/${id}`);
      setQuote(r.data);
      const biz = await api.get('/api/business');
      if (biz.data[0]) setBusiness(biz.data[0]);
    } catch {}
  };

  useEffect(() => { fetchQuote(); }, [id]);
  useEffect(() => { navigation.addListener('focus', fetchQuote); }, [navigation]);

  const changeStatus = async (status: string) => {
    try {
      await api.patch(`/api/quotations/${id}/status?status=${status}`);
      setShowStatusPicker(false);
      fetchQuote();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); }
  };

  const handleDuplicate = () => {
    Alert.alert('Duplicate', 'Create a copy of this quotation?', [
      { text: 'Cancel' },
      { text: 'Duplicate', onPress: () => navigation.navigate('QuotationForm', { duplicate: id }) },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Delete', 'Delete this quotation?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/api/quotations/${id}`); navigation.goBack(); } catch {}
      }},
    ]);
  };

  const generateHTML = () => {
    if (!quote) return '';
    const items = (quote.items || []).map((it: any, i: number) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${i + 1}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${it.item_name}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${it.qty}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">₹${it.rate?.toFixed(2)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${it.tax_rate || 0}%</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">₹${it.amount?.toFixed(2)}</td>
      </tr>`).join('');

    return `<html><head><meta charset="utf-8"><style>
      body{font-family:Helvetica,Arial;margin:0;padding:20px;color:#333}
      .header{display:flex;justify-content:space-between;margin-bottom:24px}
      .title{font-size:28px;font-weight:700;color:#1a1a40}
      .info{font-size:13px;color:#666;margin-top:4px}
      table{width:100%;border-collapse:collapse;margin:16px 0}
      th{background:#1a1a40;color:#fff;padding:10px 8px;text-align:left;font-size:13px}
      .summary{margin-left:auto;width:280px}
      .sum-row{display:flex;justify-content:space-between;padding:4px 0;font-size:14px}
      .total-row{border-top:2px solid #1a1a40;font-weight:700;font-size:16px;padding-top:8px;margin-top:4px}
      .badge{display:inline-block;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600}
    </style></head><body>
      <div class="header">
        <div>
          <div class="title">${business?.business_name || 'Quotation'}</div>
          <div class="info">${business?.address || ''}</div>
          <div class="info">${business?.mobile || ''} ${business?.email ? '• ' + business.email : ''}</div>
          ${business?.gst_number ? `<div class="info">GSTIN: ${business.gst_number}</div>` : ''}
        </div>
        <div style="text-align:right">
          <div style="font-size:22px;font-weight:700;color:#1a1a40">QUOTATION</div>
          <div class="info">${quote.quotation_number}</div>
          <div class="info">Date: ${quote.quotation_date}</div>
          ${quote.valid_until ? `<div class="info">Valid Until: ${quote.valid_until}</div>` : ''}
          <div><span class="badge" style="background:${quote.status === 'Accepted' ? '#16a34a' : quote.status === 'Rejected' ? '#dc2626' : '#f59e0b'};color:#fff">${quote.status}</span></div>
        </div>
      </div>
      <div style="margin-bottom:16px">
        <div style="font-size:13px;color:#666">Bill To</div>
        <div style="font-size:16px;font-weight:600">${quote.customer_name || 'N/A'}</div>
      </div>
      <table>
        <tr><th>#</th><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:center">Tax</th><th style="text-align:right">Amount</th></tr>
        ${items}
      </table>
      <div class="summary">
        <div class="sum-row"><span>Subtotal</span><span>₹${quote.subtotal?.toFixed(2)}</span></div>
        ${quote.discount_value > 0 ? `<div class="sum-row"><span>Discount</span><span>-₹${quote.discount_value?.toFixed(2)}</span></div>` : ''}
        <div class="sum-row"><span>Tax</span><span>₹${quote.tax_amount?.toFixed(2)}</span></div>
        <div class="sum-row total-row"><span>Total</span><span>₹${quote.total?.toFixed(2)}</span></div>
      </div>
      ${quote.notes ? `<div style="margin-top:20px;padding:12px;background:#f9fafb;border-radius:8px"><div style="font-size:12px;color:#666;margin-bottom:4px">Notes</div><div style="font-size:13px">${quote.notes}</div></div>` : ''}
    </body></html>`;
  };

  const handleDownloadPDF = async () => {
    try {
      const { uri } = await Print.printToFileAsync({ html: generateHTML() });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Quotation ${quote.quotation_number}` });
    } catch (e: any) { Alert.alert('Error', 'Failed to generate PDF'); }
  };

  const handleShareWhatsApp = () => {
    const greet = quote.customer_name || 'there';
    const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const dateStr = quote.quotation_date ? new Date(quote.quotation_date).toLocaleDateString('en-IN') : '';
    const lines = [
      `Hi ${greet},`,
      ``,
      `📋 *Quotation ${quote.quotation_number}*`,
      `📅 Date: ${dateStr}`,
    ];
    if (quote.valid_until) lines.push(`⏳ Valid Until: ${new Date(quote.valid_until).toLocaleDateString('en-IN')}`);
    lines.push(`💰 Total: ${fmt(quote.total)}`);
    lines.push(``, `Looking forward to your confirmation.`, business?.business_name ? `— ${business.business_name}` : '');
    const text = lines.filter(Boolean).join('\n');
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'WhatsApp not installed'));
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Quotation ${quote.quotation_number}\nCustomer: ${quote.customer_name}\nAmount: ₹${quote.total?.toFixed(2)}\nStatus: ${quote.status}`,
        title: `Quotation ${quote.quotation_number}`,
      });
    } catch {}
  };

  const handleSendEmail = async () => {
    if (!emailTo) return Alert.alert('Error', 'Enter email address');
    setEmailSending(true);
    try {
      await api.post(`/api/quotations/${id}/send-email`, { to_email: emailTo, to_name: quote.customer_name });
      toast.success('Quotation sent via email');
      setShowEmailModal(false);
      setEmailTo('');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to send');
    } finally { setEmailSending(false); }
  };

  if (!quote) return <View style={s.center}><Text>Loading...</Text></View>;

  return (
    <ScrollView style={s.container}>
      {/* Header Card */}
      <View style={s.headerCard}>
        <View style={s.headerRow}>
          <Text style={s.invNum}>{quote.quotation_number}</Text>
          <StatusBadge status={quote.status} />
        </View>
        <Text style={s.custName}>{quote.customer_name || 'N/A'}</Text>
        <View style={s.dateRow}>
          <Text style={s.dateLabel}>Date: {quote.quotation_date}</Text>
          <Text style={s.dateLabel}>Valid: {quote.valid_until || 'N/A'}</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={s.quickActions}>
        <TouchableOpacity style={s.qAction} onPress={() => setShowStatusPicker(true)}>
          <View style={[s.qIcon, { backgroundColor: colors.warning + '20' }]}><Ionicons name="flag-outline" size={20} color={colors.warning} /></View>
          <Text style={s.qLabel}>Status</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.qAction} onPress={() => navigation.navigate('QuotationForm', { id })}>
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
        <TouchableOpacity style={s.qAction} onPress={() => { setEmailTo(quote.customer_email || ''); setShowEmailModal(true); }}>
          <View style={[s.qIcon, { backgroundColor: colors.accent + '20' }]}><Ionicons name="mail-outline" size={20} color={colors.accent} /></View>
          <Text style={s.qLabel}>Email</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.qAction} onPress={handleShare}>
          <View style={[s.qIcon, { backgroundColor: colors.info + '20' }]}><Ionicons name="share-outline" size={20} color={colors.info || colors.primary} /></View>
          <Text style={s.qLabel}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Convert to Invoice */}
      <TouchableOpacity style={s.convertBtn} onPress={() => navigation.navigate('InvoiceForm', {})}>
        <Ionicons name="swap-horizontal-outline" size={20} color={colors.white} />
        <Text style={s.convertText}>Convert to Invoice</Text>
      </TouchableOpacity>

      {/* Line Items */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Items ({(quote.items || []).length})</Text>
        {(quote.items || []).map((item: any, i: number) => (
          <View key={i} style={s.lineItem}>
            <View style={s.lineNum}><Text style={s.lineNumText}>{i + 1}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.itemName}>{item.item_name}</Text>
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
        <View style={s.sumRow}><Text style={s.sumLabel}>Subtotal</Text><CurrencyText amount={quote.subtotal} style={s.sumValue} /></View>
        {quote.discount_value > 0 && <View style={s.sumRow}><Text style={s.sumLabel}>Discount ({quote.discount_type === 'percentage' ? `${quote.discount_value}%` : 'Flat'})</Text><Text style={s.sumValue}>-₹{(quote.discount_type === 'percentage' ? (quote.subtotal * quote.discount_value / 100) : quote.discount_value)?.toFixed(2)}</Text></View>}
        <View style={s.sumRow}><Text style={s.sumLabel}>Tax</Text><CurrencyText amount={quote.tax_amount} style={s.sumValue} /></View>
        <View style={[s.sumRow, s.totalRow]}><Text style={s.totalLabel}>Total</Text><CurrencyText amount={quote.total} style={s.totalValue} /></View>
      </View>

      {/* Notes */}
      {quote.notes ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Notes</Text>
          <Text style={s.notes}>{quote.notes}</Text>
        </View>
      ) : null}

      {/* More Actions */}
      <View style={s.moreActions}>
        <TouchableOpacity style={s.moreBtn} onPress={handleDuplicate}>
          <Ionicons name="copy-outline" size={18} color={colors.gray600} />
          <Text style={s.moreBtnText}>Duplicate Quotation</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.moreBtn, { borderColor: colors.danger }]} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={[s.moreBtnText, { color: colors.danger }]}>Delete Quotation</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />

      {/* Status Picker Modal */}
      <Modal visible={showStatusPicker} transparent animationType="fade" onRequestClose={() => setShowStatusPicker(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowStatusPicker(false)}>
          <View style={s.statusModal}>
            <Text style={s.modalTitle}>Change Status</Text>
            {STATUS_OPTIONS.map(st => (
              <TouchableOpacity key={st} style={[s.statusOption, quote.status === st && { backgroundColor: colors.primary + '10' }]} onPress={() => changeStatus(st)}>
                <StatusBadge status={st} />
                {quote.status === st && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Email Modal */}
      <Modal visible={showEmailModal} transparent animationType="slide" onRequestClose={() => setShowEmailModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.payModal}>
            <Text style={s.modalTitle}>Send Quotation via Email</Text>
            <Text style={s.fieldLabel}>Recipient Email</Text>
            <TextInput style={s.modalInput} value={emailTo} onChangeText={setEmailTo} keyboardType="email-address" autoCapitalize="none" placeholder="email@example.com" placeholderTextColor={colors.placeholder} />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setShowEmailModal(false)}>
                <Text style={{ color: colors.gray600 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalConfirm, emailSending && { opacity: 0.6 }]} onPress={handleSendEmail} disabled={emailSending}>
                <Ionicons name="send" size={16} color={colors.white} />
                <Text style={{ color: colors.white, fontWeight: '600', marginLeft: 6 }}>{emailSending ? 'Sending...' : 'Send'}</Text>
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
  qAction: { width: '16.66%', alignItems: 'center', paddingVertical: spacing.sm },
  qIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  qLabel: { fontSize: 10, color: colors.gray600, fontWeight: '500' },

  convertBtn: { flexDirection: 'row', backgroundColor: colors.primary, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.md, padding: spacing.md, justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  convertText: { color: colors.white, fontWeight: '700', fontSize: fontSize.md },

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
  fieldLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700, marginTop: spacing.md, marginBottom: spacing.xs },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, padding: spacing.md, fontSize: fontSize.md, color: colors.text },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.lg, gap: spacing.md },
  modalCancel: { padding: spacing.md },
  modalConfirm: { flexDirection: 'row', backgroundColor: colors.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: 'center' },
});
