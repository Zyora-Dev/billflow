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
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtAmt = (n: number) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};
const numToWords = (num: number): string => {
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

const methodColor = (m: string) => {
  switch (m) {
    case 'Cash': return { bg: '#dcfce7', fg: '#15803d' };
    case 'UPI': return { bg: '#ede9fe', fg: '#7c3aed' };
    case 'Bank Transfer': return { bg: '#dbeafe', fg: '#1d4ed8' };
    case 'Cheque': return { bg: '#fef3c7', fg: '#b45309' };
    case 'Card': return { bg: '#fce7f3', fg: '#be185d' };
    default: return { bg: '#f3f4f6', fg: '#4b5563' };
  }
};

export default function PaymentVoucherDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const { id } = route.params;
  const [payment, setPayment] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [pmt, biz] = await Promise.all([
        api.get(`/api/purchase-payments/${id}`),
        api.get('/api/business'),
      ]);
      setPayment(pmt.data);
      setBusiness(biz.data?.[0] || null);
    } catch {
      Alert.alert('Error', 'Could not load voucher');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const voucherNo = `VCH-${String(payment?.id || 0).padStart(5, '0')}`;

  const handleDelete = () => {
    Alert.alert('Delete Payment?', 'This will reverse the bill allocation. Cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/api/purchase-payments/${id}`);
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
  .header{display:flex;align-items:flex-start;gap:14px;padding-bottom:14px;border-bottom:2px solid #dc2626}
  .logo{width:64px;height:64px;object-fit:contain}
  .biz-name{font-size:22px;font-weight:800;color:#dc2626;margin:0;letter-spacing:-0.3px}
  .biz-meta{color:#6e7382;font-size:11px;margin-top:4px;line-height:1.5}
  .vch-no{font-size:11px;color:#6e7382;text-align:right}
  .vch-no .num{font-size:14px;font-weight:800;color:#dc2626;letter-spacing:0.5px}
  .title{text-align:center;font-size:22px;font-weight:800;color:#dc2626;letter-spacing:3px;margin:28px 0 8px}
  .title-rule{height:2px;background:#dc2626;width:80px;margin:0 auto 28px}
  .info-grid{display:flex;gap:16px;margin-bottom:24px}
  .info-card{flex:1;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 16px}
  .info-label{font-size:9px;font-weight:700;color:#6e7382;letter-spacing:0.6px;text-transform:uppercase;margin-bottom:4px}
  .info-val{font-size:14px;font-weight:700;color:#161620}
  .info-sub{font-size:11px;color:#6e7382;margin-top:2px}
  .amount-card{background:#fef2f2;border:2px solid #dc2626;border-radius:10px;padding:20px;text-align:center;margin-bottom:20px}
  .amount-label{font-size:10px;font-weight:700;color:#dc2626;letter-spacing:0.6px;text-transform:uppercase}
  .amount-val{font-size:34px;font-weight:800;color:#dc2626;letter-spacing:-0.5px;margin-top:4px}
  .amount-words{font-size:11px;color:#dc2626;font-style:italic;margin-top:6px}
  .row{display:flex;border-bottom:1px solid #ececf2;padding:10px 0}
  .row .lbl{flex:0 0 35%;color:#6e7382;font-size:11px;font-weight:600}
  .row .val{flex:1;color:#161620;font-size:12px;font-weight:600;text-align:right}
  .badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;background:#fef2f2;color:#dc2626}
  .signature{display:flex;justify-content:space-between;margin-top:48px}
  .sig-block{text-align:center;width:200px}
  .sig-line{border-top:1px solid #161620;padding-top:6px;font-size:10px;color:#6e7382;font-weight:600}
  .footer{margin-top:32px;padding-top:12px;border-top:1px solid #dcdee6;color:#6e7382;font-size:10px;font-style:italic;text-align:center}
</style></head><body>
  <div class="header">
    ${logoUrl ? `<img class="logo" src="${escHtml(logoUrl)}"/>` : ''}
    <div style="flex:1">
      <div class="biz-name">${escHtml(business?.business_name || 'Payment Voucher')}</div>
      <div class="biz-meta">${meta.join('<br/>')}</div>
    </div>
    <div class="vch-no">
      Voucher #<br/>
      <span class="num">${voucherNo}</span><br/>
      <span style="font-size:10px">Date: ${fmtDate(payment.payment_date)}</span>
    </div>
  </div>

  <div class="title">PAYMENT VOUCHER</div>
  <div class="title-rule"></div>

  <div class="info-grid">
    <div class="info-card">
      <div class="info-label">Paid To</div>
      <div class="info-val">${escHtml(payment.vendor_name || '—')}</div>
    </div>
    <div class="info-card">
      <div class="info-label">Payment Method</div>
      <div class="info-val">${escHtml(payment.payment_method || 'Cash')}</div>
      ${payment.reference_number ? `<div class="info-sub">Ref: ${escHtml(payment.reference_number)}</div>` : ''}
    </div>
  </div>

  <div class="amount-card">
    <div class="amount-label">Amount Paid</div>
    <div class="amount-val">₹${fmtAmt(payment.amount)}</div>
    <div class="amount-words">(${escHtml(numToWords(payment.amount))})</div>
  </div>

  <div class="row"><div class="lbl">Payment Date</div><div class="val">${fmtDate(payment.payment_date)}</div></div>
  ${payment.bill_number ? `<div class="row"><div class="lbl">Against Bill</div><div class="val">#${escHtml(payment.bill_number)}</div></div>` : ''}
  <div class="row"><div class="lbl">Method</div><div class="val"><span class="badge">${escHtml(payment.payment_method || 'Cash')}</span></div></div>
  ${payment.reference_number ? `<div class="row"><div class="lbl">Reference</div><div class="val">${escHtml(payment.reference_number)}</div></div>` : ''}
  ${payment.notes ? `<div class="row"><div class="lbl">Notes</div><div class="val" style="text-align:right;font-weight:500">${escHtml(payment.notes)}</div></div>` : ''}

  <div class="signature">
    <div class="sig-block"><div class="sig-line">Paid By</div></div>
    <div class="sig-block"><div class="sig-line">Authorised Signatory</div></div>
  </div>

  <div class="footer">This is a computer-generated payment voucher. Generated on ${fmtDate(new Date().toISOString())}.</div>
</body></html>`;
  };

  const handlePDF = async () => {
    setExporting(true);
    try {
      const html = buildHTML();
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Voucher ${voucherNo}`, UTI: 'com.adobe.pdf' });
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
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Voucher', UTI: 'com.adobe.pdf' });
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
        <Text style={{ marginTop: spacing.md, color: colors.gray600 }}>Voucher not found</Text>
      </View>
    );
  }

  const mc = methodColor(payment.payment_method);

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
      {/* Hero */}
      <View style={s.heroCard}>
        <View style={s.heroIconWrap}>
          <Ionicons name="wallet" size={28} color="#fff" />
        </View>
        <Text style={s.heroLabel}>Payment Made</Text>
        <CurrencyText amount={payment.amount} style={s.heroAmount} />
        <Text style={s.heroDate}>{fmtDate(payment.payment_date)}</Text>
        <View style={s.heroBadge}>
          <Ionicons name="card-outline" size={11} color="#fff" />
          <Text style={s.heroBadgeText}>{payment.payment_method || 'Cash'}</Text>
        </View>
      </View>

      {/* Voucher number strip */}
      <View style={s.voucherStrip}>
        <Ionicons name="document-text-outline" size={16} color="#dc2626" />
        <Text style={s.voucherStripText}>{voucherNo}</Text>
      </View>

      {/* Quick actions */}
      <View style={s.qActions}>
        <TouchableOpacity style={s.qAction} onPress={handlePDF} disabled={exporting}>
          <View style={[s.qIcon, { backgroundColor: '#dc2626' + '20' }]}>
            {exporting ? <ActivityIndicator size="small" color="#dc2626" /> : <Ionicons name="download-outline" size={20} color="#dc2626" />}
          </View>
          <Text style={s.qLabel}>PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.qAction} onPress={handleShare} disabled={exporting}>
          <View style={[s.qIcon, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="share-social-outline" size={20} color={colors.primary} />
          </View>
          <Text style={s.qLabel}>Share</Text>
        </TouchableOpacity>
        {payment.purchase_bill_id ? (
          <TouchableOpacity
            style={s.qAction}
            onPress={() => navigation.getParent()?.navigate('Purchase', { screen: 'PBDetail', params: { id: payment.purchase_bill_id }, initial: false })}
          >
            <View style={[s.qIcon, { backgroundColor: '#3b82f6' + '20' }]}>
              <Ionicons name="document-text-outline" size={20} color="#3b82f6" />
            </View>
            <Text style={s.qLabel}>Bill</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={s.qAction} onPress={handleDelete}>
          <View style={[s.qIcon, { backgroundColor: colors.danger + '20' }]}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </View>
          <Text style={s.qLabel}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Vendor Card */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Paid To</Text>
        <View style={s.partyRow}>
          <View style={[s.avatar, { backgroundColor: '#dc262615' }]}>
            <Text style={[s.avatarText, { color: '#dc2626' }]}>{(payment.vendor_name || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.partyName}>{payment.vendor_name || '—'}</Text>
            {payment.bill_number ? (
              <Text style={s.partySub}>Against Bill #{payment.bill_number}</Text>
            ) : (
              <Text style={s.partySub}>Advance / Direct Payment</Text>
            )}
          </View>
        </View>
      </View>

      {/* Amount in Words */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Amount in Words</Text>
        <Text style={s.amountWords}>{numToWords(payment.amount)}</Text>
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
          <View style={[s.methodChip, { backgroundColor: mc.bg }]}>
            <Text style={[s.methodChipText, { color: mc.fg }]}>{payment.payment_method || 'Cash'}</Text>
          </View>
        </View>
        {payment.reference_number ? (
          <View style={s.row}>
            <Text style={s.rowLabel}>Reference</Text>
            <Text style={s.rowVal}>{payment.reference_number}</Text>
          </View>
        ) : null}
        {payment.bill_number ? (
          <View style={s.row}>
            <Text style={s.rowLabel}>Bill</Text>
            <TouchableOpacity
              onPress={() => navigation.getParent()?.navigate('Purchase', { screen: 'PBDetail', params: { id: payment.purchase_bill_id }, initial: false })}
            >
              <Text style={[s.rowVal, { color: '#dc2626', textDecorationLine: 'underline' }]}>
                #{payment.bill_number}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={[s.row, { borderBottomWidth: 0 }]}>
          <Text style={s.rowLabel}>Voucher #</Text>
          <Text style={s.rowVal}>{voucherNo}</Text>
        </View>
      </View>

      {/* Notes */}
      {payment.notes ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Notes</Text>
          <Text style={s.notes}>{payment.notes}</Text>
        </View>
      ) : null}

      <Text style={s.footerText}>This voucher is for record purposes only.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },

  heroCard: {
    backgroundColor: '#dc2626',
    borderRadius: 22,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    shadowColor: '#dc2626', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5,
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

  voucherStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#dc262610',
    borderRadius: borderRadius.md,
    paddingVertical: 8, marginBottom: spacing.md,
    borderWidth: 1, borderColor: '#dc262625',
  },
  voucherStripText: { fontSize: fontSize.sm, fontWeight: '800', color: '#dc2626', letterSpacing: 0.5 },

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
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800' },
  partyName: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  partySub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },

  amountWords: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, fontStyle: 'italic', lineHeight: 22 },

  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.xs + 4,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  rowVal: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },

  methodChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  methodChipText: { fontSize: 12, fontWeight: '700' },

  notes: { fontSize: fontSize.sm, color: colors.gray600, lineHeight: 20 },
  footerText: { textAlign: 'center', fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.md, fontStyle: 'italic' },
});
