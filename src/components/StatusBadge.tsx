import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, borderRadius, fontSize } from '../theme';

const statusColors: Record<string, { bg: string; text: string }> = {
  Draft: { bg: '#f3f4f6', text: '#374151' },
  Sent: { bg: '#dbeafe', text: '#1d4ed8' },
  Paid: { bg: '#dcfce7', text: '#15803d' },
  'Partially Paid': { bg: '#fef9c3', text: '#a16207' },
  Overdue: { bg: '#fee2e2', text: '#dc2626' },
  Cancelled: { bg: '#f3f4f6', text: '#6b7280' },
  Accepted: { bg: '#dcfce7', text: '#15803d' },
  Rejected: { bg: '#fee2e2', text: '#dc2626' },
  Expired: { bg: '#f3f4f6', text: '#6b7280' },
};

export default function StatusBadge({ status }: { status: string }) {
  const c = statusColors[status] || { bg: colors.gray100, text: colors.gray600 };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.text }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full },
  text: { fontSize: fontSize.xs, fontWeight: '600' },
});
