import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../theme';

export default function ComingSoon({ route }: { route: any }) {
  const title = route?.params?.title || 'Coming Soon';
  return (
    <View style={styles.container}>
      <Ionicons name="construct-outline" size={64} color={colors.gray300} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>This feature is coming soon!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: spacing.xl },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.gray600, marginTop: spacing.md },
  sub: { fontSize: fontSize.sm, color: colors.gray400, marginTop: spacing.xs },
});
