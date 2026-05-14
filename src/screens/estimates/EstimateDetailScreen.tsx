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
import { buildDocumentHTML } from '../../lib/document-templates';

const STATUS_OPTIONS = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'];

const SERVICE_COLOR: Record<string, string> = {
  Repair: '#ef4444', AMC: '#8b5cf6', Installation: '#3b82f6',
  Maintenance: '#f59e0b', Inspection: '#10b981', Other: '#6b7280',
};

export default function EstimateDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const toast = useToast();
  const { id } = route.params;
  const [est, setEst] = useState<any>(null);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [business, setBusiness] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);

  const fetchData = async () => {
    try {
      const r = await api.get(`/api/estimates/${id}`);
      const e = r.data;
      setEst(e);
      try {
        const biz = await api.get(`/api/business/${e.org_id}`);
        setBusiness(biz.data);
      } catch {
        const all = await api.get('/api/business');
        if (all.data?.[0]) setBusiness(all.data[0]);
      }
      try {
        const s = await api.get(`/api/estimate-settings?org_id=${e.org_id}`);
        setSettings(s.data);
      } catch {}
      if (e.customer_id) {
        try { const c = await api.get(`/api/customers/${e.customer_id}`); setCustomer(c.data); } catch {}
      }
    } catch {}
  };

  useEffect(() => { fetchData(); }, [id]);
  useEffect(() => { navigation.addListener('focus', fetchData); }, [navigation]);

  const changeStatus = async (status: string) => {
    try {
      await api.patch(`/api/estimates/${id}/status?status=${status}`);
      setShowStatusPicker(false);
      fetchData();
      toast.success(`Status changed to ${status}`);
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); }
  };

  const handleDuplicate = () => {
    Alert.alert('Duplicate', 'Create a copy of this estimate?', [
      { text: 'Cancel' },
      { text: 'Duplicate', onPress: () => navigation.navigate('EstimateForm', { duplicate: id }) },
    ]);
  };

  const handleConvertToInvoice = async () => {
    Alert.alert('Convert to Invoice', 'Create an invoice from this estimate?', [
      { text: 'Cancel' },
      { text: 'Convert', onPress: async () => {
        try {
          const biz = await api.get('/api/business');
          const oid = biz.data[0]?.org_id;
          const body = {
            org_id: oid,
            customer_id: est.customer_id,
            invoice_date: new Date().toISOString().split('T')[0],
            due_date: null,
            notes: est.notes,
            discount_type: est.discount_type || 'flat',
            discount_value: est.discount_value || 0,
            items: (est.items || []).map((it: any) => ({
              item_id: it.item_id,
              item_name: it.item_name,
              description: it.description || '',
              hsn_code: it.hsn_code || '',
              unit: it.unit || 'Nos',
              qty: it.qty,
              rate: it.rate,
              discount_percent: it.discount_percent || 0,
              tax_rate: est.gst_enabled !== false ? (it.tax_rate || 0) : 0,
              serial_numbers: it.serial_numbers || '',
            })),
          };
          const res = await api.post('/api/invoices', body);
          toast.success('Invoice created');
          // Navigate to invoice detail
          const parent = navigation.getParent();
          if (parent) {
            parent.navigate('Invoices', { screen: 'InvoiceDetail', params: { id: res.data.id } });
          }
        } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed to create invoice'); }
      }},
    ]);
  };

  const handleConvertToQuotation = async () => {
    Alert.alert('Convert to Quotation', 'Create a quotation from this estimate?', [
      { text: 'Cancel' },
      { text: 'Convert', onPress: async () => {
        try {
          const biz = await api.get('/api/business');
          const oid = biz.data[0]?.org_id;
          const body = {
            org_id: oid,
            customer_id: est.customer_id,
            quotation_date: new Date().toISOString().split('T')[0],
            valid_until: est.valid_until || null,
            notes: est.notes,
            discount_type: est.discount_type || 'flat',
            discount_value: est.discount_value || 0,
            items: (est.items || []).map((it: any) => ({
              item_id: it.item_id,
              item_name: it.item_name,
              description: it.description || '',
              hsn_code: it.hsn_code || '',
              unit: it.unit || 'Nos',
              qty: it.qty,
              rate: it.rate,
              discount_percent: it.discount_percent || 0,
              tax_rate: est.gst_enabled !== false ? (it.tax_rate || 0) : 0,
            })),
          };
          const res = await api.post('/api/quotations', body);
          toast.success('Quotation created');
          const parent = navigation.getParent();
          if (parent) {
            parent.navigate('Quotations', { screen: 'QuotationDetail', params: { id: res.data.id } });
          }
        } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed to create quotation'); }
      }},
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Delete', 'Delete this estimate?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/api/estimates/${id}`); toast.success('Estimate deleted'); navigation.goBack(); } catch {}
      }},
    ]);
  };

  const generateHTML = () => {
    if (!est) return '';
    return buildDocumentHTML({
      doc: { ...est, invoice_number: est.estimate_number, invoice_date: est.estimate_date },
      business,
      customer,
      settings: { ...(settings || {}), quote_title: 'Estimate' },
      baseUrl: BASE_URL,
      assetDir: 'quotation',
      isQuotation: true,
    });
  };

  const handleDownloadPDF = async () => {
    try {
      const html = generateHTML();
      if (!html) { Alert.alert('Error', 'Estimate not loaded'); return; }
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Estimate ${est.estimate_number}` });
    } catch (e: any) {
      Alert.alert('Error', `Failed to generate PDF: ${e?.message || String(e)}`);
    }
  };

  const handleShareWhatsApp = () => {
    const greet = est.customer_name || 'there';
    const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const dateStr = est.estimate_date ? new Date(est.estimate_date).toLocaleDateString('en-IN') : '';
    const lines = [
      `Hi ${greet},`,
      ``,
      `📋 *Estimate ${est.estimate_number}*`,
      `📅 Date: ${dateStr}`,
    ];
    if (est.service_type) lines.push(`🔧 Service: ${est.service_type}`);
    if (est.valid_until) lines.push(`⏳ Valid Until: ${new Date(est.valid_until).toLocaleDateString('en-IN')}`);
    lines.push(`💰 Total: ${fmt(est.total)}`);
    if (est.gst_enabled === false) lines.push(`ℹ️ No GST applied`);
    lines.push(``, `Looking forward to your confirmation.`, business?.business_name ? `— ${business.business_name}` : '');
    const text = lines.filter(Boolean).join('\n');
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'WhatsApp not installed'));
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Estimate ${est.estimate_number}\nCustomer: ${est.customer_name}\nAmount: ₹${est.total?.toFixed(2)}\nStatus: ${est.status}`,
        title: `Estimate ${est.estimate_number}`,
      });
    } catch {}
  };

  const handleSendEmail = async () => {
    if (!emailTo) return Alert.alert('Error', 'Enter email address');
    setEmailSending(true);
    try {
      await api.post(`/api/estimates/${id}/send-email`, { to_email: emailTo, to_name: est.customer_name });
      toast.success('Estimate sent via email');
      setShowEmailModal(false);
      setEmailTo('');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to send');
    } finally { setEmailSending(false); }
  };

  if (!est) return <View style={s.center}><Text>Loading...</Text></View>;

  const svcColor = SERVICE_COLOR[est.service_type] || '#6b7280';

  return (
    <ScrollView style={s.container}>
      {/* Header Card */}
      <View style={s.headerCard}>
        <View style={s.headerRow}>
          <Text style={s.invNum}>{est.estimate_number}</Text>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            {est.gst_enabled === false && (
              <View style={{ backgroundColor: '#f59e0b20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#f59e0b' }}>No GST</Text>
              </View>
            )}
            <StatusBadge status={est.status} />
          </View>
        </View>
        <Text style={s.custName}>{est.customer_name || 'N/A'}</Text>
        <View style={s.dateRow}>
          <Text style={s.dateLabel}>Date: {est.estimate_date}</Text>
          <Text style={s.dateLabel}>Valid: {est.valid_until || 'N/A'}</Text>
        </View>
      </View>

      {/* Service Info Cards */}
      {(est.service_type || est.estimated_days || est.warranty_terms) && (
        <View style={s.svcRow}>
          {est.service_type ? (
            <View style={[s.svcCard, { borderColor: svcColor + '40' }]}>
              <Ionicons name="construct-outline" size={16} color={svcColor} />
              <Text style={[s.svcCardLabel, { color: svcColor }]}>{est.service_type}</Text>
            </View>
          ) : null}
          {est.estimated_days ? (
            <View style={[s.svcCard, { borderColor: '#3b82f640' }]}>
              <Ionicons name="time-outline" size={16} color="#3b82f6" />
              <Text style={[s.svcCardLabel, { color: '#3b82f6' }]}>{est.estimated_days} days</Text>
            </View>
          ) : null}
          {est.warranty_terms ? (
            <View style={[s.svcCard, { borderColor: '#10b98140' }]}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#10b981" />
              <Text style={[s.svcCardLabel, { color: '#10b981' }]} numberOfLines={1}>{est.warranty_terms}</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Quick Actions */}
      <View style={s.quickActions}>
        <TouchableOpacity style={s.qAction} onPress={() => setShowStatusPicker(true)}>
          <View style={[s.qIcon, { backgroundColor: colors.warning + '20' }]}><Ionicons name="flag-outline" size={20} color={colors.warning} /></View>
          <Text style={s.qLabel}>Status</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.qAction} onPress={() => navigation.navigate('EstimateForm', { id })}>
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
        <TouchableOpacity style={s.qAction} onPress={() => { setEmailTo(customer?.email || ''); setShowEmailModal(true); }}>
          <View style={[s.qIcon, { backgroundColor: colors.accent + '20' }]}><Ionicons name="mail-outline" size={20} color={colors.accent} /></View>
          <Text style={s.qLabel}>Email</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.qAction} onPress={handleShare}>
          <View style={[s.qIcon, { backgroundColor: (colors.info || colors.primary) + '20' }]}><Ionicons name="share-outline" size={20} color={colors.info || colors.primary} /></View>
          <Text style={s.qLabel}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Convert Buttons */}
      <View style={{ paddingHorizontal: spacing.md, gap: 8, marginBottom: spacing.sm }}>
        <TouchableOpacity style={s.convertBtn} onPress={handleConvertToInvoice}>
          <Ionicons name="document-text-outline" size={18} color={colors.white} />
          <Text style={s.convertText}>Convert to Invoice</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.convertBtn, { backgroundColor: '#8b5cf6' }]} onPress={handleConvertToQuotation}>
          <Ionicons name="document-outline" size={18} color={colors.white} />
          <Text style={s.convertText}>Convert to Quotation</Text>
        </TouchableOpacity>
      </View>

      {/* Line Items */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Items ({(est.items || []).length})</Text>
        {(est.items || []).map((item: any, i: number) => (
          <View key={i} style={s.lineItem}>
            <View style={s.lineNum}><Text style={s.lineNumText}>{i + 1}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.itemName}>{item.item_name}</Text>
              <Text style={s.itemSub}>
                {item.qty} {item.unit || 'Nos'} × ₹{item.rate?.toFixed(2)}
                {item.discount_percent > 0 ? ` • ${item.discount_percent}% off` : ''}
                {est.gst_enabled !== false && item.tax_rate > 0 ? ` • Tax ${item.tax_rate}%` : ''}
              </Text>
              {item.serial_numbers ? <Text style={s.serialText}>S/N: {item.serial_numbers}</Text> : null}
            </View>
            <CurrencyText amount={item.amount} style={s.itemAmt} />
          </View>
        ))}
      </View>

      {/* Summary */}
      <View style={s.section}>
        <View style={s.sumRow}><Text style={s.sumLabel}>Subtotal</Text><CurrencyText amount={est.subtotal} style={s.sumValue} /></View>
        {est.discount_value > 0 && (
          <View style={s.sumRow}>
            <Text style={s.sumLabel}>Discount ({est.discount_type === 'percentage' ? `${est.discount_value}%` : 'Flat'})</Text>
            <Text style={s.sumValue}>-₹{(est.discount_type === 'percentage' ? (est.subtotal * est.discount_value / 100) : est.discount_value)?.toFixed(2)}</Text>
          </View>
        )}
        {est.gst_enabled !== false ? (
          <View style={s.sumRow}><Text style={s.sumLabel}>Tax</Text><CurrencyText amount={est.tax_amount} style={s.sumValue} /></View>
        ) : (
          <View style={s.sumRow}><Text style={[s.sumLabel, { color: '#f59e0b' }]}>No GST applied</Text><Text style={s.sumValue}>—</Text></View>
        )}
        <View style={[s.sumRow, s.totalRow]}>
          <Text style={s.totalLabel}>Total</Text>
          <CurrencyText amount={est.total} style={s.totalValue} />
        </View>
      </View>

      {/* Notes */}
      {est.notes ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Notes</Text>
          <Text style={s.notes}>{est.notes}</Text>
        </View>
      ) : null}

      {/* More Actions */}
      <View style={s.moreActions}>
        <TouchableOpacity style={s.moreBtn} onPress={handleDuplicate}>
          <Ionicons name="copy-outline" size={18} color={colors.gray600} />
          <Text style={s.moreBtnText}>Duplicate Estimate</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.moreBtn, { borderColor: colors.danger }]} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={[s.moreBtnText, { color: colors.danger }]}>Delete Estimate</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />

      {/* Status Picker Modal */}
      <Modal visible={showStatusPicker} transparent animationType="fade" onRequestClose={() => setShowStatusPicker(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowStatusPicker(false)}>
          <View style={s.statusModal}>
            <Text style={s.modalTitle}>Change Status</Text>
            {STATUS_OPTIONS.map(st => (
              <TouchableOpacity key={st} style={[s.statusOption, est.status === st && { backgroundColor: colors.primary + '10' }]} onPress={() => changeStatus(st)}>
                <StatusBadge status={st} />
                {est.status === st && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Email Modal */}
      <Modal visible={showEmailModal} transparent animationType="slide" onRequestClose={() => setShowEmailModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.payModal}>
            <Text style={s.modalTitle}>Send Estimate via Email</Text>
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

  svcRow: { flexDirection: 'row', paddingHorizontal: spacing.md, marginBottom: spacing.sm, gap: 8, flexWrap: 'wrap' },
  svcCard: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: borderRadius.md, borderWidth: 1,
  },
  svcCardLabel: { fontSize: 12, fontWeight: '700' },

  quickActions: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.white, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, marginBottom: spacing.sm },
  qAction: { width: '16.66%', alignItems: 'center', paddingVertical: spacing.sm },
  qIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  qLabel: { fontSize: 10, color: colors.gray600, fontWeight: '500' },

  convertBtn: { flexDirection: 'row', backgroundColor: colors.primary, borderRadius: borderRadius.md, padding: spacing.md, justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  convertText: { color: colors.white, fontWeight: '700', fontSize: fontSize.md },

  section: { backgroundColor: colors.white, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.md, padding: spacing.md },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  lineItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  lineNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.gray100, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
  lineNumText: { fontSize: 11, fontWeight: '600', color: colors.gray500 },
  itemName: { fontSize: fontSize.md, fontWeight: '500', color: colors.text },
  itemSub: { fontSize: fontSize.xs, color: colors.gray500, marginTop: 2 },
  serialText: { fontSize: 10, color: colors.gray400, marginTop: 2, fontStyle: 'italic' },
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
