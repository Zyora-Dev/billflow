import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

export type ReportKey =
  | 'aging' | 'customer-wise-sales' | 'vendor-wise-purchases'
  | 'item-wise-sales' | 'item-wise-purchases'
  | 'sales-trend' | 'purchase-trend'
  | 'profit-loss' | 'cash-flow' | 'day-book'
  | 'hsn-sales' | 'hsn-purchases' | 'gst-summary'
  | 'sales-return' | 'purchase-return'
  | 'low-stock' | 'stock-movement'
  | 'attendance' | 'payroll' | 'tasks' | 'party-balance';

export interface ReportDef {
  key: ReportKey;
  title: string;
  description: string;
  category: 'Sales' | 'Purchase' | 'Inventory' | 'Financial' | 'Tax' | 'Parties' | 'HR' | 'Tasks';
  icon: string;
  needsDateRange?: boolean;
  needsMonthYear?: boolean;
}

export const REPORTS: ReportDef[] = [
  { key: 'customer-wise-sales', title: 'Customer-wise Sales', description: 'Top customers', category: 'Sales', icon: 'people-outline', needsDateRange: true },
  { key: 'item-wise-sales', title: 'Item-wise Sales', description: 'Best-selling items', category: 'Sales', icon: 'cube-outline', needsDateRange: true },
  { key: 'sales-trend', title: 'Sales Trend', description: 'By day/week/month', category: 'Sales', icon: 'trending-up-outline', needsDateRange: true },
  { key: 'sales-return', title: 'Sales Returns', description: 'Credit notes', category: 'Sales', icon: 'arrow-undo-outline', needsDateRange: true },
  { key: 'vendor-wise-purchases', title: 'Vendor-wise Purchases', description: 'Top vendors', category: 'Purchase', icon: 'storefront-outline', needsDateRange: true },
  { key: 'item-wise-purchases', title: 'Item-wise Purchases', description: 'Most-bought items', category: 'Purchase', icon: 'bag-handle-outline', needsDateRange: true },
  { key: 'purchase-trend', title: 'Purchase Trend', description: 'By day/week/month', category: 'Purchase', icon: 'trending-down-outline', needsDateRange: true },
  { key: 'purchase-return', title: 'Purchase Returns', description: 'Debit notes', category: 'Purchase', icon: 'arrow-redo-outline', needsDateRange: true },
  { key: 'low-stock', title: 'Low Stock', description: 'Below alert qty', category: 'Inventory', icon: 'alert-circle-outline' },
  { key: 'stock-movement', title: 'Stock Movement', description: 'In/Out per item', category: 'Inventory', icon: 'swap-horizontal-outline', needsDateRange: true },
  { key: 'profit-loss', title: 'Profit & Loss', description: 'P&L statement', category: 'Financial', icon: 'stats-chart-outline', needsDateRange: true },
  { key: 'cash-flow', title: 'Cash Flow', description: 'Money in vs out', category: 'Financial', icon: 'wallet-outline', needsDateRange: true },
  { key: 'day-book', title: 'Day Book', description: 'All transactions', category: 'Financial', icon: 'book-outline', needsDateRange: true },
  { key: 'gst-summary', title: 'GST Summary', description: 'Output − Input', category: 'Tax', icon: 'receipt-outline', needsDateRange: true },
  { key: 'hsn-sales', title: 'HSN-wise Sales', description: 'By HSN & rate', category: 'Tax', icon: 'pricetags-outline', needsDateRange: true },
  { key: 'hsn-purchases', title: 'HSN-wise Purchases', description: 'By HSN & rate', category: 'Tax', icon: 'pricetag-outline', needsDateRange: true },
  { key: 'aging', title: 'Aging', description: '0-30/30-60/60-90/90+', category: 'Parties', icon: 'time-outline' },
  { key: 'party-balance', title: 'Party Balances', description: 'Debtors & creditors', category: 'Parties', icon: 'cash-outline' },
  { key: 'attendance', title: 'Attendance Report', description: 'Monthly summary', category: 'HR', icon: 'calendar-outline', needsMonthYear: true },
  { key: 'payroll', title: 'Payroll Report', description: 'Salary disbursed', category: 'HR', icon: 'briefcase-outline', needsMonthYear: true },
  { key: 'tasks', title: 'Task Report', description: 'By employee', category: 'Tasks', icon: 'checkbox-outline', needsDateRange: true },
];

const CATEGORIES: { name: ReportDef['category']; color: string }[] = [
  { name: 'Sales', color: '#10b981' },
  { name: 'Purchase', color: '#3b82f6' },
  { name: 'Financial', color: '#f59e0b' },
  { name: 'Tax', color: '#8b5cf6' },
  { name: 'Parties', color: '#ef4444' },
  { name: 'Inventory', color: '#06b6d4' },
  { name: 'HR', color: '#f97316' },
  { name: 'Tasks', color: '#6366f1' },
];

export default function ReportsScreen({ navigation }: { navigation: any }) {
  const [search, setSearch] = useState('');

  const filtered = REPORTS.filter(
    (r) => !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.header}>
        <Text style={s.title}>BF Insights</Text>
        <Text style={s.subtitle}>Comprehensive reports across your business</Text>
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.gray400} />
          <TextInput
            placeholder="Search reports…"
            placeholderTextColor={colors.placeholder}
            value={search}
            onChangeText={setSearch}
            style={s.searchInput}
          />
        </View>
      </View>

      {CATEGORIES.map((cat) => {
        const items = filtered.filter((r) => r.category === cat.name);
        if (items.length === 0) return null;
        return (
          <View key={cat.name} style={s.section}>
            <View style={s.sectionHeader}>
              <View style={[s.catBadge, { backgroundColor: cat.color }]} />
              <Text style={s.sectionTitle}>{cat.name}</Text>
              <Text style={s.sectionCount}>{items.length}</Text>
            </View>
            {items.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={s.card}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ReportDetail', { reportKey: r.key })}
              >
                <View style={[s.iconBox, { backgroundColor: cat.color + '15' }]}>
                  <Ionicons name={r.icon as any} size={20} color={cat.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{r.title}</Text>
                  <Text style={s.cardDesc}>{r.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
              </TouchableOpacity>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.white, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, marginTop: spacing.md, height: 44,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: fontSize.sm, color: colors.text },
  section: { paddingHorizontal: spacing.md, marginTop: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  catBadge: { width: 4, height: 18, borderRadius: 2 },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  sectionCount: { fontSize: fontSize.xs, color: colors.textSecondary, marginLeft: 4 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.white, padding: spacing.md, borderRadius: borderRadius.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  cardDesc: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
});
