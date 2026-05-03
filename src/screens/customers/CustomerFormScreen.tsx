import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import api from '../../api/client';
import { useToast } from '../../components/Toast';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

export default function CustomerFormScreen({ route, navigation }: { route: any; navigation: any }) {
  const toast = useToast();
  const editId = route.params?.id;
  const [form, setForm] = useState({
    contact_person: '', business_name: '', type: 'individual', mobile: '', email: '',
    pan: '', gst_registered: false, gst_number: '', tax_info: 'GST', address: '',
  });
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/api/business').then(r => setOrgId(r.data[0]?.org_id || '')).catch(() => {});
    if (editId) {
      api.get(`/api/customers/${editId}`).then(r => {
        const c = r.data;
        setForm({
          contact_person: c.contact_person || '', business_name: c.business_name || '',
          type: c.type || 'individual', mobile: c.mobile || '', email: c.email || '',
          pan: c.pan || '', gst_registered: c.gst_registered || false,
          gst_number: c.gst_number || '', tax_info: c.tax_info || 'GST', address: c.address || '',
        });
      }).catch(() => {});
    }
  }, [editId]);

  const handleSave = async () => {
    if (!form.contact_person) return Alert.alert('Error', 'Contact person is required');
    setLoading(true);
    try {
      if (editId) {
        await api.put(`/api/customers/${editId}`, form);
      } else {
        await api.post('/api/customers', { ...form, org_id: orgId });
      }
      toast.success(editId ? 'Customer updated' : 'Customer created');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const update = (key: string, val: any) => setForm(p => ({ ...p, [key]: val }));

  const typeOptions = ['individual', 'business'];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.label}>Type</Text>
          <View style={styles.typeRow}>
            {typeOptions.map(t => (
              <TouchableOpacity key={t} style={[styles.typeBtn, form.type === t && styles.typeBtnActive]} onPress={() => update('type', t)}>
                <Text style={[styles.typeText, form.type === t && styles.typeTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {[
            { key: 'contact_person', label: 'Contact Person *', placeholder: 'Full name' },
            { key: 'business_name', label: 'Business Name', placeholder: 'Company name' },
            { key: 'mobile', label: 'Mobile', placeholder: '9876543210', keyboard: 'phone-pad' as const },
            { key: 'email', label: 'Email', placeholder: 'email@example.com', keyboard: 'email-address' as const },
            { key: 'address', label: 'Address', placeholder: 'Full address', multiline: true },
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
              <TextInput style={styles.input} value={form.gst_number} onChangeText={v => update('gst_number', v)} placeholder="GST Number" placeholderTextColor={colors.placeholder} autoCapitalize="characters" />
            </>
          )}

          <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={handleSave} disabled={loading}>
            <Text style={styles.btnText}>{loading ? 'Saving...' : editId ? 'Update Customer' : 'Create Customer'}</Text>
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
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, padding: spacing.md, fontSize: fontSize.md, color: colors.text },
  typeRow: { flexDirection: 'row', gap: spacing.sm },
  typeBtn: { flex: 1, padding: spacing.sm, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  typeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeText: { fontSize: fontSize.sm, color: colors.gray600 },
  typeTextActive: { color: colors.white, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  btn: { backgroundColor: colors.primary, borderRadius: borderRadius.sm, padding: spacing.md, alignItems: 'center', marginTop: spacing.xl },
  btnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
});
