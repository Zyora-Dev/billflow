import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

export default function CustomerDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const { id } = route.params;
  const [customer, setCustomer] = useState<any>(null);

  useEffect(() => {
    api.get(`/api/customers/${id}`).then(r => setCustomer(r.data)).catch(() => {});
  }, [id]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      api.get(`/api/customers/${id}`).then(r => setCustomer(r.data)).catch(() => {});
    });
    return unsubscribe;
  }, [navigation, id]);

  const handleDelete = () => {
    Alert.alert('Delete', 'Delete this customer?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/api/customers/${id}`);
          navigation.goBack();
        } catch (e: any) {
          Alert.alert('Error', e.response?.data?.detail || 'Failed');
        }
      }},
    ]);
  };

  if (!customer) return <View style={styles.center}><Text>Loading...</Text></View>;

  const rows = [
    { icon: 'person', label: 'Type', value: customer.type || '-' },
    { icon: 'call', label: 'Mobile', value: customer.mobile || '-' },
    { icon: 'mail', label: 'Email', value: customer.email || '-' },
    { icon: 'business', label: 'Business', value: customer.business_name || '-' },
    { icon: 'location', label: 'Address', value: customer.address || '-' },
    { icon: 'card', label: 'PAN', value: customer.pan || '-' },
    { icon: 'receipt', label: 'GST', value: customer.gst_number || (customer.gst_registered ? 'Yes' : 'No') },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(customer.contact_person || '?')[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{customer.contact_person}</Text>
        {customer.business_name && <Text style={styles.biz}>{customer.business_name}</Text>}
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
        <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('CustomerForm', { id })}>
          <Ionicons name="create-outline" size={20} color={colors.white} />
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', padding: spacing.lg, backgroundColor: colors.white },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
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
