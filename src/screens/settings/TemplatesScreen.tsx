import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { useToast } from '../../components/Toast';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import { TEMPLATE_OPTIONS } from '../../lib/document-templates';

type DocKind = 'invoice' | 'quotation';

const KIND_LABEL: Record<DocKind, string> = {
  invoice: 'Invoice',
  quotation: 'Quotation',
};

const SETTINGS_PATH: Record<DocKind, string> = {
  invoice: '/api/invoice-settings',
  quotation: '/api/quotation-settings',
};

export default function TemplatesScreen({ navigation }: { navigation: any }) {
  const toast = useToast();
  const [kind, setKind] = useState<DocKind>('invoice');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoiceTpl, setInvoiceTpl] = useState<string>('classic');
  const [quotationTpl, setQuotationTpl] = useState<string>('classic');

  const load = async () => {
    try {
      setLoading(true);
      const biz = await api.get('/api/business');
      const org = biz.data?.[0]?.org_id;
      if (!org) {
        Alert.alert('No business', 'Please set up a business first.');
        navigation.goBack();
        return;
      }
      setOrgId(org);
      const [inv, q] = await Promise.all([
        api.get(`/api/invoice-settings?org_id=${org}`).catch(() => null),
        api.get(`/api/quotation-settings?org_id=${org}`).catch(() => null),
      ]);
      if (inv?.data?.template) setInvoiceTpl(inv.data.template);
      if (q?.data?.template) setQuotationTpl(q.data.template);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const currentTpl = kind === 'invoice' ? invoiceTpl : quotationTpl;

  const select = async (templateId: string) => {
    if (!orgId || saving) return;
    if (currentTpl === templateId) return;
    try {
      setSaving(true);
      const fd = new FormData();
      fd.append('org_id', orgId);
      fd.append('template', templateId);
      const res = await api.put(SETTINGS_PATH[kind], fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const saved = res.data?.template;
      if (saved && saved !== templateId) {
        Alert.alert('Save mismatch', `Server returned template="${saved}" instead of "${templateId}".`);
        return;
      }
      if (kind === 'invoice') setInvoiceTpl(templateId);
      else setQuotationTpl(templateId);
      toast.success(`${KIND_LABEL[kind]} template updated`);
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.response?.data || e?.message || 'Failed';
      console.log('[Templates] save error', { status: e?.response?.status, detail, code: e?.code });
      Alert.alert('Error', typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.tabRow}>
        {(['invoice', 'quotation'] as DocKind[]).map((k) => (
          <TouchableOpacity
            key={k}
            onPress={() => setKind(k)}
            style={[s.tab, kind === k && s.tabActive]}
          >
            <Text style={[s.tabText, kind === k && s.tabTextActive]}>{KIND_LABEL[k]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.helper}>
        Pick a template for {KIND_LABEL[kind].toLowerCase()} PDFs and prints. Default is Classic.
      </Text>

      <View style={s.list}>
        {TEMPLATE_OPTIONS.map((opt) => {
          const selected = currentTpl === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              activeOpacity={0.85}
              onPress={() => select(opt.id)}
              disabled={saving}
              style={[s.card, selected && s.cardSelected]}
            >
              <View style={[s.preview, { backgroundColor: opt.accent }]}>
                <View style={s.previewBar} />
                <View style={s.previewLine} />
                <View style={[s.previewLine, { width: '60%' }]} />
                <View style={[s.previewLine, { width: '80%' }]} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={s.title}>{opt.name}</Text>
                  {selected && (
                    <View style={s.checkBadge}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={s.desc}>{opt.description}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {saving && (
        <View style={s.savingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={s.savingText}>Saving…</Text>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  tabRow: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: borderRadius.md, padding: 4, marginBottom: spacing.md },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: borderRadius.sm },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray600 },
  tabTextActive: { color: colors.white },
  helper: { fontSize: fontSize.sm, color: colors.gray600, marginBottom: spacing.md },
  list: { gap: spacing.md },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.gray200,
    padding: spacing.md,
    gap: spacing.md,
    alignItems: 'center',
  },
  cardSelected: { borderColor: colors.primary, backgroundColor: '#f5f5ff' },
  preview: {
    width: 60,
    height: 76,
    borderRadius: borderRadius.sm,
    padding: 6,
    gap: 4,
    overflow: 'hidden',
  },
  previewBar: { height: 8, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 2 },
  previewLine: { height: 4, backgroundColor: 'rgba(255,255,255,0.45)', borderRadius: 2, width: '100%' },
  title: { fontSize: fontSize.md, fontWeight: '700', color: colors.gray800 },
  desc: { fontSize: fontSize.xs, color: colors.gray600, marginTop: 4 },
  checkBadge: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  savingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: spacing.md },
  savingText: { fontSize: fontSize.sm, color: colors.gray600 },
});
