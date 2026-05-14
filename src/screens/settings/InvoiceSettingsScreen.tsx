import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../../api/client';
import { useToast } from '../../components/Toast';
import { colors, spacing } from '../../theme';

const BASE = api.defaults.baseURL || 'https://books.spectrasaas.in';

const FONTS = ['Inter', 'Roboto', 'Poppins', 'Open Sans', 'Lato', 'Nunito', 'Montserrat'];
const SIZES: { value: string; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];
const TEMPLATES = [
  { id: 'classic', name: 'Classic', desc: 'Default dark-header layout', color: '#18181b' },
  { id: 'modern_blue', name: 'Modern Blue', desc: 'Bold blue title with badges', color: '#2596d4' },
  { id: 'tally_tax', name: 'Tally Tax', desc: 'Bordered Tally-style GST', color: '#3f3f46' },
];

export default function InvoiceSettingsScreen({ navigation }: any) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState('');

  const [invoicePrefix, setInvoicePrefix] = useState('INV-');
  const [nextNumber, setNextNumber] = useState('1');
  const [invoiceTitle, setInvoiceTitle] = useState('Invoice');
  const [template, setTemplate] = useState('classic');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [fontSz, setFontSz] = useState('medium');
  const [footerText, setFooterText] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [upiId, setUpiId] = useState('');

  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [signatureUri, setSignatureUri] = useState<string | null>(null);
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [newLogo, setNewLogo] = useState<any>(null);
  const [newSignature, setNewSignature] = useState<any>(null);
  const [newQr, setNewQr] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const biz = await api.get('/api/business');
        const oid = biz.data[0]?.org_id;
        if (!oid) { setLoading(false); return; }
        setOrgId(oid);
        const r = await api.get(`/api/invoice-settings?org_id=${oid}`);
        const s = r.data;
        setInvoicePrefix(s.invoice_prefix || 'INV-');
        setNextNumber(String(s.next_number || 1));
        setInvoiceTitle(s.invoice_title || 'Invoice');
        setTemplate(s.template || 'classic');
        setFontFamily(s.font_family || 'Inter');
        setFontSz(s.font_size || 'medium');
        setFooterText(s.footer_text || '');
        setBankName(s.bank_name || '');
        setBankAccount(s.bank_account || '');
        setBankIfsc(s.bank_ifsc || '');
        setBankBranch(s.bank_branch || '');
        setTermsAndConditions(s.terms_and_conditions || '');
        setUpiId(s.upi_id || '');
        if (s.header_logo) setLogoUri(`${BASE}/assets/invoice/${s.header_logo}`);
        if (s.signature_image) setSignatureUri(`${BASE}/assets/invoice/${s.signature_image}`);
        if (s.qr_code_image) setQrUri(`${BASE}/assets/invoice/${s.qr_code_image}`);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const pickImage = async (setter: (u: string) => void, fileSetter: (f: any) => void) => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!res.canceled && res.assets[0]) {
      const asset = res.assets[0];
      setter(asset.uri);
      const name = asset.uri.split('/').pop() || 'image.jpg';
      const ext = name.split('.').pop()?.toLowerCase() || 'jpeg';
      const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
      fileSetter({ uri: asset.uri, name, type: mimeMap[ext] || 'image/jpeg' });
    }
  };

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('org_id', orgId);
      fd.append('invoice_prefix', invoicePrefix);
      fd.append('next_number', nextNumber);
      fd.append('invoice_title', invoiceTitle);
      fd.append('template', template);
      fd.append('font_family', fontFamily);
      fd.append('font_size', fontSz);
      fd.append('footer_text', footerText);
      fd.append('bank_name', bankName);
      fd.append('bank_account', bankAccount);
      fd.append('bank_ifsc', bankIfsc);
      fd.append('bank_branch', bankBranch);
      fd.append('terms_and_conditions', termsAndConditions);
      fd.append('upi_id', upiId);
      if (newLogo) fd.append('header_logo', newLogo as any);
      if (newSignature) fd.append('signature_image', newSignature as any);
      if (newQr) fd.append('qr_code_image', newQr as any);

      await api.put('/api/invoice-settings', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Settings saved');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  if (loading) return <View style={st.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <ScrollView style={st.container} keyboardShouldPersistTaps="handled">
      {/* Template Selection */}
      <View style={st.card}>
        <Text style={st.cardTitle}>Template</Text>
        <Text style={st.cardSub}>Choose a style for your invoices</Text>
        <View style={{ gap: 8, marginTop: 8 }}>
          {TEMPLATES.map(t => {
            const sel = template === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[st.tplCard, sel && { borderColor: t.color, borderWidth: 2 }]}
                onPress={() => setTemplate(t.id)}
                activeOpacity={0.7}
              >
                <View style={[st.tplDot, { backgroundColor: t.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={st.tplName}>{t.name}</Text>
                  <Text style={st.tplDesc}>{t.desc}</Text>
                </View>
                {sel && <Ionicons name="checkmark-circle" size={22} color={t.color} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Header & Logo */}
      <View style={st.card}>
        <Text style={st.cardTitle}>Header</Text>
        <Text style={st.cardSub}>Logo and title shown on invoices</Text>

        <Text style={st.label}>Header Logo</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {logoUri ? (
            <View style={st.imgWrap}>
              <Image source={{ uri: logoUri }} style={st.imgPreview} />
              <TouchableOpacity style={st.imgRemove} onPress={() => { setLogoUri(null); setNewLogo(null); }}>
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={st.imgPlaceholder} onPress={() => pickImage(setLogoUri, setNewLogo)}>
              <Ionicons name="image-outline" size={24} color={colors.gray400} />
              <Text style={st.imgPlaceholderText}>Logo</Text>
            </TouchableOpacity>
          )}
          {logoUri && (
            <TouchableOpacity style={st.changeBtn} onPress={() => pickImage(setLogoUri, setNewLogo)}>
              <Text style={st.changeBtnText}>Change</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={[st.label, { marginTop: 16 }]}>Invoice Title</Text>
        <TextInput style={st.input} value={invoiceTitle} onChangeText={setInvoiceTitle} placeholder="Invoice" placeholderTextColor={colors.gray400} />
      </View>

      {/* Numbering */}
      <View style={st.card}>
        <Text style={st.cardTitle}>Numbering</Text>
        <Text style={st.cardSub}>Auto-generated invoice number format</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={st.label}>Prefix</Text>
            <TextInput style={st.input} value={invoicePrefix} onChangeText={setInvoicePrefix} placeholder="INV-" placeholderTextColor={colors.gray400} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.label}>Next Number</Text>
            <TextInput style={st.input} value={nextNumber} onChangeText={setNextNumber} keyboardType="number-pad" placeholder="1" placeholderTextColor={colors.gray400} />
          </View>
        </View>
        <View style={st.previewBox}>
          <Ionicons name="document-text-outline" size={14} color={colors.primary} />
          <Text style={st.previewText}>Preview: {invoicePrefix}{String(nextNumber).padStart(5, '0')}</Text>
        </View>
      </View>

      {/* Typography */}
      <View style={st.card}>
        <Text style={st.cardTitle}>Typography</Text>
        <Text style={st.label}>Font Family</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 6 }}>
          {FONTS.map(f => (
            <TouchableOpacity
              key={f}
              style={[st.chip, fontFamily === f && st.chipActive]}
              onPress={() => setFontFamily(f)}
            >
              <Text style={[st.chipText, fontFamily === f && st.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={st.label}>Font Size</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {SIZES.map(sz => (
            <TouchableOpacity
              key={sz.value}
              style={[st.chip, fontSz === sz.value && st.chipActive, { flex: 1, alignItems: 'center' }]}
              onPress={() => setFontSz(sz.value)}
            >
              <Text style={[st.chipText, fontSz === sz.value && st.chipTextActive]}>{sz.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Signature */}
      <View style={st.card}>
        <Text style={st.cardTitle}>Signature</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {signatureUri ? (
            <View style={st.imgWrap}>
              <Image source={{ uri: signatureUri }} style={[st.imgPreview, { width: 120, height: 50 }]} resizeMode="contain" />
              <TouchableOpacity style={st.imgRemove} onPress={() => { setSignatureUri(null); setNewSignature(null); }}>
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={[st.imgPlaceholder, { width: 120, height: 50 }]} onPress={() => pickImage(setSignatureUri, setNewSignature)}>
              <Ionicons name="pencil-outline" size={20} color={colors.gray400} />
              <Text style={st.imgPlaceholderText}>Signature</Text>
            </TouchableOpacity>
          )}
          {signatureUri && (
            <TouchableOpacity style={st.changeBtn} onPress={() => pickImage(setSignatureUri, setNewSignature)}>
              <Text style={st.changeBtnText}>Change</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Bank Details */}
      <View style={st.card}>
        <Text style={st.cardTitle}>Bank Details</Text>
        <Text style={st.cardSub}>Shown on invoice for payment reference</Text>
        <Text style={st.label}>Bank Name</Text>
        <TextInput style={st.input} value={bankName} onChangeText={setBankName} placeholder="Bank name" placeholderTextColor={colors.gray400} />
        <Text style={st.label}>Account Number</Text>
        <TextInput style={st.input} value={bankAccount} onChangeText={setBankAccount} placeholder="Account number" keyboardType="number-pad" placeholderTextColor={colors.gray400} />
        <Text style={st.label}>IFSC Code</Text>
        <TextInput style={st.input} value={bankIfsc} onChangeText={setBankIfsc} placeholder="IFSC code" autoCapitalize="characters" placeholderTextColor={colors.gray400} />
        <Text style={st.label}>Branch</Text>
        <TextInput style={st.input} value={bankBranch} onChangeText={setBankBranch} placeholder="Branch name" placeholderTextColor={colors.gray400} />
      </View>

      {/* UPI */}
      <View style={st.card}>
        <Text style={st.cardTitle}>UPI Payment</Text>
        <Text style={st.cardSub}>UPI ID for dynamic QR code on invoices</Text>
        <Text style={st.label}>UPI ID</Text>
        <TextInput style={st.input} value={upiId} onChangeText={setUpiId} placeholder="e.g. business@upi" placeholderTextColor={colors.gray400} autoCapitalize="none" keyboardType="email-address" />
      </View>

      {/* QR Code */}
      <View style={st.card}>
        <Text style={st.cardTitle}>QR Code</Text>
        <Text style={st.cardSub}>Static payment QR (fallback when UPI QR is off)</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {qrUri ? (
            <View style={st.imgWrap}>
              <Image source={{ uri: qrUri }} style={st.imgPreview} />
              <TouchableOpacity style={st.imgRemove} onPress={() => { setQrUri(null); setNewQr(null); }}>
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={st.imgPlaceholder} onPress={() => pickImage(setQrUri, setNewQr)}>
              <Ionicons name="qr-code-outline" size={24} color={colors.gray400} />
              <Text style={st.imgPlaceholderText}>QR</Text>
            </TouchableOpacity>
          )}
          {qrUri && (
            <TouchableOpacity style={st.changeBtn} onPress={() => pickImage(setQrUri, setNewQr)}>
              <Text style={st.changeBtnText}>Change</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Terms & Conditions */}
      <View style={st.card}>
        <Text style={st.cardTitle}>Terms & Conditions</Text>
        <TextInput
          style={[st.input, { minHeight: 100, textAlignVertical: 'top' }]}
          value={termsAndConditions}
          onChangeText={setTermsAndConditions}
          placeholder="Enter terms and conditions..."
          multiline
          placeholderTextColor={colors.gray400}
        />
      </View>

      {/* Footer */}
      <View style={st.card}>
        <Text style={st.cardTitle}>Footer Text</Text>
        <TextInput
          style={[st.input, { minHeight: 60, textAlignVertical: 'top' }]}
          value={footerText}
          onChangeText={setFooterText}
          placeholder="e.g. Thank you for your business"
          multiline
          placeholderTextColor={colors.gray400}
        />
      </View>

      {/* Save Button */}
      <View style={{ paddingHorizontal: spacing.md, marginBottom: 40 }}>
        <TouchableOpacity style={st.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
          {saving ? <ActivityIndicator color="#fff" size={18} /> : <Ionicons name="checkmark-circle" size={20} color="#fff" />}
          <Text style={st.saveBtnText}>Save Settings</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: {
    backgroundColor: '#fff', marginHorizontal: spacing.md, marginTop: spacing.sm,
    borderRadius: 16, padding: spacing.md,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 12, color: colors.gray500, marginBottom: 10 },

  label: { fontSize: 12, fontWeight: '600', color: colors.gray500, marginBottom: 4, marginTop: 10 },
  input: {
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text,
  },

  previewBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary + '08', borderRadius: 8,
    padding: 10, marginTop: 10,
  },
  previewText: { fontSize: 13, fontWeight: '600', color: colors.primary },

  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  chipText: { fontSize: 12, fontWeight: '500', color: colors.gray500 },
  chipTextActive: { color: colors.primary, fontWeight: '700' },

  tplCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f9fafb', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  tplDot: { width: 14, height: 14, borderRadius: 7 },
  tplName: { fontSize: 14, fontWeight: '600', color: colors.text },
  tplDesc: { fontSize: 11, color: colors.gray500 },

  imgWrap: { position: 'relative' },
  imgPreview: { width: 70, height: 70, borderRadius: 10, backgroundColor: '#f3f4f6' },
  imgRemove: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center',
  },
  imgPlaceholder: {
    width: 70, height: 70, borderRadius: 10, borderWidth: 2,
    borderColor: '#e5e7eb', borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
  },
  imgPlaceholderText: { fontSize: 9, color: colors.gray400, marginTop: 2 },

  changeBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: colors.primary + '10',
  },
  changeBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
