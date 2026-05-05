import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing } from '../../theme';
import EmptyState from '../../components/EmptyState';
import { usePreview } from '../../components/Preview';

export default function CustomerListScreen({ navigation }: { navigation: any }) {
  const preview = usePreview();
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (oid) {
        const res = await api.get(`/api/customers?org_id=${oid}`);
        setCustomers(res.data);
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchData);
    return unsubscribe;
  }, [navigation]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? customers.filter((c: any) =>
          c.contact_person?.toLowerCase().includes(q) ||
          c.business_name?.toLowerCase().includes(q) ||
          c.mobile?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
        )
      : customers.slice();
    return list.sort((a, b) => {
      const an = String(a.business_name || a.contact_person || '').toLowerCase();
      const bn = String(b.business_name || b.contact_person || '').toLowerCase();
      if (q) {
        const ap = an.startsWith(q) ? 0 : 1;
        const bp = bn.startsWith(q) ? 0 : 1;
        if (ap !== bp) return ap - bp;
      }
      return an.localeCompare(bn);
    });
  }, [search, customers]);

  const renderItem = ({ item }: { item: any }) => {
    const nm = item.business_name || item.contact_person || 'Customer';
    const initial = String(nm).trim().charAt(0).toUpperCase() || '?';
    const isBiz = !!(item.business_name && item.contact_person);
    const subtitle = isBiz ? item.contact_person : (item.email || '');
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('CustomerDetail', { id: item.id })}
        onLongPress={() => preview.show({ type: 'customer', id: item.id })}
        delayLongPress={350}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.cardTopRow}>
            <Text style={styles.name} numberOfLines={1}>{nm}</Text>
            {item.gst_registered ? (
              <View style={styles.gstChip}>
                <Text style={styles.gstChipText}>GST</Text>
              </View>
            ) : null}
          </View>
          {subtitle ? <Text style={styles.sub} numberOfLines={1}>{subtitle}</Text> : null}
          {item.mobile ? (
            <View style={styles.metaRow}>
              <Ionicons name="call-outline" size={11} color={colors.gray500} />
              <Text style={styles.metaText}>{item.mobile}</Text>
            </View>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.primary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Type a letter to search customer..."
            placeholderTextColor={colors.gray400}
          />
          {search.trim().length > 0 ? (
            <View style={styles.countChip}>
              <Text style={styles.countChipText}>{filtered.length}</Text>
            </View>
          ) : null}
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={colors.gray400} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        ListHeaderComponent={
          customers.length ? (
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>All Customers</Text>
              <Text style={styles.listHeaderCount}>{filtered.length} of {customers.length}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={loading ? null : <EmptyState icon="people-outline" title="No customers" subtitle="Tap + to add one" />}
        contentContainerStyle={!filtered.length ? { flex: 1 } : { paddingBottom: 80 }}
      />
      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => navigation.navigate('CustomerForm', {})}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },

  searchSection: { marginHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11,
    gap: 10,
    borderWidth: 1.5, borderColor: colors.primary + '30',
    shadowColor: colors.primary, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0, fontWeight: '500' },
  countChip: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 999,
    minWidth: 24, alignItems: 'center',
  },
  countChipText: { fontSize: 11, color: colors.primary, fontWeight: '800' },

  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md + 2, paddingTop: 8, paddingBottom: 6 },
  listHeaderText: { fontSize: 10.5, color: colors.gray500, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  listHeaderCount: { fontSize: 11, color: colors.gray400, fontWeight: '700' },

  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: spacing.md, marginBottom: 10,
    borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#eef0f5',
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.primary + '12',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.primary + '30',
    marginRight: 12,
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: colors.primary },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.gray900, letterSpacing: -0.2 },
  gstChip: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 999,
  },
  gstChipText: { fontSize: 9, fontWeight: '800', color: '#15803d', letterSpacing: 0.4 },
  sub: { fontSize: 12, color: colors.gray500, marginTop: 2, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  metaText: { fontSize: 11, color: colors.gray500, fontWeight: '500' },

  fab: {
    position: 'absolute', right: 20, bottom: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
