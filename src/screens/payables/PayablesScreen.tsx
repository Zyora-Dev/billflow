import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize } from '../../theme';
import EmptyState from '../../components/EmptyState';
import CurrencyText from '../../components/CurrencyText';

export default function PayablesScreen({ navigation }: { navigation: any }) {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [overall, setOverall] = useState(0);
  const [list, setList] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async (oid?: string | null) => {
    const id = oid || orgId;
    if (!id) return;
    try {
      const listRes = await api.get(`/api/ledger/creditors?org_id=${id}`);
      const data = Array.isArray(listRes.data) ? listRes.data : [];
      setList(data);
      const total = data.reduce((s: number, c: any) => s + Number(c.closing || 0), 0);
      setOverall(total);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId]);

  useEffect(() => {
    (async () => {
      try {
        const biz = await api.get('/api/business');
        const id = biz.data[0]?.org_id || null;
        setOrgId(id);
        fetchAll(id);
      } catch {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => fetchAll());
    return unsub;
  }, [navigation, fetchAll]);

  const filtered = list.filter(c =>
    !search || String(c.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const top = list.slice(0, 1)[0];
  const totalVendors = list.length;
  const tallyAnchored = list.filter((c: any) => Number(c.opening || 0) > 0).length;

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const closing = Number(item.closing || 0);
    const opening = Number(item.opening || 0);
    const current = Number(item.current || 0);
    const pct = overall > 0 ? Math.min(100, (closing / overall) * 100) : 0;
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.85}
        onPress={() =>
          item.id
            ? navigation.navigate('VendorLedger', {
                vendor_id: item.id,
                vendor_name: item.name,
                payables_balance: closing,
                opening,
                current,
              })
            : null
        }
        disabled={!item.id}
      >
        <View style={styles.rowTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{String(item.name || 'V').trim().charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.name} numberOfLines={1}>{item.name || 'Unknown'}</Text>
              {item.tally_only && (
                <View style={styles.tallyOnlyChip}>
                  <Text style={styles.tallyOnlyText}>Tally</Text>
                </View>
              )}
            </View>
            <Text style={styles.sub}>
              Opening ₹{opening.toLocaleString('en-IN')} · {current >= 0 ? '+' : ''}₹{current.toLocaleString('en-IN')} this FY
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <CurrencyText amount={closing} style={styles.amt} />
            <Text style={styles.amtSub}>closing</Text>
          </View>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>
        <View style={styles.rowFoot}>
          <Text style={styles.rank}>#{index + 1}</Text>
          <Text style={styles.pctText}>{pct.toFixed(1)}% of total</Text>
          {item.id ? <Ionicons name="chevron-forward" size={14} color={colors.gray400} /> : null}
        </View>
      </TouchableOpacity>
    );
  };

  const Header = (
    <View>
      <View style={styles.hero}>
        <View style={styles.heroBgAccent} />
        <View style={styles.heroBgAccent2} />
        <View style={styles.heroIconWrap}>
          <Ionicons name="trending-down" size={22} color="#dc2626" />
        </View>
        <Text style={styles.heroLabel}>Total Payables</Text>
        <CurrencyText amount={overall} style={styles.heroValue} />
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Vendors</Text>
            <Text style={styles.heroStatVal}>{totalVendors}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>With Opening</Text>
            <Text style={styles.heroStatVal}>{tallyAnchored}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Top Due</Text>
            <Text style={[styles.heroStatVal, { fontSize: 12 }]} numberOfLines={1}>
              {top?.name?.split(' ')[0] || '—'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.gray400} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search vendor..."
          placeholderTextColor={colors.placeholder}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.gray400} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>Vendor Breakdown</Text>
        <Text style={styles.listHeaderText}>Outstanding</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={c => String(c.id || c.name)}
        renderItem={renderItem}
        ListHeaderComponent={Header}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchAll(); }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <EmptyState icon="checkmark-circle-outline" title="All clear!" subtitle="No outstanding payables" />
          )
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },

  hero: {
    backgroundColor: '#dc2626',
    marginHorizontal: spacing.md, marginTop: spacing.md,
    borderRadius: 22,
    padding: spacing.md + 4,
    overflow: 'hidden',
    shadowColor: '#dc2626', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  heroBgAccent: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.08)', top: -70, right: -50 },
  heroBgAccent2: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -40, left: -30 },
  heroIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  heroValue: { color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: -0.6, marginTop: 2 },
  heroStatsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: spacing.md, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)',
  },
  heroStatItem: { flex: 1 },
  heroStatLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  heroStatVal: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 2 },
  heroDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: spacing.sm },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: spacing.md, marginTop: spacing.md,
    borderRadius: 14,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    gap: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  searchInput: { flex: 1, fontSize: fontSize.md, color: colors.text, paddingVertical: 0 },

  listHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md + 4, paddingTop: spacing.md, paddingBottom: 6 },
  listHeaderText: { fontSize: 10, color: colors.gray400, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },

  row: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.md, marginBottom: 10,
    borderRadius: 16, padding: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 10 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fee2e2',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: '#dc2626' },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  tallyOnlyChip: { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#ede9fe', borderRadius: 4 },
  tallyOnlyText: { fontSize: 9, fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.3 },
  sub: { fontSize: 11, color: colors.gray500, marginTop: 2 },
  amt: { fontSize: 16, fontWeight: '800', color: '#dc2626', letterSpacing: -0.3 },
  amtSub: { fontSize: 10, color: colors.gray400, marginTop: 2, fontWeight: '600' },

  barTrack: { height: 6, backgroundColor: colors.gray100, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#dc2626', borderRadius: 999 },

  rowFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  rank: { fontSize: 10, fontWeight: '800', color: colors.gray400, letterSpacing: 0.3 },
  pctText: { flex: 1, fontSize: 11, color: colors.gray500, fontWeight: '600' },
});
