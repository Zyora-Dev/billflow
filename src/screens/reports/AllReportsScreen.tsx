import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import { REPORTS, ReportDef } from './ReportsScreen';

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

export default function AllReportsScreen({ navigation }: { navigation: any }) {
  const [search, setSearch] = useState('');

  const filtered = REPORTS.filter(
    (r) => !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.header}>
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.gray400} />
          <TextInput
            placeholder="Search reports…"
            placeholderTextColor={colors.placeholder}
            value={search}
            onChangeText={setSearch}
            style={s.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.gray400} />
            </TouchableOpacity>
          )}
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
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.white, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, height: 44,
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
