import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import SearchBar from '../../components/SearchBar';
import EmptyState from '../../components/EmptyState';
import { usePreview } from '../../components/Preview';

export default function VendorListScreen({ navigation }: { navigation: any }) {
  const preview = usePreview();
  const [vendors, setVendors] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (oid) { const res = await api.get(`/api/vendors?org_id=${oid}`); setVendors(res.data); setFiltered(res.data); }
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { navigation.addListener('focus', fetchData); }, [navigation]);
  useEffect(() => {
    if (!search) setFiltered(vendors);
    else { const s = search.toLowerCase(); setFiltered(vendors.filter((v: any) => v.contact_person?.toLowerCase().includes(s) || v.business_name?.toLowerCase().includes(s))); }
  }, [search, vendors]);

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('VendorDetail', { id: item.id })} onLongPress={() => preview.show({ type: 'vendor', id: item.id })} delayLongPress={350}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{(item.contact_person || item.business_name || '?')[0].toUpperCase()}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.contact_person || item.business_name}</Text>
        <Text style={styles.sub}>{item.mobile || item.email || 'No contact'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search vendors..." />
      <FlatList data={filtered} keyExtractor={i => String(i.id)} renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        ListEmptyComponent={loading ? null : <EmptyState icon="storefront-outline" title="No vendors" subtitle="Tap + to add one" />}
        contentContainerStyle={!filtered.length ? { flex: 1 } : { paddingBottom: 80 }} />
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('VendorForm', {})}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.md, padding: spacing.md, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  avatarText: { color: colors.white, fontSize: fontSize.lg, fontWeight: '700' },
  name: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  sub: { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
});
