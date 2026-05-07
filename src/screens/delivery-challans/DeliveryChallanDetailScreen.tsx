import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import StatusBadge from '../../components/StatusBadge';
import CurrencyText from '../../components/CurrencyText';

function statusColor(s: string) {
  switch (s) {
    case 'Dispatched': return '#3b82f6';
    case 'Delivered': return '#10b981';
    case 'Cancelled': return '#ef4444';
    default: return '#94a3b8';
  }
}

function typeColor(t: string) {
  switch (t) {
    case 'Supply': return '#3b82f6';
    case 'Job Work': return '#8b5cf6';
    case 'Export': return '#f59e0b';
    case 'SKD/CKD': return '#06b6d4';
    default: return colors.gray400;
  }
}

const STATUS_FLOW: Record<string, string[]> = {
  Draft: ['Dispatched', 'Cancelled'],
  Dispatched: ['Delivered', 'Cancelled'],
  Delivered: ['Cancelled'],
  Cancelled: [],
};

export default function DeliveryChallanDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const { id } = route.params;
  const [challan, setChallan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchChallan = async () => {
    try {
      const res = await api.get(`/api/delivery-challans/${id}`);
      setChallan(res.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchChallan(); }, [id]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchChallan);
    return unsub;
  }, [navigation]);

  const changeStatus = async (newStatus: string) => {
    Alert.alert('Change Status', `Mark as ${newStatus}?`, [
      { text: 'Cancel' },
      {
        text: 'Confirm', onPress: async () => {
          try {
            await api.patch(`/api/delivery-challans/${id}/status`, { status: newStatus });
            fetchChallan();
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.detail || 'Failed');
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Delete', 'Delete this delivery challan?', [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/api/delivery-challans/${id}`);
            navigation.goBack();
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.detail || 'Failed');
          }
        },
      },
    ]);
  };

  if (loading || !challan) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const accent = statusColor(challan.status);
  const dateFmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const nextStatuses = STATUS_FLOW[challan.status] || [];
  const items = challan.items || [];

  return (
    <ScrollView style={s.container}>
      {/* HEADER */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View style={[s.accentBar, { backgroundColor: accent }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.headerLabel}>DELIVERY CHALLAN</Text>
            <Text style={s.headerNumber}>{challan.dc_number}</Text>
          </View>
          <View style={[s.statusPill, { backgroundColor: accent + '15', borderColor: accent + '40' }]}>
            <View style={[s.statusDot, { backgroundColor: accent }]} />
            <Text style={[s.statusText, { color: accent }]}>{challan.status}</Text>
          </View>
        </View>

        <View style={s.amountBlock}>
          <Text style={s.amountLabel}>Total Amount</Text>
          <Text style={s.amountValue}>₹{Number(challan.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        </View>

        <View style={s.dateRow}>
          <View style={s.dateCol}>
            <Text style={s.dateLabel}>Date</Text>
            <Text style={s.dateValue}>{dateFmt(challan.challan_date)}</Text>
          </View>
          <View style={s.dateDiv} />
          <View style={s.dateCol}>
            <Text style={s.dateLabel}>Type</Text>
            <Text style={[s.dateValue, { color: typeColor(challan.challan_type) }]}>{challan.challan_type || '—'}</Text>
          </View>
          <View style={s.dateDiv} />
          <View style={s.dateCol}>
            <Text style={s.dateLabel}>Items</Text>
            <Text style={s.dateValue}>{items.length}</Text>
          </View>
        </View>
      </View>

      {/* CUSTOMER */}
      <View style={s.card}>
        <View style={s.sectionHeader}>
          <Ionicons name="person-outline" size={16} color={colors.primary} />
          <Text style={s.sectionTitle}>Customer</Text>
        </View>
        <Text style={s.customerName}>{challan.customer_name || '—'}</Text>
      </View>

      {/* CHALLAN TYPE */}
      {challan.challan_type ? (
        <View style={s.card}>
          <View style={s.sectionHeader}>
            <Ionicons name="pricetag-outline" size={16} color={colors.primary} />
            <Text style={s.sectionTitle}>Challan Type</Text>
          </View>
          <View style={[s.typeBadgeLarge, { backgroundColor: typeColor(challan.challan_type) + '18' }]}>
            <Text style={[s.typeBadgeLargeText, { color: typeColor(challan.challan_type) }]}>{challan.challan_type}</Text>
          </View>
        </View>
      ) : null}

      {/* TRANSPORT INFO */}
      {(challan.vehicle_number || challan.transporter_name) ? (
        <View style={s.card}>
          <View style={s.sectionHeader}>
            <Ionicons name="car-outline" size={16} color={colors.primary} />
            <Text style={s.sectionTitle}>Transport Details</Text>
          </View>
          {challan.vehicle_number ? (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Vehicle No.</Text>
              <Text style={s.infoValue}>{challan.vehicle_number}</Text>
            </View>
          ) : null}
          {challan.transporter_name ? (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Transporter</Text>
              <Text style={s.infoValue}>{challan.transporter_name}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* SHIPPING ADDRESS */}
      {challan.shipping_address ? (
        <View style={s.card}>
          <View style={s.sectionHeader}>
            <Ionicons name="location-outline" size={16} color={colors.primary} />
            <Text style={s.sectionTitle}>Shipping Address</Text>
          </View>
          <Text style={s.infoValue}>{challan.shipping_address}</Text>
        </View>
      ) : null}

      {/* LINE ITEMS */}
      <View style={s.card}>
        <View style={s.sectionHeader}>
          <Ionicons name="list-outline" size={16} color={colors.primary} />
          <Text style={s.sectionTitle}>Items ({items.length})</Text>
        </View>
        {items.map((item: any, idx: number) => (
          <View key={idx} style={[s.lineItem, idx < items.length - 1 && s.lineItemBorder]}>
            <View style={s.lineTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.lineName} numberOfLines={1}>{item.item_name}</Text>
                {item.description ? <Text style={s.lineDesc} numberOfLines={1}>{item.description}</Text> : null}
              </View>
              <Text style={s.lineAmount}>₹{Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>
            <View style={s.lineMeta}>
              <Text style={s.lineMetaText}>{item.qty} {item.unit || 'Nos'} × ₹{Number(item.rate || 0).toLocaleString('en-IN')}</Text>
              {item.discount_percent > 0 ? <Text style={s.lineMetaText}> · {item.discount_percent}% off</Text> : null}
              {item.tax_rate > 0 ? <Text style={s.lineMetaText}> · GST {item.tax_rate}%</Text> : null}
              {item.hsn_code ? <Text style={s.lineMetaText}> · HSN {item.hsn_code}</Text> : null}
            </View>
          </View>
        ))}
      </View>

      {/* SUMMARY */}
      <View style={s.card}>
        <View style={s.sectionHeader}>
          <Ionicons name="calculator-outline" size={16} color={colors.primary} />
          <Text style={s.sectionTitle}>Summary</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={s.summaryLabel}>Subtotal</Text>
          <Text style={s.summaryValue}>₹{Number(challan.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
        </View>
        {challan.discount_value > 0 ? (
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Discount {challan.discount_type === 'percentage' ? `(${challan.discount_value}%)` : ''}</Text>
            <Text style={[s.summaryValue, { color: colors.danger }]}>
              -₹{Number(
                challan.discount_type === 'percentage'
                  ? (challan.subtotal || 0) * (challan.discount_value || 0) / 100
                  : challan.discount_value || 0
              ).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        ) : null}
        {challan.tax_amount > 0 ? (
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Tax</Text>
            <Text style={s.summaryValue}>₹{Number(challan.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
        ) : null}
        <View style={[s.summaryRow, s.totalRow]}>
          <Text style={s.totalLabel}>Total</Text>
          <Text style={s.totalValue}>₹{Number(challan.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
        </View>
      </View>

      {/* NOTES */}
      {challan.notes ? (
        <View style={s.card}>
          <View style={s.sectionHeader}>
            <Ionicons name="document-text-outline" size={16} color={colors.primary} />
            <Text style={s.sectionTitle}>Notes</Text>
          </View>
          <Text style={s.infoValue}>{challan.notes}</Text>
        </View>
      ) : null}

      {/* STATUS ACTIONS */}
      {nextStatuses.length > 0 ? (
        <View style={s.card}>
          <View style={s.sectionHeader}>
            <Ionicons name="swap-horizontal-outline" size={16} color={colors.primary} />
            <Text style={s.sectionTitle}>Change Status</Text>
          </View>
          <View style={s.statusActions}>
            {nextStatuses.map(ns => (
              <TouchableOpacity
                key={ns}
                style={[s.statusBtn, { backgroundColor: statusColor(ns) + '15', borderColor: statusColor(ns) + '40' }]}
                onPress={() => changeStatus(ns)}
              >
                <Ionicons
                  name={ns === 'Dispatched' ? 'send-outline' : ns === 'Delivered' ? 'checkmark-circle-outline' : 'close-circle-outline'}
                  size={16}
                  color={statusColor(ns)}
                />
                <Text style={[s.statusBtnText, { color: statusColor(ns) }]}>{ns}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {/* ACTION BUTTONS */}
      <View style={s.actions}>
        {challan.status === 'Draft' ? (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('DCForm', { id: challan.id })}
          >
            <Ionicons name="create-outline" size={18} color="#fff" />
            <Text style={s.actionBtnText}>Edit</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: colors.danger }]}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={18} color="#fff" />
          <Text style={s.actionBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    backgroundColor: colors.card, marginHorizontal: spacing.md, marginTop: spacing.md,
    borderRadius: borderRadius.lg, padding: spacing.lg,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  accentBar: { width: 4, height: 36, borderRadius: 2, marginRight: spacing.sm },
  headerLabel: { fontSize: fontSize.xs, color: colors.gray400, fontWeight: '600', letterSpacing: 0.5 },
  headerNumber: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.full, borderWidth: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 5 },
  statusText: { fontSize: fontSize.xs, fontWeight: '700' },
  amountBlock: { marginTop: spacing.lg, alignItems: 'center' },
  amountLabel: { fontSize: fontSize.xs, color: colors.gray400, marginBottom: 2 },
  amountValue: { fontSize: 28, fontWeight: '800', color: colors.text },
  dateRow: { flexDirection: 'row', marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  dateCol: { flex: 1, alignItems: 'center' },
  dateLabel: { fontSize: fontSize.xs, color: colors.gray400, marginBottom: 2 },
  dateValue: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  dateDiv: { width: 1, backgroundColor: colors.border },

  // Cards
  card: {
    backgroundColor: colors.card, marginHorizontal: spacing.md, marginTop: spacing.sm,
    borderRadius: borderRadius.lg, padding: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text, marginLeft: 6 },
  customerName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },

  typeBadgeLarge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.md },
  typeBadgeLargeText: { fontSize: fontSize.sm, fontWeight: '700' },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  infoLabel: { fontSize: fontSize.sm, color: colors.gray500 },
  infoValue: { fontSize: fontSize.sm, color: colors.text, fontWeight: '500' },

  // Line items
  lineItem: { paddingVertical: spacing.sm },
  lineItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  lineTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  lineName: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  lineDesc: { fontSize: fontSize.xs, color: colors.gray400, marginTop: 1 },
  lineAmount: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  lineMeta: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  lineMetaText: { fontSize: fontSize.xs, color: colors.gray400 },

  // Summary
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontSize: fontSize.sm, color: colors.gray500 },
  summaryValue: { fontSize: fontSize.sm, color: colors.text, fontWeight: '500' },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: spacing.sm },
  totalLabel: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: fontSize.md, fontWeight: '800', color: colors.primary },

  // Status actions
  statusActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statusBtn: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: borderRadius.md, borderWidth: 1, gap: 6,
  },
  statusBtnText: { fontSize: fontSize.sm, fontWeight: '600' },

  // Action buttons
  actions: { flexDirection: 'row', marginHorizontal: spacing.md, marginTop: spacing.md, gap: spacing.sm },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: borderRadius.md, gap: 6,
  },
  actionBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '700' },
});
