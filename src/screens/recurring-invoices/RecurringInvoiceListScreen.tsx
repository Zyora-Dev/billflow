import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  Alert, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import EmptyState from '../../components/EmptyState';
import CurrencyText from '../../components/CurrencyText';
import DateInput from '../../components/DateInput';

const { width: SCREEN_W } = Dimensions.get('window');

const FREQ_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'weekly', label: 'Weekly', color: '#3b82f6' },
  { value: 'monthly', label: 'Monthly', color: '#8b5cf6' },
  { value: 'quarterly', label: 'Quarterly', color: '#f59e0b' },
  { value: 'half_yearly', label: 'Half Yearly', color: '#06b6d4' },
  { value: 'yearly', label: 'Yearly', color: '#ec4899' },
];

const freqColor = (f: string) => FREQ_OPTIONS.find(o => o.value === f)?.color || colors.gray400;
const freqLabel = (f: string) => FREQ_OPTIONS.find(o => o.value === f)?.label || f;

const fmtDate = (d: string) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
};

const todayStr = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

export default function RecurringInvoiceListScreen({ navigation }: { navigation: any }) {
  const [orgId, setOrgId] = useState<string>('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_id: null as number | null,
    frequency: 'monthly',
    next_date: todayStr(),
    due_days: '15',
    notes: '',
    status: 'active',
  });
  const [lineItems, setLineItems] = useState<any[]>([]);

  // Customer picker
  const [custPickerOpen, setCustPickerOpen] = useState(false);
  const [custSearch, setCustSearch] = useState('');

  // Item picker
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState('');

  // Processing states
  const [generating, setGenerating] = useState<number | null>(null);
  const [processingDue, setProcessingDue] = useState(false);

  const debounceRef = useRef<any>(null);
  const [searchDebounced, setSearchDebounced] = useState('');

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchDebounced(search.trim().toLowerCase()), 300);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [search]);

  const fetchData = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (!oid) { setLoading(false); setRefreshing(false); return; }
      setOrgId(oid);
      const [tplRes, custRes, itemRes] = await Promise.all([
        api.get(`/api/recurring-invoices?org_id=${oid}`),
        api.get(`/api/customers?org_id=${oid}`),
        api.get(`/api/items?org_id=${oid}`),
      ]);
      setTemplates(Array.isArray(tplRes.data) ? tplRes.data : []);
      setCustomers(Array.isArray(custRes.data) ? custRes.data : []);
      setItems(Array.isArray(itemRes.data) ? itemRes.data : []);
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

  // Filtered list
  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (statusFilter !== 'All' && t.status !== statusFilter.toLowerCase()) return false;
      if (searchDebounced) {
        const hay = `${t.customer_name || ''} ${t.frequency || ''} ${t.notes || ''}`.toLowerCase();
        if (!hay.includes(searchDebounced)) return false;
      }
      return true;
    });
  }, [templates, statusFilter, searchDebounced]);

  // Stats
  const stats = useMemo(() => {
    const total = templates.length;
    const active = templates.filter(t => t.status === 'active').length;
    const paused = templates.filter(t => t.status === 'paused').length;
    const generated = templates.reduce((s, t) => s + (Number(t.invoices_created) || 0), 0);
    return { total, active, paused, generated };
  }, [templates]);

  // ─── Actions ────────────────────────────────────────────────────────

  const handleGenerateNow = async (id: number) => {
    setGenerating(id);
    try {
      const res = await api.post(`/api/recurring-invoices/${id}/generate`);
      const invNum = res.data?.invoice_number || res.data?.invoice?.invoice_number || '';
      Alert.alert('Success', invNum ? `Invoice ${invNum} generated!` : 'Invoice generated successfully!');
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to generate invoice');
    } finally {
      setGenerating(null);
    }
  };

  const handleProcessDue = async () => {
    if (!orgId) return;
    setProcessingDue(true);
    try {
      const res = await api.post(`/api/recurring-invoices/process-due?org_id=${orgId}`);
      const count = res.data?.generated_count ?? res.data?.count ?? 0;
      Alert.alert('Done', count > 0 ? `${count} invoice(s) generated from due templates.` : 'No invoices were due.');
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to process due invoices');
    } finally {
      setProcessingDue(false);
    }
  };

  const handleToggleStatus = async (t: any) => {
    const newStatus = t.status === 'active' ? 'paused' : 'active';
    try {
      await api.put(`/api/recurring-invoices/${t.id}`, { ...t, status: newStatus, org_id: orgId });
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to update status');
    }
  };

  const handleDelete = (t: any) => {
    Alert.alert('Delete Template', `Delete recurring template for ${t.customer_name || 'this customer'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/api/recurring-invoices/${t.id}`);
            fetchData();
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.detail || 'Failed to delete');
          }
        },
      },
    ]);
  };

  // ─── Form ───────────────────────────────────────────────────────────

  const openForm = (item?: any) => {
    if (item) {
      setEditItem(item);
      let parsedItems: any[] = [];
      try {
        parsedItems = typeof item.items_json === 'string' ? JSON.parse(item.items_json) : (item.items_json || []);
      } catch { parsedItems = []; }
      setForm({
        customer_id: item.customer_id,
        frequency: item.frequency || 'monthly',
        next_date: item.next_date ? item.next_date.slice(0, 10) : todayStr(),
        due_days: String(item.due_days ?? 15),
        notes: item.notes || '',
        status: item.status || 'active',
      });
      setLineItems(parsedItems);
    } else {
      setEditItem(null);
      setForm({
        customer_id: null,
        frequency: 'monthly',
        next_date: todayStr(),
        due_days: '15',
        notes: '',
        status: 'active',
      });
      setLineItems([]);
    }
    setShowForm(true);
  };

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === form.customer_id);
  }, [customers, form.customer_id]);

  const addLineItem = (item: any) => {
    const existing = lineItems.find(li => li.item_id === item.id);
    if (existing) {
      setLineItems(prev => prev.map(li => li.item_id === item.id ? { ...li, qty: li.qty + 1 } : li));
    } else {
      setLineItems(prev => [...prev, {
        item_id: item.id,
        item_name: item.item_name,
        description: item.description || '',
        unit: item.unit || 'Nos',
        qty: 1,
        rate: Number(item.sale_price) || 0,
        discount_percent: 0,
        tax_rate: Number(item.tax_rate) || 0,
        hsn_code: item.hsn_code || '',
      }]);
    }
    setItemPickerOpen(false);
    setItemSearch('');
  };

  const updateLineItem = (idx: number, field: string, value: any) => {
    setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, [field]: value } : li));
  };

  const removeLineItem = (idx: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  };

  const lineTotal = (li: any) => {
    const base = (Number(li.qty) || 0) * (Number(li.rate) || 0);
    const disc = base * (Number(li.discount_percent) || 0) / 100;
    const taxable = base - disc;
    const tax = taxable * (Number(li.tax_rate) || 0) / 100;
    return taxable + tax;
  };

  const formTotal = useMemo(() => lineItems.reduce((s, li) => s + lineTotal(li), 0), [lineItems]);

  const handleSave = async () => {
    if (!form.customer_id) return Alert.alert('Validation', 'Select a customer');
    if (lineItems.length === 0) return Alert.alert('Validation', 'Add at least one line item');
    if (!form.next_date) return Alert.alert('Validation', 'Select next date');
    setSaving(true);
    try {
      const body = {
        org_id: orgId,
        customer_id: form.customer_id,
        frequency: form.frequency,
        next_date: form.next_date,
        due_days: parseInt(form.due_days) || 15,
        items_json: JSON.stringify(lineItems),
        notes: form.notes,
        status: form.status,
      };
      if (editItem) {
        await api.put(`/api/recurring-invoices/${editItem.id}`, body);
      } else {
        await api.post('/api/recurring-invoices', body);
      }
      setShowForm(false);
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────

  const renderHero = () => (
    <View style={styles.hero}>
      {/* Orbs */}
      <View style={[styles.orb, { width: 180, height: 180, top: -60, right: -40, opacity: 0.08 }]} />
      <View style={[styles.orb, { width: 100, height: 100, bottom: -30, left: -20, opacity: 0.06 }]} />
      <View style={[styles.orb, { width: 60, height: 60, top: 20, left: 60, opacity: 0.05 }]} />

      <View style={styles.heroTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroLabel}>Recurring Invoices</Text>
          <Text style={styles.heroCount}>{stats.total}</Text>
          <Text style={styles.heroSub}>
            {stats.active} active · {stats.paused} paused
          </Text>
        </View>
        <TouchableOpacity
          style={styles.processDueBtn}
          onPress={handleProcessDue}
          disabled={processingDue}
          activeOpacity={0.7}
        >
          {processingDue ? (
            <ActivityIndicator size="small" color="#064e3b" />
          ) : (
            <Ionicons name="flash" size={18} color="#064e3b" />
          )}
          <Text style={styles.processDueText}>Process Due</Text>
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Ionicons name="checkmark-circle" size={16} color="#34d399" />
          <Text style={styles.statValue}>{stats.active}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={[styles.statDivider]} />
        <View style={styles.statBox}>
          <Ionicons name="pause-circle" size={16} color="#fbbf24" />
          <Text style={styles.statValue}>{stats.paused}</Text>
          <Text style={styles.statLabel}>Paused</Text>
        </View>
        <View style={[styles.statDivider]} />
        <View style={styles.statBox}>
          <Ionicons name="receipt" size={16} color="#a7f3d0" />
          <Text style={styles.statValue}>{stats.generated}</Text>
          <Text style={styles.statLabel}>Generated</Text>
        </View>
      </View>
    </View>
  );

  const renderSearch = () => (
    <View style={styles.searchRow}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.gray400} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search templates..."
          placeholderTextColor={colors.placeholder}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.gray400} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderFilters = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingHorizontal: spacing.md }}>
      {['All', 'Active', 'Paused'].map(s => {
        const active = statusFilter === s;
        return (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, active && styles.filterChipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{s}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderCard = ({ item: t }: { item: any }) => {
    const fc = freqColor(t.frequency);
    const isActive = t.status === 'active';
    const isGenerating = generating === t.id;

    return (
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('RecurringInvoiceDetail', { id: t.id })} activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardCustomer} numberOfLines={1}>{t.customer_name || 'Unknown Customer'}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.freqBadge, { backgroundColor: fc + '18' }]}>
                <Ionicons name="repeat" size={12} color={fc} />
                <Text style={[styles.freqBadgeText, { color: fc }]}>{freqLabel(t.frequency)}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: isActive ? '#10b98118' : '#f59e0b18' }]}>
                <View style={[styles.statusDot, { backgroundColor: isActive ? '#10b981' : '#f59e0b' }]} />
                <Text style={[styles.statusBadgeText, { color: isActive ? '#10b981' : '#f59e0b' }]}>
                  {isActive ? 'Active' : 'Paused'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.gray400} />
            <Text style={styles.metaText}>Next: {fmtDate(t.next_date)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="receipt-outline" size={14} color={colors.gray400} />
            <Text style={styles.metaText}>{t.invoices_created || 0} generated</Text>
          </View>
          {t.due_days != null && (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={colors.gray400} />
              <Text style={styles.metaText}>Due: {t.due_days} days</Text>
            </View>
          )}
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary + '12' }]}
            onPress={() => handleGenerateNow(t.id)}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <ActivityIndicator size={14} color={colors.primary} />
            ) : (
              <Ionicons name="flash" size={14} color={colors.primary} />
            )}
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Generate</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: isActive ? '#f59e0b12' : '#10b98112' }]}
            onPress={() => handleToggleStatus(t)}
          >
            <Ionicons name={isActive ? 'pause' : 'play'} size={14} color={isActive ? '#f59e0b' : '#10b981'} />
            <Text style={[styles.actionBtnText, { color: isActive ? '#f59e0b' : '#10b981' }]}>
              {isActive ? 'Pause' : 'Resume'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.info + '12' }]}
            onPress={() => navigation.navigate('RecurringInvoiceForm', { id: t.id })}
          >
            <Ionicons name="pencil" size={14} color={colors.info} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.danger + '12' }]}
            onPress={() => handleDelete(t)}
          >
            <Ionicons name="trash" size={14} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Customer Picker Modal ──────────────────────────────────────────

  const renderCustomerPicker = () => {
    const q = custSearch.trim().toLowerCase();
    const filtCust = customers.filter(c => {
      const hay = `${c.contact_person || ''} ${c.business_name || ''} ${c.mobile || ''}`.toLowerCase();
      return !q || hay.includes(q);
    });
    return (
      <Modal visible={custPickerOpen} animationType="slide" transparent>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Customer</Text>
              <TouchableOpacity onPress={() => { setCustPickerOpen(false); setCustSearch(''); }}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <View style={[styles.searchBox, { marginHorizontal: spacing.md, marginBottom: spacing.sm }]}>
              <Ionicons name="search" size={18} color={colors.gray400} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search customers..."
                placeholderTextColor={colors.placeholder}
                value={custSearch}
                onChangeText={setCustSearch}
              />
            </View>
            <FlatList
              data={filtCust}
              keyExtractor={c => String(c.id)}
              renderItem={({ item: c }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => {
                    setForm(f => ({ ...f, customer_id: c.id }));
                    setCustPickerOpen(false);
                    setCustSearch('');
                  }}
                >
                  <View style={styles.pickerItemIcon}>
                    <Ionicons name="person" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerItemName}>{c.contact_person || c.business_name}</Text>
                    {c.business_name && c.contact_person ? (
                      <Text style={styles.pickerItemSub}>{c.business_name}</Text>
                    ) : null}
                  </View>
                  {form.customer_id === c.id && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyPicker}>No customers found</Text>}
            />
          </View>
        </View>
      </Modal>
    );
  };

  // ─── Item Picker Modal ──────────────────────────────────────────────

  const renderItemPicker = () => {
    const q = itemSearch.trim().toLowerCase();
    const filtItems = items.filter(i => {
      const hay = `${i.item_name || ''} ${i.model_number || ''} ${i.description || ''}`.toLowerCase();
      return !q || hay.includes(q);
    });
    return (
      <Modal visible={itemPickerOpen} animationType="slide" transparent>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Add Item</Text>
              <TouchableOpacity onPress={() => { setItemPickerOpen(false); setItemSearch(''); }}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <View style={[styles.searchBox, { marginHorizontal: spacing.md, marginBottom: spacing.sm }]}>
              <Ionicons name="search" size={18} color={colors.gray400} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search items..."
                placeholderTextColor={colors.placeholder}
                value={itemSearch}
                onChangeText={setItemSearch}
              />
            </View>
            <FlatList
              data={filtItems}
              keyExtractor={i => String(i.id)}
              renderItem={({ item: i }) => (
                <TouchableOpacity style={styles.pickerItem} onPress={() => addLineItem(i)}>
                  <View style={[styles.pickerItemIcon, { backgroundColor: '#8b5cf612' }]}>
                    <Ionicons name="cube" size={16} color="#8b5cf6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerItemName}>{i.item_name}</Text>
                    <Text style={styles.pickerItemSub}>
                      ₹ {Number(i.sale_price || 0).toLocaleString('en-IN')} · {i.unit || 'Nos'}
                      {i.tax_rate ? ` · ${i.tax_rate}% GST` : ''}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={22} color={colors.primary} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyPicker}>No items found</Text>}
            />
          </View>
        </View>
      </Modal>
    );
  };

  // ─── Create/Edit Modal ──────────────────────────────────────────────

  const renderFormModal = () => (
    <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={() => setShowForm(false)}>
            <Ionicons name="close" size={24} color={colors.gray700} />
          </TouchableOpacity>
          <Text style={styles.formTitle}>{editItem ? 'Edit Template' : 'New Recurring Invoice'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.formSaveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
          {/* Customer */}
          <Text style={styles.fieldLabel}>Customer *</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setCustPickerOpen(true)}>
            <Ionicons name="person-outline" size={18} color={colors.gray400} />
            <Text style={[styles.pickerBtnText, !selectedCustomer && { color: colors.placeholder }]}>
              {selectedCustomer ? (selectedCustomer.contact_person || selectedCustomer.business_name) : 'Select customer'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
          </TouchableOpacity>

          {/* Frequency */}
          <Text style={styles.fieldLabel}>Frequency *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
            {FREQ_OPTIONS.map(fo => {
              const sel = form.frequency === fo.value;
              return (
                <TouchableOpacity
                  key={fo.value}
                  style={[styles.freqOption, sel && { backgroundColor: fo.color + '18', borderColor: fo.color }]}
                  onPress={() => setForm(f => ({ ...f, frequency: fo.value }))}
                >
                  <Text style={[styles.freqOptionText, sel && { color: fo.color, fontWeight: '600' }]}>{fo.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Next Date */}
          <Text style={styles.fieldLabel}>Next Invoice Date *</Text>
          <DateInput
            value={form.next_date}
            onChange={v => setForm(f => ({ ...f, next_date: v }))}
            placeholder="Select date"
          />
          <View style={{ height: spacing.md }} />

          {/* Due Days */}
          <Text style={styles.fieldLabel}>Payment Due Days</Text>
          <TextInput
            style={styles.textInput}
            value={form.due_days}
            onChangeText={v => setForm(f => ({ ...f, due_days: v.replace(/[^0-9]/g, '') }))}
            keyboardType="number-pad"
            placeholder="15"
            placeholderTextColor={colors.placeholder}
          />

          {/* Line Items */}
          <View style={styles.lineItemsHeader}>
            <Text style={styles.fieldLabel}>Line Items *</Text>
            <TouchableOpacity style={styles.addItemBtn} onPress={() => setItemPickerOpen(true)}>
              <Ionicons name="add" size={16} color={colors.white} />
              <Text style={styles.addItemBtnText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          {lineItems.length === 0 ? (
            <View style={styles.noItems}>
              <Ionicons name="cube-outline" size={32} color={colors.gray300} />
              <Text style={styles.noItemsText}>No items added</Text>
            </View>
          ) : (
            lineItems.map((li, idx) => (
              <View key={idx} style={styles.lineCard}>
                <View style={styles.lineCardTop}>
                  <Text style={styles.lineItemName} numberOfLines={1}>{li.item_name}</Text>
                  <TouchableOpacity onPress={() => removeLineItem(idx)}>
                    <Ionicons name="close-circle" size={20} color={colors.danger} />
                  </TouchableOpacity>
                </View>
                <View style={styles.lineCardFields}>
                  <View style={styles.lineField}>
                    <Text style={styles.lineFieldLabel}>Qty</Text>
                    <TextInput
                      style={styles.lineFieldInput}
                      value={String(li.qty)}
                      onChangeText={v => updateLineItem(idx, 'qty', Number(v) || 0)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.lineField}>
                    <Text style={styles.lineFieldLabel}>Rate</Text>
                    <TextInput
                      style={styles.lineFieldInput}
                      value={String(li.rate)}
                      onChangeText={v => updateLineItem(idx, 'rate', Number(v) || 0)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.lineField}>
                    <Text style={styles.lineFieldLabel}>Tax %</Text>
                    <TextInput
                      style={styles.lineFieldInput}
                      value={String(li.tax_rate)}
                      onChangeText={v => updateLineItem(idx, 'tax_rate', Number(v) || 0)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.lineField}>
                    <Text style={styles.lineFieldLabel}>Total</Text>
                    <Text style={styles.lineFieldTotal}>₹ {lineTotal(li).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                  </View>
                </View>
              </View>
            ))
          )}

          {lineItems.length > 0 && (
            <View style={styles.formTotalRow}>
              <Text style={styles.formTotalLabel}>Estimated Total</Text>
              <CurrencyText amount={formTotal} style={styles.formTotalValue} />
            </View>
          )}

          {/* Notes */}
          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Notes</Text>
          <TextInput
            style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
            value={form.notes}
            onChangeText={v => setForm(f => ({ ...f, notes: v }))}
            placeholder="Optional notes..."
            placeholderTextColor={colors.placeholder}
            multiline
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {renderCustomerPicker()}
      {renderItemPicker()}
    </Modal>
  );

  // ─── Main ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={t => String(t.id)}
        renderItem={renderCard}
        ListHeaderComponent={
          <>
            {renderHero()}
            {renderSearch()}
            {renderFilters()}
            <View style={{ height: spacing.sm }} />
          </>
        }
        ListEmptyComponent={
          <EmptyState
            icon="repeat-outline"
            title="No Recurring Invoices"
            subtitle={statusFilter !== 'All' || searchDebounced ? 'Try adjusting your filters' : 'Create a template to auto-generate invoices'}
            actionLabel="Create Template"
            onAction={() => navigation.navigate('RecurringInvoiceForm')}
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('RecurringInvoiceForm')} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {renderFormModal()}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },

  // Hero
  hero: {
    backgroundColor: '#064e3b',
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.sm,
    fontWeight: '500',
    marginBottom: 4,
  },
  heroCount: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  processDueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#a7f3d0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  processDueText: {
    color: '#064e3b',
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  statValue: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: fontSize.xs,
  },

  // Search
  searchRow: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
    padding: 0,
  },

  // Filters
  filterScroll: {
    marginTop: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.white,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: fontSize.sm,
    color: colors.gray600,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: colors.white,
  },

  // Card
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardCustomer: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  freqBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  freqBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: fontSize.xs,
    color: colors.gray500,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    paddingTop: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },

  // Form Modal
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  formTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  formSaveText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.primary,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.gray700,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: fontSize.sm,
    color: colors.text,
    marginBottom: spacing.md,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: spacing.md,
    gap: 8,
  },
  pickerBtnText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
  },

  // Frequency option chips
  freqOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  freqOptionText: {
    fontSize: fontSize.sm,
    color: colors.gray500,
    fontWeight: '500',
  },

  // Line items
  lineItemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addItemBtnText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  noItems: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  noItemsText: {
    marginTop: 6,
    fontSize: fontSize.sm,
    color: colors.gray400,
  },
  lineCard: {
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lineCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lineItemName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  lineCardFields: {
    flexDirection: 'row',
    gap: 8,
  },
  lineField: {
    flex: 1,
  },
  lineFieldLabel: {
    fontSize: 10,
    color: colors.gray400,
    marginBottom: 3,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  lineFieldInput: {
    backgroundColor: colors.white,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: fontSize.xs,
    color: colors.text,
    textAlign: 'center',
  },
  lineFieldTotal: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.primary,
    paddingTop: 8,
    textAlign: 'center',
  },
  formTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary + '0A',
    borderRadius: borderRadius.md,
    padding: 14,
    marginTop: 4,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  formTotalLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.gray700,
  },
  formTotalValue: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.primary,
  },

  // Picker Modals
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray50,
  },
  pickerItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerItemName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
  },
  pickerItemSub: {
    fontSize: fontSize.xs,
    color: colors.gray500,
    marginTop: 1,
  },
  emptyPicker: {
    textAlign: 'center',
    padding: spacing.xl,
    color: colors.gray400,
    fontSize: fontSize.sm,
  },
});
