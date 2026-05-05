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

const STATUS_OPTIONS = ['Draft', 'Sent', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled'];

export default function InvoiceDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const toast = useToast();
  const { id } = route.params;
  const [invoice, setInvoice] = useState<any>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payRef, setPayRef] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [business, setBusiness] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);

  const fetchInvoice = async () => {
    try {
      const r = await api.get(`/api/invoices/${id}`);
      const inv = r.data;
      setInvoice(inv);
      // business by org
      try {
        const biz = await api.get(`/api/business/${inv.org_id}`);
        setBusiness(biz.data);
      } catch {
        const all = await api.get('/api/business');
        if (all.data?.[0]) setBusiness(all.data[0]);
      }
      // invoice settings
      try {
        const s = await api.get(`/api/invoice-settings?org_id=${inv.org_id}`);
        setSettings(s.data);
      } catch {}
      // customer
      if (inv.customer_id) {
        try {
          const c = await api.get(`/api/customers/${inv.customer_id}`);
          setCustomer(c.data);
        } catch {}
      }
      // payment history
      const ph = await api.get(`/api/payments/invoice/${id}`);
      setPayments(Array.isArray(ph.data) ? ph.data : []);
    } catch {}
  };

  useEffect(() => { fetchInvoice(); }, [id]);
  useEffect(() => { navigation.addListener('focus', fetchInvoice); }, [navigation]);

  const changeStatus = async (status: string) => {
    try {
      await api.patch(`/api/invoices/${id}/status?status=${status}`);
      setShowStatusPicker(false);
      fetchInvoice();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); }
  };

  const recordPayment = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return Alert.alert('Error', 'Enter valid amount');
    if (amt > (invoice.balance_due || 0)) return Alert.alert('Error', 'Amount exceeds balance');
    setPayLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await api.post('/api/payments', {
        org_id: invoice.org_id,
        customer_id: invoice.customer_id,
        invoice_id: Number(id),
        payment_date: today,
        amount: amt,
        payment_method: payMethod,
        reference_number: payRef || null,
      });
      setShowPayment(false);
      setPayAmount('');
      setPayRef('');
      fetchInvoice();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally { setPayLoading(false); }
  };

  const handleDuplicate = () => {
    Alert.alert('Duplicate', 'Create a copy of this invoice?', [
      { text: 'Cancel' },
      { text: 'Duplicate', onPress: () => navigation.navigate('InvoiceForm', { duplicate: id }) },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Delete', 'Delete this invoice?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/api/invoices/${id}`); navigation.goBack(); } catch {}
      }},
    ]);
  };

  const generateHTML = () => {
    if (!invoice) return '';
    return buildDocumentHTML({
      doc: invoice,
      business,
      customer,
      settings,
      payments,
      baseUrl: BASE_URL,
      assetDir: 'invoice',
    });
  };

  const handleDownloadPDF = async () => {
    try {
      const html = generateHTML();
      if (!html) { Alert.alert('Error', 'Invoice not loaded yet'); return; }
      console.log('[PDF] template=', settings?.template, 'html length=', html.length);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Invoice ${invoice.invoice_number}` });
    } catch (e: any) {
      console.log('[PDF] error', e);
      Alert.alert('Error', `Failed to generate PDF: ${e?.message || String(e)}`);
    }
  };

  const handleShareWhatsApp = () => {
    const greet = customer?.contact_person || customer?.business_name || invoice.customer_name || 'there';
    const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const dateStr = invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-IN') : '';
    const lines = [
      `Hi ${greet},`,
      ``,
      `📄 *Invoice ${invoice.invoice_number}*`,
      `📅 Date: ${dateStr}`,
      `💰 Total: ${fmt(invoice.total)}`,
    ];
    if (invoice.balance_due > 0) lines.push(`⚠️ Balance Due: ${fmt(invoice.balance_due)}`);
    if (invoice.due_date) lines.push(`🗓️ Due: ${new Date(invoice.due_date).toLocaleDateString('en-IN')}`);
    lines.push(``, `Thank you for your business!`, business?.business_name ? `— ${business.business_name}` : '');
    const text = lines.filter(Boolean).join('\n');
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'WhatsApp not installed'));
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Invoice ${invoice.invoice_number}\nCustomer: ${invoice.customer_name}\nAmount: ₹${invoice.total?.toFixed(2)}\nBalance Due: ₹${invoice.balance_due?.toFixed(2)}\nStatus: ${invoice.status}`,
        title: `Invoice ${invoice.invoice_number}`,
      });
    } catch {}
  };

  const handleSendEmail = async () => {
    if (!emailTo) return Alert.alert('Error', 'Enter email address');
    setEmailSending(true);
    try {
      await api.post(`/api/invoices/${id}/send-email`, { to_email: emailTo, to_name: invoice.customer_name });
      toast.success('Invoice sent via email');
      setShowEmailModal(false);
      setEmailTo('');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to send');
    } finally { setEmailSending(false); }
  };

  if (!invoice) return <View style={s.center}><Text>Loading...</Text></View>;

  const statusAccent: Record<string, string> = {
    Paid: '#16a34a', 'Partially Paid': '#f59e0b', Overdue: '#dc2626',
    Sent: '#2563eb', Draft: '#71717a', Cancelled: '#dc2626',
  };
  const accent = statusAccent[invoice.status] || colors.primary;
  const dateFmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const callCustomer = () => customer?.mobile && Linking.openURL(`tel:${customer.mobile}`);
  const emailCustomer = () => customer?.email && Linking.openURL(`mailto:${customer.email}`);
  const whatsappCustomer = () => {
    const num = (customer?.mobile || '').replace(/\D/g, '');
    if (!num) return;
    Linking.openURL(`whatsapp://send?phone=${num.length === 10 ? '91' + num : num}`).catch(() => Alert.alert('Error', 'WhatsApp not installed'));
  };

  return (
    <ScrollView style={s.container}>
      {/* HEADER — minimal, elegant */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View style={[s.accentBar, { backgroundColor: accent }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.headerLabel}>INVOICE</Text>
            <Text style={s.headerNumber}>{invoice.invoice_number}</Text>
          </View>
          <View style={[s.statusPill, { backgroundColor: accent + '15', borderColor: accent + '40' }]}>
            <View style={[s.statusDot, { backgroundColor: accent }]} />
            <Text style={[s.statusText, { color: accent }]}>{invoice.status}</Text>
          </View>
        </View>

        <View style={s.amountBlock}>
          <Text style={s.amountLabel}>Total Amount</Text>
          <Text style={s.amountValue}>₹{Number(invoice.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        </View>

        <View style={s.dateRow}>
          <View style={s.dateCol}>
            <Text style={s.dateLabel}>Issued</Text>
            <Text style={s.dateValue}>{dateFmt(invoice.invoice_date)}</Text>
          </View>
          <View style={s.dateDiv} />
          <View style={s.dateCol}>
            <Text style={s.dateLabel}>Due</Text>
            <Text style={[s.dateValue, invoice.balance_due > 0 && invoice.due_date && new Date(invoice.due_date) < new Date() ? { color: colors.danger } : null]}>{dateFmt(invoice.due_date)}</Text>
          </View>
          <View style={s.dateDiv} />
          <View style={s.dateCol}>
            <Text style={s.dateLabel}>Items</Text>
            <Text style={s.dateValue}>{(invoice.items || []).length}</Text>
          </View>
        </View>
      </View>

      {/* PAYMENT PROGRESS */}
      {invoice.total > 0 && (
        <View style={s.progressCard}>
          <View style={s.progressTopRow}>
            <View>
              <Text style={s.progressLabel}>Paid</Text>
              <Text style={[s.progressAmount, { color: colors.success }]}>₹{Number(invoice.amount_paid || 0).toLocaleString('en-IN')}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.progressLabel}>{invoice.balance_due > 0 ? 'Balance' : 'Status'}</Text>
              <Text style={[s.progressAmount, { color: invoice.balance_due > 0 ? colors.danger : colors.success }]}>
                {invoice.balance_due > 0 ? `₹${Number(invoice.balance_due).toLocaleString('en-IN')}` : 'Settled'}
              </Text>
            </View>
          </View>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${Math.min(100, Math.max(0, ((invoice.amount_paid || 0) / invoice.total) * 100))}%`, backgroundColor: invoice.balance_due > 0 ? colors.warning : colors.success }]} />
          </View>
          <Text style={s.progressPct}>{Math.round(((invoice.amount_paid || 0) / invoice.total) * 100)}% paid</Text>
        </View>
      )}

      {/* QUICK ACTIONS */}
      <View style={s.quickActions}>
        <TouchableOpacity style={s.qAction} onPress={() => setShowStatusPicker(true)}>
          <View style={[s.qIcon, { backgroundColor: colors.warning + '20' }]}><Ionicons name="flag-outline" size={20} color={colors.warning} /></View>
          <Text style={s.qLabel}>Status</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.qAction} onPress={() => navigation.navigate('InvoiceForm', { id })}>
          <View style={[s.qIcon, { backgroundColor: colors.primary + '20' }]}><Ionicons name="create-outline" size={20} color={colors.primary} /></View>
          <Text style={s.qLabel}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.qAction} onPress={handleDownloadPDF}>
          <View style={[s.qIcon, { backgroundColor: colors.success + '20' }]}><Ionicons name="download-outline" size={20} color={colors.success} /></View>
          <Text style={s.qLabel}>PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.qAction} onPress={handleShareWhatsApp}>
          <View style={[s.qIcon, { backgroundColor: '#25D36620' }]}><Ionicons name="logo-whatsapp" size={20} color="#25D366" /></View>
          <Text style={s.qLabel}>WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.qAction} onPress={() => { setEmailTo(customer?.email || invoice.customer_email || ''); setShowEmailModal(true); }}>
          <View style={[s.qIcon, { backgroundColor: colors.accent + '20' }]}><Ionicons name="mail-outline" size={20} color={colors.accent} /></View>
          <Text style={s.qLabel}>Email</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.qAction} onPress={handleShare}>
          <View style={[s.qIcon, { backgroundColor: colors.info + '20' }]}><Ionicons name="share-outline" size={20} color={colors.info || colors.primary} /></View>
          <Text style={s.qLabel}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.qAction}
          onPress={() => navigation.getParent()?.navigate('EwayBills', { screen: 'EwayBillForm', params: { invoice_id: invoice.id } })}
        >
          <View style={[s.qIcon, { backgroundColor: '#f3e8ff' }]}><Ionicons name="car-outline" size={20} color="#7c3aed" /></View>
          <Text style={s.qLabel}>E-Way</Text>
        </TouchableOpacity>
      </View>

      {/* PAY CTA */}
      {invoice.balance_due > 0 && (
        <TouchableOpacity style={s.payBtn} onPress={() => { setPayAmount(String(invoice.balance_due)); setShowPayment(true); }}>
          <View style={s.payBtnIcon}><Ionicons name="cash" size={18} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.payText}>Record Payment</Text>
            <Text style={s.paySub}>₹{Number(invoice.balance_due).toLocaleString('en-IN')} pending</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>
      )}

      {/* CUSTOMER */}
      <View style={s.section}>
        <View style={s.sectionHead}>
          <View style={s.sectionTitleRow}>
            <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
            <Text style={s.sectionTitle}>Bill To</Text>
          </View>
        </View>
        <View style={s.custCard}>
          <View style={s.custAvatar}>
            <Text style={s.custAvatarText}>{(customer?.business_name || customer?.contact_person || invoice.customer_name || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.custName}>{customer?.business_name || customer?.contact_person || invoice.customer_name || 'N/A'}</Text>
            {customer?.business_name && customer?.contact_person ? <Text style={s.custMeta}>{customer.contact_person}</Text> : null}
            {customer?.mobile ? <Text style={s.custMeta}><Ionicons name="call-outline" size={11} color={colors.gray500} /> {customer.mobile}</Text> : null}
            {customer?.email ? <Text style={s.custMeta} numberOfLines={1}><Ionicons name="mail-outline" size={11} color={colors.gray500} /> {customer.email}</Text> : null}
            {customer?.gst_number ? <Text style={s.custMeta}><Ionicons name="receipt-outline" size={11} color={colors.gray500} /> GST: {customer.gst_number}</Text> : null}
          </View>
        </View>
        {customer && (customer.mobile || customer.email) ? (
          <View style={s.custActions}>
            {customer.mobile ? (
              <TouchableOpacity style={s.custActionBtn} onPress={callCustomer}>
                <Ionicons name="call" size={14} color={colors.primary} />
                <Text style={s.custActionText}>Call</Text>
              </TouchableOpacity>
            ) : null}
            {customer.mobile ? (
              <TouchableOpacity style={s.custActionBtn} onPress={whatsappCustomer}>
                <Ionicons name="logo-whatsapp" size={14} color="#25D366" />
                <Text style={[s.custActionText, { color: '#25D366' }]}>WhatsApp</Text>
              </TouchableOpacity>
            ) : null}
            {customer.email ? (
              <TouchableOpacity style={s.custActionBtn} onPress={emailCustomer}>
                <Ionicons name="mail" size={14} color={colors.accent} />
                <Text style={[s.custActionText, { color: colors.accent }]}>Email</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* ITEMS */}
      <View style={s.section}>
        <View style={s.sectionHead}>
          <View style={s.sectionTitleRow}>
            <Ionicons name="cube-outline" size={18} color={colors.primary} />
            <Text style={s.sectionTitle}>Items</Text>
          </View>
          <View style={s.itemCountChip}>
            <Text style={s.itemCountText}>{(invoice.items || []).length}</Text>
          </View>
        </View>
        {(invoice.items || []).map((item: any, i: number) => (
          <View key={i} style={[s.lineItem, i === (invoice.items || []).length - 1 && { borderBottomWidth: 0 }]}>
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
                  <Text style={[s.metaChipLabel, { fontSize: 9 }]}>HSN</Text>
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
        <View style={s.sumRow}><Text style={s.sumLabel}>Subtotal</Text><CurrencyText amount={invoice.subtotal} style={s.sumValue} /></View>
        {invoice.discount_value > 0 && (
          <View style={s.sumRow}>
            <Text style={s.sumLabel}>Discount {invoice.discount_type === 'percentage' ? `(${invoice.discount_value}%)` : ''}</Text>
            <Text style={[s.sumValue, { color: colors.danger }]}>−₹{(invoice.discount_type === 'percentage' ? (invoice.subtotal * invoice.discount_value / 100) : invoice.discount_value)?.toFixed(2)}</Text>
          </View>
        )}
        {invoice.tax_amount > 0 && <View style={s.sumRow}><Text style={s.sumLabel}>Tax (CGST + SGST)</Text><CurrencyText amount={invoice.tax_amount} style={s.sumValue} /></View>}
        <View style={[s.sumRow, s.totalRow]}><Text style={s.totalLabel}>Total</Text><CurrencyText amount={invoice.total} style={s.totalValue} /></View>
        {invoice.amount_paid > 0 && (
          <>
            <View style={s.sumRow}><Text style={s.sumLabel}>Amount Paid</Text><CurrencyText amount={invoice.amount_paid} style={[s.sumValue, { color: colors.success, fontWeight: '700' }]} /></View>
            <View style={[s.sumRow, { backgroundColor: invoice.balance_due > 0 ? '#fef2f2' : '#f0fdf4', marginHorizontal: -spacing.md, paddingHorizontal: spacing.md, paddingVertical: 10, marginTop: 4 }]}>
              <Text style={[s.sumLabel, { fontWeight: '700', color: invoice.balance_due > 0 ? colors.danger : colors.success }]}>
                {invoice.balance_due > 0 ? 'Balance Due' : 'Fully Paid'}
              </Text>
              <CurrencyText amount={invoice.balance_due} style={[s.sumValue, { color: invoice.balance_due > 0 ? colors.danger : colors.success, fontWeight: '800', fontSize: 15 }]} />
            </View>
          </>
        )}
      </View>

      {/* NOTES */}
      {invoice.notes ? (
        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={s.sectionTitleRow}>
              <Ionicons name="document-text-outline" size={18} color={colors.primary} />
              <Text style={s.sectionTitle}>Notes</Text>
            </View>
          </View>
          <Text style={s.notes}>{invoice.notes}</Text>
        </View>
      ) : null}

      {/* PAYMENT HISTORY */}
      {payments.length > 0 && (
        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={s.sectionTitleRow}>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
              <Text style={s.sectionTitle}>Payment History</Text>
            </View>
            <View style={s.payCountChip}><Text style={s.payCountText}>{payments.length}</Text></View>
          </View>
          {payments.map((p, idx) => (
            <View key={p.id || idx} style={s.payRow}>
              <View style={s.payIcon}><Ionicons name="checkmark-circle" size={18} color={colors.success} /></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={s.payDate}>{dateFmt(p.payment_date)}</Text>
                  <View style={s.payMethodChip}><Text style={s.payMethodText}>{p.payment_method || 'Cash'}</Text></View>
                </View>
                {p.reference_number ? <Text style={s.payRef}>Ref: {p.reference_number}</Text> : null}
              </View>
              <CurrencyText amount={p.amount} style={s.payAmt} />
            </View>
          ))}
        </View>
      )}

      {/* MORE */}
      <View style={s.moreActions}>
        <TouchableOpacity style={s.moreBtn} onPress={handleDuplicate}>
          <Ionicons name="copy-outline" size={18} color={colors.gray600} />
          <Text style={s.moreBtnText}>Duplicate Invoice</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.moreBtn, { borderColor: colors.danger + '40' }]} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={[s.moreBtnText, { color: colors.danger }]}>Delete Invoice</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />

      {/* Status Picker Modal */}
      <Modal visible={showStatusPicker} transparent animationType="fade" onRequestClose={() => setShowStatusPicker(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowStatusPicker(false)}>
          <View style={s.statusModal}>
            <Text style={s.modalTitle}>Change Status</Text>
            {STATUS_OPTIONS.map(st => (
              <TouchableOpacity key={st} style={[s.statusOption, invoice.status === st && { backgroundColor: colors.primary + '10' }]} onPress={() => changeStatus(st)}>
                <StatusBadge status={st} />
                {invoice.status === st && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
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
            <Text style={s.modalSub}>Balance Due: ₹{invoice.balance_due?.toLocaleString('en-IN')}</Text>
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

      {/* Email Modal */}
      <Modal visible={showEmailModal} transparent animationType="slide" onRequestClose={() => setShowEmailModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.payModal}>
            <Text style={s.modalTitle}>Send Invoice via Email</Text>
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

  // HEADER — minimal white card with accent bar
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

  // PROGRESS
  progressCard: { backgroundColor: '#fff', marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: 12, padding: spacing.md },
  progressTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  progressLabel: { fontSize: 10, fontWeight: '700', color: colors.gray500, letterSpacing: 0.5, textTransform: 'uppercase' },
  progressAmount: { fontSize: 16, fontWeight: '800', marginTop: 2, letterSpacing: -0.3 },
  progressBar: { height: 6, backgroundColor: colors.gray100, borderRadius: 3, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressPct: { fontSize: 10, fontWeight: '700', color: colors.gray500, marginTop: 6, letterSpacing: 0.3 },

  quickActions: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.white, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: 12 },
  qAction: { width: '16.66%', alignItems: 'center', paddingVertical: spacing.sm },
  qIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  qLabel: { fontSize: 10, color: colors.gray600, fontWeight: '500' },

  payBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.success, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: 14, padding: spacing.md, gap: 12, shadowColor: colors.success, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  payBtnIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  payText: { color: colors.white, fontWeight: '800', fontSize: 14, letterSpacing: -0.1 },
  paySub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600', marginTop: 1 },

  section: { backgroundColor: colors.white, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: 12, padding: spacing.md },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.text, letterSpacing: -0.1 },

  // Customer
  custCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  custAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' },
  custAvatarText: { fontSize: 18, fontWeight: '800', color: colors.primary },
  custName: { fontSize: 15, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  custMeta: { fontSize: 12, color: colors.gray600, marginTop: 3, lineHeight: 16 },
  custActions: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.gray100 },
  custActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.gray100 },
  custActionText: { fontSize: 12, fontWeight: '700', color: colors.primary },

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

  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  sumLabel: { fontSize: 13, color: colors.gray600 },
  sumValue: { fontSize: 13, fontWeight: '600', color: colors.text },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.gray200, paddingTop: 10, marginTop: 6 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: colors.text },
  totalValue: { fontSize: 18, fontWeight: '900', color: colors.primary, letterSpacing: -0.4 },

  notes: { fontSize: 13, color: colors.gray600, lineHeight: 20 },

  payCountChip: { paddingHorizontal: 9, paddingVertical: 2, backgroundColor: colors.primary + '15', borderRadius: 999 },
  payCountText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  payIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.success + '15', alignItems: 'center', justifyContent: 'center' },
  payDate: { fontSize: 13, fontWeight: '700', color: colors.text },
  payMethodChip: { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.gray100, borderRadius: 4 },
  payMethodText: { fontSize: 9, fontWeight: '700', color: colors.gray600, textTransform: 'uppercase', letterSpacing: 0.3 },
  payRef: { fontSize: 11, color: colors.gray500, marginTop: 2 },
  payAmt: { fontSize: 15, fontWeight: '800', color: colors.success, letterSpacing: -0.3 },

  moreActions: { paddingHorizontal: spacing.md, gap: spacing.sm },
  moreBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.gray200, borderRadius: 12, padding: spacing.md, backgroundColor: '#fff' },
  moreBtnText: { fontSize: fontSize.md, color: colors.gray600, fontWeight: '600' },

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
