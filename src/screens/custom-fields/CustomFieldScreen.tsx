import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
  Modal, ScrollView, ActivityIndicator, Alert, TextInput, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import EmptyState from '../../components/EmptyState';

const ENTITY_TYPES = ['All', 'customer', 'item', 'invoice', 'vendor', 'purchase_bill'];
const ENTITY_LABELS: Record<string, string> = {
  All: 'All',
  customer: 'Customer',
  item: 'Item',
  invoice: 'Invoice',
  vendor: 'Vendor',
  purchase_bill: 'Purchase Bill',
};

const FIELD_TYPES = ['text', 'number', 'date', 'dropdown', 'checkbox', 'textarea'];
const FIELD_TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  text: { bg: '#dbeafe', fg: '#3b82f6' },
  number: { bg: '#ede9fe', fg: '#8b5cf6' },
  date: { bg: '#fef3c7', fg: '#f59e0b' },
  dropdown: { bg: '#cffafe', fg: '#06b6d4' },
  checkbox: { bg: '#dcfce7', fg: '#10b981' },
  textarea: { bg: '#fce7f3', fg: '#ec4899' },
};

const entityBadge = (e: string) => {
  switch (e) {
    case 'customer': return { bg: '#dbeafe', fg: '#1d4ed8' };
    case 'item': return { bg: '#dcfce7', fg: '#15803d' };
    case 'invoice': return { bg: '#fef3c7', fg: '#b45309' };
    case 'vendor': return { bg: '#ede9fe', fg: '#7c3aed' };
    case 'purchase_bill': return { bg: '#fce7f3', fg: '#be185d' };
    default: return { bg: '#f3f4f6', fg: '#6b7280' };
  }
};

export default function CustomFieldScreen({ navigation }: { navigation: any }) {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entityFilter, setEntityFilter] = useState('All');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formEntity, setFormEntity] = useState('customer');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('text');
  const [formRequired, setFormRequired] = useState(false);
  const [formDefault, setFormDefault] = useState('');
  const [formOptions, setFormOptions] = useState('');
  const [formSort, setFormSort] = useState('0');

  // Picker modals
  const [showEntityPicker, setShowEntityPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (!oid) { setLoading(false); setRefreshing(false); return; }
      setOrgId(oid);
      const res = await api.get(`/api/custom-fields?org_id=${oid}`);
      setFields(Array.isArray(res.data) ? res.data : []);
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

  const filtered = useMemo(() => {
    if (entityFilter === 'All') return fields;
    return fields.filter(f => f.entity_type === entityFilter);
  }, [fields, entityFilter]);

  const resetForm = () => {
    setEditing(null);
    setFormEntity('customer');
    setFormName('');
    setFormType('text');
    setFormRequired(false);
    setFormDefault('');
    setFormOptions('');
    setFormSort('0');
  };

  const openAdd = () => { resetForm(); setShowForm(true); };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormEntity(item.entity_type || 'customer');
    setFormName(item.field_name || '');
    setFormType(item.field_type || 'text');
    setFormRequired(!!item.required);
    setFormDefault(item.default_value || '');
    setFormOptions(item.options || '');
    setFormSort(String(item.sort_order ?? 0));
    setShowForm(true);
  };

  const saveField = async () => {
    if (!orgId) return;
    if (!formName.trim()) return Alert.alert('Error', 'Field name is required');
    setFormSaving(true);
    const body = {
      org_id: orgId,
      entity_type: formEntity,
      field_name: formName.trim(),
      field_type: formType,
      required: formRequired,
      default_value: formDefault || null,
      options: formType === 'dropdown' ? formOptions : null,
      sort_order: parseInt(formSort) || 0,
    };
    try {
      if (editing) {
        await api.put(`/api/custom-fields/${editing.id}`, body);
      } else {
        await api.post('/api/custom-fields', body);
      }
      setShowForm(false);
      resetForm();
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to save');
    } finally { setFormSaving(false); }
  };

  const deleteField = (id: number, name: string) => {
    Alert.alert('Delete Field', `Remove "${name}"?`, [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/api/custom-fields/${id}`);
          setFields(prev => prev.filter(f => f.id !== id));
        } catch (e: any) {
          Alert.alert('Error', e.response?.data?.detail || 'Failed');
        }
      }},
    ]);
  };

  const renderCard = ({ item }: { item: any }) => {
    const ftc = FIELD_TYPE_COLORS[item.field_type] || FIELD_TYPE_COLORS.text;
    const eb = entityBadge(item.entity_type);
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => openEdit(item)}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.cardName}>{item.field_name}</Text>
              {item.required && (
                <Text style={styles.requiredStar}>*</Text>
              )}
            </View>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: eb.bg }]}>
                <Text style={[styles.badgeText, { color: eb.fg }]}>
                  {ENTITY_LABELS[item.entity_type] || item.entity_type}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: ftc.bg }]}>
                <Text style={[styles.badgeText, { color: ftc.fg }]}>{item.field_type}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity onPress={() => deleteField(item.id, item.field_name)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>
        {item.default_value ? (
          <Text style={styles.cardMeta}>Default: {item.default_value}</Text>
        ) : null}
        {item.field_type === 'dropdown' && item.options ? (
          <Text style={styles.cardMeta} numberOfLines={1}>Options: {item.options}</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Entity Filter Chips */}
      <View style={styles.chipContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {ENTITY_TYPES.map(e => (
            <TouchableOpacity
              key={e}
              style={[styles.chip, entityFilter === e && styles.chipActive]}
              onPress={() => setEntityFilter(e)}
            >
              <Text style={[styles.chipText, entityFilter === e && styles.chipTextActive]}>
                {ENTITY_LABELS[e] || e}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        renderItem={renderCard}
        contentContainerStyle={filtered.length === 0 ? { flex: 1 } : { paddingHorizontal: spacing.md, paddingBottom: 80 }}
        ListEmptyComponent={<EmptyState icon="options-outline" title="No custom fields" subtitle="Add custom fields for your entities" actionLabel="Add Field" onAction={openAdd} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={openAdd}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Edit Field' : 'Add Custom Field'}</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color={colors.gray500} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 500 }} keyboardShouldPersistTaps="handled">
              {/* Entity Type Picker */}
              <Text style={styles.fieldLabel}>Entity Type</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowEntityPicker(true)}>
                <Text style={styles.pickerBtnText}>{ENTITY_LABELS[formEntity] || formEntity}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.gray400} />
              </TouchableOpacity>

              {/* Field Name */}
              <Text style={styles.fieldLabel}>Field Name *</Text>
              <TextInput
                style={styles.input}
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g. Company Size"
                placeholderTextColor={colors.placeholder}
              />

              {/* Field Type Picker */}
              <Text style={styles.fieldLabel}>Field Type</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTypePicker(true)}>
                <Text style={styles.pickerBtnText}>{formType}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.gray400} />
              </TouchableOpacity>

              {/* Required */}
              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Required</Text>
                <Switch
                  value={formRequired}
                  onValueChange={setFormRequired}
                  trackColor={{ false: colors.gray200, true: colors.primaryLight }}
                  thumbColor={formRequired ? colors.primary : colors.gray400}
                />
              </View>

              {/* Default Value */}
              <Text style={styles.fieldLabel}>Default Value</Text>
              <TextInput
                style={styles.input}
                value={formDefault}
                onChangeText={setFormDefault}
                placeholder="Optional"
                placeholderTextColor={colors.placeholder}
              />

              {/* Options (dropdown only) */}
              {formType === 'dropdown' && (
                <>
                  <Text style={styles.fieldLabel}>Options (comma-separated)</Text>
                  <TextInput
                    style={styles.input}
                    value={formOptions}
                    onChangeText={setFormOptions}
                    placeholder="Option 1, Option 2, Option 3"
                    placeholderTextColor={colors.placeholder}
                  />
                </>
              )}

              {/* Sort Order */}
              <Text style={styles.fieldLabel}>Sort Order</Text>
              <TextInput
                style={[styles.input, { width: 80 }]}
                value={formSort}
                onChangeText={setFormSort}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.placeholder}
              />

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={saveField}
                disabled={formSaving}
              >
                {formSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>{editing ? 'Update Field' : 'Add Field'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Entity Type Picker Modal */}
      <Modal visible={showEntityPicker} transparent animationType="fade" onRequestClose={() => setShowEntityPicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowEntityPicker(false)}>
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>Select Entity Type</Text>
            {ENTITY_TYPES.filter(e => e !== 'All').map(e => (
              <TouchableOpacity
                key={e}
                style={[styles.pickerOption, formEntity === e && styles.pickerOptionActive]}
                onPress={() => { setFormEntity(e); setShowEntityPicker(false); }}
              >
                <Text style={[styles.pickerOptionText, formEntity === e && { color: colors.primary, fontWeight: '700' }]}>
                  {ENTITY_LABELS[e]}
                </Text>
                {formEntity === e && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Field Type Picker Modal */}
      <Modal visible={showTypePicker} transparent animationType="fade" onRequestClose={() => setShowTypePicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowTypePicker(false)}>
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>Select Field Type</Text>
            {FIELD_TYPES.map(t => {
              const c = FIELD_TYPE_COLORS[t];
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.pickerOption, formType === t && styles.pickerOptionActive]}
                  onPress={() => { setFormType(t); setShowTypePicker(false); }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.typeDot, { backgroundColor: c.fg }]} />
                    <Text style={[styles.pickerOptionText, formType === t && { color: c.fg, fontWeight: '700' }]}>
                      {t}
                    </Text>
                  </View>
                  {formType === t && <Ionicons name="checkmark" size={18} color={c.fg} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

  chipContainer: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chipRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 17,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: '#fff' },

  card: {
    backgroundColor: colors.card, marginBottom: spacing.sm,
    borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardName: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  requiredStar: { fontSize: fontSize.md, fontWeight: '800', color: colors.danger },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: spacing.xs },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardMeta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs },

  fab: {
    position: 'absolute', bottom: 20, right: 20,
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
    elevation: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: spacing.lg, paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },

  fieldLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginTop: spacing.sm, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: fontSize.sm, color: colors.text,
    backgroundColor: colors.background,
  },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: spacing.sm,
  },

  pickerBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.background,
  },
  pickerBtnText: { fontSize: fontSize.sm, color: colors.text, textTransform: 'capitalize' },

  saveBtn: {
    backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.md,
    alignItems: 'center', marginTop: spacing.md,
  },
  saveBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: '700' },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  pickerModal: {
    backgroundColor: colors.card, borderRadius: borderRadius.lg, width: '80%',
    padding: spacing.md, maxHeight: 400,
  },
  pickerTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  pickerOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pickerOptionActive: { backgroundColor: colors.gray50 },
  pickerOptionText: { fontSize: fontSize.sm, color: colors.text, textTransform: 'capitalize' },
  typeDot: { width: 10, height: 10, borderRadius: 5 },
});
