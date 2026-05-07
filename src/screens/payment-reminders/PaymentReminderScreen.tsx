import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TextInput, TouchableOpacity,
  Switch, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import EmptyState from '../../components/EmptyState';

const fmtDate = (d: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const typeColor = (t: string) => {
  switch (t) {
    case 'before_due': return { bg: '#dbeafe', fg: '#3b82f6' };
    case 'on_due': return { bg: '#fef3c7', fg: '#f59e0b' };
    case 'after_due': return { bg: '#fef2f2', fg: '#ef4444' };
    default: return { bg: '#f3f4f6', fg: '#6b7280' };
  }
};
const statusColor = (s: string) => {
  switch (s) {
    case 'sent': return { bg: '#dcfce7', fg: '#15803d' };
    case 'failed': return { bg: '#fef2f2', fg: '#dc2626' };
    default: return { bg: '#fef3c7', fg: '#b45309' };
  }
};

const typeLabel = (t: string) => {
  switch (t) {
    case 'before_due': return 'Before Due';
    case 'on_due': return 'On Due';
    case 'after_due': return 'After Due';
    default: return t;
  }
};

export default function PaymentReminderScreen({ navigation }: { navigation: any }) {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sendingDue, setSendingDue] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);

  // Settings
  const [enabled, setEnabled] = useState(false);
  const [beforeDueDays, setBeforeDueDays] = useState('3');
  const [onDueDate, setOnDueDate] = useState(true);
  const [afterDueDays, setAfterDueDays] = useState('3,7,15');

  // Reminders list
  const [reminders, setReminders] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (!oid) { setLoading(false); setRefreshing(false); return; }
      setOrgId(oid);

      const [settingsRes, remindersRes] = await Promise.all([
        api.get(`/api/reminder-settings?org_id=${oid}`),
        api.get(`/api/payment-reminders?org_id=${oid}`),
      ]);

      const s = settingsRes.data;
      if (s) {
        setEnabled(!!s.enabled);
        setBeforeDueDays(String(s.before_due_days ?? '3'));
        setOnDueDate(!!s.on_due_date);
        setAfterDueDays(s.after_due_days ?? '3,7,15');
      }

      setReminders(Array.isArray(remindersRes.data) ? remindersRes.data : []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const saveSettings = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      await api.put('/api/reminder-settings', {
        org_id: orgId,
        enabled,
        before_due_days: parseInt(beforeDueDays) || 3,
        on_due_date: onDueDate,
        after_due_days: afterDueDays,
      });
      Alert.alert('Saved', 'Reminder settings updated');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const generateReminders = async () => {
    if (!orgId) return;
    setGenerating(true);
    try {
      const res = await api.post(`/api/payment-reminders/generate?org_id=${orgId}`);
      Alert.alert('Done', `Generated ${res.data?.count ?? 0} reminders`);
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally { setGenerating(false); }
  };

  const sendDue = async () => {
    if (!orgId) return;
    setSendingDue(true);
    try {
      const res = await api.post(`/api/payment-reminders/send-due?org_id=${orgId}`);
      Alert.alert('Done', `Sent ${res.data?.sent ?? 0} reminders`);
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally { setSendingDue(false); }
  };

  const sendOne = async (id: number) => {
    setSendingId(id);
    try {
      await api.post(`/api/payment-reminders/${id}/send`);
      Alert.alert('Sent', 'Reminder sent successfully');
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally { setSendingId(null); }
  };

  const deleteReminder = (id: number) => {
    Alert.alert('Delete', 'Remove this reminder?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/api/payment-reminders/${id}`);
          setReminders(prev => prev.filter(r => r.id !== id));
        } catch (e: any) {
          Alert.alert('Error', e.response?.data?.detail || 'Failed');
        }
      }},
    ]);
  };

  const renderCard = ({ item }: { item: any }) => {
    const tc = typeColor(item.reminder_type);
    const sc = statusColor(item.status);
    const isPending = item.status === 'pending';
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardInv}>{item.invoice_number || '—'}</Text>
            <Text style={styles.cardCust} numberOfLines={1}>{item.customer_name || '—'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={[styles.badge, { backgroundColor: tc.bg }]}>
              <Text style={[styles.badgeText, { color: tc.fg }]}>{typeLabel(item.reminder_type)}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: sc.bg }]}>
              <Text style={[styles.badgeText, { color: sc.fg }]}>{item.status}</Text>
            </View>
          </View>
        </View>
        <View style={styles.cardMid}>
          <Text style={styles.cardDate}>
            <Ionicons name="calendar-outline" size={12} color={colors.gray400} /> Scheduled: {fmtDate(item.scheduled_date)}
          </Text>
          {item.sent_date ? (
            <Text style={styles.cardDate}>
              <Ionicons name="checkmark-circle-outline" size={12} color={colors.primary} /> Sent: {fmtDate(item.sent_date)}
            </Text>
          ) : null}
        </View>
        <View style={styles.cardActions}>
          {isPending && (
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={() => sendOne(item.id)}
              disabled={sendingId === item.id}
            >
              {sendingId === item.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={14} color="#fff" />
                  <Text style={styles.sendBtnText}>Send</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteReminder(item.id)}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <FlatList
      data={reminders}
      keyExtractor={item => String(item.id)}
      renderItem={renderCard}
      contentContainerStyle={reminders.length === 0 ? { flexGrow: 1 } : { paddingBottom: 20 }}
      ListEmptyComponent={<EmptyState icon="notifications-outline" title="No reminders" subtitle="Generate reminders for unpaid invoices" />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View>
          {/* Settings Card */}
          <View style={styles.settingsCard}>
            <Text style={styles.sectionTitle}>Reminder Settings</Text>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Reminders Enabled</Text>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                trackColor={{ false: colors.gray200, true: colors.primaryLight }}
                thumbColor={enabled ? colors.primary : colors.gray400}
              />
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Before Due (days)</Text>
              <TextInput
                style={styles.settingInput}
                value={beforeDueDays}
                onChangeText={setBeforeDueDays}
                keyboardType="number-pad"
                placeholder="3"
                placeholderTextColor={colors.placeholder}
              />
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>On Due Date</Text>
              <Switch
                value={onDueDate}
                onValueChange={setOnDueDate}
                trackColor={{ false: colors.gray200, true: colors.primaryLight }}
                thumbColor={onDueDate ? colors.primary : colors.gray400}
              />
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>After Due (days)</Text>
              <TextInput
                style={[styles.settingInput, { width: 120 }]}
                value={afterDueDays}
                onChangeText={setAfterDueDays}
                placeholder="3,7,15"
                placeholderTextColor={colors.placeholder}
              />
            </View>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={saveSettings}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>Save Settings</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnOutline, { flex: 1 }]}
              onPress={generateReminders}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="refresh" size={16} color={colors.primary} />
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>Generate</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { flex: 1, backgroundColor: '#064e3b' }]}
              onPress={sendDue}
              disabled={sendingDue}
            >
              {sendingDue ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>Send Due</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.listTitle}>Reminders ({reminders.length})</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

  settingsCard: {
    backgroundColor: colors.card, margin: spacing.md, borderRadius: borderRadius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },

  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.xs + 2,
  },
  settingLabel: { fontSize: fontSize.sm, color: colors.text },
  settingInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm,
    paddingHorizontal: 10, paddingVertical: 6, fontSize: fontSize.sm, color: colors.text,
    width: 70, textAlign: 'center', backgroundColor: colors.gray50,
  },

  actionsRow: {
    flexDirection: 'row', marginHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.sm,
  },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: spacing.sm + 2, borderRadius: borderRadius.md, gap: 6, marginTop: spacing.xs,
  },
  actionBtnOutline: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary,
  },
  actionBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '700' },

  listTitle: {
    fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary,
    marginHorizontal: spacing.md, marginBottom: spacing.xs, marginTop: spacing.xs,
  },

  card: {
    backgroundColor: colors.card, marginHorizontal: spacing.md, marginBottom: spacing.sm,
    borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardInv: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  cardCust: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  cardMid: { marginTop: spacing.xs, gap: 2 },
  cardDate: { fontSize: fontSize.xs, color: colors.textSecondary },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: spacing.xs, gap: 8 },

  sendBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.sm, gap: 4,
  },
  sendBtnText: { color: '#fff', fontSize: fontSize.xs, fontWeight: '700' },

  deleteBtn: { padding: 6 },
});
