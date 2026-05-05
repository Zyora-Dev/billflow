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

export default function ReceivablesScreen({ navigation }: { navigation: any }) {
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
      // Use same endpoint as web: Tally opening + new BillFlow activity (tally_synced=False)
      const listRes = await api.get(`/api/ledger/debtors?org_id=${id}`);
      const data = Array.isArray(listRes.data) ? listRes.data : [];
      setList(data);
      // Total receivables = sum of closing balances (authoritative — matches Tally Sundry Debtors)
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

  const filtered = list
    .filter(c =>
      !search || String(c.name || '').toLowerCase().includes(search.toLowerCase().trim())
    )
    .slice()
    .sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
    );

  // Top suggestions for autocomplete (prefix match preferred)
  const suggestions = search.trim().length > 0
    ? [...filtered]
        .sort((a, b) => {
          const q = search.toLowerCase().trim();
          const an = String(a.name || '').toLowerCase();
          const bn = String(b.name || '').toLowerCase();
          const ap = an.startsWith(q) ? 0 : 1;
          const bp = bn.startsWith(q) ? 0 : 1;
          if (ap !== bp) return ap - bp;
          return Number(b.closing || 0) - Number(a.closing || 0);
        })
        .slice(0, 5)
    : [];

  const top = list.slice(0, 1)[0];
  const totalCustomers = list.length;
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
            ? navigation.navigate('CustomerLedger', {
                customer_id: item.id,
                customer_name: item.name,
                receivables_balance: closing,
                opening,
                current,
              })
            : null
        }
        disabled={!item.id}
      >
        <View style={styles.rowMain}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {String(item.name || 'U').trim().charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.rowNameRow}>
              <Text style={styles.name} numberOfLines={1}>{item.name || 'Unknown'}</Text>
              <View style={styles.rankPill}>
                <Text style={styles.rankPillText}>#{index + 1}</Text>
              </View>
              {item.tally_only && (
                <View style={styles.tallyOnlyChip}>
                  <Text style={styles.tallyOnlyText}>Tally</Text>
                </View>
              )}
            </View>
            <View style={styles.rowMetaRow}>
              <Text style={styles.metaPill}>Open ₹{opening.toLocaleString('en-IN')}</Text>
              <View style={styles.metaDot} />
              <Text style={[styles.metaPill, current >= 0 ? { color: '#dc2626' } : { color: '#059669' }]}>
                {current >= 0 ? '+' : ''}₹{Math.abs(current).toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <CurrencyText amount={closing} style={styles.amt} />
            <Text style={styles.pctText}>{pct.toFixed(1)}%</Text>
          </View>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>
      </TouchableOpacity>
    );
  };

  const Header = (
    <View>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroBgAccent} />
        <View style={styles.heroBgAccent2} />
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>Total Receivables</Text>
            <CurrencyText amount={overall} style={styles.heroValue} />
          </View>
          <View style={styles.heroIconWrap}>
            <Ionicons name="wallet" size={20} color="#10B981" />
          </View>
        </View>
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Customers</Text>
            <Text style={styles.heroStatVal}>{totalCustomers}</Text>
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

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={17} color={colors.gray400} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Type a letter to search customer..."
            placeholderTextColor={colors.placeholder}
            autoCorrect={false}
            autoCapitalize="words"
          />
          {search ? (
            <>
              <View style={styles.countChip}>
                <Text style={styles.countChipText}>{filtered.length}</Text>
              </View>
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="close-circle" size={18} color={colors.gray400} />
              </TouchableOpacity>
            </>
          ) : null}
        </View>

        {/* Live suggestions dropdown */}
        {suggestions.length > 0 && search.trim().length > 0 && (
          <View style={styles.suggestBox}>
            {suggestions.map((s, i) => {
              const closing = Number(s.closing || 0);
              return (
                <TouchableOpacity
                  key={String(s.id || s.name) + i}
                  style={[styles.suggestRow, i === suggestions.length - 1 && { borderBottomWidth: 0 }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSearch('');
                    if (s.id) {
                      navigation.navigate('CustomerLedger', {
                        customer_id: s.id,
                        customer_name: s.name,
                        receivables_balance: closing,
                        opening: Number(s.opening || 0),
                        current: Number(s.current || 0),
                      });
                    }
                  }}
                >
                  <View style={styles.suggestAvatar}>
                    <Text style={styles.suggestAvatarText}>
                      {String(s.name || 'U').trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.suggestName} numberOfLines={1}>{s.name || 'Unknown'}</Text>
                  <CurrencyText amount={closing} style={styles.suggestAmt} />
                  <Ionicons name="arrow-forward" size={14} color={colors.gray400} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>Customer Breakdown</Text>
        <Text style={styles.listHeaderText}>{filtered.length} {filtered.length === 1 ? 'customer' : 'customers'}</Text>
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
            <EmptyState icon="checkmark-circle-outline" title="All clear!" subtitle="No outstanding amounts" />
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
    backgroundColor: colors.primary,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    overflow: 'hidden',
    shadowColor: colors.primary, shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  heroBgAccent: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.07)', top: -55, right: -35 },
  heroBgAccent2: { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -30, left: -20 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heroIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroEyebrow: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  heroValue: { color: '#ffffff', fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 4 },
  heroStatsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: spacing.sm + 2,
    paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)',
  },
  heroStatItem: { flex: 1 },
  heroStatLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  heroStatVal: { color: '#ffffff', fontSize: 13, fontWeight: '700', marginTop: 2 },
  heroDivider: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: spacing.sm },

  // Search
  searchWrap: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    borderWidth: 1, borderColor: '#e6e9f2',
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0, fontWeight: '500' },
  countChip: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 999,
    minWidth: 24, alignItems: 'center',
  },
  countChipText: { fontSize: 11, color: '#059669', fontWeight: '800' },

  // Suggestions dropdown
  suggestBox: {
    marginTop: 6,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1, borderColor: '#e6e9f2',
    overflow: 'hidden',
  },
  suggestRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f1f3f8',
  },
  suggestAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#dcfce7',
    alignItems: 'center', justifyContent: 'center',
  },
  suggestAvatarText: { fontSize: 12, fontWeight: '800', color: '#059669' },
  suggestName: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.gray900 },
  suggestAmt: { fontSize: 12.5, fontWeight: '800', color: '#dc2626' },

  listHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md + 4, paddingTop: spacing.md + 4, paddingBottom: 8 },
  listHeaderText: { fontSize: 10.5, color: colors.gray500, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },

  // Row
  row: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    marginBottom: 10,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#eef0f5',
  },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 10 },
  rowNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  metaPill: {
    fontSize: 10.5, color: colors.gray500, fontWeight: '600',
  },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.gray300 },
  rankPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6, paddingVertical: 1.5,
    borderRadius: 999,
  },
  rankPillText: { fontSize: 9.5, fontWeight: '800', color: colors.gray600, letterSpacing: 0.3 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#dcfce7',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#86efac',
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: '#059669' },
  name: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.gray900, letterSpacing: -0.2 },
  tallyOnlyChip: { paddingHorizontal: 6, paddingVertical: 1.5, backgroundColor: '#ede9fe', borderRadius: 4 },
  tallyOnlyText: { fontSize: 9, fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.3 },
  amt: { fontSize: 14.5, fontWeight: '800', color: '#dc2626', letterSpacing: -0.3 },
  pctText: { fontSize: 10, color: colors.gray400, marginTop: 2, fontWeight: '700' },

  barTrack: { height: 5, backgroundColor: '#f1f3f8', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 999 },
});
