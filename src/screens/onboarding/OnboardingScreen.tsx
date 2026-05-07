import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import api from '../../api/client';
import { useToast } from '../../components/Toast';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

export default function OnboardingScreen({ navigation, route }: { navigation: any; route?: any }) {
  const toast = useToast();
  const editId: string | undefined = route?.params?.editId;
  const isEdit = !!editId;
  const [form, setForm] = useState({
    business_name: '', contact_person: '', mobile: '', email: '', address: '',
    pan: '', gst_registered: false, gst_number: '', tax_info: 'GST',
  });
  const [logo, setLogo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await api.get(`/api/business/${editId}`);
        const b = res.data;
        setForm({
          business_name: b.business_name || '',
          contact_person: b.contact_person || '',
          mobile: b.mobile || '',
          email: b.email || '',
          address: b.address || '',
          pan: b.pan || '',
          gst_registered: !!b.gst_registered,
          gst_number: b.gst_number || '',
          tax_info: b.tax_info || 'GST',
        });
      } catch {}
    })();
  }, [editId, isEdit]);

  const pickLogo = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled) setLogo(res.assets[0]);
  };

  const handleSubmit = async () => {
    if (!form.business_name || !form.contact_person || !form.mobile) {
      return Alert.alert('Error', 'Business name, contact person, and mobile are required');
    }
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
      if (logo) {
        fd.append('business_logo', { uri: logo.uri, name: 'logo.jpg', type: 'image/jpeg' } as any);
      }
      // Mark business as stealth if creating in private mode
      const stealthActive = await SecureStore.getItemAsync('stealth_active');
      if (stealthActive === '1' && !isEdit) {
        fd.append('is_stealth', 'true');
      }
      if (isEdit) {
        await api.put(`/api/business/${editId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Business updated');
        navigation.goBack();
      } else {
        await api.post('/api/business', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Business created');
        navigation.goBack();
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const update = (key: string, val: any) => setForm(p => ({ ...p, [key]: val }));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <TouchableOpacity style={styles.logoPicker} onPress={pickLogo}>
            <Text style={styles.logoText}>{logo ? '✓ Logo Selected' : (isEdit ? 'Change Business Logo' : 'Pick Business Logo')}</Text>
          </TouchableOpacity>

          {[
            { key: 'business_name', label: 'Business Name *', placeholder: 'Your business' },
            { key: 'contact_person', label: 'Contact Person *', placeholder: 'Full name' },
            { key: 'mobile', label: 'Mobile *', placeholder: '9876543210', keyboard: 'phone-pad' as const },
            { key: 'email', label: 'Email', placeholder: 'business@email.com', keyboard: 'email-address' as const },
            { key: 'address', label: 'Address', placeholder: 'Business address', multiline: true },
            { key: 'pan', label: 'PAN', placeholder: 'ABCDE1234F' },
          ].map(f => (
            <View key={f.key}>
              <Text style={styles.label}>{f.label}</Text>
              <TextInput
                style={[styles.input, f.multiline && { height: 80, textAlignVertical: 'top' }]}
                value={(form as any)[f.key]}
                onChangeText={v => update(f.key, v)}
                placeholder={f.placeholder}
                placeholderTextColor={colors.placeholder}
                keyboardType={f.keyboard}
                multiline={f.multiline}
              />
            </View>
          ))}

          <View style={styles.switchRow}>
            <Text style={styles.label}>GST Registered</Text>
            <Switch value={form.gst_registered} onValueChange={v => update('gst_registered', v)} trackColor={{ true: colors.primary }} />
          </View>

          {form.gst_registered && (
            <>
              <Text style={styles.label}>GST Number</Text>
              <TextInput style={styles.input} value={form.gst_number} onChangeText={v => update('gst_number', v)} placeholder="22ABCDE1234F1Z5" placeholderTextColor={colors.placeholder} autoCapitalize="characters" />
            </>
          )}

          <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
            <Text style={styles.btnText}>{loading ? (isEdit ? 'Updating...' : 'Creating...') : (isEdit ? 'Update Business' : 'Create Business')}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  card: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg },
  logoPicker: { borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', borderRadius: borderRadius.md, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md },
  logoText: { color: colors.accent, fontWeight: '600' },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, padding: spacing.md, fontSize: fontSize.md, color: colors.text },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  btn: { backgroundColor: colors.primary, borderRadius: borderRadius.sm, padding: spacing.md, alignItems: 'center', marginTop: spacing.xl },
  btnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
});
