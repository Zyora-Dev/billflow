import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

export default function VendorDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const { id } = route.params;
  const [vendor, setVendor] = useState<any>(null);

  const fetch = () => api.get(`/api/vendors/${id}`).then(r => setVendor(r.data)).catch(() => {});
  useEffect(() => { fetch(); }, [id]);
  useEffect(() => { navigation.addListener('focus', fetch); }, [navigation]);

  const handleDelete = () => {
    Alert.alert('Delete', 'Delete this vendor?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.delete(`/api/vendors/${id}`); navigation.goBack(); } catch {} } },
    ]);
  };

  if (!vendor) return <View style={styles.center}><Text>Loading...</Text></View>;

  const rows = [
    { icon: 'person', label: 'Type', value: vendor.type || '-' },
    { icon: 'call', label: 'Mobile', value: vendor.mobile || '-' },
    { icon: 'mail', label: 'Email', value: vendor.email || '-' },
    { icon: 'business', label: 'Business', value: vendor.business_name || '-' },
    { icon: 'location', label: 'Address', value: vendor.address || '-' },
    { icon: 'card', label: 'PAN', value: vendor.pan || '-' },
    { icon: 'receipt', label: 'GST', value: vendor.gst_number || (vendor.gst_registered ? 'Yes' : 'No') },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(vendor.contact_person || '?')[0].toUpperCase()}</Text></View>
        <Text style={styles.name}>{vendor.contact_person}</Text>
        {vendor.business_name && <Text style={styles.biz}>{vendor.business_name}</Text>}
      </View>
      <View style={styles.card}>
        {rows.map((r, i) => (
          <View key={i} style={styles.row}>
            <Ionicons name={r.icon as any} size={18} color={colors.gray500} />
            <Text style={styles.rowLabel}>{r.label}</Text>
            <Text style={styles.rowValue}>{r.value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('VendorForm', { id })}>
          <Ionicons name="create-outline" size={20} color={colors.white} /><Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={20} color={colors.danger} /><Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', padding: spacing.lg, backgroundColor: colors.white },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: colors.white, fontSize: 28, fontWeight: '700' },
  name: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  biz: { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },
  card: { backgroundColor: colors.white, margin: spacing.md, borderRadius: borderRadius.md, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  rowLabel: { fontSize: fontSize.sm, color: colors.gray500, marginLeft: spacing.sm, width: 70 },
  rowValue: { flex: 1, fontSize: fontSize.md, color: colors.text, textAlign: 'right' },
  actions: { flexDirection: 'row', padding: spacing.md, gap: spacing.md },
  editBtn: { flex: 1, flexDirection: 'row', backgroundColor: colors.primary, borderRadius: borderRadius.sm, padding: spacing.md, justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  editText: { color: colors.white, fontWeight: '600' },
  deleteBtn: { flexDirection: 'row', borderWidth: 1, borderColor: colors.danger, borderRadius: borderRadius.sm, padding: spacing.md, paddingHorizontal: spacing.lg, justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  deleteText: { color: colors.danger, fontWeight: '600' },
});
