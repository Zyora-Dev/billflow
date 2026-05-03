import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api, { BASE_URL } from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';

export default function BusinessListScreen({ navigation }: { navigation: any }) {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try { const res = await api.get('/api/business'); setBusinesses(res.data); } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { navigation.addListener('focus', fetchData); }, [navigation]);

  const handleDelete = (orgId: string, name: string) => {
    Alert.alert('Delete', `Delete "${name}"?`, [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.delete(`/api/business/${orgId}`); fetchData(); } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); } } }]);
  };

  return (
    <View style={s.container}>
      <FlatList data={businesses} keyExtractor={i => i.org_id} renderItem={({ item }) => (
        <View style={s.card}>
          <View style={s.logoBox}>
            {item.business_logo ? (
              <Image
                source={{ uri: item.business_logo.startsWith('http') ? item.business_logo : `${BASE_URL}/${String(item.business_logo).replace(/^\/+/, '')}` }}
                style={s.logoImage}
                resizeMode="cover"
              />
            ) : (
              <View style={s.logoPlaceholder}><Text style={s.logoText}>{(item.business_name || '?')[0].toUpperCase()}</Text></View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{item.business_name}</Text>
            <Text style={s.sub}>{item.contact_person} • {item.mobile || ''}</Text>
            {item.gst_number && <Text style={s.gst}>GST: {item.gst_number}</Text>}
            <Text style={s.orgId}>ID: {item.org_id}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Onboarding', { editId: item.org_id })} style={{ padding: spacing.sm }}>
            <Ionicons name="create-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.org_id, item.business_name)} style={{ padding: spacing.sm }}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>
      )} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        ListEmptyComponent={loading ? <SkeletonList count={4} /> : <EmptyState icon="business-outline" title="No businesses" subtitle="Tap + to add" />}
        contentContainerStyle={!businesses.length ? { flex: 1 } : { paddingBottom: 80 }} />

      <TouchableOpacity style={s.fab} onPress={() => navigation.navigate('Onboarding')}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, marginHorizontal: spacing.md, marginBottom: spacing.sm, marginTop: spacing.xs, borderRadius: borderRadius.md, padding: spacing.md, elevation: 1 },
  logoBox: { marginRight: spacing.md },
  logoImage: { width: 50, height: 50, borderRadius: 12, backgroundColor: colors.gray100 },
  logoPlaceholder: { width: 50, height: 50, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  logoText: { color: colors.white, fontSize: 22, fontWeight: '700' },
  name: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  sub: { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },
  gst: { fontSize: fontSize.xs, color: colors.accent, marginTop: 2 },
  orgId: { fontSize: fontSize.xs, color: colors.gray400, marginTop: 1 },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 4 },
});
