import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import CurrencyText from '../../components/CurrencyText';

const escHtml = (s: any) =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtAmt = (n: number) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};
const numToWords = (num: number): string => {
  // Simple Indian numbering words
  if (!num || num <= 0) return 'Zero';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const inWords = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + inWords(n % 10000000) : '');
  };
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  let out = inWords(rupees) + ' Rupees';
  if (paise) out += ' and ' + inWords(paise) + ' Paise';
  return out + ' Only';
};

export default function PaymentDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const { id } = route.params;
  const [payment, setPayment] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [pmt, biz] = await Promise.all([
        api.get(`/api/payments/${id}`),
        api.get('/api/business'),
      ]);
      setPayment(pmt.data);
      setBusiness(biz.data?.[0] || null);
    } catch (e: any) {
      Alert.alert('Error', 'Could not load payment');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = () => {
    Alert.alert('Delete Payment?', 'This will reverse the invoice allocation. Cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/api/payments/${id}`);
            navigation.goBack();
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.detail || 'Failed to delete');
          }
        },
      },
    ]);
  };

  const buildHTML = () => {
    if (!payment) return '';
    const BASE = require('../../api/client').BASE_URL;
    const logoUrl = business?.business_logo
      ? business.business_logo.startsWith('http')
        ? business.business_logo
        : `${BASE}/assets/logos/${business.business_logo}`
      : null;
    const meta: string[] = [];
    if (business?.address) meta.push(escHtml(business.address));
    const contact: string[] = [];
    if (business?.mobile) contact.push(`Tel: ${escHtml(business.mobile)}`);
    if (business?.email) contact.push(escHtml(business.email));
    if (contact.length) meta.push(contact.join('  •  '));
    const ids: string[] = [];
    if (business?.gst_number) ids.push(`GSTIN: ${escHtml(business.gst_number)}`);
    if (business?.pan) ids.push(`PAN: ${escHtml(business.pan)}`);
    if (ids.length) meta.push(ids.join('  •  '));

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,Helvetica,Arial,sans-serif;margin:0;padding:32px;color:#161620;font-size:12px;line-height:1.5}
  .header{display:flex;align-items:flex-start;gap:14px;padding-bottom:14px;border-bottom:2px solid #1a1a40}
  .logo{width:64px;height:64px;object-fit:contain}
  .biz-name{font-size:22px;font-weight:800;color:#1a1a40;margin:0;letter-spacing:-0.3px}
  .biz-meta{color:#6e7382;font-size:11px;margin-top:4px;line-height:1.5}
  .receipt-no{font-size:11px;color:#6e7382;text-align:right}
  .receipt-no .num{font-size:14px;font-weight:800;color:#1a1a40;letter-spacing:0.5px}
  .title{text-align:center;font-size:22px;font-weight:800;color:#1a1a40;letter-spacing:3px;margin:28px 0 8px}
  .title-rule{height:2px;background:#1a1a40;width:80px;margin:0 auto 28px}
  .info-grid{display:flex;gap:16px;margin-bottom:24px}
  .info-card{flex:1;background:#fafbfd;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px}
  .info-label{font-size:9px;font-weight:700;color:#6e7382;letter-spacing:0.6px;text-transform:uppercase;margin-bottom:4px}
  .info-val{font-size:14px;font-weight:700;color:#161620}
  .info-sub{font-size:11px;color:#6e7382;margin-top:2px}
  .amount-card{background:#dcfce7;border:2px solid #15803d;border-radius:10px;padding:20px;text-align:center;margin-bottom:20px}
  .amount-label{font-size:10px;font-weight:700;color:#15803d;letter-spacing:0.6px;text-transform:uppercase}
  .amount-val{font-size:34px;font-weight:800;color:#15803d;letter-spacing:-0.5px;margin-top:4px}
  .amount-words{font-size:11px;color:#15803d;font-style:italic;margin-top:6px}
  .row{display:flex;border-bottom:1px solid #ececf2;padding:10px 0}
  .row .lbl{flex:0 0 35%;color:#6e7382;font-size:11px;font-weight:600}
  .row .val{flex:1;color:#161620;font-size:12px;font-weight:600;text-align:right}
  .badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;background:#e0e7ff;color:#3730a3}
  .signature{display:flex;justify-content:space-between;margin-top:48px}
  .sig-block{text-align:center;width:200px}
  .sig-line{border-top:1px solid #161620;padding-top:6px;font-size:10px;color:#6e7382;font-weight:600}
  .footer{margin-top:32px;padding-top:12px;border-top:1px solid #dcdee6;color:#6e7382;font-size:10px;font-style:italic;text-align:center}
</style></head><body>
  <div class="header">
    ${logoUrl ? `<img class="logo" src="${escHtml(logoUrl)}"/>` : ''}
    <div style="flex:1">
      <div class="biz-name">${escHtml(business?.business_name || 'Receipt')}</div>
      <div class="biz-meta">${meta.join('<br/>')}</div>
    </div>
    <div class="receipt-no">
      Receipt #<br/>
      <span class="num">PMT-${String(payment.id).padStart(5, '0')}</span><br/>
      <span style="font-size:10px">Date: ${fmtDate(payment.payment_date)}</span>
    </div>
  </div>

  <div class="title">PAYMENT RECEIPT</div>
  <div class="title-rule"></div>

  <div class="info-grid">
    <div class="info-card">
      <div class="info-label">Received From</div>
      <div class="info-val">${escHtml(payment.customer_name || '—')}</div>
    </div>
    <div class="info-card">
      <div class="info-label">Payment Method</div>
      <div class="info-val">${escHtml(payment.payment_method || 'Cash')}</div>
      ${payment.reference_number ? `<div class="info-sub">Ref: ${escHtml(payment.reference_number)}</div>` : ''}
    </div>
  </div>

  <div class="amount-card">
    <div class="amount-label">Amount Received</div>
    <div class="amount-val">₹${fmtAmt(payment.amount)}</div>
    <div class="amount-words">(${escHtml(numToWords(payment.amount))})</div>
  </div>

  <div class="row"><div class="lbl">Payment Date</div><div class="val">${fmtDate(payment.payment_date)}</div></div>
  ${payment.invoice_number ? `<div class="row"><div class="lbl">Against Invoice</div><div class="val">#${escHtml(payment.invoice_number)}</div></div>` : ''}
  <div class="row"><div class="lbl">Method</div><div class="val"><span class="badge">${escHtml(payment.payment_method || 'Cash')}</span></div></div>
  ${payment.reference_number ? `<div class="row"><div class="lbl">Reference</div><div class="val">${escHtml(payment.reference_number)}</div></div>` : ''}
  ${payment.notes ? `<div class="row"><div class="lbl">Notes</div><div class="val" style="text-align:right;font-weight:500">${escHtml(payment.notes)}</div></div>` : ''}

  <div class="signature">
    <div class="sig-block"><div class="sig-line">Receiver's Signature</div></div>
    <div class="sig-block"><div class="sig-line">Authorised Signatory</div></div>
  </div>

  <div class="footer">This is a computer-generated receipt. Generated on ${fmtDate(new Date().toISOString())}.</div>
</body></html>`;
  };

  const handleDownloadPDF = async () => {
    setExporting(true);
    try {
      const html = buildHTML();
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Receipt PMT-${payment?.id}`,
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'PDF failed');
    } finally { setExporting(false); }
  };

  const handleShare = async () => {
    setExporting(true);
    try {
      const html = buildHTML();
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share Receipt`,
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Share failed');
    } finally { setExporting(false); }
  };

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!payment) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center', padding: spacing.lg }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.gray400} />
        <Text style={{ marginTop: spacing.md, color: colors.gray600 }}>Payment not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
      {/* Hero amount card */}
      <View style={s.heroCard}>
        <View style={s.heroIconWrap}>
          <Ionicons name="checkmark-circle" size={28} color="#fff" />
        </View>
        <Text style={s.heroLabel}>Payment Received</Text>
        <CurrencyText amount={payment.amount} style={s.heroAmount} />
        <Text style={s.heroDate}>{fmtDate(payment.payment_date)}</Text>
        <View style={s.heroBadge}>
          <Ionicons name="card-outline" size={11} color="#fff" />
          <Text style={s.heroBadgeText}>{payment.payment_method || 'Cash'}</Text>
        </View>
      </View>

      {/* Quick actions */}
      <View style={s.qActions}>
        <TouchableOpacity style={s.qAction} onPress={handleDownloadPDF} disabled={exporting}>
          <View style={[s.qIcon, { backgroundColor: colors.success + '20' }]}>
            {exporting ? <ActivityIndicator size="small" color={colors.success} /> : <Ionicons name="download-outline" size={20} color={colors.success} />}
          </View>
          <Text style={s.qLabel}>PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.qAction} onPress={handleShare} disabled={exporting}>
          <View style={[s.qIcon, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="share-social-outline" size={20} color={colors.primary} />
          </View>
          <Text style={s.qLabel}>Share</Text>
        </TouchableOpacity>
        {payment.invoice_id ? (
          <TouchableOpacity
            style={s.qAction}
            onPress={() => navigation.getParent()?.navigate('Invoices', { screen: 'InvoiceDetail', params: { id: payment.invoice_id }, initial: false })}
          >
            <View style={[s.qIcon, { backgroundColor: '#3b82f6' + '20' }]}>
              <Ionicons name="document-text-outline" size={20} color="#3b82f6" />
            </View>
            <Text style={s.qLabel}>Invoice</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={s.qAction} onPress={handleDelete}>
          <View style={[s.qIcon, { backgroundColor: colors.danger + '20' }]}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </View>
          <Text style={s.qLabel}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Customer Card */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Received From</Text>
        <View style={s.partyRow}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{(payment.customer_name || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.partyName}>{payment.customer_name || '—'}</Text>
            {payment.invoice_number ? (
              <Text style={s.partySub}>Against Invoice #{payment.invoice_number}</Text>
            ) : (
              <Text style={s.partySub}>Advance / Direct Payment</Text>
            )}
          </View>
        </View>
      </View>

      {/* Details */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Payment Details</Text>
        <View style={s.row}>
          <Text style={s.rowLabel}>Date</Text>
          <Text style={s.rowVal}>{fmtDate(payment.payment_date)}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.rowLabel}>Method</Text>
          <View style={s.methodChip}>
            <Text style={s.methodChipText}>{payment.payment_method || 'Cash'}</Text>
          </View>
        </View>
        {payment.reference_number ? (
          <View style={s.row}>
            <Text style={s.rowLabel}>Reference</Text>
            <Text style={s.rowVal}>{payment.reference_number}</Text>
          </View>
        ) : null}
        {payment.invoice_number ? (
          <View style={s.row}>
            <Text style={s.rowLabel}>Invoice</Text>
            <TouchableOpacity
              onPress={() => navigation.getParent()?.navigate('Invoices', { screen: 'InvoiceDetail', params: { id: payment.invoice_id }, initial: false })}
            >
              <Text style={[s.rowVal, { color: colors.primary, textDecorationLine: 'underline' }]}>
                #{payment.invoice_number}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={[s.row, { borderBottomWidth: 0 }]}>
          <Text style={s.rowLabel}>Receipt #</Text>
          <Text style={s.rowVal}>PMT-{String(payment.id).padStart(5, '0')}</Text>
        </View>
      </View>

      {/* Notes */}
      {payment.notes ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Notes</Text>
          <Text style={s.notes}>{payment.notes}</Text>
        </View>
      ) : null}

      <Text style={s.footerText}>This receipt is for record purposes only.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },

  heroCard: {
    backgroundColor: colors.success,
    borderRadius: 22,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.success, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  heroIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  heroAmount: { color: '#fff', fontSize: 38, fontWeight: '800', letterSpacing: -0.8, marginTop: 4 },
  heroDate: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', marginTop: 4 },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
    marginTop: spacing.sm,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  heroBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  qActions: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  qAction: { alignItems: 'center', flex: 1, gap: 6 },
  qIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  qLabel: { fontSize: 11, color: colors.gray600, fontWeight: '600' },

  section: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.gray700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.sm },

  partyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: colors.primary },
  partyName: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  partySub: { fontSize: 12, color: colors.gray500, marginTop: 2 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  rowLabel: { fontSize: fontSize.sm, color: colors.gray500, fontWeight: '500' },
  rowVal: { fontSize: fontSize.sm, color: colors.text, fontWeight: '700' },
  methodChip: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.primary + '12', borderRadius: 999 },
  methodChipText: { fontSize: 11, fontWeight: '800', color: colors.primary, letterSpacing: 0.3 },

  notes: { fontSize: fontSize.sm, color: colors.gray600, lineHeight: 20 },

  footerText: { textAlign: 'center', fontSize: 10, color: colors.gray400, fontStyle: 'italic', marginTop: spacing.sm },
});
