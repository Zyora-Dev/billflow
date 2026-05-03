import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { useToast } from '../../components/Toast';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import DateInput from '../../components/DateInput';

const SALARY_TYPES = [
  { value: 'monthly', label: 'Monthly', icon: 'calendar' as const },
  { value: 'daily',   label: 'Daily',   icon: 'today'    as const },
];

const STATUSES = [
  { value: 'Active',   label: 'Active',   color: '#22c55e' },
  { value: 'Inactive', label: 'Inactive', color: '#9ca3af' },
];

export default function EmployeeFormScreen({ route, navigation }: { route: any; navigation: any }) {
  const toast = useToast();
  const editId = route.params?.id;
  const [form, setForm] = useState({
    name: '', email: '', mobile: '',
    pan: '', aadhaar: '',
    bank_name: '', bank_account: '', bank_ifsc: '', bank_branch: '',
    salary_type: 'monthly',
    salary_amount: '',
    joining_date: new Date().toISOString().split('T')[0],
    status: 'Active',
  });
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/api/business');
        setOrgId(r.data[0]?.org_id || '');
        if (editId) {
          const e = (await api.get(`/api/employees/${editId}`)).data;
          setForm({
            name: e.name || '', email: e.email || '', mobile: e.mobile || '',
            pan: e.pan || '', aadhaar: e.aadhaar || '',
            bank_name: e.bank_name || '', bank_account: e.bank_account || '',
            bank_ifsc: e.bank_ifsc || '', bank_branch: e.bank_branch || '',
            salary_type: e.salary_type || 'monthly',
            salary_amount: String(e.salary_amount || ''),
            joining_date: e.joining_date || '',
            status: e.status || 'Active',
          });
        }
      } catch {} finally { setBootstrapping(false); }
    })();
  }, [editId]);

  const update = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return Alert.alert('Validation', 'Name is required');
    setLoading(true);
    try {
      const body = { ...form, salary_amount: parseFloat(form.salary_amount) || 0, org_id: orgId };
      if (editId) await api.put(`/api/employees/${editId}`, body);
      else await api.post('/api/employees', body);
      toast.success(editId ? 'Employee updated' : 'Employee created');
      navigation.goBack();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); } finally { setLoading(false); }
  };

  if (bootstrapping) {
    return <View style={st.loading}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f6f7fb' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {/* Hero */}
        <View style={st.headerCard}>
          <View style={st.headerAccent} />
          <Text style={st.headerEyebrow}>{editId ? 'Edit Employee' : 'New Employee'}</Text>
          <Text style={st.headerTitle}>
            {form.name ? form.name : 'Add team member'}
          </Text>
        </View>

        {/* Personal */}
        <Section title="Personal Info" icon="person-outline">
          <Label text="Full Name *" />
          <TextInput
            style={st.input}
            value={form.name}
            onChangeText={v => update('name', v)}
            placeholder="e.g. Rahul Sharma"
            placeholderTextColor={colors.placeholder}
          />

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Label text="Mobile" />
              <TextInput
                style={st.input}
                value={form.mobile}
                onChangeText={v => update('mobile', v)}
                placeholder="9876543210"
                placeholderTextColor={colors.placeholder}
                keyboardType="phone-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Label text="Email" />
              <TextInput
                style={st.input}
                value={form.email}
                onChangeText={v => update('email', v)}
                placeholder="email@..."
                placeholderTextColor={colors.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Label text="PAN" />
              <TextInput
                style={st.input}
                value={form.pan}
                onChangeText={v => update('pan', v.toUpperCase())}
                placeholder="ABCDE1234F"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="characters"
                maxLength={10}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Label text="Aadhaar" />
              <TextInput
                style={st.input}
                value={form.aadhaar}
                onChangeText={v => update('aadhaar', v)}
                placeholder="1234 5678 9012"
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </Section>

        {/* Salary */}
        <Section title="Salary" icon="cash-outline">
          <Label text="Salary Type" />
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {SALARY_TYPES.map(t => {
              const active = form.salary_type === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[st.segBtn, active && st.segBtnActive]}
                  onPress={() => update('salary_type', t.value)}
                  activeOpacity={0.85}
                >
                  <Ionicons name={t.icon} size={14} color={active ? '#fff' : colors.gray600} />
                  <Text style={[st.segText, active && st.segTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Label text="Salary Amount" />
          <View style={st.amountWrap}>
            <Text style={st.amountPrefix}>₹</Text>
            <TextInput
              style={st.amountInput}
              value={form.salary_amount}
              onChangeText={v => update('salary_amount', v.replace(/[^0-9.]/g, ''))}
              placeholder="0"
              placeholderTextColor={colors.placeholder}
              keyboardType="decimal-pad"
            />
            <Text style={st.amountSuffix}>/{form.salary_type === 'monthly' ? 'mo' : 'day'}</Text>
          </View>

          <Label text="Joining Date" />
          <DateInput value={form.joining_date} onChange={v => update('joining_date', v)} />

          <Label text="Status" />
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {STATUSES.map(t => {
              const active = form.status === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[
                    st.segBtn,
                    active && { backgroundColor: t.color + '15', borderColor: t.color },
                  ]}
                  onPress={() => update('status', t.value)}
                  activeOpacity={0.85}
                >
                  <View style={[st.statusBeacon, { backgroundColor: t.color }]} />
                  <Text style={[
                    st.segText,
                    active && { color: t.color, fontWeight: '800' },
                  ]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>

        {/* Bank */}
        <Section title="Bank Details" icon="card-outline">
          <Label text="Bank Name" />
          <TextInput
            style={st.input}
            value={form.bank_name}
            onChangeText={v => update('bank_name', v)}
            placeholder="e.g. HDFC Bank"
            placeholderTextColor={colors.placeholder}
          />
          <Label text="Account Number" />
          <TextInput
            style={st.input}
            value={form.bank_account}
            onChangeText={v => update('bank_account', v)}
            placeholder="Account number"
            placeholderTextColor={colors.placeholder}
            keyboardType="number-pad"
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Label text="IFSC" />
              <TextInput
                style={st.input}
                value={form.bank_ifsc}
                onChangeText={v => update('bank_ifsc', v.toUpperCase())}
                placeholder="HDFC0000123"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="characters"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Label text="Branch" />
              <TextInput
                style={st.input}
                value={form.bank_branch}
                onChangeText={v => update('bank_branch', v)}
                placeholder="Branch"
                placeholderTextColor={colors.placeholder}
              />
            </View>
          </View>
        </Section>
      </ScrollView>

      <View style={st.bottomBar}>
        <TouchableOpacity style={st.btnGhost} onPress={() => navigation.goBack()}>
          <Text style={st.btnGhostText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[st.btnPrimary, loading && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? <ActivityIndicator size="small" color="#fff" /> : (
            <>
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={st.btnPrimaryText}>{editId ? 'Update' : 'Add Employee'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={st.label}>{text}</Text>;
}

function Section({ title, icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <View style={st.section}>
      <View style={st.sectionHeader}>
        <Ionicons name={icon} size={14} color={colors.gray500} />
        <Text style={st.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const st = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f7fb' },

  headerCard: {
    backgroundColor: colors.primary,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: 18,
    padding: spacing.md,
    overflow: 'hidden',
  },
  headerAccent: {
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -50, right: -30,
  },
  headerEyebrow: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 2 },

  section: {
    backgroundColor: '#fff',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm + 2,
    borderRadius: 16,
    padding: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  sectionTitle: { fontSize: 11, color: colors.gray500, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },

  label: {
    fontSize: 11, fontWeight: '800', color: colors.gray500,
    textTransform: 'uppercase', letterSpacing: 0.4,
    marginTop: spacing.md, marginBottom: 6,
  },
  input: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: spacing.md - 2,
    fontSize: fontSize.md, color: colors.text,
    backgroundColor: '#fff',
  },

  segBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff',
  },
  segBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segText: { fontSize: 12, fontWeight: '700', color: colors.gray600 },
  segTextActive: { color: '#fff' },

  statusBeacon: { width: 8, height: 8, borderRadius: 4 },

  amountWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  amountPrefix: { fontSize: 18, fontWeight: '700', color: colors.primary, marginRight: 6 },
  amountInput: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text, paddingVertical: 12 },
  amountSuffix: { fontSize: 12, color: colors.gray500, fontWeight: '700' },

  bottomBar: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 18,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: colors.gray100,
  },
  btnGhost: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', backgroundColor: colors.gray100 },
  btnGhostText: { fontSize: 14, fontWeight: '700', color: colors.gray700 },
  btnPrimary: { flex: 2, flexDirection: 'row', gap: 6, paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  btnPrimaryText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
