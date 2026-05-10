import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import api, { BASE_URL } from '../../api/client';
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

const EMP_TYPES = [
  { value: 'Full Time', label: 'Full Time', icon: 'person' as const, color: '#3b82f6' },
  { value: 'Part Time', label: 'Part Time', icon: 'time' as const, color: '#f59e0b' },
  { value: 'Contract',  label: 'Contract',  icon: 'document-text' as const, color: '#8b5cf6' },
  { value: 'Freelancer', label: 'Freelancer', icon: 'globe' as const, color: '#0ea5e9' },
];

export default function EmployeeFormScreen({ route, navigation }: { route: any; navigation: any }) {
  const toast = useToast();
  const editId = route.params?.id;
  const [form, setForm] = useState({
    name: '', email: '', mobile: '',
    pan: '', aadhaar: '',
    designation: '', department: '', emp_type: '',
    bank_name: '', bank_account: '', bank_ifsc: '', bank_branch: '',
    salary_type: 'monthly',
    salary_amount: '',
    joining_date: new Date().toISOString().split('T')[0],
    status: 'Active',
  });
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [metaDesignations, setMetaDesignations] = useState<string[]>([]);
  const [metaDepartments, setMetaDepartments] = useState<string[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<{ uri: string; name: string; type: string; docType: string }[]>([]);

  const pickDocument = (docType: string) => {
    const typeLabel = docType === 'aadhaar' ? 'Aadhaar Card' : docType === 'pan' ? 'PAN Card' : 'Document';
    Alert.alert(`Upload ${typeLabel}`, 'Choose source', [
      {
        text: 'Camera', onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permission needed', 'Camera permission required'); return; }
          const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
          if (!result.canceled && result.assets?.[0]) {
            const a = result.assets[0];
            if (editId) { uploadDocNow(a, docType); } else { setPendingUploads(p => [...p, { uri: a.uri, name: a.fileName || `${docType}_${Date.now()}.jpg`, type: a.type || 'image/jpeg', docType }]); }
          }
        },
      },
      {
        text: 'Photo Library', onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permission needed', 'Gallery permission required'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
          if (!result.canceled && result.assets?.[0]) {
            const a = result.assets[0];
            if (editId) { uploadDocNow(a, docType); } else { setPendingUploads(p => [...p, { uri: a.uri, name: a.fileName || `${docType}_${Date.now()}.jpg`, type: a.type || 'image/jpeg', docType }]); }
          }
        },
      },
      {
        text: 'Files', onPress: async () => {
          const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
          if (!result.canceled && result.assets?.[0]) {
            const a = result.assets[0];
            if (editId) { uploadDocNow({ uri: a.uri, fileName: a.name, type: a.mimeType } as any, docType); } else { setPendingUploads(p => [...p, { uri: a.uri, name: a.name || 'file', type: a.mimeType || 'application/octet-stream', docType }]); }
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const uploadDocNow = async (asset: any, docType: string) => {
    setUploadingDoc(true);
    try {
      const fd = new FormData();
      fd.append('doc_type', docType);
      fd.append('file', { uri: asset.uri, name: asset.fileName || asset.name || `${docType}.jpg`, type: asset.type || asset.mimeType || 'image/jpeg' } as any);
      await api.post(`/api/employees/${editId}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const docsRes = await api.get(`/api/employees/${editId}/documents`);
      setDocuments(Array.isArray(docsRes.data) ? docsRes.data : []);
    } catch (e: any) { Alert.alert('Error', e?.response?.data?.detail || 'Upload failed'); } finally { setUploadingDoc(false); }
  };

  const handleDeleteExistingDoc = (docId: number, fileName: string) => {
    Alert.alert('Delete Document', `Remove ${fileName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/api/employees/${editId}/documents/${docId}`);
          setDocuments(d => d.filter(x => x.id !== docId));
        } catch { Alert.alert('Error', 'Failed to delete'); }
      }},
    ]);
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/api/business');
        const oid = r.data[0]?.org_id || '';
        setOrgId(oid);
        // Fetch meta options for autocomplete
        try {
          const meta = await api.get(`/api/employees/meta/options?org_id=${oid}`);
          setMetaDesignations(meta.data.designations || []);
          setMetaDepartments(meta.data.departments || []);
        } catch {}
        if (editId) {
          const e = (await api.get(`/api/employees/${editId}`)).data;
          setForm({
            name: e.name || '', email: e.email || '', mobile: e.mobile || '',
            pan: e.pan || '', aadhaar: e.aadhaar || '',
            designation: e.designation || '', department: e.department || '', emp_type: e.emp_type || '',
            bank_name: e.bank_name || '', bank_account: e.bank_account || '',
            bank_ifsc: e.bank_ifsc || '', bank_branch: e.bank_branch || '',
            salary_type: e.salary_type || 'monthly',
            salary_amount: String(e.salary_amount || ''),
            joining_date: e.joining_date || '',
            status: e.status || 'Active',
          });
          // Fetch docs for edit mode
          try {
            const docsRes = await api.get(`/api/employees/${editId}/documents`);
            setDocuments(Array.isArray(docsRes.data) ? docsRes.data : []);
          } catch {}
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
      let empId = editId;
      if (editId) {
        await api.put(`/api/employees/${editId}`, body);
      } else {
        const res = await api.post('/api/employees', body);
        empId = res.data?.id;
      }
      // Upload pending documents for new employee
      if (empId && pendingUploads.length > 0) {
        for (const pu of pendingUploads) {
          const fd = new FormData();
          fd.append('doc_type', pu.docType);
          fd.append('file', { uri: pu.uri, name: pu.name, type: pu.type } as any);
          try { await api.post(`/api/employees/${empId}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); } catch {}
        }
      }
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

        {/* Work Info */}
        <Section title="Work Info" icon="briefcase-outline">
          <Label text="Designation" />
          <TextInput
            style={st.input}
            value={form.designation}
            onChangeText={v => update('designation', v)}
            placeholder="e.g. Manager, Accountant"
            placeholderTextColor={colors.placeholder}
          />
          {metaDesignations.length > 0 && !form.designation && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {metaDesignations.map(d => (
                  <TouchableOpacity key={d} onPress={() => update('designation', d)} style={st.suggChip} activeOpacity={0.85}>
                    <Text style={st.suggText}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          <Label text="Department" />
          <TextInput
            style={st.input}
            value={form.department}
            onChangeText={v => update('department', v)}
            placeholder="e.g. Sales, Operations"
            placeholderTextColor={colors.placeholder}
          />
          {metaDepartments.length > 0 && !form.department && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {metaDepartments.map(d => (
                  <TouchableOpacity key={d} onPress={() => update('department', d)} style={st.suggChip} activeOpacity={0.85}>
                    <Text style={st.suggText}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          <Label text="Employee Type" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {EMP_TYPES.map(t => {
              const active = form.emp_type === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[st.typeChip, active && { backgroundColor: t.color + '18', borderColor: t.color }]}
                  onPress={() => update('emp_type', active ? '' : t.value)}
                  activeOpacity={0.85}
                >
                  <Ionicons name={t.icon} size={12} color={active ? t.color : colors.gray500} />
                  <Text style={[st.typeChipText, active && { color: t.color }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
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

        {/* Documents */}
        <Section title="Documents" icon="document-text-outline">
          <View style={st.docUploadRow}>
            {[{ key: 'aadhaar', label: 'Aadhaar Card', icon: 'finger-print-outline', bg: '#fff7ed', color: '#ea580c' },
              { key: 'pan', label: 'PAN Card', icon: 'card-outline', bg: '#eff6ff', color: '#2563eb' },
              { key: 'other', label: 'Other Doc', icon: 'cloud-upload-outline', bg: '#f3f4f6', color: '#6b7280' },
            ].map(dt => (
              <TouchableOpacity key={dt.key} style={st.docUploadCard} onPress={() => pickDocument(dt.key)} activeOpacity={0.85}>
                <View style={[st.docUploadIcon, { backgroundColor: dt.bg }]}>
                  <Ionicons name={dt.icon as any} size={16} color={dt.color} />
                </View>
                <Text style={st.docUploadLabel}>{dt.label}</Text>
                <Text style={st.docUploadHint}>Tap to upload</Text>
              </TouchableOpacity>
            ))}
          </View>
          {uploadingDoc && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ fontSize: 11, color: colors.gray500 }}>Uploading...</Text>
            </View>
          )}
          {/* Show existing docs (edit mode) + pending uploads (new mode) */}
          {(documents.length > 0 || pendingUploads.length > 0) && (
            <View style={{ gap: 6, marginTop: 10 }}>
              {documents.map(doc => {
                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.file_name);
                const typeLabel = doc.doc_type === 'aadhaar' ? 'Aadhaar' : doc.doc_type === 'pan' ? 'PAN' : 'Doc';
                return (
                  <View key={doc.id} style={st.docItem}>
                    {isImage ? (
                      <Image source={{ uri: `${BASE_URL}/${doc.file_path}` }} style={st.docThumb} />
                    ) : (
                      <View style={[st.docThumb, { backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="document-text" size={16} color="#9ca3af" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={st.docName} numberOfLines={1}>{doc.file_name}</Text>
                      <Text style={{ fontSize: 9, color: colors.gray400 }}>{typeLabel}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteExistingDoc(doc.id, doc.file_name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={14} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                );
              })}
              {pendingUploads.map((pu, idx) => (
                <View key={`pending-${idx}`} style={st.docItem}>
                  <Image source={{ uri: pu.uri }} style={st.docThumb} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.docName} numberOfLines={1}>{pu.name}</Text>
                    <Text style={{ fontSize: 9, color: '#22c55e', fontWeight: '700' }}>Ready to upload</Text>
                  </View>
                  <TouchableOpacity onPress={() => setPendingUploads(p => p.filter((_, i) => i !== idx))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
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
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: '#fff',
  },
  typeChipText: { fontSize: 12, fontWeight: '700', color: colors.gray600 },
  suggChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: colors.primary + '10',
    borderWidth: 1, borderColor: colors.primary + '25',
  },
  suggText: { fontSize: 11, fontWeight: '700', color: colors.primary },

  docUploadRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  docUploadCard: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', backgroundColor: '#fafafa',
  },
  docUploadIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  docUploadLabel: { fontSize: 10, fontWeight: '800', color: colors.gray700, textAlign: 'center' },
  docUploadHint: { fontSize: 8, color: colors.gray400, marginTop: 1 },
  docItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10,
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#f3f4f6',
  },
  docThumb: { width: 34, height: 34, borderRadius: 6 },
  docName: { fontSize: 11, fontWeight: '700', color: colors.gray700 },
});
