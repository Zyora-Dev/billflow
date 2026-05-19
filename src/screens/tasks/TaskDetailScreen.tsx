import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  Image, TextInput, ActivityIndicator, Linking, Modal, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateInput from '../../components/DateInput';
import api, { BASE_URL } from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

const STATUS_OPTIONS = ['Pending', 'Assigned', 'In Progress', 'Completed', 'Delayed', 'Cancelled'];

const STATUS_META: Record<string, { color: string; bg: string }> = {
  Pending:        { color: '#475569', bg: '#f1f5f9' },
  Assigned:       { color: '#1d4ed8', bg: '#dbeafe' },
  'In Progress':  { color: '#b45309', bg: '#fef3c7' },
  Completed:      { color: '#15803d', bg: '#dcfce7' },
  Delayed:        { color: '#dc2626', bg: '#fee2e2' },
  Cancelled:      { color: '#6b7280', bg: '#f3f4f6' },
};

const PRIO_META: Record<string, { color: string; bg: string }> = {
  Low:    { color: '#1d4ed8', bg: '#dbeafe' },
  Medium: { color: '#0e7490', bg: '#cffafe' },
  High:   { color: '#b45309', bg: '#fef3c7' },
  Urgent: { color: '#dc2626', bg: '#fee2e2' },
};

const CAT_META: Record<string, { color: string; bg: string; icon: any }> = {
  AMC:         { color: '#7c3aed', bg: '#ede9fe', icon: 'repeat' },
  Repair:      { color: '#dc2626', bg: '#fee2e2', icon: 'construct' },
  Replacement: { color: '#1d4ed8', bg: '#dbeafe', icon: 'swap-horizontal' },
  Others:      { color: '#6b7280', bg: '#f3f4f6', icon: 'ellipsis-horizontal' },
};

const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Other'];

export default function TaskDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const { id } = route.params;
  const [task, setTask] = useState<any>(null);
  const [updates, setUpdates] = useState<any[]>([]);
  const [updateText, setUpdateText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  // Service payments
  const [servicePayments, setServicePayments] = useState<any[]>([]);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '', payment_method: 'Cash', payment_date: new Date().toISOString().split('T')[0],
    reference_number: '', notes: '', payment_type: 'service',
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fetchData = async () => {
    try {
      const t = await api.get(`/api/tasks/${id}`);
      setTask(t.data);
      const u = await api.get(`/api/task-updates?task_id=${id}`);
      setUpdates(Array.isArray(u.data) ? u.data : []);
      // Fetch service payments for this task
      try {
        const sp = await api.get(`/api/service-payments?task_id=${id}`);
        setServicePayments(Array.isArray(sp.data) ? sp.data : []);
      } catch {}
    } catch {}
  };

  useEffect(() => { fetchData(); }, [id]);
  useEffect(() => navigation.addListener('focus', fetchData), [navigation]);

  const changeStatus = (s: string) => {
    if (s === 'Completed') {
      setPaymentForm({
        amount: task?.order_amount ? String(task.order_amount) : '',
        payment_method: 'Cash',
        payment_date: new Date().toISOString().split('T')[0],
        reference_number: '', notes: '',
        payment_type: task?.task_type === 'order' ? 'order' : 'service',
      });
      setPaymentDialogOpen(true);
      return;
    }
    Alert.alert('Change status', `Set status to ${s}?`, [
      { text: 'Cancel' },
      { text: 'Confirm', onPress: async () => { try { await api.patch(`/api/tasks/${id}/status?status=${s}`); fetchData(); } catch {} } },
    ]);
  };

  const handleCompleteWithPayment = async () => {
    setSubmittingPayment(true);
    try {
      const amt = parseFloat(paymentForm.amount);
      if (amt > 0 && task) {
        await api.post('/api/service-payments', {
          task_id: id, org_id: task.org_id, amount: amt,
          payment_method: paymentForm.payment_method,
          payment_date: paymentForm.payment_date,
          reference_number: paymentForm.reference_number || null,
          notes: paymentForm.notes || null,
          payment_type: paymentForm.payment_type || 'service',
        });
      }
      await api.patch(`/api/tasks/${id}/status?status=Completed`);
      setPaymentDialogOpen(false);
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally { setSubmittingPayment(false); }
  };

  const handleCompleteWithoutPayment = async () => {
    setSubmittingPayment(true);
    try {
      await api.patch(`/api/tasks/${id}/status?status=Completed`);
      setPaymentDialogOpen(false);
      fetchData();
    } catch {} finally { setSubmittingPayment(false); }
  };

  const deleteServicePayment = (spId: number) => {
    Alert.alert('Delete Payment', 'Remove this service payment?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/api/service-payments/${spId}`); fetchData(); } catch {}
      }},
    ]);
  };

  const handleDelete = () =>
    Alert.alert('Delete task', 'This action cannot be undone.', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.delete(`/api/tasks/${id}`); navigation.goBack(); } catch {} } },
    ]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setSelectedImage(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission', 'Camera access required'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) setSelectedImage(result.assets[0].uri);
  };

  const postUpdate = async () => {
    if (!updateText.trim() && !selectedImage) return;
    setPosting(true);
    try {
      const formData = new FormData();
      formData.append('task_id', id);
      formData.append('update_text', updateText.trim());
      if (selectedImage) {
        formData.append('file', { uri: selectedImage, name: 'photo.jpg', type: 'image/jpeg' } as any);
      }
      await api.post('/api/task-updates', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUpdateText(''); setSelectedImage(null);
      fetchData();
    } catch { Alert.alert('Error', 'Failed to post update'); } finally { setPosting(false); }
  };

  const deleteUpdate = (uid: number) =>
    Alert.alert('Delete update', 'Remove this update?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.delete(`/api/task-updates/${uid}`); fetchData(); } catch {} } },
    ]);

  if (!task) {
    return <View style={st.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  const sm = STATUS_META[task.status] || STATUS_META.Pending;
  const pm = PRIO_META[task.priority] || PRIO_META.Medium;
  const cm = task.category ? CAT_META[task.category] : null;
  const isOrder = task.task_type === 'order';

  let orderItems: any[] = [];
  try {
    const raw = task.order_items;
    if (Array.isArray(raw)) orderItems = raw;
    else if (typeof raw === 'string' && raw) orderItems = JSON.parse(raw);
  } catch {}

  return (
    <View style={{ flex: 1, backgroundColor: '#f6f7fb' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Hero */}
        <View style={st.hero}>
          <View style={st.heroAccent} />
          <View style={st.heroTopRow}>
            <View style={[st.heroBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <Ionicons name={isOrder ? 'cube' : 'construct'} size={11} color="#fff" />
              <Text style={st.heroBadgeText}>{isOrder ? 'Order' : 'Task'}</Text>
            </View>
            {cm && (
              <View style={[st.heroBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Ionicons name={cm.icon} size={11} color="#fff" />
                <Text style={st.heroBadgeText}>{task.category}</Text>
              </View>
            )}
            {task.service_type ? (
              <View style={[st.heroBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Ionicons name={task.service_type === 'In Call' ? 'call' : 'walk'} size={11} color="#fff" />
                <Text style={st.heroBadgeText}>{task.service_type}</Text>
              </View>
            ) : null}
          </View>
          <Text style={st.heroTitle}>{task.title}</Text>
          {task.description ? <Text style={st.heroDesc}>{task.description}</Text> : null}

          <View style={st.heroPills}>
            <View style={[st.pill, { backgroundColor: sm.bg }]}>
              <Text style={[st.pillText, { color: sm.color }]}>{task.status}</Text>
            </View>
            <View style={[st.pill, { backgroundColor: pm.bg }]}>
              <View style={[st.pillDot, { backgroundColor: pm.color }]} />
              <Text style={[st.pillText, { color: pm.color }]}>{task.priority}</Text>
            </View>
            {isOrder && task.order_amount > 0 && (
              <View style={[st.pill, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                <Ionicons name="cash" size={10} color="#fff" />
                <Text style={[st.pillText, { color: '#fff' }]}>
                  ₹{Number(task.order_amount).toLocaleString('en-IN')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Quick status row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.statusRow}>
          {STATUS_OPTIONS.filter(s => s !== task.status).map(s => {
            const m = STATUS_META[s];
            return (
              <TouchableOpacity
                key={s}
                style={[st.statusChip, { borderColor: m.color, backgroundColor: m.bg }]}
                onPress={() => changeStatus(s)}
                activeOpacity={0.85}
              >
                <Text style={[st.statusChipText, { color: m.color }]}>{s}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Customer & Assignment */}
        <View style={st.section}>
          <Text style={st.secTitle}>Customer</Text>
          <View style={st.bigRow}>
            <View style={[st.avatar, { backgroundColor: '#dcfce7' }]}>
              <Text style={[st.avatarText, { color: '#15803d' }]}>
                {(task.customer_name?.[0] || '?').toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.bigName}>{task.customer_name || '-'}</Text>
              {task.mobile ? <Text style={st.bigSub}>{task.mobile}</Text> : null}
              {task.address ? <Text style={[st.bigSub, { marginTop: 1 }]} numberOfLines={2}>{task.address}</Text> : null}
            </View>
            {task.mobile ? (
              <TouchableOpacity style={st.actionMini} onPress={() => Linking.openURL(`tel:${task.mobile}`)}>
                <Ionicons name="call" size={14} color={colors.primary} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={[st.divider, { marginVertical: 10 }]} />

          <Text style={st.secTitle}>Assigned To</Text>
          <View style={st.bigRow}>
            <View style={[st.avatar, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="person" size={16} color="#1d4ed8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.bigName}>{task.employee_name || 'Unassigned'}</Text>
              <Text style={st.bigSub}>{task.employee_name ? 'Assignee' : 'No employee assigned'}</Text>
            </View>
          </View>
        </View>

        {/* Schedule */}
        <View style={st.section}>
          <Text style={st.secTitle}>Schedule</Text>
          <View style={st.gridRow}>
            <View style={st.gridCell}>
              <Ionicons name="calendar-outline" size={14} color={colors.gray500} />
              <Text style={st.gridLabel}>Date</Text>
              <Text style={st.gridValue}>{task.task_date || '-'}</Text>
            </View>
            <View style={[st.gridCell, st.gridCellMid]}>
              <Ionicons name="time-outline" size={14} color={colors.gray500} />
              <Text style={st.gridLabel}>Time</Text>
              <Text style={st.gridValue}>{task.task_time || '-'}</Text>
            </View>
            <View style={st.gridCell}>
              <Ionicons name="flag-outline" size={14} color={colors.gray500} />
              <Text style={st.gridLabel}>Due</Text>
              <Text style={st.gridValue}>{task.due_date || '-'}</Text>
            </View>
          </View>
          {task.completed_date ? (
            <Text style={st.completedNote}>
              <Ionicons name="checkmark-circle" size={11} color="#15803d" /> Completed on {task.completed_date}
            </Text>
          ) : null}
        </View>

        {/* Order items */}
        {isOrder && orderItems.length > 0 && (
          <View style={st.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={st.secTitle}>Order Items</Text>
              <Text style={st.sectionRight}>{orderItems.length} item{orderItems.length === 1 ? '' : 's'}</Text>
            </View>
            {orderItems.map((it: any, i: number) => (
              <View key={i} style={st.orderItem}>
                <View style={st.orderBullet}><Text style={st.orderBulletText}>{i + 1}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={st.orderName}>{it.name || it.item_name}</Text>
                  <Text style={st.orderSub}>
                    {it.qty} × ₹{Number(it.rate || 0).toLocaleString('en-IN')}
                  </Text>
                </View>
                <Text style={st.orderTotal}>
                  ₹{((parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0)).toLocaleString('en-IN')}
                </Text>
              </View>
            ))}
            {task.order_amount > 0 && (
              <View style={st.orderGrand}>
                <Text style={st.orderGrandLabel}>Total</Text>
                <Text style={st.orderGrandValue}>₹{Number(task.order_amount).toLocaleString('en-IN')}</Text>
              </View>
            )}
          </View>
        )}

        {/* Remarks */}
        {task.remarks ? (
          <View style={st.section}>
            <Text style={st.secTitle}>Remarks</Text>
            <Text style={st.remarkText}>{task.remarks}</Text>
          </View>
        ) : null}

        {/* Service Payments */}
        {servicePayments.length > 0 ? (
          <View style={st.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="cash" size={16} color="#059669" />
                <Text style={st.secTitle}>Service Payments</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 11, color: '#6b7280' }}>{servicePayments.length} payment{servicePayments.length > 1 ? 's' : ''}</Text>
                <View style={{ backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#bbf7d0' }}>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: '#059669' }}>₹{servicePayments.reduce((s: number, p: any) => s + (p.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                </View>
              </View>
            </View>
            {servicePayments.map((p: any) => (
              <View key={p.id} style={{ backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#dcfce7' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#059669' }}>₹{(p.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                  <View style={{ backgroundColor: p.payment_method === 'Cash' ? '#fef3c7' : p.payment_method === 'UPI' ? '#dbeafe' : '#f3e8ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: p.payment_method === 'Cash' ? '#92400e' : p.payment_method === 'UPI' ? '#1e40af' : '#7e22ce' }}>{p.payment_method}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                  {p.payment_date ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="calendar-outline" size={11} color="#6b7280" />
                      <Text style={{ fontSize: 11, color: '#6b7280' }}>{new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                    </View>
                  ) : null}
                  {p.reference_number ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="document-text-outline" size={11} color="#6b7280" />
                      <Text style={{ fontSize: 11, color: '#6b7280' }}>Ref: {p.reference_number}</Text>
                    </View>
                  ) : null}
                </View>
                {p.notes ? <Text style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic', marginTop: 4 }}>{p.notes}</Text> : null}
                <TouchableOpacity
                  style={{ position: 'absolute', top: 10, right: 10 }}
                  onPress={() => deleteServicePayment(p.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="trash-outline" size={13} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

        {/* Updates */}
        <View style={st.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={st.secTitle}>Updates</Text>
            <Text style={st.sectionRight}>{updates.length}</Text>
          </View>

          {/* Composer */}
          <View style={st.composer}>
            <TextInput
              style={st.composerInput}
              placeholder="Write an update..."
              placeholderTextColor={colors.gray400}
              value={updateText}
              onChangeText={setUpdateText}
              multiline
            />
            {selectedImage && (
              <View style={st.previewWrap}>
                <Image source={{ uri: selectedImage }} style={st.previewImg} />
                <TouchableOpacity style={st.previewRemove} onPress={() => setSelectedImage(null)}>
                  <Ionicons name="close-circle" size={20} color={colors.danger} />
                </TouchableOpacity>
              </View>
            )}
            <View style={st.composerActions}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity style={st.composerBtn} onPress={takePhoto}>
                  <Ionicons name="camera" size={14} color={colors.primary} />
                  <Text style={st.composerBtnText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.composerBtn} onPress={pickImage}>
                  <Ionicons name="image" size={14} color={colors.primary} />
                  <Text style={st.composerBtnText}>Gallery</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[st.postBtn, posting && { opacity: 0.6 }]}
                onPress={postUpdate}
                disabled={posting}
              >
                {posting ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Ionicons name="send" size={13} color="#fff" />
                    <Text style={st.postBtnText}>Post</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Update timeline */}
          {updates.length === 0 ? (
            <Text style={st.emptyText}>No updates yet</Text>
          ) : (
            [...updates].reverse().map((u: any, idx: number) => (
              <View key={u?.id ?? idx} style={st.updateCard}>
                <View style={st.updateBullet} />
                <View style={{ flex: 1 }}>
                  <View style={st.updateHead}>
                    <Text style={st.updateDate}>{new Date(u.created_at).toLocaleString()}</Text>
                    <TouchableOpacity onPress={() => deleteUpdate(u.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={14} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                  {u.update_text ? <Text style={st.updateText}>{u.update_text}</Text> : null}
                  {u.file_path ? (
                    <Image
                      source={{ uri: `${BASE_URL}/assets/tasks/${u.file_path}` }}
                      style={st.updateImg}
                      resizeMode="cover"
                    />
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Bottom actions */}
      <View style={st.bottomBar}>
        <TouchableOpacity
          style={st.editBtn}
          onPress={() => navigation.navigate('TaskForm', { id, task_type: task.task_type })}
        >
          <Ionicons name="create-outline" size={16} color={colors.primary} />
          <Text style={st.editBtnText}>Edit</Text>
        </TouchableOpacity>
        {!isOrder && (
          <TouchableOpacity
            style={st.orderBtn}
            onPress={() => navigation.navigate('TaskForm', { task_type: 'order', parent_task_id: task.id })}
          >
            <Ionicons name="cube" size={16} color="#fff" />
            <Text style={st.orderBtnText}>New Order</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={st.deleteBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
        </TouchableOpacity>
      </View>

      {/* Complete with payment dialog */}
      <Modal visible={paymentDialogOpen} transparent animationType="slide" onRequestClose={() => setPaymentDialogOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', alignSelf: 'center', marginBottom: 12 }} />
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#1f2937' }}>Complete Task</Text>
              <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{task?.title}</Text>
              {task?.customer_name ? <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{task.customer_name}</Text> : null}
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', marginTop: 4, marginBottom: 4 }}>Collection Amount</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', borderWidth: 2, borderColor: '#059669', borderRadius: 10, paddingHorizontal: 12 }}>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#059669' }}>₹</Text>
                <TextInput
                  style={{ flex: 1, fontSize: 22, fontWeight: '800', color: '#065f46', paddingVertical: Platform.OS === 'ios' ? 12 : 8, marginLeft: 6 }}
                  value={paymentForm.amount}
                  onChangeText={v => setPaymentForm(f => ({ ...f, amount: v }))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#d1d5db"
                />
              </View>

              <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', marginTop: 12, marginBottom: 4 }}>Payment Method</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
                {PAYMENT_METHODS.map(m => {
                  const active = paymentForm.payment_method === m;
                  return (
                    <TouchableOpacity key={m}
                      style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: active ? '#065f46' : '#f9fafb', borderWidth: 1, borderColor: active ? '#065f46' : '#e5e7eb' }}
                      onPress={() => setPaymentForm(f => ({ ...f, payment_method: m }))}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#fff' : '#6b7280' }}>{m}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', marginTop: 12, marginBottom: 4 }}>Payment Date</Text>
              <DateInput value={paymentForm.payment_date} onChange={v => setPaymentForm(f => ({ ...f, payment_date: v }))} />

              <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', marginTop: 12, marginBottom: 4 }}>Reference Number</Text>
              <TextInput
                style={{ backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 14, color: '#1f2937' }}
                value={paymentForm.reference_number}
                onChangeText={v => setPaymentForm(f => ({ ...f, reference_number: v }))}
                placeholder="UPI ref / cheque no."
                placeholderTextColor="#d1d5db"
              />

              <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', marginTop: 12, marginBottom: 4 }}>Notes</Text>
              <TextInput
                style={{ backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 14, color: '#1f2937', minHeight: 60, textAlignVertical: 'top' }}
                value={paymentForm.notes}
                onChangeText={v => setPaymentForm(f => ({ ...f, notes: v }))}
                placeholder="Optional notes..."
                placeholderTextColor="#d1d5db"
                multiline
              />

              <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', marginTop: 12, marginBottom: 4 }}>Payment Type</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                {(['service', 'order', 'both'] as const).map(t => {
                  const active = paymentForm.payment_type === t;
                  return (
                    <TouchableOpacity key={t}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: active ? '#065f46' : '#e5e7eb', backgroundColor: active ? '#065f46' : '#fafafa' }}
                      onPress={() => setPaymentForm(f => ({ ...f, payment_type: t }))}
                    >
                      <Text style={{ fontSize: 12, fontWeight: active ? '700' : '500', color: active ? '#fff' : '#6b7280' }}>{t === 'service' ? 'Service' : t === 'order' ? 'Order' : 'Both'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'column', gap: 8, marginTop: 16 }}>
              <TouchableOpacity
                style={{ paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' }}
                onPress={handleCompleteWithoutPayment}
                disabled={submittingPayment}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#6b7280' }}>Complete Without Payment</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flexDirection: 'row', gap: 6, paddingVertical: 13, borderRadius: 8, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', opacity: submittingPayment ? 0.6 : 1 }}
                onPress={handleCompleteWithPayment}
                disabled={submittingPayment}
              >
                {submittingPayment ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Record & Complete</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f7fb' },

  // Hero
  hero: {
    backgroundColor: '#065f46',
    margin: spacing.md,
    borderRadius: 20,
    padding: spacing.md,
    overflow: 'hidden',
  },
  heroAccent: {
    position: 'absolute',
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -60, right: -50,
  },
  heroTopRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 999,
  },
  heroBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 8, lineHeight: 26 },
  heroDesc: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4, fontWeight: '500', lineHeight: 17 },
  heroPills: { flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillDot: { width: 5, height: 5, borderRadius: 2.5 },
  pillText: { fontSize: 11, fontWeight: '800' },

  // Status row
  statusRow: { paddingHorizontal: spacing.md, paddingBottom: 4, gap: 6 },
  statusChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusChipText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },

  // Section card
  section: {
    backgroundColor: '#fff',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm + 2,
    borderRadius: 16,
    padding: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  secTitle: { fontSize: 11, color: colors.gray500, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  sectionRight: { fontSize: 11, color: colors.gray500, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.gray100 },

  // Big row (customer / assignee)
  bigRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800', fontSize: 15 },
  bigName: { fontSize: 14, fontWeight: '700', color: colors.text },
  bigSub: { fontSize: 11, color: colors.gray500, marginTop: 1, fontWeight: '600' },
  actionMini: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.primary + '12',
    alignItems: 'center', justifyContent: 'center',
  },

  // Schedule grid
  gridRow: { flexDirection: 'row' },
  gridCell: { flex: 1, paddingVertical: 4 },
  gridCellMid: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.gray100, paddingHorizontal: 12 },
  gridLabel: { fontSize: 10, color: colors.gray500, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 4 },
  gridValue: { fontSize: 13, color: colors.text, fontWeight: '700', marginTop: 2 },
  completedNote: { marginTop: 8, fontSize: 11, color: '#15803d', fontWeight: '700' },

  // Order items
  orderItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  orderBullet: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.primary + '12',
    alignItems: 'center', justifyContent: 'center',
  },
  orderBulletText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  orderName: { fontSize: 13, fontWeight: '700', color: colors.text },
  orderSub: { fontSize: 11, color: colors.gray500, marginTop: 1, fontWeight: '600' },
  orderTotal: { fontSize: 13, fontWeight: '800', color: colors.primary },
  orderGrand: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.primary + '08',
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, marginTop: 8,
  },
  orderGrandLabel: { fontSize: 12, color: colors.gray700, fontWeight: '700' },
  orderGrandValue: { fontSize: 16, color: colors.primary, fontWeight: '900' },

  remarkText: { fontSize: 13, color: colors.gray700, lineHeight: 19 },

  // Updates
  composer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1, borderColor: colors.gray100,
    marginBottom: 10,
  },
  composerInput: { fontSize: 13, color: colors.text, minHeight: 50, textAlignVertical: 'top' },
  previewWrap: { position: 'relative', alignSelf: 'flex-start', marginTop: 6 },
  previewImg: { width: 90, height: 90, borderRadius: 10 },
  previewRemove: { position: 'absolute', top: -8, right: -8, backgroundColor: '#fff', borderRadius: 10 },
  composerActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  composerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: colors.primary + '12',
    borderRadius: 999,
  },
  composerBtnText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  postBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999,
  },
  postBtnText: { fontSize: 12, fontWeight: '800', color: '#fff' },

  updateCard: { flexDirection: 'row', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  updateBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 7 },
  updateHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  updateDate: { fontSize: 11, color: colors.gray500, fontWeight: '600' },
  updateText: { fontSize: 13, color: colors.text, marginTop: 2, lineHeight: 18 },
  updateImg: { width: '100%', height: 180, borderRadius: 10, marginTop: 6 },
  emptyText: { fontSize: 12, color: colors.gray400, textAlign: 'center', paddingVertical: 18, fontStyle: 'italic' },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 18,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: colors.gray100,
  },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 11,
    backgroundColor: colors.primary + '12',
    borderRadius: 12,
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  orderBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 11,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  orderBtnText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  deleteBtn: {
    width: 44, height: 44,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
});
