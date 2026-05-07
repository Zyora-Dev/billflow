import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import api from '../../api/client';
import { useToast } from '../../components/Toast';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

const TAX_RATES = ['0', '5', '12', '18', '28'];
const UNITS = ['Nos', 'Pcs', 'Kg', 'Ltr', 'Mtr', 'Box', 'Set', 'Pair', 'Hrs', 'Sqft'];

export default function ItemFormScreen({ route, navigation }: { route: any; navigation: any }) {
  const toast = useToast();
  const editId = route.params?.id;
  const [form, setForm] = useState({
    item_name: '', type: 'goods', unit: 'Nos', sale_price: '', offer_price: '',
    tax_rate: '18', stock: '0', description: '', model_number: '',
    stock_alert_enabled: false, stock_alert_qty: '5', hsn_code: '',
    purchase_unit: '', conversion_factor: '', purchase_price: '',
  });
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/api/business').then(r => setOrgId(r.data[0]?.org_id || '')).catch(() => {});
    if (editId) {
      api.get(`/api/items/${editId}`).then(r => {
        const i = r.data;
        setForm({
          item_name: i.item_name || '', type: i.type || 'goods', unit: i.unit || 'Nos',
          sale_price: String(i.sale_price || ''), offer_price: String(i.offer_price || ''),
          tax_rate: String(i.tax_rate || '18'), stock: String(i.stock || '0'),
          description: i.description || '', model_number: i.model_number || '',
          stock_alert_enabled: i.stock_alert_enabled || false,
          stock_alert_qty: String(i.stock_alert_qty || '5'), hsn_code: i.hsn_code || '',
          purchase_unit: i.purchase_unit || '', conversion_factor: i.conversion_factor != null ? String(i.conversion_factor) : '',
          purchase_price: i.purchase_price != null ? String(i.purchase_price) : '',
        });
      }).catch(() => {});
    }
  }, [editId]);

  const update = (key: string, val: any) => setForm(p => ({ ...p, [key]: val }));

  const handleSave = async () => {
    if (!form.item_name) return Alert.alert('Error', 'Item name is required');
    if (!form.sale_price) return Alert.alert('Error', 'Sale price is required');
    setLoading(true);
    try {
      const body = {
        ...form, sale_price: parseFloat(form.sale_price) || 0,
        offer_price: parseFloat(form.offer_price) || 0,
        tax_rate: parseFloat(form.tax_rate) || 0,
        stock: parseInt(form.stock) || 0,
        stock_alert_qty: parseInt(form.stock_alert_qty) || 0,
        purchase_unit: form.purchase_unit || null,
        conversion_factor: form.conversion_factor ? parseFloat(form.conversion_factor) : null,
        purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
        org_id: orgId,
      };
      if (editId) await api.put(`/api/items/${editId}`, body);
      else await api.post('/api/items', body);
      toast.success(editId ? 'Item updated' : 'Item created');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.label}>Type</Text>
          <View style={styles.typeRow}>
            {['goods', 'service'].map(t => (
              <TouchableOpacity key={t} style={[styles.typeBtn, form.type === t && styles.typeBtnActive]} onPress={() => update('type', t)}>
                <Text style={[styles.typeText, form.type === t && styles.typeTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Item Name *</Text>
          <TextInput style={styles.input} value={form.item_name} onChangeText={v => update('item_name', v)} placeholder="Item name" placeholderTextColor={colors.placeholder} />

          <Text style={styles.label}>HSN Code</Text>
          <TextInput style={styles.input} value={form.hsn_code} onChangeText={v => update('hsn_code', v)} placeholder="HSN/SAC Code" placeholderTextColor={colors.placeholder} />

          <Text style={styles.label}>Model Number</Text>
          <TextInput style={styles.input} value={form.model_number} onChangeText={v => update('model_number', v)} placeholder="Model" placeholderTextColor={colors.placeholder} />

          <Text style={styles.label}>Sale Unit</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
            {UNITS.map(u => (
              <TouchableOpacity key={u} style={[styles.chip, form.unit === u && styles.chipActive]} onPress={() => update('unit', u)}>
                <Text style={[styles.chipText, form.unit === u && styles.chipTextActive]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Purchase Unit <Text style={{ fontWeight: '400', color: colors.gray500 }}>(if different)</Text></Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
            <TouchableOpacity style={[styles.chip, !form.purchase_unit && styles.chipActive]} onPress={() => update('purchase_unit', '')}>
              <Text style={[styles.chipText, !form.purchase_unit && styles.chipTextActive]}>Same</Text>
            </TouchableOpacity>
            {UNITS.map(u => (
              <TouchableOpacity key={u} style={[styles.chip, form.purchase_unit === u && styles.chipActive]} onPress={() => update('purchase_unit', u)}>
                <Text style={[styles.chipText, form.purchase_unit === u && styles.chipTextActive]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {form.purchase_unit ? (
            <>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Conversion Factor</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: fontSize.xs, color: colors.gray500 }}>1 {form.purchase_unit} =</Text>
                    <TextInput style={[styles.input, { flex: 1 }]} value={form.conversion_factor} onChangeText={v => update('conversion_factor', v)} placeholder="e.g. 24" placeholderTextColor={colors.placeholder} keyboardType="decimal-pad" />
                    <Text style={{ fontSize: fontSize.xs, color: colors.gray500 }}>{form.unit}</Text>
                  </View>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Purchase Price (per {form.purchase_unit})</Text>
                <TextInput style={styles.input} value={form.purchase_price} onChangeText={v => update('purchase_price', v)} placeholder="0.00" placeholderTextColor={colors.placeholder} keyboardType="decimal-pad" />
              </View>
              {form.conversion_factor && parseFloat(form.conversion_factor) > 0 && (
                <View style={{ backgroundColor: '#eff6ff', borderRadius: borderRadius.sm, padding: spacing.sm, marginTop: spacing.xs }}>
                  <Text style={{ fontSize: fontSize.xs, color: '#2563eb' }}>
                    1 {form.purchase_unit} = {form.conversion_factor} {form.unit}
                    {form.purchase_price && parseFloat(form.purchase_price) > 0 ? ` · Cost per ${form.unit}: ₹${(parseFloat(form.purchase_price) / parseFloat(form.conversion_factor)).toFixed(2)}` : ''}
                  </Text>
                </View>
              )}
            </>
          ) : null}

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Sale Price *</Text>
              <TextInput style={styles.input} value={form.sale_price} onChangeText={v => update('sale_price', v)} placeholder="0.00" placeholderTextColor={colors.placeholder} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={styles.label}>Offer Price</Text>
              <TextInput style={styles.input} value={form.offer_price} onChangeText={v => update('offer_price', v)} placeholder="0.00" placeholderTextColor={colors.placeholder} keyboardType="decimal-pad" />
            </View>
          </View>

          <Text style={styles.label}>GST Rate</Text>
          <View style={styles.typeRow}>
            {TAX_RATES.map(r => (
              <TouchableOpacity key={r} style={[styles.chip, form.tax_rate === r && styles.chipActive]} onPress={() => update('tax_rate', r)}>
                <Text style={[styles.chipText, form.tax_rate === r && styles.chipTextActive]}>{r}%</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Stock</Text>
              <TextInput style={styles.input} value={form.stock} onChangeText={v => update('stock', v)} keyboardType="number-pad" />
            </View>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.label}>Stock Alert</Text>
            <Switch value={form.stock_alert_enabled} onValueChange={v => update('stock_alert_enabled', v)} trackColor={{ true: colors.primary }} />
          </View>
          {form.stock_alert_enabled && (
            <>
              <Text style={styles.label}>Alert Qty</Text>
              <TextInput style={styles.input} value={form.stock_alert_qty} onChangeText={v => update('stock_alert_qty', v)} keyboardType="number-pad" />
            </>
          )}

          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={form.description} onChangeText={v => update('description', v)} multiline placeholder="Item description" placeholderTextColor={colors.placeholder} />

          <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={handleSave} disabled={loading}>
            <Text style={styles.btnText}>{loading ? 'Saving...' : editId ? 'Update Item' : 'Create Item'}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  card: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, padding: spacing.md, fontSize: fontSize.md, color: colors.text },
  row: { flexDirection: 'row' },
  typeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  typeBtn: { flex: 1, padding: spacing.sm, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', minWidth: 80 },
  typeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeText: { fontSize: fontSize.sm, color: colors.gray600 },
  typeTextActive: { color: colors.white, fontWeight: '600' },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.border, marginRight: spacing.xs },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, color: colors.gray600 },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  btn: { backgroundColor: colors.primary, borderRadius: borderRadius.sm, padding: spacing.md, alignItems: 'center', marginTop: spacing.xl },
  btnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
});
