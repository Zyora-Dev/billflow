import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const fmtLimit = (v: number | null | undefined) => {
  if (v == null) return 'Unlimited';
  return v === -1 ? 'Unlimited' : String(v);
};

export default function SubscriptionScreen() {
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPlan = useCallback(async () => {
    try {
      const res = await api.get('/api/auth/me');
      setPlan(res.data?.plan || null);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);
  const onRefresh = () => { setRefreshing(true); fetchPlan(); };

  const openWhatsApp = () => {
    const url = 'https://wa.me/919876543210?text=Hi, I want to know more about SpectraBooks plans';
    Linking.openURL(url).catch(() => {});
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const now = new Date();
  const isTrial = !!plan?.is_trial;
  const expiresAt = plan?.expires_at ? new Date(plan.expires_at) : null;
  const isExpired = expiresAt ? expiresAt < now : false;
  const planName = plan?.plan_name || 'No Plan';

  const daysLeft = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const trialTotal = 7;
  const trialProgress = isTrial && daysLeft != null ? Math.min(1, Math.max(0, (trialTotal - daysLeft) / trialTotal)) : 0;

  const bannerBg = isExpired ? '#dc2626' : isTrial ? '#d97706' : '#059669';
  const statusLabel = isExpired ? 'Expired' : isTrial ? 'Trial' : 'Active';
  const statusColor = isExpired ? '#ef4444' : isTrial ? '#f59e0b' : '#10b981';
  const statusBgColor = isExpired ? '#fef2f2' : isTrial ? '#fffbeb' : '#ecfdf5';
  const bannerIcon = isExpired ? 'close-circle' : isTrial ? 'time-outline' : 'checkmark-circle';
  const bannerSub = isExpired
    ? 'Your plan has expired'
    : daysLeft != null
      ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`
      : 'No expiry';

  // Parse features
  const featuresList: string[] = [];
  if (plan?.features) {
    try {
      const parsed = JSON.parse(plan.features);
      if (Array.isArray(parsed)) featuresList.push(...parsed);
    } catch {
      // comma-separated fallback
      plan.features.split(',').forEach((f: string) => { if (f.trim()) featuresList.push(f.trim()); });
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Status Banner */}
      <View style={[styles.banner, { backgroundColor: bannerBg }]}>
        <Ionicons name={bannerIcon as any} size={28} color="#fff" />
        <View style={styles.bannerText}>
          <Text style={styles.bannerTitle}>{statusLabel}</Text>
          <Text style={styles.bannerSub}>{bannerSub}</Text>
        </View>
      </View>

      {/* Plan Name */}
      <View style={styles.planHero}>
        <Text style={styles.planName}>{planName}</Text>
        {isTrial && !isExpired && daysLeft != null && (
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressBar, { width: `${trialProgress * 100}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{daysLeft} of {trialTotal} days left</Text>
          </View>
        )}
      </View>

      {/* Plan Details Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Plan Details</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Plan</Text>
          <Text style={styles.value}>{planName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusBgColor }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        {plan?.started_at && (
          <View style={styles.row}>
            <Text style={styles.label}>Started</Text>
            <Text style={styles.value}>{fmtDate(plan.started_at)}</Text>
          </View>
        )}
        {plan?.expires_at && (
          <View style={styles.row}>
            <Text style={styles.label}>Expires</Text>
            <Text style={styles.value}>{fmtDate(plan.expires_at)}</Text>
          </View>
        )}
      </View>

      {/* Plan Limits Card */}
      {plan && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Plan Limits</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Invoices</Text>
            <Text style={styles.value}>{fmtLimit(plan.max_invoices)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Customers</Text>
            <Text style={styles.value}>{fmtLimit(plan.max_customers)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Items</Text>
            <Text style={styles.value}>{fmtLimit(plan.max_items)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Users</Text>
            <Text style={styles.value}>{fmtLimit(plan.max_users)}</Text>
          </View>
        </View>
      )}

      {/* Features */}
      {featuresList.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Included Features</Text>
          <View style={styles.featuresList}>
            {featuresList.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* WhatsApp CTA */}
      <TouchableOpacity style={styles.upgradeBtn} activeOpacity={0.8} onPress={openWhatsApp}>
        <Ionicons name="logo-whatsapp" size={22} color="#fff" />
        <Text style={styles.upgradeBtnText}>Contact us on WhatsApp</Text>
      </TouchableOpacity>

      <Text style={styles.upgradeHint}>For premium plans or support, reach out anytime</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

  banner: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md,
    borderRadius: borderRadius.lg, gap: 12,
  },
  bannerText: { flex: 1 },
  bannerTitle: { color: '#fff', fontSize: fontSize.lg, fontWeight: '700' },
  bannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.sm, marginTop: 2 },

  planHero: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.md },
  planName: { fontSize: 24, fontWeight: '800', color: colors.text },
  progressWrap: { width: '100%', marginTop: spacing.sm },
  progressTrack: { height: 8, backgroundColor: colors.gray200, borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#f59e0b', borderRadius: 4 },
  progressLabel: { textAlign: 'center', fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 4 },

  card: {
    backgroundColor: colors.card, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.xs + 2,
  },
  label: { fontSize: fontSize.sm, color: colors.textSecondary },
  value: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, gap: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: fontSize.xs, fontWeight: '700' },

  featuresList: { gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: fontSize.sm, color: colors.text, flex: 1 },

  upgradeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#25D366', padding: spacing.md, borderRadius: borderRadius.lg,
    gap: 10, marginTop: spacing.sm,
  },
  upgradeBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: '700' },
  upgradeHint: {
    textAlign: 'center', fontSize: fontSize.xs, color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
