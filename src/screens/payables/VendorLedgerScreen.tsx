import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity, Linking, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize } from '../../theme';
import CurrencyText from '../../components/CurrencyText';
import { downloadStatementPDF, shareStatementWhatsApp } from '../../lib/statement-pdf';

export default function VendorLedgerScreen({ route, navigation }: { route: any; navigation: any }) {
  const { vendor_id, vendor_name, payables_balance } = route.params || {};
  const [orgId, setOrgId] = useState<string | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [party, setParty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: vendor_name || 'Vendor Ledger' });
  }, [navigation, vendor_name]);

  const fetchAll = useCallback(async (oid?: string | null) => {
    const id = oid || orgId;
    if (!id || !vendor_id) return;
    try {
      const [stmt, bal, ven] = await Promise.all([
        api.get(`/api/ledger/vendor-statement/${vendor_id}?org_id=${id}`),
        api.get(`/api/balance/vendor/${vendor_id}?org_id=${id}`),
        api.get(`/api/vendors/${vendor_id}`),
      ]);
      setEntries(Array.isArray(stmt.data?.entries) ? stmt.data.entries : []);
      setSummary(bal.data || null);
      setParty(ven.data || null);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId, vendor_id]);

  useEffect(() => {
    (async () => {
      try {
        const biz = await api.get('/api/business');
        const id = biz.data[0]?.org_id || null;
        setOrgId(id);
        setBusiness(biz.data[0] || null);
        fetchAll(id);
      } catch {
        setLoading(false);
      }
    })();
  }, []);

  const partyInfo = useMemo(() => ({
    name: party?.business_name || party?.contact_person || vendor_name || 'Vendor',
    mobile: party?.mobile || null,
    email: party?.email || null,
    address: party?.address || null,
    gst_number: party?.gst_number || null,
  }), [party, vendor_name]);

  const handleDownload = async () => {
    if (!entries.length) return Alert.alert('No data', 'No ledger entries to export.');
    setExporting(true);
    try {
      await downloadStatementPDF({
        business,
        party: partyInfo,
        entries,
        title: 'Vendor Statement',
        party_label: 'Statement For Vendor',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleWhatsApp = () => {
    if (!entries.length) return Alert.alert('No data', 'No ledger entries to share.');
    shareStatementWhatsApp({ business, party: partyInfo, entries });
  };

  const handleEmail = () => {
    if (!entries.length) return;
    const lastBal = entries.length ? Number(entries[entries.length - 1].balance || 0) : 0;
    const sign = lastBal < 0 ? 'Cr' : 'Dr';
    const subject = `Statement of Account — ${partyInfo.name}`;
    const body =
      `Dear ${partyInfo.name},\n\n` +
      `Please find your statement of account below.\n\n` +
      `Closing Balance: ₹${Math.abs(lastBal).toLocaleString('en-IN')} ${sign}\n` +
      `Entries: ${entries.length}\n\n` +
      `Regards,\n${business?.business_name || ''}`;
    const to = partyInfo.email || '';
    const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open email client'));
  };

  const handleCall = () => {
    if (!partyInfo.mobile) return Alert.alert('No mobile', 'Vendor has no mobile number on file.');
    Linking.openURL(`tel:${partyInfo.mobile}`).catch(() => {});
  };

  const closingBalance = useMemo(() => {
    if (!entries || entries.length === 0) return summary?.outstanding || 0;
    const last = entries[entries.length - 1];
    return Number(last?.balance || 0);
  }, [entries, summary]);

  const openingEntry = useMemo(
    () => (entries.find(e => e?.type === 'Opening Balance') || null),
    [entries]
  );
  const opening = openingEntry ? Number(openingEntry.credit || 0) - Number(openingEntry.debit || 0) : 0;

  const tagFor = (type: string) => {
    if (type === 'Opening Balance') return { bg: '#ede9fe', fg: '#7c3aed', icon: 'time' as const };
    if (type === 'Bill' || type === 'Purchase Bill') return { bg: '#dbeafe', fg: '#1d4ed8', icon: 'newspaper' as const };
    if (type === 'Payment') return { bg: '#dcfce7', fg: '#15803d', icon: 'cash' as const };
    if (type === 'Debit Note') return { bg: '#fee2e2', fg: '#dc2626', icon: 'arrow-undo' as const };
    return { bg: colors.gray100, fg: colors.gray600, icon: 'ellipse' as const };
  };

  const renderItem = ({ item }: { item: any }) => {
    const tag = tagFor(item.type);
    const isOpening = item.type === 'Opening Balance';
    return (
      <View style={[styles.entry, isOpening && styles.entryOpening]}>
        <View style={[styles.entryIcon, { backgroundColor: tag.bg }]}>
          <Ionicons name={tag.icon} size={16} color={tag.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.entryTopLine}>
            <View style={[styles.typeTag, { backgroundColor: tag.bg }]}>
              <Text style={[styles.typeTagText, { color: tag.fg }]}>{item.type}</Text>
            </View>
            <Text style={styles.entryDate}>{item.date}</Text>
          </View>
          <Text style={styles.entryRef}>{item.ref}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {item.credit > 0 && (
            <Text style={[styles.entryAmt, { color: '#dc2626' }]}>+ ₹{Number(item.credit).toLocaleString('en-IN')}</Text>
          )}
          {item.debit > 0 && (
            <Text style={[styles.entryAmt, { color: '#15803d' }]}>− ₹{Number(item.debit).toLocaleString('en-IN')}</Text>
          )}
          <Text style={styles.entryBal}>Bal ₹{Number(item.balance || 0).toLocaleString('en-IN')}</Text>
        </View>
      </View>
    );
  };

  const Header = (
    <View>
      <View style={styles.hero}>
        <View style={styles.heroBgAccent} />
        <View style={styles.heroBgAccent2} />
        <View style={styles.heroTopRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {String(vendor_name || 'V').trim().charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLabel}>Closing Payable</Text>
            <CurrencyText amount={closingBalance} style={styles.heroValue} />
            {openingEntry ? (
              <View style={styles.sourcePill}>
                <Ionicons name="sync" size={10} color="rgba(255,255,255,0.95)" />
                <Text style={styles.sourceText}>Includes Opening B/F</Text>
              </View>
            ) : (
              <View style={styles.sourcePill}>
                <Ionicons name="newspaper" size={10} color="rgba(255,255,255,0.95)" />
                <Text style={styles.sourceText}>Current FY Only</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.breakdownRow}>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>Opening B/F</Text>
            <Text style={styles.breakdownVal}>
              ₹{Math.abs(opening).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              {opening < 0 ? ' Dr' : opening > 0 ? ' Cr' : ''}
            </Text>
          </View>
          <Ionicons name="add" size={14} color="rgba(255,255,255,0.5)" />
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>FY Movement</Text>
            <Text style={styles.breakdownVal}>
              ₹{(closingBalance - opening).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </Text>
          </View>
          <Ionicons name="remove" size={14} color="rgba(255,255,255,0.5)" />
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>Closing</Text>
            <Text style={[styles.breakdownVal, { color: '#fde68a' }]}>
              ₹{closingBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleDownload} disabled={exporting}>
          <View style={[styles.actionIcon, { backgroundColor: '#10B981' + '20' }]}>
            {exporting ? (
              <ActivityIndicator size="small" color="#10B981" />
            ) : (
              <Ionicons name="download-outline" size={20} color="#10B981" />
            )}
          </View>
          <Text style={styles.actionLabel}>PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleWhatsApp}>
          <View style={[styles.actionIcon, { backgroundColor: '#25D366' + '20' }]}>
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
          </View>
          <Text style={styles.actionLabel}>WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleEmail}>
          <View style={[styles.actionIcon, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="mail-outline" size={20} color={colors.primary} />
          </View>
          <Text style={styles.actionLabel}>Email</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleCall}>
          <View style={[styles.actionIcon, { backgroundColor: '#3b82f6' + '20' }]}>
            <Ionicons name="call-outline" size={20} color="#3b82f6" />
          </View>
          <Text style={styles.actionLabel}>Call</Text>
        </TouchableOpacity>
      </View>

      {typeof payables_balance === 'number' && Math.abs(Number(payables_balance) - closingBalance) > 1 && (
        <View style={styles.reconcileCard}>
          <Ionicons name="information-circle" size={16} color="#b45309" />
          <View style={{ flex: 1 }}>
            <Text style={styles.reconcileTitle}>Payables shows ₹{Number(payables_balance).toLocaleString('en-IN')}</Text>
            <Text style={styles.reconcileSub}>
              Ledger closing differs because it includes
              {openingEntry ? ' opening B/F from previous FY' : ' unallocated payments/advances'}.
              The closing balance above is the authoritative ledger value.
            </Text>
          </View>
        </View>
      )}

      <View style={styles.timelineHeader}>
        <Ionicons name="time-outline" size={14} color={colors.gray500} />
        <Text style={styles.timelineHeaderText}>Current FY Timeline</Text>
        <View style={styles.entryCountChip}>
          <Text style={styles.entryCountText}>{entries.length}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(_, idx) => String(idx)}
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
            <View style={{ paddingVertical: 50, alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={42} color={colors.gray300} />
              <Text style={styles.emptyText}>No entries this FY</Text>
            </View>
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
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: 22,
    padding: spacing.md + 4,
    overflow: 'hidden',
    shadowColor: '#dc2626', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  heroBgAccent: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.08)', top: -70, right: -50 },
  heroBgAccent2: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -40, left: -30 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  heroValue: { color: '#ffffff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  sourcePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
  },
  sourceText: { color: 'rgba(255,255,255,0.95)', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },

  breakdownRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingHorizontal: 10, paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 12,
  },
  breakdownItem: { flex: 1, alignItems: 'center' },
  breakdownLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  breakdownVal: { color: '#ffffff', fontSize: 12, fontWeight: '800', marginTop: 3, letterSpacing: -0.2 },

  actionsRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  actionBtn: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 4 },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11, fontWeight: '700', color: colors.gray700 },

  reconcileCard: {
    flexDirection: 'row', gap: 10,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    borderWidth: 1, borderColor: '#fde68a',
  },
  reconcileTitle: { fontSize: 12, fontWeight: '800', color: '#92400e' },
  reconcileSub: { fontSize: 11, color: '#92400e', marginTop: 2, lineHeight: 15 },

  timelineHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md + 4, paddingTop: spacing.md + 4, paddingBottom: 8,
  },
  timelineHeaderText: { fontSize: 11, color: colors.gray500, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  entryCountChip: { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#dc2626' + '15', borderRadius: 999 },
  entryCountText: { fontSize: 10, fontWeight: '800', color: '#dc2626' },

  entry: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    marginBottom: 8,
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  entryOpening: {
    backgroundColor: '#faf5ff',
    borderWidth: 1, borderColor: '#e9d5ff',
  },
  entryIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  entryTopLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  typeTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  typeTagText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  entryDate: { fontSize: 10, color: colors.gray500, fontWeight: '600' },
  entryRef: { fontSize: 13, fontWeight: '700', color: colors.text },
  entryAmt: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  entryBal: { fontSize: 10, color: colors.gray500, fontWeight: '700', marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 6 },
  emptyText: { color: colors.gray500, fontSize: fontSize.sm, fontWeight: '600' },
});
