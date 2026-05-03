import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import SearchBar from '../../components/SearchBar';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { usePreview } from '../../components/Preview';
import CurrencyText from '../../components/CurrencyText';

export default function ItemListScreen({ navigation }: { navigation: any }) {
  const preview = usePreview();
  const [items, setItems] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (oid) {
        const res = await api.get(`/api/items?org_id=${oid}`);
        setItems(res.data);
        setFiltered(res.data);
      }
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    const u = navigation.addListener('focus', fetchData);
    return u;
  }, [navigation]);

  useEffect(() => {
    if (!search) setFiltered(items);
    else {
      const s = search.toLowerCase();
      setFiltered(items.filter((i: any) => i.item_name?.toLowerCase().includes(s) || i.model_number?.toLowerCase().includes(s)));
    }
  }, [search, items]);

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ItemForm', { id: item.id })} onLongPress={() => preview.show({ type: 'item', id: item.id })} delayLongPress={350}>
      <View style={[styles.badge, { backgroundColor: item.type === 'goods' ? colors.info + '20' : colors.success + '20' }]}>
        <Ionicons name={item.type === 'goods' ? 'cube' : 'construct'} size={20} color={item.type === 'goods' ? colors.info : colors.success} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.item_name}</Text>
        <Text style={styles.sub}>{item.type} • {item.unit || 'N/A'} • Tax: {item.tax_rate || 0}%</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <CurrencyText amount={item.sale_price} style={styles.price} />
        <Text style={[styles.stock, item.stock <= (item.stock_alert_qty || 0) && { color: colors.danger }]}>
          Stock: {item.stock ?? 0}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search items..." />
      <FlatList
        data={filtered}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        ListEmptyComponent={loading ? <SkeletonList count={6} /> : <EmptyState icon="cube-outline" title="No items" subtitle="Tap + to add one" />}
        contentContainerStyle={!filtered.length ? { flex: 1 } : { paddingBottom: 80 }}
      />
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('ItemForm', {})}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
    marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.md,
    padding: spacing.md, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  badge: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  name: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  sub: { fontSize: fontSize.xs, color: colors.gray500, marginTop: 2 },
  price: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  stock: { fontSize: fontSize.xs, color: colors.gray500, marginTop: 2 },
  fab: {
    position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
});
