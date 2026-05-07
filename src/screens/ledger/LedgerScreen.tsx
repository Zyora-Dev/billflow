import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import EmptyState from '../../components/EmptyState';
import CurrencyText from '../../components/CurrencyText';

const { width: SCREEN_W } = Dimensions.get('window');

const TABS = ['Debtors', 'Creditors', 'All Ledgers'] as const;
type Tab = typeof TABS[number];

const DR_COLOR = '#ef4444';
const CR_COLOR = '#10b981';
const HERO_BG = '#064e3b';

const fmt = (n: number) =>
  Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function LedgerScreen({ navigation }: { navigation: any }) {
  const [tab, setTab] = useState<Tab>('Debtors');
  const [debtors, setDebtors] = useState<any[]>([]);
  const [creditors, setCreditors] = useState<any[]>([]);
  const [allLedgers, setAllLedgers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [orgId, setOrgId] = useState('');

  // Statement drill-down
  const [statementMode, setStatementMode] = useState(false);
  const [statementData, setStatementData] = useState<any>(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementType, setStatementType] = useState<'customer' | 'vendor' | 'generic'>('customer');

  useEffect(() => {
    (async () => {
      const bid = await SecureStore.getItemAsync('business_id');
      if (bid) { setOrgId(bid); }
    })();
  }, []);

  useEffect(() => {
    if (orgId) fetchData();
  }, [orgId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [d, c, a] = await Promise.all([
        api.get(`/api/ledger/debtors?org_id=${orgId}`),
        api.get(`/api/ledger/creditors?org_id=${orgId}`),
        api.get(`/api/ledger/all?org_id=${orgId}`),
      ]);
      setDebtors(d.data || []);
      setCreditors(c.data || []);
      setAllLedgers(a.data || []);
    } catch {}
    setLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [orgId]);

  // Totals
  const totalReceivable = useMemo(() => debtors.reduce((s, d) => s + (d.closing || 0), 0), [debtors]);
  const totalPayable = useMemo(() => creditors.reduce((s, c) => s + Math.abs(c.closing || 0), 0), [creditors]);
  const totalDebit = useMemo(() => allLedgers.reduce((s, l) => s + (l.movement_dr || 0), 0), [allLedgers]);
  const totalCredit = useMemo(() => allLedgers.reduce((s, l) => s + (l.movement_cr || 0), 0), [allLedgers]);

  // Filtered lists
  const q = search.toLowerCase();
  const filteredDebtors = useMemo(() =>
    debtors.filter(d => (d.name || '').toLowerCase().includes(q)), [debtors, q]);
  const filteredCreditors = useMemo(() =>
    creditors.filter(c => (c.name || '').toLowerCase().includes(q)), [creditors, q]);
  const filteredAll = useMemo(() =>
    allLedgers.filter(l => (l.name || '').toLowerCase().includes(q)), [allLedgers, q]);

  // Open statement
  const openStatement = async (item: any, type: 'customer' | 'vendor' | 'generic') => {
    setStatementLoading(true);
    setStatementMode(true);
    setStatementType(type);
    try {
      let url = '';
      if (type === 'customer') url = `/api/ledger/customer-statement/${item.id}?org_id=${orgId}`;
      else if (type === 'vendor') url = `/api/ledger/vendor-statement/${item.id}?org_id=${orgId}`;
      else url = `/api/ledger/statement?org_id=${orgId}&ledger_name=${encodeURIComponent(item.name)}`;
      const r = await api.get(url);
      setStatementData(r.data);
    } catch {
      setStatementData(null);
    }
    setStatementLoading(false);
  };

  const closeStatement = () => {
    setStatementMode(false);
    setStatementData(null);
  };

  // ─── Statement View ───
  if (statementMode) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.stmtHeader}>
          <TouchableOpacity onPress={closeStatement} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.stmtHeaderTitle} numberOfLines={1}>
            {statementData?.party_name || 'Statement'}
          </Text>
        </View>

        {statementLoading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={HERO_BG} /></View>
        ) : !statementData ? (
          <EmptyState icon="document-text-outline" title="No statement data" />
        ) : (
          <>
            {/* Summary strip */}
            <View style={styles.stmtSummary}>
              <View style={styles.stmtSumItem}>
                <Text style={styles.stmtSumLabel}>Opening</Text>
                <Text style={[styles.stmtSumValue, { color: (statementData.opening || 0) >= 0 ? DR_COLOR : CR_COLOR }]}>
                  ₹ {fmt(statementData.opening || 0)} {(statementData.opening || 0) >= 0 ? 'Dr' : 'Cr'}
                </Text>
              </View>
              <View style={[styles.stmtSumItem, { borderLeftWidth: 1, borderLeftColor: '#e5e7eb' }]}>
                <Text style={styles.stmtSumLabel}>Closing</Text>
                <Text style={[styles.stmtSumValue, { color: (statementData.closing || 0) >= 0 ? DR_COLOR : CR_COLOR }]}>
                  ₹ {fmt(statementData.closing || 0)} {(statementData.closing || 0) >= 0 ? 'Dr' : 'Cr'}
                </Text>
              </View>
            </View>

            {/* Entries */}
            <FlatList
              data={statementData.entries || []}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
              ListEmptyComponent={<EmptyState icon="receipt-outline" title="No entries" />}
              renderItem={({ item: e, index }) => (
                <View style={styles.entryCard}>
                  {/* timeline dot */}
                  <View style={styles.timelineDot}>
                    <View style={[styles.dot, { backgroundColor: e.debit > 0 ? DR_COLOR : CR_COLOR }]} />
                    {index < (statementData.entries || []).length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.entryContent}>
                    <View style={styles.entryTop}>
                      <Text style={styles.entryDate}>{e.date || ''}</Text>
                      <View style={[styles.entryTypeBadge, { backgroundColor: e.debit > 0 ? '#fef2f2' : '#ecfdf5' }]}>
                        <Text style={[styles.entryTypeText, { color: e.debit > 0 ? DR_COLOR : CR_COLOR }]}>
                          {e.type || ''}
                        </Text>
                      </View>
                    </View>
                    {e.ref ? <Text style={styles.entryRef}>{e.ref}</Text> : null}
                    <View style={styles.entryAmounts}>
                      <View style={styles.entryAmtCol}>
                        <Text style={styles.entryAmtLabel}>Debit</Text>
                        <Text style={[styles.entryAmtVal, { color: DR_COLOR }]}>
                          {e.debit > 0 ? `₹ ${fmt(e.debit)}` : '—'}
                        </Text>
                      </View>
                      <View style={styles.entryAmtCol}>
                        <Text style={styles.entryAmtLabel}>Credit</Text>
                        <Text style={[styles.entryAmtVal, { color: CR_COLOR }]}>
                          {e.credit > 0 ? `₹ ${fmt(e.credit)}` : '—'}
                        </Text>
                      </View>
                      <View style={[styles.entryAmtCol, { alignItems: 'flex-end' }]}>
                        <Text style={styles.entryAmtLabel}>Balance</Text>
                        <Text style={[styles.entryAmtVal, { color: (e.balance || 0) >= 0 ? DR_COLOR : CR_COLOR }]}>
                          ₹ {fmt(e.balance || 0)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            />
          </>
        )}
      </View>
    );
  }

  // ─── Main View ───
  return (
    <View style={styles.container}>
      {/* Hero */}
      <View style={styles.hero}>
        {/* Decorative orbs */}
        <View style={[styles.orb, { top: -30, right: -20, width: 100, height: 100 }]} />
        <View style={[styles.orb, { bottom: -20, left: -15, width: 70, height: 70 }]} />
        <View style={[styles.orb, { top: 10, left: SCREEN_W * 0.4, width: 50, height: 50 }]} />

        {tab === 'Debtors' && (
          <>
            <Text style={styles.heroLabel}>Total Receivable</Text>
            <Text style={styles.heroAmount}>₹ {fmt(totalReceivable)}</Text>
            <Text style={styles.heroSub}>{debtors.length} debtor{debtors.length !== 1 ? 's' : ''}</Text>
          </>
        )}
        {tab === 'Creditors' && (
          <>
            <Text style={styles.heroLabel}>Total Payable</Text>
            <Text style={styles.heroAmount}>₹ {fmt(totalPayable)}</Text>
            <Text style={styles.heroSub}>{creditors.length} creditor{creditors.length !== 1 ? 's' : ''}</Text>
          </>
        )}
        {tab === 'All Ledgers' && (
          <>
            <View style={styles.heroRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>Total Debit</Text>
                <Text style={styles.heroAmount}>₹ {fmt(totalDebit)}</Text>
              </View>
              <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: 12 }} />
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.heroLabel}>Total Credit</Text>
                <Text style={styles.heroAmount}>₹ {fmt(totalCredit)}</Text>
              </View>
            </View>
            <Text style={styles.heroSub}>{allLedgers.length} ledger{allLedgers.length !== 1 ? 's' : ''}</Text>
          </>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => { setTab(t); setSearch(''); }}
            style={[styles.tabItem, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#9ca3af" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${tab.toLowerCase()}...`}
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={HERO_BG} /></View>
      ) : (
        <>
          {tab === 'Debtors' && (
            <FlatList
              data={filteredDebtors}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={HERO_BG} />}
              ListEmptyComponent={<EmptyState icon="people-outline" title="No debtors" subtitle="No outstanding receivables" />}
              renderItem={({ item }) => {
                const isDebit = (item.closing || 0) >= 0;
                return (
                  <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => openStatement(item, 'customer')}>
                    <View style={styles.cardLeft}>
                      <View style={[styles.avatar, { backgroundColor: '#ecfdf5' }]}>
                        <Ionicons name="person" size={18} color={HERO_BG} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.cardSub}>
                          Dr: ₹ {fmt(item.debit || 0)}  ·  Cr: ₹ {fmt(item.credit || 0)}
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.cardAmount, { color: isDebit ? DR_COLOR : CR_COLOR }]}>
                        ₹ {fmt(item.closing || 0)}
                      </Text>
                      <Text style={[styles.cardDrCr, { color: isDebit ? DR_COLOR : CR_COLOR }]}>
                        {isDebit ? 'Dr' : 'Cr'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#d1d5db" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {tab === 'Creditors' && (
            <FlatList
              data={filteredCreditors}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={HERO_BG} />}
              ListEmptyComponent={<EmptyState icon="business-outline" title="No creditors" subtitle="No outstanding payables" />}
              renderItem={({ item }) => {
                const closing = item.closing || 0;
                const isDebit = closing >= 0;
                return (
                  <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => openStatement(item, 'vendor')}>
                    <View style={styles.cardLeft}>
                      <View style={[styles.avatar, { backgroundColor: '#fef2f2' }]}>
                        <Ionicons name="storefront" size={18} color={DR_COLOR} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.cardSub}>
                          Dr: ₹ {fmt(item.debit || 0)}  ·  Cr: ₹ {fmt(item.credit || 0)}
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.cardAmount, { color: isDebit ? DR_COLOR : CR_COLOR }]}>
                        ₹ {fmt(Math.abs(closing))}
                      </Text>
                      <Text style={[styles.cardDrCr, { color: isDebit ? DR_COLOR : CR_COLOR }]}>
                        {isDebit ? 'Dr' : 'Cr'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#d1d5db" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {tab === 'All Ledgers' && (
            <FlatList
              data={filteredAll}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={HERO_BG} />}
              ListEmptyComponent={<EmptyState icon="book-outline" title="No ledgers" subtitle="No ledger entries found" />}
              renderItem={({ item }) => {
                const closing = item.closing || 0;
                const isDebit = closing >= 0;
                return (
                  <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => openStatement(item, 'generic')}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                      {item.parent ? <Text style={styles.cardParent}>{item.parent}</Text> : null}
                      <View style={styles.allRow}>
                        <View style={styles.allCol}>
                          <Text style={styles.allLabel}>Opening</Text>
                          <Text style={styles.allVal}>₹ {fmt(item.opening || 0)}</Text>
                        </View>
                        <View style={styles.allCol}>
                          <Text style={styles.allLabel}>Dr</Text>
                          <Text style={[styles.allVal, { color: DR_COLOR }]}>₹ {fmt(item.movement_dr || 0)}</Text>
                        </View>
                        <View style={styles.allCol}>
                          <Text style={styles.allLabel}>Cr</Text>
                          <Text style={[styles.allVal, { color: CR_COLOR }]}>₹ {fmt(item.movement_cr || 0)}</Text>
                        </View>
                        <View style={[styles.allCol, { alignItems: 'flex-end' }]}>
                          <Text style={styles.allLabel}>Closing</Text>
                          <Text style={[styles.allVal, { color: isDebit ? DR_COLOR : CR_COLOR, fontWeight: '700' }]}>
                            ₹ {fmt(closing)} {isDebit ? 'Dr' : 'Cr'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#d1d5db" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Hero
  hero: {
    backgroundColor: HERO_BG,
    paddingTop: 18,
    paddingBottom: 22,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginBottom: 4 },
  heroAmount: { fontSize: 26, color: '#fff', fontWeight: '800', letterSpacing: -0.5 },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 6 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: HERO_BG },
  tabText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  tabTextActive: { color: HERO_BG },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1f2937', padding: 0 },

  // List
  listContent: { padding: 14, paddingBottom: 100 },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  cardName: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  cardSub: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  cardAmount: { fontSize: 15, fontWeight: '800' },
  cardDrCr: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  cardParent: { fontSize: 11, color: '#6b7280', marginTop: 1, fontStyle: 'italic' },

  // All ledgers row
  allRow: { flexDirection: 'row', marginTop: 8, gap: 4 },
  allCol: { flex: 1 },
  allLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '500', marginBottom: 2 },
  allVal: { fontSize: 12, color: '#374151', fontWeight: '600' },

  // ── Statement view ──
  stmtHeader: {
    backgroundColor: HERO_BG,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stmtHeaderTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#fff' },

  stmtSummary: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  stmtSumItem: { flex: 1, alignItems: 'center' },
  stmtSumLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '500', marginBottom: 4 },
  stmtSumValue: { fontSize: 16, fontWeight: '800' },

  // Entry card (timeline)
  entryCard: { flexDirection: 'row', marginBottom: 0 },
  timelineDot: { width: 24, alignItems: 'center', paddingTop: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e5e7eb',
    marginTop: 4,
  },
  entryContent: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginLeft: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  entryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  entryDate: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  entryTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  entryTypeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  entryRef: { fontSize: 12, color: '#374151', fontWeight: '600', marginBottom: 6 },
  entryAmounts: { flexDirection: 'row', marginTop: 6 },
  entryAmtCol: { flex: 1 },
  entryAmtLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '500', marginBottom: 2 },
  entryAmtVal: { fontSize: 13, fontWeight: '700' },
});
