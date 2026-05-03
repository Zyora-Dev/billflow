import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import CurrencyText from '../../components/CurrencyText';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function GSTScreen({ navigation }: { navigation: any }) {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [gstr1, setGstr1] = useState<any>(null);
  const [gstr3b, setGstr3b] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'gstr1' | 'gstr3b'>('gstr3b');
  const [orgId, setOrgId] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (oid) {
        setOrgId(oid);
        const [r1, r3b] = await Promise.all([
          api.get(`/api/gst/gstr1?org_id=${oid}&month=${month}&year=${year}`),
          api.get(`/api/gst/gstr3b?org_id=${oid}&month=${month}&year=${year}`),
        ]);
        setGstr1(r1.data); setGstr3b(r3b.data);
      }
    } catch {} finally { setRefreshing(false); }
  }, [month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}>
      {/* Month picker */}
      <View style={s.monthRow}>
        <TouchableOpacity onPress={() => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={s.monthText}>{MONTHS[month - 1]} {year}</Text>
        <TouchableOpacity onPress={() => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }}>
          <Ionicons name="chevron-forward" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tab, tab === 'gstr3b' && s.tabActive]} onPress={() => setTab('gstr3b')}><Text style={[s.tabText, tab === 'gstr3b' && s.tabTextActive]}>GSTR-3B</Text></TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'gstr1' && s.tabActive]} onPress={() => setTab('gstr1')}><Text style={[s.tabText, tab === 'gstr1' && s.tabTextActive]}>GSTR-1</Text></TouchableOpacity>
      </View>

      {tab === 'gstr3b' && gstr3b && (
        <>
          <View style={s.card}>
            <Text style={s.cardTitle}>Output Tax (Sales)</Text>
            <View style={s.row}><Text style={s.rowLabel}>Taxable Value</Text><CurrencyText amount={gstr3b.output_tax?.taxable_value} style={s.rowValue} /></View>
            <View style={s.row}><Text style={s.rowLabel}>CGST</Text><CurrencyText amount={gstr3b.output_tax?.cgst} style={s.rowValue} /></View>
            <View style={s.row}><Text style={s.rowLabel}>SGST</Text><CurrencyText amount={gstr3b.output_tax?.sgst} style={s.rowValue} /></View>
            <View style={s.row}><Text style={s.rowLabel}>IGST</Text><CurrencyText amount={gstr3b.output_tax?.igst} style={s.rowValue} /></View>
            <View style={s.row}><Text style={s.rowLabel}>Total Tax</Text><CurrencyText amount={gstr3b.output_tax?.total_tax} style={[s.rowValue, { fontWeight: '700' }]} /></View>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Input Tax Credit (Purchases)</Text>
            <View style={s.row}><Text style={s.rowLabel}>CGST</Text><CurrencyText amount={gstr3b.itc?.cgst} style={s.rowValue} /></View>
            <View style={s.row}><Text style={s.rowLabel}>SGST</Text><CurrencyText amount={gstr3b.itc?.sgst} style={s.rowValue} /></View>
            <View style={s.row}><Text style={s.rowLabel}>IGST</Text><CurrencyText amount={gstr3b.itc?.igst} style={s.rowValue} /></View>
            <View style={s.row}><Text style={s.rowLabel}>Total ITC</Text><CurrencyText amount={gstr3b.itc?.total_itc} style={[s.rowValue, { fontWeight: '700' }]} /></View>
          </View>

          <View style={s.netCard}>
            <Text style={s.netLabel}>Net GST Payable</Text>
            <CurrencyText amount={gstr3b.net_payable?.total} style={s.netValue} />
            <View style={s.netRow}><Text style={s.netSub}>CGST: ₹{gstr3b.net_payable?.cgst?.toFixed(2)}</Text><Text style={s.netSub}>SGST: ₹{gstr3b.net_payable?.sgst?.toFixed(2)}</Text><Text style={s.netSub}>IGST: ₹{gstr3b.net_payable?.igst?.toFixed(2)}</Text></View>
          </View>
        </>
      )}

      {tab === 'gstr1' && gstr1 && (
        <>
          <View style={s.card}>
            <Text style={s.cardTitle}>Summary</Text>
            <View style={s.row}><Text style={s.rowLabel}>Total Invoices</Text><Text style={s.rowValue}>{gstr1.doc_summary?.total_invoices || 0}</Text></View>
            <View style={s.row}><Text style={s.rowLabel}>Total Value</Text><CurrencyText amount={gstr1.doc_summary?.total_value} style={s.rowValue} /></View>
          </View>

          {gstr1.b2b && gstr1.b2b.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>B2B Invoices</Text>
              {gstr1.b2b.map((b: any, i: number) => (
                <View key={i} style={s.row}>
                  <Text style={s.rowLabel}>{b.customer_gstin || b.customer_name}</Text>
                  <CurrencyText amount={b.total_value} style={s.rowValue} />
                </View>
              ))}
            </View>
          )}

          {gstr1.hsn_summary && gstr1.hsn_summary.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>HSN Summary</Text>
              {gstr1.hsn_summary.map((h: any, i: number) => (
                <View key={i} style={s.row}>
                  <Text style={s.rowLabel}>{h.hsn_code || 'N/A'}</Text>
                  <CurrencyText amount={h.taxable_value} style={s.rowValue} />
                </View>
              ))}
            </View>
          )}
        </>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  monthRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: spacing.md, gap: spacing.lg, backgroundColor: colors.white },
  monthText: { fontSize: fontSize.lg, fontWeight: '700', color: colors.primary },
  tabRow: { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { fontSize: fontSize.md, color: colors.gray500, fontWeight: '500' },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  card: { backgroundColor: colors.white, margin: spacing.md, marginBottom: 0, borderRadius: borderRadius.md, padding: spacing.md },
  cardTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  rowLabel: { fontSize: fontSize.sm, color: colors.gray600 },
  rowValue: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text },
  netCard: { backgroundColor: colors.primary, margin: spacing.md, borderRadius: borderRadius.md, padding: spacing.lg, alignItems: 'center' },
  netLabel: { fontSize: fontSize.sm, color: colors.gray300 },
  netValue: { fontSize: 32, fontWeight: '700', color: colors.white, marginTop: 4 },
  netRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  netSub: { fontSize: fontSize.xs, color: colors.gray300 },
});
