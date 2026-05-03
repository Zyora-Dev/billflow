import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, Animated, Easing, ActivityIndicator,
  ScrollView, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../api/client';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import haptic from '../lib/haptics';

export type PreviewType = 'invoice' | 'quotation' | 'customer' | 'vendor' | 'item' | 'bill' | 'po' | 'task' | 'employee';

interface PreviewRequest { type: PreviewType; id: number | string; }

interface PreviewCtx {
  show: (req: PreviewRequest) => void;
  hide: () => void;
}

const PreviewContext = createContext<PreviewCtx>({ show: () => {}, hide: () => {} });
export const usePreview = () => useContext(PreviewContext);

const TYPE_META: Record<PreviewType, {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  endpoint: (id: number | string) => string;
  navTarget: { stack: string; screen: string };
}> = {
  invoice:   { label: 'Invoice',   icon: 'document-text', color: '#6366f1', endpoint: id => `/api/invoices/${id}`,        navTarget: { stack: 'Invoices',       screen: 'InvoiceDetail'   } },
  quotation: { label: 'Quotation', icon: 'pricetag',      color: '#0ea5e9', endpoint: id => `/api/quotations/${id}`,      navTarget: { stack: 'Quotations',     screen: 'QuotationDetail' } },
  customer:  { label: 'Customer',  icon: 'person',        color: '#8b5cf6', endpoint: id => `/api/customers/${id}`,       navTarget: { stack: 'Customers',      screen: 'CustomerDetail'  } },
  vendor:    { label: 'Vendor',    icon: 'storefront',    color: '#f59e0b', endpoint: id => `/api/vendors/${id}`,         navTarget: { stack: 'Vendors',        screen: 'VendorDetail'    } },
  item:      { label: 'Item',      icon: 'cube',          color: '#ec4899', endpoint: id => `/api/items/${id}`,           navTarget: { stack: 'Items',          screen: 'ItemForm'        } },
  bill:      { label: 'Bill',      icon: 'receipt',       color: '#10b981', endpoint: id => `/api/purchase-bills/${id}`,  navTarget: { stack: 'Purchase',       screen: 'PBDetail'        } },
  po:        { label: 'PO',        icon: 'cart',          color: '#0891b2', endpoint: id => `/api/purchase-orders/${id}`, navTarget: { stack: 'PurchaseOrders', screen: 'PODetail'        } },
  task:      { label: 'Task',      icon: 'checkmark-done',color: '#14b8a6', endpoint: id => `/api/tasks/${id}`,           navTarget: { stack: 'Tasks',          screen: 'TaskDetail'      } },
  employee:  { label: 'Employee',  icon: 'people',        color: '#a855f7', endpoint: id => `/api/employees/${id}`,       navTarget: { stack: 'Employees',      screen: 'EmployeeDetail'  } },
};

const SCREEN_H = Dimensions.get('window').height;

export function PreviewProvider({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [req, setReq] = useState<PreviewRequest | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const overlay = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const show = useCallback((r: PreviewRequest) => {
    haptic.medium();
    setReq(r);
    setData(null);
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(overlay, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.92, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      setOpen(false);
      setReq(null);
      setData(null);
    });
  }, []);

  useEffect(() => {
    if (open) {
      overlay.setValue(0);
      opacity.setValue(0);
      scale.setValue(0.92);
      Animated.parallel([
        Animated.timing(overlay, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 8, tension: 80, useNativeDriver: true }),
      ]).start();
    }
  }, [open]);

  useEffect(() => {
    if (!req) return;
    const meta = TYPE_META[req.type];
    setLoading(true);
    api.get(meta.endpoint(req.id))
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [req]);

  const openFull = () => {
    if (!req) return;
    haptic.selection();
    const meta = TYPE_META[req.type];
    hide();
    setTimeout(() => {
      try {
        navigation.navigate(meta.navTarget.stack, { screen: meta.navTarget.screen, params: { id: req.id } });
      } catch {}
    }, 200);
  };

  return (
    <PreviewContext.Provider value={{ show, hide }}>
      {children}
      <Modal visible={open} transparent animationType="none" onRequestClose={hide} statusBarTranslucent>
        <Pressable style={StyleSheet.absoluteFill} onPress={hide}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)', opacity: overlay }]} />
        </Pressable>
        <View style={styles.center} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.card,
              { maxHeight: SCREEN_H * 0.7, opacity, transform: [{ scale }] },
            ]}
          >
            {req && <PreviewBody req={req} data={data} loading={loading} onOpen={openFull} onClose={hide} />}
          </Animated.View>
        </View>
      </Modal>
    </PreviewContext.Provider>
  );
}

function PreviewBody({ req, data, loading, onOpen, onClose }: {
  req: PreviewRequest;
  data: any;
  loading: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const meta = TYPE_META[req.type];

  return (
    <View style={{ flex: 1 }}>
      {/* Header strip */}
      <View style={[styles.header, { backgroundColor: meta.color + '12' }]}>
        <View style={[styles.iconDisc, { backgroundColor: meta.color }]}>
          <Ionicons name={meta.icon} size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerLabel, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{getTitle(req.type, data) || 'Preview'}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={22} color={colors.gray600} />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {loading && !data ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={meta.color} />
            <Text style={{ marginTop: 10, color: colors.gray500, fontSize: fontSize.sm }}>Loading…</Text>
          </View>
        ) : !data ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.gray400} />
            <Text style={{ marginTop: 8, color: colors.gray500 }}>Couldn't load preview</Text>
          </View>
        ) : (
          <PreviewContent type={req.type} data={data} color={meta.color} />
        )}
      </ScrollView>

      {/* Action footer */}
      <View style={styles.footer}>
        <Pressable onPress={onClose} style={[styles.btn, styles.btnGhost]}>
          <Text style={styles.btnGhostText}>Close</Text>
        </Pressable>
        <Pressable onPress={onOpen} style={[styles.btn, styles.btnPrimary, { backgroundColor: meta.color }]}>
          <Text style={styles.btnPrimaryText}>Open</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

function getTitle(type: PreviewType, data: any): string {
  if (!data) return '';
  switch (type) {
    case 'invoice':   return data.invoice_number || '';
    case 'quotation': return data.quotation_number || '';
    case 'customer':  return data.contact_person || data.business_name || 'Customer';
    case 'vendor':    return data.contact_person || data.business_name || 'Vendor';
    case 'item':      return data.item_name || 'Item';
    case 'bill':      return data.bill_number || '';
    case 'po':        return data.po_number || '';
    case 'task':      return data.title || 'Task';
    case 'employee':  return data.name || 'Employee';
  }
}

function PreviewContent({ type, data, color }: { type: PreviewType; data: any; color: string }) {
  const Row = ({ label, value }: { label: string; value?: any }) => {
    if (value === null || value === undefined || value === '') return null;
    return (
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={2}>{String(value)}</Text>
      </View>
    );
  };

  const fmtMoney = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

  switch (type) {
    case 'invoice':
    case 'quotation': {
      const items = data.items || [];
      return (
        <View>
          <View style={styles.amountHero}>
            <Text style={styles.amountLabel}>Total</Text>
            <Text style={[styles.amountValue, { color }]}>{fmtMoney(data.total)}</Text>
            {data.balance_due !== undefined && Number(data.balance_due) > 0 && (
              <Text style={styles.amountSub}>Balance: {fmtMoney(data.balance_due)}</Text>
            )}
            <View style={[styles.statusPill, { backgroundColor: color + '18' }]}>
              <Text style={[styles.statusPillText, { color }]}>{data.status}</Text>
            </View>
          </View>
          <Row label={type === 'invoice' ? 'Customer' : 'Customer'} value={data.customer_name} />
          <Row label="Date" value={fmtDate(data.invoice_date || data.quotation_date)} />
          <Row label={type === 'invoice' ? 'Due' : 'Valid until'} value={fmtDate(data.due_date || data.valid_until)} />
          {items.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.sectionLabel}>Items ({items.length})</Text>
              {items.slice(0, 4).map((it: any, i: number) => (
                <View key={i} style={styles.itemRow}>
                  <Text style={styles.itemName} numberOfLines={1}>{it.item_name}</Text>
                  <Text style={styles.itemQty}>{it.qty} × {fmtMoney(it.rate)}</Text>
                </View>
              ))}
              {items.length > 4 && <Text style={styles.itemMore}>+{items.length - 4} more</Text>}
            </View>
          )}
        </View>
      );
    }
    case 'customer':
    case 'vendor':
      return (
        <View>
          <Row label="Business" value={data.business_name} />
          <Row label="Type" value={data.type} />
          <Row label="Mobile" value={data.mobile} />
          <Row label="Email" value={data.email} />
          <Row label="GST" value={data.gst_number} />
          <Row label="PAN" value={data.pan} />
          <Row label="Address" value={data.address} />
        </View>
      );
    case 'item':
      return (
        <View>
          <View style={styles.amountHero}>
            <Text style={styles.amountLabel}>Sale price</Text>
            <Text style={[styles.amountValue, { color }]}>{fmtMoney(data.sale_price)}</Text>
            {data.offer_price && <Text style={styles.amountSub}>Offer: {fmtMoney(data.offer_price)}</Text>}
          </View>
          <Row label="Type" value={data.type} />
          <Row label="Unit" value={data.unit} />
          <Row label="Tax %" value={data.tax_rate ? `${data.tax_rate}%` : ''} />
          <Row label="HSN" value={data.hsn_code} />
          <Row label="Stock" value={data.stock} />
          <Row label="Model" value={data.model_number} />
          <Row label="Description" value={data.description} />
        </View>
      );
    case 'bill':
      return (
        <View>
          <View style={styles.amountHero}>
            <Text style={styles.amountLabel}>Total</Text>
            <Text style={[styles.amountValue, { color }]}>{fmtMoney(data.total)}</Text>
            {Number(data.balance_due || 0) > 0 && <Text style={styles.amountSub}>Payable: {fmtMoney(data.balance_due)}</Text>}
            <View style={[styles.statusPill, { backgroundColor: color + '18' }]}>
              <Text style={[styles.statusPillText, { color }]}>{data.status}</Text>
            </View>
          </View>
          <Row label="Vendor" value={data.vendor_name} />
          <Row label="Bill date" value={fmtDate(data.bill_date)} />
          <Row label="Due" value={fmtDate(data.due_date)} />
        </View>
      );
    case 'po':
      return (
        <View>
          <View style={styles.amountHero}>
            <Text style={styles.amountLabel}>Total</Text>
            <Text style={[styles.amountValue, { color }]}>{fmtMoney(data.total)}</Text>
            <View style={[styles.statusPill, { backgroundColor: color + '18' }]}>
              <Text style={[styles.statusPillText, { color }]}>{data.status}</Text>
            </View>
          </View>
          <Row label="Vendor" value={data.vendor_name} />
          <Row label="PO date" value={fmtDate(data.po_date)} />
          <Row label="Valid until" value={fmtDate(data.valid_until)} />
        </View>
      );
    case 'task':
      return (
        <View>
          <Row label="Status" value={data.status} />
          <Row label="Priority" value={data.priority} />
          <Row label="Customer" value={data.customer_name} />
          <Row label="Mobile" value={data.mobile} />
          <Row label="Date" value={fmtDate(data.task_date)} />
          <Row label="Time" value={data.task_time} />
          <Row label="Assigned" value={data.employee_name} />
          <Row label="Description" value={data.description} />
        </View>
      );
    case 'employee':
      return (
        <View>
          <View style={styles.amountHero}>
            <Text style={styles.amountLabel}>Salary ({data.salary_type})</Text>
            <Text style={[styles.amountValue, { color }]}>{fmtMoney(data.salary_amount)}</Text>
            <View style={[styles.statusPill, { backgroundColor: color + '18' }]}>
              <Text style={[styles.statusPillText, { color }]}>{data.status}</Text>
            </View>
          </View>
          <Row label="Mobile" value={data.mobile} />
          <Row label="Email" value={data.email} />
          <Row label="Joined" value={fmtDate(data.joining_date)} />
          <Row label="PAN" value={data.pan} />
        </View>
      );
  }
}

const styles = StyleSheet.create({
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  card: {
    width: '100%', maxWidth: 480,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  iconDisc: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text, marginTop: 2 },
  amountHero: {
    alignItems: 'center', paddingVertical: 16,
    backgroundColor: colors.gray50, borderRadius: 14, marginBottom: 12,
  },
  amountLabel: { fontSize: fontSize.xs, fontWeight: '700', color: colors.gray500, letterSpacing: 0.5, textTransform: 'uppercase' },
  amountValue: { fontSize: 28, fontWeight: '900', marginTop: 4 },
  amountSub: { fontSize: fontSize.sm, color: colors.gray600, marginTop: 4 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, marginTop: 8 },
  statusPillText: { fontSize: 11, fontWeight: '800' },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, gap: 12,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  rowLabel: { fontSize: fontSize.sm, color: colors.gray500, fontWeight: '600' },
  rowValue: { flex: 1, fontSize: fontSize.sm, color: colors.text, fontWeight: '600', textAlign: 'right' },
  sectionLabel: { fontSize: fontSize.xs, fontWeight: '800', color: colors.gray500, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, gap: 12,
  },
  itemName: { flex: 1, fontSize: fontSize.sm, color: colors.text, fontWeight: '600' },
  itemQty: { fontSize: fontSize.sm, color: colors.gray600 },
  itemMore: { fontSize: fontSize.xs, color: colors.gray500, fontStyle: 'italic', marginTop: 4 },
  footer: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: colors.gray100,
  },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  btnGhost: { backgroundColor: colors.gray100 },
  btnGhostText: { color: colors.gray700, fontWeight: '700', fontSize: fontSize.sm },
  btnPrimary: {},
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: fontSize.sm },
});
