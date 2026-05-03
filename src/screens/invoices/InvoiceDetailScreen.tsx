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

const STATUS_OPTIONS = ['Draft', 'Sent', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled'];

function numberToWordsINR(num: number): string {
  if (!num || num === 0) return 'Rupees Zero Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const below1000 = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + below1000(n % 100) : '');
  };
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const rest = Math.floor(num % 1000);
  const paise = Math.round((num - Math.floor(num)) * 100);
  let words = '';
  if (crore) words += below1000(crore) + ' Crore ';
  if (lakh) words += below1000(lakh) + ' Lakh ';
  if (thousand) words += below1000(thousand) + ' Thousand ';
  if (rest) words += below1000(rest);
  words = 'Rupees ' + words.trim();
  if (paise) words += ' and ' + below1000(paise) + ' Paise';
  return words + ' Only';
}

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
    const fmt = (n: number) => (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const halfTax = (invoice.tax_amount || 0) / 2;
    const discAmt = invoice.discount_type === 'percentage'
      ? (invoice.subtotal || 0) * ((invoice.discount_value || 0) / 100)
      : (invoice.discount_value || 0);
    const logoUrl = settings?.header_logo
      ? `${BASE_URL}/assets/invoice/${settings.header_logo}`
      : business?.business_logo ? `${BASE_URL}/assets/logos/${business.business_logo}` : '';
    const fontFamily = settings?.font_family || 'Inter';
    const baseSize = settings?.font_size === 'small' ? 11 : settings?.font_size === 'large' ? 14 : 12;
    const statusColor: Record<string, string> = {
      Paid: '#16a34a', Sent: '#2563eb', Draft: '#71717a', Overdue: '#dc2626',
      'Partially Paid': '#f59e0b', Cancelled: '#dc2626',
    };
    const sColor = statusColor[invoice.status] || '#71717a';

    const items = (invoice.items || []).map((it: any, i: number) => `
      <tr>
        <td style="padding:9px 12px;border-bottom:1px solid #e4e4e7;color:#71717a">${i + 1}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #e4e4e7;font-weight:500">${it.item_name || ''}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #e4e4e7;color:#71717a">${it.description || '—'}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #e4e4e7;text-align:right">${it.qty} ${it.unit || ''}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #e4e4e7;text-align:right">₹${fmt(it.rate)}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #e4e4e7;text-align:right">${it.discount_percent || 0}%</td>
        <td style="padding:9px 12px;border-bottom:1px solid #e4e4e7;text-align:right">${it.tax_rate || 0}%</td>
        <td style="padding:9px 12px;border-bottom:1px solid #e4e4e7;text-align:right;font-weight:500">₹${fmt(it.amount)}</td>
      </tr>`).join('');

    const paymentRows = payments.map((p: any) => `
      <tr>
        <td style="padding:6px 0;border-bottom:1px dashed #e4e4e7">${fmtDate(p.payment_date)}</td>
        <td style="padding:6px 0;border-bottom:1px dashed #e4e4e7;text-align:right;color:#16a34a;font-weight:500">₹${fmt(p.amount)}</td>
        <td style="padding:6px 0 6px 16px;border-bottom:1px dashed #e4e4e7">${p.payment_method || ''}</td>
        <td style="padding:6px 0 6px 16px;border-bottom:1px dashed #e4e4e7;color:#71717a">${p.reference_number || '—'}</td>
      </tr>`).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      *{box-sizing:border-box}
      body{font-family:'${fontFamily}',system-ui,sans-serif;margin:0;padding:24px;color:#18181b;font-size:${baseSize}px;line-height:1.5}
      .doc{max-width:780px;margin:0 auto}
      .row{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
      .biz-head{display:flex;align-items:center;gap:14px}
      .biz-head img{height:54px;width:54px;object-fit:contain;border:1px solid #e4e4e7;border-radius:8px}
      .biz-name{font-size:16px;font-weight:700;margin:0}
      .muted{color:#71717a;font-size:11px;margin:1px 0}
      .doc-title{font-size:22px;font-weight:700;color:#27272a;letter-spacing:1.5px;text-transform:uppercase;margin:0}
      .badge{display:inline-block;margin-top:6px;padding:3px 10px;border-radius:10px;font-size:10px;font-weight:600;color:#fff;background:${sColor}}
      .sep{height:1px;background:#e4e4e7;margin:18px 0}
      .grid2{display:grid;grid-template-columns:1fr 1fr;gap:24px}
      .label{font-size:10px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px}
      .info-card{display:inline-block;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:10px 14px;text-align:left}
      .info-card p{margin:2px 0;font-size:11px}
      table.items{width:100%;border-collapse:separate;border-spacing:0;font-size:11px;margin-top:6px}
      table.items thead th{background:#18181b;color:#fff;padding:9px 12px;text-align:left;font-weight:500;font-size:11px}
      table.items thead th:first-child{border-top-left-radius:8px}
      table.items thead th:last-child{border-top-right-radius:8px}
      .sum-wrap{display:flex;justify-content:flex-end;margin-top:18px}
      .summary{width:300px}
      .sum-row{display:flex;justify-content:space-between;font-size:11px;padding:3px 0}
      .sum-row .lbl{color:#71717a}
      .sum-total{display:flex;justify-content:space-between;font-size:15px;font-weight:700;padding-top:8px;margin-top:6px;border-top:1px solid #e4e4e7}
      .words{font-size:10px;color:#71717a;font-style:italic;margin-top:4px}
      .pay-row-green{color:#16a34a}
      .pay-row-red{color:#dc2626;font-weight:700;font-size:13px}
      .notes{white-space:pre-wrap;color:#71717a;font-size:11px}
      .pay-table{width:100%;border-collapse:collapse;font-size:11px;margin-top:6px}
      .pay-table th{text-align:left;padding:6px 0;border-bottom:1px solid #e4e4e7;font-weight:500;color:#71717a;font-size:11px}
      .pay-table th.right{text-align:right}
      .qr{height:96px;width:96px;object-fit:contain;border:1px solid #e4e4e7;border-radius:6px}
      .sig{height:60px;object-fit:contain}
      .footer{text-align:center;font-size:9px;color:#71717a}
      @media print{body{padding:0}@page{margin:10mm}}
    </style></head><body><div class="doc">
      <div class="row">
        <div class="biz-head">
          ${logoUrl ? `<img src="${logoUrl}" alt=""/>` : ''}
          <div>
            <h2 class="biz-name">${business?.business_name || ''}</h2>
            ${business?.address ? `<p class="muted">${business.address}</p>` : ''}
            ${business?.mobile ? `<p class="muted">Tel: ${business.mobile}</p>` : ''}
            ${business?.email ? `<p class="muted">${business.email}</p>` : ''}
          </div>
        </div>
        <div style="text-align:right">
          <h1 class="doc-title">${settings?.invoice_title || 'Tax Invoice'}</h1>
          <span class="badge">${invoice.status}</span>
        </div>
      </div>

      ${(business?.gst_number || business?.pan) ? `
      <div class="grid2" style="margin-top:14px">
        <div>
          ${business?.gst_number ? `<p class="muted" style="font-size:11px"><strong style="color:#27272a">GSTIN:</strong> ${business.gst_number}</p>` : ''}
          ${business?.pan ? `<p class="muted" style="font-size:11px"><strong style="color:#27272a">PAN:</strong> ${business.pan}</p>` : ''}
        </div>
        <div></div>
      </div>` : ''}

      <div class="sep"></div>

      <div class="grid2">
        <div>
          <p class="label">Bill To</p>
          <p style="font-weight:600;margin:0 0 2px">${customer?.business_name || customer?.contact_person || invoice.customer_name || ''}</p>
          ${customer?.business_name && customer?.contact_person ? `<p class="muted">${customer.contact_person}</p>` : ''}
          ${customer?.address ? `<p class="muted">${customer.address}</p>` : ''}
          ${customer?.mobile ? `<p class="muted">Tel: ${customer.mobile}</p>` : ''}
          ${customer?.gst_number ? `<p class="muted"><strong style="color:#27272a">GSTIN:</strong> ${customer.gst_number}</p>` : ''}
        </div>
        <div style="text-align:right">
          <div class="info-card">
            <p><strong>Invoice No:</strong> ${invoice.invoice_number}</p>
            <p><strong>Date:</strong> ${fmtDate(invoice.invoice_date)}</p>
            ${invoice.due_date ? `<p><strong>Due Date:</strong> ${fmtDate(invoice.due_date)}</p>` : ''}
          </div>
        </div>
      </div>

      <table class="items" style="margin-top:18px">
        <thead><tr>
          <th style="width:32px">#</th>
          <th>Item</th>
          <th>Description</th>
          <th style="text-align:right;width:60px">Qty</th>
          <th style="text-align:right;width:80px">Rate</th>
          <th style="text-align:right;width:60px">Disc%</th>
          <th style="text-align:right;width:60px">Tax%</th>
          <th style="text-align:right;width:90px">Amount</th>
        </tr></thead>
        <tbody>${items}</tbody>
      </table>

      <div class="sum-wrap"><div class="summary">
        <div class="sum-row"><span class="lbl">Subtotal</span><span>₹${fmt(invoice.subtotal)}</span></div>
        ${discAmt > 0 ? `<div class="sum-row"><span class="lbl">Discount${invoice.discount_type === 'percentage' ? ` (${invoice.discount_value}%)` : ''}</span><span style="color:#dc2626">-₹${fmt(discAmt)}</span></div>` : ''}
        <div class="sum-row"><span class="lbl">CGST</span><span>₹${fmt(halfTax)}</span></div>
        <div class="sum-row"><span class="lbl">SGST</span><span>₹${fmt(halfTax)}</span></div>
        ${(invoice.freight_charges || 0) > 0 ? `<div class="sum-row"><span class="lbl">Freight Charges</span><span>₹${fmt(invoice.freight_charges)}</span></div>` : ''}
        ${Math.abs(invoice.round_off || 0) > 0 ? `<div class="sum-row"><span class="lbl">Round Off</span><span${(invoice.round_off || 0) < 0 ? ' style="color:#dc2626"' : ''}>${(invoice.round_off || 0) >= 0 ? '+' : '−'}₹${fmt(Math.abs(invoice.round_off || 0))}</span></div>` : ''}
        <div class="sum-total"><span>Total</span><span>₹${fmt(invoice.total)}</span></div>
        <p class="words">${numberToWordsINR(invoice.total || 0)}</p>
        ${(invoice.amount_paid || 0) > 0 ? `
          <div class="sum-row pay-row-green"><span>Amount Paid</span><span>₹${fmt(invoice.amount_paid)}</span></div>
          <div class="sum-row pay-row-red"><span>Balance Due</span><span>₹${fmt(invoice.balance_due)}</span></div>` : ''}
      </div></div>

      ${invoice.notes ? `<div style="margin-top:18px"><p class="label">Notes</p><p class="notes">${invoice.notes}</p></div>` : ''}

      ${payments.length > 0 ? `
        <div class="sep"></div>
        <p class="label">Payment History</p>
        <table class="pay-table">
          <thead><tr><th>Date</th><th class="right">Amount</th><th style="padding-left:16px">Method</th><th style="padding-left:16px">Reference</th></tr></thead>
          <tbody>${paymentRows}</tbody>
        </table>` : ''}

      ${(settings?.bank_name || settings?.qr_code_image) ? `
        <div class="sep"></div>
        <div class="grid2">
          ${settings?.bank_name ? `
            <div>
              <p class="label">Bank Details</p>
              <p style="font-size:11px;margin:1px 0"><strong>Bank:</strong> ${settings.bank_name}</p>
              ${settings.bank_account ? `<p style="font-size:11px;margin:1px 0"><strong>A/C No:</strong> ${settings.bank_account}</p>` : ''}
              ${settings.bank_ifsc ? `<p style="font-size:11px;margin:1px 0"><strong>IFSC:</strong> ${settings.bank_ifsc}</p>` : ''}
              ${settings.bank_branch ? `<p style="font-size:11px;margin:1px 0"><strong>Branch:</strong> ${settings.bank_branch}</p>` : ''}
            </div>` : '<div></div>'}
          ${settings?.qr_code_image ? `<div style="text-align:right"><img class="qr" src="${BASE_URL}/assets/invoice/${settings.qr_code_image}" alt="QR"/></div>` : '<div></div>'}
        </div>` : ''}

      ${settings?.terms_and_conditions ? `
        <div class="sep"></div>
        <p class="label">Terms & Conditions</p>
        <p class="notes">${settings.terms_and_conditions}</p>` : ''}

      ${settings?.signature_image ? `
        <div style="display:flex;justify-content:flex-end;margin-top:24px">
          <div style="text-align:center">
            <img class="sig" src="${BASE_URL}/assets/invoice/${settings.signature_image}" alt=""/>
            <p class="muted" style="margin-top:4px">Authorized Signature</p>
          </div>
        </div>` : ''}

      ${settings?.footer_text ? `<div class="sep"></div><p class="footer">${settings.footer_text}</p>` : ''}
    </div></body></html>`;
  };

  const handleDownloadPDF = async () => {
    try {
      const { uri } = await Print.printToFileAsync({ html: generateHTML() });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Invoice ${invoice.invoice_number}` });
    } catch (e: any) { Alert.alert('Error', 'Failed to generate PDF'); }
  };

  const handleShareWhatsApp = () => {
    const text = `Invoice ${invoice.invoice_number}\nAmount: ₹${invoice.total?.toFixed(2)}\nBalance Due: ₹${invoice.balance_due?.toFixed(2)}\nStatus: ${invoice.status}\n\nFrom ${business?.business_name || ''}`;
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

  return (
    <ScrollView style={s.container}>
      {/* Header Card */}
      <View style={s.headerCard}>
        <View style={s.headerRow}>
          <Text style={s.invNum}>{invoice.invoice_number}</Text>
          <StatusBadge status={invoice.status} />
        </View>
        <Text style={s.custName}>{invoice.customer_name || 'N/A'}</Text>
        <View style={s.dateRow}>
          <Text style={s.dateLabel}>Date: {invoice.invoice_date}</Text>
          <Text style={s.dateLabel}>Due: {invoice.due_date || 'N/A'}</Text>
        </View>
      </View>

      {/* Quick Actions */}
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
          <View style={[s.qIcon, { backgroundColor: '#25D366' + '20' }]}><Ionicons name="logo-whatsapp" size={20} color="#25D366" /></View>
          <Text style={s.qLabel}>WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.qAction} onPress={() => { setEmailTo(invoice.customer_email || ''); setShowEmailModal(true); }}>
          <View style={[s.qIcon, { backgroundColor: colors.accent + '20' }]}><Ionicons name="mail-outline" size={20} color={colors.accent} /></View>
          <Text style={s.qLabel}>Email</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.qAction} onPress={handleShare}>
          <View style={[s.qIcon, { backgroundColor: colors.info + '20' }]}><Ionicons name="share-outline" size={20} color={colors.info || colors.primary} /></View>
          <Text style={s.qLabel}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Payment button */}
      {invoice.balance_due > 0 && (
        <TouchableOpacity style={s.payBtn} onPress={() => { setPayAmount(String(invoice.balance_due)); setShowPayment(true); }}>
          <Ionicons name="cash-outline" size={20} color={colors.white} />
          <Text style={s.payText}>Record Payment — ₹{invoice.balance_due?.toFixed(2)} due</Text>
        </TouchableOpacity>
      )}

      {/* Line Items */}
      <View style={s.section}>
        <View style={s.itemsHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="cube-outline" size={16} color={colors.primary} />
            <Text style={s.sectionTitle}>Items</Text>
          </View>
          <View style={s.itemCountChip}>
            <Text style={s.itemCountText}>{(invoice.items || []).length}</Text>
          </View>
        </View>
        {(invoice.items || []).map((item: any, i: number) => {
          const baseAmt = (item.qty || 0) * (item.rate || 0);
          const discAmt = baseAmt * (item.discount_percent || 0) / 100;
          const afterDisc = baseAmt - discAmt;
          return (
            <View key={i} style={[s.lineItem, i === (invoice.items || []).length - 1 && { borderBottomWidth: 0, marginBottom: 0 }]}>
              <View style={s.lineHeaderRow}>
                <View style={s.lineNum}><Text style={s.lineNumText}>{i + 1}</Text></View>
                <Text style={s.itemName} numberOfLines={2}>{item.item_name}</Text>
                <CurrencyText amount={item.amount} style={s.itemAmt} />
              </View>
              {item.description ? (
                <Text style={s.itemDesc} numberOfLines={2}>{item.description}</Text>
              ) : null}
              <View style={s.itemMetaRow}>
                <View style={s.metaChip}>
                  <Text style={s.metaChipLabel}>Qty</Text>
                  <Text style={s.metaChipValue}>{item.qty}{item.unit ? ` ${item.unit}` : ''}</Text>
                </View>
                <View style={s.metaChip}>
                  <Text style={s.metaChipLabel}>Rate</Text>
                  <Text style={s.metaChipValue}>₹{Number(item.rate || 0).toFixed(2)}</Text>
                </View>
                {item.discount_percent > 0 ? (
                  <View style={[s.metaChip, { backgroundColor: '#fef3c7' }]}>
                    <Text style={[s.metaChipLabel, { color: '#b45309' }]}>Disc</Text>
                    <Text style={[s.metaChipValue, { color: '#b45309' }]}>{item.discount_percent}%</Text>
                  </View>
                ) : null}
                {item.tax_rate > 0 ? (
                  <View style={[s.metaChip, { backgroundColor: colors.primary + '12' }]}>
                    <Text style={[s.metaChipLabel, { color: colors.primary }]}>GST</Text>
                    <Text style={[s.metaChipValue, { color: colors.primary }]}>{item.tax_rate}%</Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      {/* Summary */}
      <View style={s.section}>
        <View style={s.sumRow}><Text style={s.sumLabel}>Subtotal</Text><CurrencyText amount={invoice.subtotal} style={s.sumValue} /></View>
        {invoice.discount_value > 0 && <View style={s.sumRow}><Text style={s.sumLabel}>Discount ({invoice.discount_type === 'percentage' ? `${invoice.discount_value}%` : 'Flat'})</Text><Text style={s.sumValue}>-₹{(invoice.discount_type === 'percentage' ? (invoice.subtotal * invoice.discount_value / 100) : invoice.discount_value)?.toFixed(2)}</Text></View>}
        <View style={s.sumRow}><Text style={s.sumLabel}>Tax</Text><CurrencyText amount={invoice.tax_amount} style={s.sumValue} /></View>
        <View style={[s.sumRow, s.totalRow]}><Text style={s.totalLabel}>Total</Text><CurrencyText amount={invoice.total} style={s.totalValue} /></View>
        <View style={s.sumRow}><Text style={s.sumLabel}>Amount Paid</Text><CurrencyText amount={invoice.amount_paid} style={[s.sumValue, { color: colors.success }]} /></View>
        <View style={s.sumRow}><Text style={[s.sumLabel, { fontWeight: '700' }]}>Balance Due</Text><CurrencyText amount={invoice.balance_due} style={[s.sumValue, { color: colors.danger, fontWeight: '700' }]} /></View>
      </View>

      {/* Notes */}
      {invoice.notes ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Notes</Text>
          <Text style={s.notes}>{invoice.notes}</Text>
        </View>
      ) : null}

      {/* Payment History */}
      {payments.length > 0 && (
        <View style={s.section}>
          <View style={s.payHistoryHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="receipt-outline" size={16} color={colors.primary} />
              <Text style={s.sectionTitle}>Payment History</Text>
            </View>
            <View style={s.payCountChip}>
              <Text style={s.payCountText}>{payments.length}</Text>
            </View>
          </View>
          {payments.map((p, idx) => (
            <View key={p.id || idx} style={s.payRow}>
              <View style={s.payIcon}>
                <Ionicons name="cash" size={16} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.payDate}>
                    {p.payment_date
                      ? new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </Text>
                  <View style={s.payMethodChip}>
                    <Text style={s.payMethodText}>{p.payment_method || 'Cash'}</Text>
                  </View>
                </View>
                {p.reference_number ? (
                  <Text style={s.payRef}>Ref: {p.reference_number}</Text>
                ) : null}
                {p.notes ? (
                  <Text style={s.payRef} numberOfLines={1}>{p.notes}</Text>
                ) : null}
              </View>
              <CurrencyText amount={p.amount} style={s.payAmt} />
            </View>
          ))}
        </View>
      )}

      {/* More Actions */}
      <View style={s.moreActions}>
        <TouchableOpacity style={s.moreBtn} onPress={handleDuplicate}>
          <Ionicons name="copy-outline" size={18} color={colors.gray600} />
          <Text style={s.moreBtnText}>Duplicate Invoice</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.moreBtn, { borderColor: colors.danger }]} onPress={handleDelete}>
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

  payBtn: { flexDirection: 'row', backgroundColor: colors.success, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.md, padding: spacing.md, justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  payText: { color: colors.white, fontWeight: '700', fontSize: fontSize.md },

  section: { backgroundColor: colors.white, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.md, padding: spacing.md },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  lineItem: {
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
    marginBottom: 2,
  },
  lineHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lineNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center', alignItems: 'center',
    marginTop: 1,
  },
  lineNumText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  itemName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, letterSpacing: -0.1, lineHeight: 19 },
  itemDesc: { fontSize: 12, color: colors.gray500, marginTop: 4, marginLeft: 30, lineHeight: 17 },
  itemAmt: { fontSize: 14, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  itemMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, marginLeft: 30 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 2,
    backgroundColor: colors.gray100,
    borderRadius: 5,
  },
  metaChipLabel: { fontSize: 9, fontWeight: '600', color: colors.gray600, textTransform: 'uppercase', letterSpacing: 0.2 },
  metaChipValue: { fontSize: 11, fontWeight: '600', color: colors.text },
  itemsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  itemCountChip: { paddingHorizontal: 8, paddingVertical: 2, backgroundColor: colors.primary + '15', borderRadius: 999 },
  itemCountText: { fontSize: 11, fontWeight: '800', color: colors.primary },

  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  sumLabel: { fontSize: fontSize.sm, color: colors.gray500 },
  sumValue: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.gray200, paddingTop: spacing.sm, marginTop: spacing.xs },
  totalLabel: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: fontSize.lg, fontWeight: '700', color: colors.primary },

  notes: { fontSize: fontSize.sm, color: colors.gray600, lineHeight: 20 },

  payHistoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  payCountChip: { paddingHorizontal: 8, paddingVertical: 2, backgroundColor: colors.primary + '15', borderRadius: 999 },
  payCountText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  payRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  payIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.success + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  payDate: { fontSize: 13, fontWeight: '700', color: colors.text },
  payMethodChip: { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.gray100, borderRadius: 4 },
  payMethodText: { fontSize: 9, fontWeight: '700', color: colors.gray600, textTransform: 'uppercase', letterSpacing: 0.3 },
  payRef: { fontSize: 11, color: colors.gray500, marginTop: 2 },
  payAmt: { fontSize: 15, fontWeight: '800', color: colors.success, letterSpacing: -0.3 },

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
