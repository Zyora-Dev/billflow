import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ScrollView, KeyboardAvoidingView, Platform, Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { useToast } from '../../components/Toast';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import DateInput from '../../components/DateInput';

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const PRIO_META: Record<string, { color: string; bg: string }> = {
  Low:    { color: '#1d4ed8', bg: '#dbeafe' },
  Medium: { color: '#0e7490', bg: '#cffafe' },
  High:   { color: '#b45309', bg: '#fef3c7' },
  Urgent: { color: '#dc2626', bg: '#fee2e2' },
};

const CATEGORIES = [
  { value: 'AMC',         label: 'AMC',         icon: 'repeat' as const,           color: '#7c3aed', bg: '#ede9fe' },
  { value: 'Repair',      label: 'Repair',      icon: 'construct' as const,        color: '#dc2626', bg: '#fee2e2' },
  { value: 'Replacement', label: 'Replacement', icon: 'swap-horizontal' as const,  color: '#1d4ed8', bg: '#dbeafe' },
  { value: 'Others',      label: 'Others',      icon: 'ellipsis-horizontal' as const, color: '#6b7280', bg: '#f3f4f6' },
];

type CustomerMode = 'select' | 'manual';

export default function TaskFormScreen({ route, navigation }: { route: any; navigation: any }) {
  const toast = useToast();
  const editId = route.params?.id;
  const taskType = route.params?.task_type || 'task';
  const isOrder = taskType === 'order';
  const parentTaskId = route.params?.parent_task_id;

  const [orgId, setOrgId] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '' as '' | 'AMC' | 'Repair' | 'Replacement' | 'Others',
    employee_id: null as number | null,
    employee_name: '',
    customer_id: null as number | null,
    customer_name: '',
    customer_mode: 'select' as CustomerMode,
    mobile: '',
    address: '',
    task_date: new Date().toISOString().split('T')[0],
    task_time: '',
    due_date: '',
    priority: 'Medium',
    remarks: '',
    task_type: taskType,
    order_items: [] as { name: string; qty: string; rate: string; from_catalog: boolean; item_id?: number }[],
    parent_task_id: parentTaskId || null,
  });

  // Modal state
  const [showEmpPicker, setShowEmpPicker] = useState(false);
  const [showCustPicker, setShowCustPicker] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [custSearch, setCustSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const biz = await api.get('/api/business');
        const oid = biz.data[0]?.org_id;
        if (!oid) { setBootstrapping(false); return; }
        setOrgId(oid);
        const [e, c, it] = await Promise.all([
          api.get(`/api/employees?org_id=${oid}&status=Active`).catch(() => ({ data: [] })),
          api.get(`/api/customers?org_id=${oid}`).catch(() => ({ data: [] })),
          api.get(`/api/items?org_id=${oid}`).catch(() => ({ data: [] })),
        ]);
        setEmployees(Array.isArray(e.data) ? e.data : []);
        setCustomers(Array.isArray(c.data) ? c.data : []);
        setItems(Array.isArray(it.data) ? it.data : []);
        if (editId) {
          const t = (await api.get(`/api/tasks/${editId}`)).data;
          let ord: any[] = [];
          try {
            const raw = t.order_items;
            if (Array.isArray(raw)) ord = raw;
            else if (typeof raw === 'string' && raw) ord = JSON.parse(raw);
          } catch {}
          setForm(p => ({
            ...p,
            title: t.title || '',
            description: t.description || '',
            category: t.category || '',
            employee_id: t.employee_id || null,
            employee_name: t.employee_name || '',
            customer_id: t.customer_id || null,
            customer_name: t.customer_name || '',
            customer_mode: t.customer_id ? 'select' : 'manual',
            mobile: t.mobile || '',
            address: t.address || '',
            task_date: t.task_date || p.task_date,
            task_time: t.task_time || '',
            due_date: t.due_date || '',
            priority: t.priority || 'Medium',
            remarks: t.remarks || '',
            task_type: t.task_type || taskType,
            order_items: ord.map((o: any) => ({
              name: o.name || o.item_name || '',
              qty: String(o.qty || 1),
              rate: String(o.rate || 0),
              from_catalog: !!o.item_id,
              item_id: o.item_id,
            })),
          }));
        } else if (parentTaskId) {
          // inherit customer details from parent task
          try {
            const pt = (await api.get(`/api/tasks/${parentTaskId}`)).data;
            setForm(p => ({
              ...p,
              customer_id: pt.customer_id || null,
              customer_name: pt.customer_name || '',
              customer_mode: pt.customer_id ? 'select' : 'manual',
              mobile: pt.mobile || '',
              address: pt.address || '',
            }));
          } catch {}
        }
      } catch {} finally {
        setBootstrapping(false);
      }
    })();
  }, [editId]);

  const update = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }));

  // Customer flow
  const selectCustomer = (c: any) => {
    setForm(p => ({
      ...p,
      customer_id: c.id,
      customer_name: c.contact_person || c.business_name || '',
      mobile: c.mobile || '',
      address: c.address || '',
    }));
    setShowCustPicker(false);
    setCustSearch('');
  };
  const clearCustomer = () => setForm(p => ({ ...p, customer_id: null, customer_name: '', mobile: '', address: '' }));

  // Employee
  const selectEmployee = (e: any) => {
    setForm(p => ({ ...p, employee_id: e.id, employee_name: e.name }));
    setShowEmpPicker(false);
    setEmpSearch('');
  };

  // Order items
  const addCatalogItem = (item: any) => {
    setForm(p => ({
      ...p,
      order_items: [...p.order_items, {
        name: item.item_name,
        qty: '1',
        rate: String(item.offer_price || item.sale_price || 0),
        from_catalog: true,
        item_id: item.id,
      }],
    }));
    setShowItemPicker(false);
    setItemSearch('');
  };
  const addCustomItem = () => {
    setForm(p => ({
      ...p,
      order_items: [...p.order_items, { name: '', qty: '1', rate: '0', from_catalog: false }],
    }));
  };
  const updateOrderItem = (idx: number, k: string, v: string) =>
    setForm(p => ({
      ...p,
      order_items: p.order_items.map((o, i) => (i === idx ? { ...o, [k]: v } : o)),
    }));
  const removeOrderItem = (idx: number) =>
    setForm(p => ({ ...p, order_items: p.order_items.filter((_, i) => i !== idx) }));

  const orderTotal = useMemo(() => {
    return form.order_items.reduce(
      (s, o) => s + (parseFloat(o.qty) || 0) * (parseFloat(o.rate) || 0),
      0,
    );
  }, [form.order_items]);

  const handleSave = async () => {
    if (!form.title.trim()) return Alert.alert('Validation', 'Task title is required');
    if (!form.task_date) return Alert.alert('Validation', 'Task date is required');
    setLoading(true);
    try {
      const payload: any = {
        org_id: orgId,
        title: form.title.trim(),
        description: form.description || null,
        category: form.category || null,
        employee_id: form.employee_id,
        customer_id: form.customer_mode === 'select' ? form.customer_id : null,
        customer_name: form.customer_name || null,
        mobile: form.mobile || null,
        address: form.address || null,
        task_date: form.task_date,
        task_time: form.task_time || null,
        due_date: form.due_date || null,
        priority: form.priority,
        remarks: form.remarks || null,
        task_type: form.task_type,
        parent_task_id: form.parent_task_id || null,
      };
      if (isOrder) {
        const cleaned = form.order_items
          .filter(o => o.name && parseFloat(o.qty) > 0)
          .map(o => ({
            name: o.name,
            qty: parseFloat(o.qty) || 0,
            rate: parseFloat(o.rate) || 0,
            item_id: o.item_id || null,
          }));
        payload.order_items = JSON.stringify(cleaned);
        payload.order_amount = orderTotal;
      }
      if (editId) await api.put(`/api/tasks/${editId}`, payload);
      else await api.post('/api/tasks', payload);
      toast.success(editId ? 'Task updated' : 'Task created');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  if (bootstrapping) {
    return <View style={st.loading}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#f6f7fb' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={st.headerCard}>
          <View style={st.headerBgAccent} />
          <Text style={st.headerEyebrow}>{isOrder ? 'New Order' : editId ? 'Edit Task' : 'New Task'}</Text>
          <Text style={st.headerTitle}>{isOrder ? 'Create order entry' : 'Service task details'}</Text>
        </View>

        {/* Title + Description */}
        <Section title="Basics" icon="document-text-outline">
          <Label text="Title *" />
          <TextInput
            style={st.input}
            value={form.title}
            onChangeText={v => update('title', v)}
            placeholder={isOrder ? 'e.g. Spare parts replacement' : 'e.g. AC servicing'}
            placeholderTextColor={colors.placeholder}
          />

          {!isOrder && (
            <>
              <Label text="Type" />
              <View style={st.catGrid}>
                {CATEGORIES.map(c => {
                  const sel = form.category === c.value;
                  return (
                    <TouchableOpacity
                      key={c.value}
                      style={[
                        st.catTile,
                        sel && { backgroundColor: c.bg, borderColor: c.color },
                      ]}
                      onPress={() => update('category', sel ? '' : c.value)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name={c.icon} size={18} color={sel ? c.color : colors.gray500} />
                      <Text style={[st.catTileText, sel && { color: c.color, fontWeight: '800' }]}>{c.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <Label text="Description" />
          <TextInput
            style={[st.input, { minHeight: 70, textAlignVertical: 'top' }]}
            value={form.description}
            onChangeText={v => update('description', v)}
            placeholder="Optional details"
            placeholderTextColor={colors.placeholder}
            multiline
          />

          <Label text="Priority" />
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {PRIORITIES.map(p => {
              const m = PRIO_META[p];
              const active = form.priority === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[
                    st.prioBtn,
                    active && { backgroundColor: m.bg, borderColor: m.color },
                  ]}
                  onPress={() => update('priority', p)}
                  activeOpacity={0.85}
                >
                  <View style={[st.prioDot, { backgroundColor: m.color }]} />
                  <Text style={[st.prioBtnText, active && { color: m.color, fontWeight: '800' }]}>{p}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>

        {/* Customer */}
        <Section title="Customer" icon="people-outline">
          <View style={st.modeRow}>
            <TouchableOpacity
              style={[st.modeBtn, form.customer_mode === 'select' && st.modeBtnActive]}
              onPress={() => update('customer_mode', 'select')}
            >
              <Ionicons name="list" size={14} color={form.customer_mode === 'select' ? '#fff' : colors.gray600} />
              <Text style={[st.modeText, form.customer_mode === 'select' && st.modeTextActive]}>From list</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.modeBtn, form.customer_mode === 'manual' && st.modeBtnActive]}
              onPress={() => { update('customer_mode', 'manual'); update('customer_id', null); }}
            >
              <Ionicons name="create-outline" size={14} color={form.customer_mode === 'manual' ? '#fff' : colors.gray600} />
              <Text style={[st.modeText, form.customer_mode === 'manual' && st.modeTextActive]}>Manual entry</Text>
            </TouchableOpacity>
          </View>

          {form.customer_mode === 'select' ? (
            form.customer_id ? (
              <View style={st.selectedCard}>
                <View style={st.selectedAvatar}>
                  <Text style={st.selectedAvatarText}>
                    {(form.customer_name || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.selectedName}>{form.customer_name}</Text>
                  {form.mobile ? <Text style={st.selectedSub}>{form.mobile}</Text> : null}
                </View>
                <TouchableOpacity onPress={clearCustomer} style={st.clearBtn}>
                  <Ionicons name="close-circle" size={20} color={colors.gray400} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={st.pickerBtn} onPress={() => setShowCustPicker(true)} activeOpacity={0.85}>
                <Ionicons name="search" size={18} color={colors.primary} />
                <Text style={[st.pickerText, { color: colors.gray500 }]}>Search customers</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
              </TouchableOpacity>
            )
          ) : (
            <>
              <Label text="Customer Name" />
              <TextInput
                style={st.input}
                value={form.customer_name}
                onChangeText={v => update('customer_name', v)}
                placeholder="Enter name"
                placeholderTextColor={colors.placeholder}
              />
            </>
          )}

          <Label text="Mobile" />
          <TextInput
            style={st.input}
            value={form.mobile}
            onChangeText={v => update('mobile', v)}
            placeholder="Phone number"
            placeholderTextColor={colors.placeholder}
            keyboardType="phone-pad"
          />

          <Label text="Address" />
          <TextInput
            style={[st.input, { minHeight: 60, textAlignVertical: 'top' }]}
            value={form.address}
            onChangeText={v => update('address', v)}
            placeholder="Full address"
            placeholderTextColor={colors.placeholder}
            multiline
          />
        </Section>

        {/* Assignment */}
        <Section title="Assignment" icon="person-outline">
          <Label text="Assign To" />
          {form.employee_id ? (
            <View style={st.selectedCard}>
              <View style={[st.selectedAvatar, { backgroundColor: '#dbeafe' }]}>
                <Text style={[st.selectedAvatarText, { color: '#1d4ed8' }]}>
                  {(form.employee_name || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.selectedName}>{form.employee_name}</Text>
                <Text style={st.selectedSub}>Assigned</Text>
              </View>
              <TouchableOpacity onPress={() => setForm(p => ({ ...p, employee_id: null, employee_name: '' }))} style={st.clearBtn}>
                <Ionicons name="close-circle" size={20} color={colors.gray400} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={st.pickerBtn} onPress={() => setShowEmpPicker(true)} activeOpacity={0.85}>
              <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
              <Text style={[st.pickerText, { color: colors.gray500 }]}>
                {employees.length ? 'Select employee' : 'No active employees'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
            </TouchableOpacity>
          )}
        </Section>

        {/* Schedule */}
        <Section title="Schedule" icon="calendar-outline">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Label text="Task Date *" />
              <DateInput value={form.task_date} onChange={v => update('task_date', v)} />
            </View>
            <View style={{ flex: 1 }}>
              <Label text="Time" />
              <TextInput
                style={st.input}
                value={form.task_time}
                onChangeText={v => update('task_time', v)}
                placeholder="HH:MM"
                placeholderTextColor={colors.placeholder}
              />
            </View>
          </View>

          <Label text="Due Date" />
          <DateInput value={form.due_date} onChange={v => update('due_date', v)} placeholder="Optional" />
        </Section>

        {/* Order items */}
        {isOrder && (
          <Section title="Order Items" icon="cube-outline" right={
            <Text style={st.orderTotalChip}>₹{orderTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
          }>
            {form.order_items.length === 0 ? (
              <Text style={st.emptyHint}>No items added yet</Text>
            ) : (
              form.order_items.map((o, i) => (
                <View key={i} style={st.orderItemCard}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={[st.input, { marginTop: 0 }]}
                      value={o.name}
                      onChangeText={v => updateOrderItem(i, 'name', v)}
                      placeholder="Item name"
                      placeholderTextColor={colors.placeholder}
                      editable={!o.from_catalog}
                    />
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                      <TextInput
                        style={[st.input, { flex: 1, marginTop: 0 }]}
                        value={o.qty}
                        onChangeText={v => updateOrderItem(i, 'qty', v)}
                        keyboardType="decimal-pad"
                        placeholder="Qty"
                        placeholderTextColor={colors.placeholder}
                      />
                      <TextInput
                        style={[st.input, { flex: 1, marginTop: 0 }]}
                        value={o.rate}
                        onChangeText={v => updateOrderItem(i, 'rate', v)}
                        keyboardType="decimal-pad"
                        placeholder="Rate"
                        placeholderTextColor={colors.placeholder}
                      />
                      <View style={st.lineTotalChip}>
                        <Text style={st.lineTotalText}>
                          ₹{((parseFloat(o.qty) || 0) * (parseFloat(o.rate) || 0)).toFixed(0)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => removeOrderItem(i)} style={st.removeBtn}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))
            )}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: spacing.sm }}>
              <TouchableOpacity style={st.addLineBtn} onPress={() => setShowItemPicker(true)}>
                <Ionicons name="cube" size={14} color={colors.primary} />
                <Text style={st.addLineText}>From Items</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.addLineBtn} onPress={addCustomItem}>
                <Ionicons name="add" size={14} color={colors.primary} />
                <Text style={st.addLineText}>Custom Line</Text>
              </TouchableOpacity>
            </View>
          </Section>
        )}

        {/* Remarks */}
        <Section title="Remarks" icon="chatbox-outline">
          <TextInput
            style={[st.input, { minHeight: 70, textAlignVertical: 'top', marginTop: 0 }]}
            value={form.remarks}
            onChangeText={v => update('remarks', v)}
            placeholder="Internal notes (optional)"
            placeholderTextColor={colors.placeholder}
            multiline
          />
        </Section>
      </ScrollView>

      {/* Bottom actions */}
      <View style={st.bottomBar}>
        <TouchableOpacity style={st.btnGhost} onPress={() => navigation.goBack()}>
          <Text style={st.btnGhostText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[st.btnPrimary, loading && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? <ActivityIndicator size="small" color="#fff" /> : (
            <>
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={st.btnPrimaryText}>{editId ? 'Update' : 'Create'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Customer picker */}
      <PickerModal
        visible={showCustPicker}
        title="Select Customer"
        search={custSearch}
        onSearch={setCustSearch}
        onClose={() => setShowCustPicker(false)}
        data={customers.filter(c => {
          const q = custSearch.trim().toLowerCase();
          if (!q) return true;
          return `${c.contact_person || ''} ${c.business_name || ''} ${c.mobile || ''}`.toLowerCase().includes(q);
        })}
        renderItem={(c: any) => (
          <TouchableOpacity key={c.id} style={st.pickerRow} onPress={() => selectCustomer(c)} activeOpacity={0.85}>
            <View style={st.selectedAvatar}>
              <Text style={st.selectedAvatarText}>
                {((c.contact_person || c.business_name || '?')[0] || '?').toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.pickerName}>{c.contact_person || c.business_name}</Text>
              <Text style={st.pickerSub}>{c.mobile || c.email || c.address || ''}</Text>
            </View>
          </TouchableOpacity>
        )}
        emptyIcon="people-outline"
        emptyText="No customers"
      />

      {/* Employee picker */}
      <PickerModal
        visible={showEmpPicker}
        title="Select Employee"
        search={empSearch}
        onSearch={setEmpSearch}
        onClose={() => setShowEmpPicker(false)}
        data={employees.filter(e => {
          const q = empSearch.trim().toLowerCase();
          if (!q) return true;
          return `${e.name || ''} ${e.mobile || ''}`.toLowerCase().includes(q);
        })}
        renderItem={(e: any) => (
          <TouchableOpacity key={e.id} style={st.pickerRow} onPress={() => selectEmployee(e)} activeOpacity={0.85}>
            <View style={[st.selectedAvatar, { backgroundColor: '#dbeafe' }]}>
              <Text style={[st.selectedAvatarText, { color: '#1d4ed8' }]}>
                {((e.name || '?')[0] || '?').toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.pickerName}>{e.name}</Text>
              <Text style={st.pickerSub}>{e.mobile || e.email || ''}</Text>
            </View>
          </TouchableOpacity>
        )}
        emptyIcon="person-outline"
        emptyText="No employees"
      />

      {/* Item picker (orders only) */}
      <PickerModal
        visible={showItemPicker}
        title="Select Item"
        search={itemSearch}
        onSearch={setItemSearch}
        onClose={() => setShowItemPicker(false)}
        data={items.filter(i => {
          const q = itemSearch.trim().toLowerCase();
          if (!q) return true;
          return `${i.item_name || ''} ${i.brand_name || ''} ${i.model_number || ''}`.toLowerCase().includes(q);
        })}
        renderItem={(i: any) => (
          <TouchableOpacity key={i.id} style={st.pickerRow} onPress={() => addCatalogItem(i)} activeOpacity={0.85}>
            <View style={[st.selectedAvatar, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="cube" size={16} color="#b45309" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.pickerName}>{i.item_name}</Text>
              <Text style={st.pickerSub}>
                {i.brand_name ? `${i.brand_name} • ` : ''}₹{Number(i.offer_price || i.sale_price || 0).toLocaleString('en-IN')}
              </Text>
            </View>
            <Text style={st.pickerStock}>Stk {i.stock ?? 0}</Text>
          </TouchableOpacity>
        )}
        emptyIcon="cube-outline"
        emptyText="No items"
      />
    </KeyboardAvoidingView>
  );
}

// ============= Helper Components =============
function Label({ text }: { text: string }) {
  return <Text style={st.formLabel}>{text}</Text>;
}

function Section({ title, icon, children, right }: { title: string; icon: any; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={st.section}>
      <View style={st.sectionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name={icon} size={14} color={colors.gray500} />
          <Text style={st.sectionTitle}>{title}</Text>
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

function PickerModal({
  visible, title, search, onSearch, onClose, data, renderItem, emptyIcon, emptyText,
}: {
  visible: boolean; title: string;
  search: string; onSearch: (v: string) => void;
  onClose: () => void; data: any[];
  renderItem: (item: any) => React.ReactNode;
  emptyIcon: any; emptyText: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.modalOverlay}>
        <View style={[st.modalSheet, { maxHeight: '85%' }]}>
          <View style={st.modalHandle} />
          <Text style={st.modalTitle}>{title}</Text>
          <View style={st.modalSearch}>
            <Ionicons name="search" size={16} color={colors.gray400} />
            <TextInput
              style={st.modalSearchInput}
              value={search}
              onChangeText={onSearch}
              placeholder="Search..."
              placeholderTextColor={colors.placeholder}
              autoFocus={false}
            />
            {search ? (
              <TouchableOpacity onPress={() => onSearch('')}>
                <Ionicons name="close-circle" size={16} color={colors.gray400} />
              </TouchableOpacity>
            ) : null}
          </View>
          <FlatList
            data={data}
            keyExtractor={(it, idx) => String(it?.id ?? idx)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => renderItem(item) as any}
            ListEmptyComponent={
              <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                <Ionicons name={emptyIcon} size={36} color={colors.gray300} />
                <Text style={{ color: colors.gray500, marginTop: 8, fontSize: 13 }}>{emptyText}</Text>
              </View>
            }
            style={{ marginTop: spacing.sm }}
          />
          <TouchableOpacity style={[st.modalCancel, { marginTop: spacing.md }]} onPress={onClose}>
            <Text style={{ color: colors.gray600, fontWeight: '600' }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f7fb' },

  headerCard: {
    backgroundColor: colors.primary,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: 18,
    padding: spacing.md,
    overflow: 'hidden',
  },
  headerBgAccent: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)', top: -50, right: -30,
  },
  headerEyebrow: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 2 },

  section: {
    backgroundColor: '#fff',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm + 2,
    borderRadius: 16,
    padding: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectionTitle: { fontSize: 11, color: colors.gray500, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },

  formLabel: {
    fontSize: 11, fontWeight: '800', color: colors.gray500,
    textTransform: 'uppercase', letterSpacing: 0.4,
    marginTop: spacing.md, marginBottom: 6,
  },
  input: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: spacing.md - 2,
    fontSize: fontSize.md, color: colors.text,
    backgroundColor: '#fff',
  },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catTile: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: '#fff',
    minWidth: '47%',
  },
  catTileText: { fontSize: 12, fontWeight: '600', color: colors.gray700 },

  prioBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff',
  },
  prioDot: { width: 6, height: 6, borderRadius: 3 },
  prioBtnText: { fontSize: 11, fontWeight: '700', color: colors.gray700 },

  modeRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 9, borderRadius: 10,
    backgroundColor: colors.gray100,
  },
  modeBtnActive: { backgroundColor: colors.primary },
  modeText: { fontSize: 12, fontWeight: '700', color: colors.gray600 },
  modeTextActive: { color: '#fff' },

  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border, backgroundColor: '#f6f7fb',
    borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  pickerText: { flex: 1, fontSize: 14, fontWeight: '600' },

  selectedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f0fdf4',
    borderWidth: 1, borderColor: '#86efac',
    borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  selectedAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#dcfce7',
    alignItems: 'center', justifyContent: 'center',
  },
  selectedAvatarText: { color: '#15803d', fontWeight: '800', fontSize: 14 },
  selectedName: { fontSize: 14, fontWeight: '700', color: colors.text },
  selectedSub: { fontSize: 11, color: colors.gray500, marginTop: 1, fontWeight: '600' },
  clearBtn: { padding: 4 },

  // Order items
  orderTotalChip: {
    backgroundColor: colors.primary + '12',
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  orderItemCard: {
    flexDirection: 'row', gap: 6,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    borderWidth: 1, borderColor: colors.gray100,
  },
  lineTotalChip: {
    minWidth: 60,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary + '12',
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  lineTotalText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  removeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#fee2e2',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  addLineBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 9,
    backgroundColor: colors.primary + '12',
    borderRadius: 10,
  },
  addLineText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  emptyHint: { fontSize: 12, color: colors.gray500, textAlign: 'center', paddingVertical: 12, fontStyle: 'italic' },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 18,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: colors.gray100,
  },
  btnGhost: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', backgroundColor: colors.gray100 },
  btnGhostText: { fontSize: 14, fontWeight: '700', color: colors.gray700 },
  btnPrimary: { flex: 2, flexDirection: 'row', gap: 6, paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  btnPrimaryText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  // Picker modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 32 },
  modalHandle: { width: 40, height: 4, backgroundColor: colors.gray200, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  modalSearch: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f6f7fb',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
    marginTop: spacing.sm,
  },
  modalSearchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 },
  modalCancel: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: colors.gray100 },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 4,
  },
  pickerName: { fontSize: 14, fontWeight: '700', color: colors.text },
  pickerSub: { fontSize: 11, color: colors.gray500, marginTop: 1, fontWeight: '600' },
  pickerStock: { fontSize: 11, fontWeight: '800', color: colors.gray500 },
});
