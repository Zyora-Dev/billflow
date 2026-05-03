import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import CurrencyText from '../../components/CurrencyText';

export default function ReportsScreen({ navigation }: { navigation: any }) {
  const [sales, setSales] = useState<any>(null);
  const [purchases, setPurchases] = useState<any>(null);
  const [expenses, setExpenses] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (oid) {
        const [s, p, e] = await Promise.all([
          api.get(`/api/reports/summary?org_id=${oid}`),
          api.get(`/api/reports/purchase-summary?org_id=${oid}`),
          api.get(`/api/reports/expense-summary?org_id=${oid}`),
        ]);
        setSales(s.data); setPurchases(p.data); setExpenses(e.data);
      }
    } catch {} finally { setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, []);

  const Card = ({ title, items }: { title: string; items: { label: string; value: number; color?: string }[] }) => (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      {items.map((item, i) => (
        <View key={i} style={s.row}>
          <Text style={s.rowLabel}>{item.label}</Text>
          <CurrencyText amount={item.value} style={[s.rowValue, item.color ? { color: item.color } : {}]} />
        </View>
      ))}
    </View>
  );

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}>
      {sales && <Card title="Sales Summary" items={[
        { label: 'Total Invoiced', value: sales.total_invoiced, color: colors.primary },
        { label: 'Total Received', value: sales.total_received, color: colors.success },
        { label: 'Outstanding', value: sales.total_outstanding, color: colors.danger },
        { label: 'Total Invoices', value: sales.total_invoices },
        { label: 'Overdue Invoices', value: sales.overdue_invoices, color: colors.warning },
      ]} />}

      {purchases && <Card title="Purchase Summary" items={[
        { label: 'Total Billed', value: purchases.total_billed, color: colors.primary },
        { label: 'Total Paid', value: purchases.total_paid, color: colors.success },
        { label: 'Payables', value: purchases.total_payable, color: colors.danger },
        { label: 'Total Bills', value: purchases.total_bills },
      ]} />}

      {expenses && <Card title="Expense Summary" items={[
        { label: 'Total Expenses', value: expenses.total_expenses, color: colors.danger },
        { label: 'Total Count', value: expenses.total_count },
        ...(expenses.category_breakdown || []).map((c: any) => ({ label: c.category, value: c.total })),
      ]} />}

      {sales && purchases && expenses && (
        <View style={s.netCard}>
          <Text style={s.netTitle}>Net Cash Flow</Text>
          <CurrencyText amount={(sales.total_received || 0) - (purchases.total_paid || 0) - (expenses.total_expenses || 0)} style={s.netValue} />
          <Text style={s.netSub}>Received - Paid - Expenses</Text>
        </View>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { backgroundColor: colors.white, margin: spacing.md, marginBottom: 0, borderRadius: borderRadius.md, padding: spacing.md, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cardTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  rowLabel: { fontSize: fontSize.sm, color: colors.gray600 },
  rowValue: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  netCard: { backgroundColor: colors.primary, margin: spacing.md, borderRadius: borderRadius.md, padding: spacing.lg, alignItems: 'center' },
  netTitle: { fontSize: fontSize.sm, color: colors.gray300 },
  netValue: { fontSize: fontSize.xxxl, fontWeight: '700', color: colors.white, marginTop: 4 },
  netSub: { fontSize: fontSize.xs, color: colors.gray300, marginTop: 4 },
});
