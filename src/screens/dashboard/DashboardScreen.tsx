import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../auth/AuthContext';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import CurrencyText from '../../components/CurrencyText';
import StatusBadge from '../../components/StatusBadge';
import DateInput from '../../components/DateInput';
import ThemedRefreshControl from '../../components/ThemedRefreshControl';
import { SkeletonStats, SkeletonCard } from '../../components/Skeleton';

export default function DashboardScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const nav = useNavigation<any>();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [purchaseSummary, setPurchaseSummary] = useState<any>(null);
  const [expenseSummary, setExpenseSummary] = useState<any>(null);
  const [todayExpense, setTodayExpense] = useState<{ total: number; count: number }>({ total: 0, count: 0 });
  const [revenue, setRevenue] = useState<{ sales: number; purchases: number }>({ sales: 0, purchases: 0 });
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [revModalOpen, setRevModalOpen] = useState(false);
  const [invModalOpen, setInvModalOpen] = useState(false);
  // Period: type=month|year|custom, plus month/year/from/to
  const today = new Date();
  const [period, setPeriod] = useState<{
    type: 'month' | 'year' | 'custom';
    month: number; year: number;
    from: string; to: string;
  }>({
    type: 'month',
    month: today.getMonth() + 1,
    year: today.getFullYear(),
    from: '',
    to: '',
  });
  const [invPeriod, setInvPeriod] = useState<{
    type: 'month' | 'year' | 'custom';
    month: number; year: number;
    from: string; to: string;
  }>({
    type: 'month',
    month: today.getMonth() + 1,
    year: today.getFullYear(),
    from: '',
    to: '',
  });
  const [gstData, setGstData] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [vendorCount, setVendorCount] = useState(0);
  const [itemCount, setItemCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Helpers
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const periodRange = useMemo(() => {
    if (period.type === 'month') {
      const last = new Date(period.year, period.month, 0).getDate();
      return {
        from: `${period.year}-${pad2(period.month)}-01`,
        to: `${period.year}-${pad2(period.month)}-${pad2(last)}`,
      };
    }
    if (period.type === 'year') {
      return { from: `${period.year}-01-01`, to: `${period.year}-12-31` };
    }
    return { from: period.from, to: period.to };
  }, [period]);

  const periodLabel = useMemo(() => {
    if (period.type === 'month') return `${monthLabels[period.month - 1]} ${period.year}`;
    if (period.type === 'year') return `Year ${period.year}`;
    if (period.from && period.to) return `${period.from} → ${period.to}`;
    return 'Custom';
  }, [period]);

  const invRange = useMemo(() => {
    if (invPeriod.type === 'month') {
      const last = new Date(invPeriod.year, invPeriod.month, 0).getDate();
      return {
        from: `${invPeriod.year}-${pad2(invPeriod.month)}-01`,
        to: `${invPeriod.year}-${pad2(invPeriod.month)}-${pad2(last)}`,
      };
    }
    if (invPeriod.type === 'year') {
      return { from: `${invPeriod.year}-01-01`, to: `${invPeriod.year}-12-31` };
    }
    return { from: invPeriod.from, to: invPeriod.to };
  }, [invPeriod]);

  const invPeriodLabel = useMemo(() => {
    if (invPeriod.type === 'month') return `${monthLabels[invPeriod.month - 1]} ${invPeriod.year}`;
    if (invPeriod.type === 'year') return `Year ${invPeriod.year}`;
    if (invPeriod.from && invPeriod.to) return `${invPeriod.from} → ${invPeriod.to}`;
    return 'Custom';
  }, [invPeriod]);

  const fetchData = useCallback(async () => {
    try {
      const bizRes = await api.get('/api/business');
      setBusinesses(bizRes.data);
      const oid = bizRes.data[0]?.org_id;
      if (oid) {
        const [sumRes, purchRes, expRes, todayExpRes, invRes, custRes, vendRes, itemRes, taskRes, gstRes] =
          await Promise.all([
            api.get(`/api/reports/summary?org_id=${oid}`),
            api.get(`/api/reports/purchase-summary?org_id=${oid}`),
            api.get(`/api/reports/expense-summary?org_id=${oid}`),
            api.get(`/api/reports/expense-summary?org_id=${oid}&date_from=${todayStr}&date_to=${todayStr}`).catch(() => ({ data: null })),
            api.get(`/api/invoices?org_id=${oid}`),
            api.get(`/api/customers?org_id=${oid}`),
            api.get(`/api/vendors?org_id=${oid}`),
            api.get(`/api/items?org_id=${oid}`),
            api.get(`/api/tasks?org_id=${oid}`).catch(() => ({ data: [] })),
            api.get(`/api/gst/gstr3b?org_id=${oid}&month=${currentMonth}&year=${currentYear}`).catch(() => ({ data: null })),
          ]);
        setSummary(sumRes.data);
        setPurchaseSummary(purchRes.data);
        setExpenseSummary(expRes.data);
        setTodayExpense({
          total: todayExpRes.data?.total_expenses || 0,
          count: todayExpRes.data?.expense_count || 0,
        });
        const invList = Array.isArray(invRes.data) ? invRes.data : (invRes.data?.data || []);
        setInvoices(invList);
        setCustomerCount(Array.isArray(custRes.data) ? custRes.data.length : 0);
        setVendorCount(Array.isArray(vendRes.data) ? vendRes.data.length : 0);
        setItemCount(Array.isArray(itemRes.data) ? itemRes.data.length : 0);
        setTasks(Array.isArray(taskRes.data) ? taskRes.data : (taskRes.data?.data || []));
        setGstData(gstRes.data);
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch revenue for current period whenever period or org changes
  useEffect(() => {
    const oid = businesses[0]?.org_id;
    if (!oid) return;
    const { from, to } = periodRange;
    if (period.type === 'custom' && (!from || !to)) return;
    let cancelled = false;
    setRevenueLoading(true);
    Promise.all([
      api.get(`/api/reports/summary?org_id=${oid}&date_from=${from}&date_to=${to}`).catch(() => ({ data: {} })),
      api.get(`/api/reports/purchase-summary?org_id=${oid}&date_from=${from}&date_to=${to}`).catch(() => ({ data: {} })),
    ]).then(([s, p]) => {
      if (cancelled) return;
      setRevenue({
        sales: s.data?.total_invoiced || 0,
        purchases: p.data?.total_billed || 0,
      });
    }).finally(() => { if (!cancelled) setRevenueLoading(false); });
    return () => { cancelled = true; };
  }, [businesses, period, periodRange.from, periodRange.to]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // ── Memos (must run on every render before any early return) ─────────────
  const invList: any[] = Array.isArray(invoices) ? invoices : [];

  const filteredInvoices = useMemo(() => {
    if (invPeriod.type === 'custom' && (!invRange.from || !invRange.to)) return invList;
    return invList.filter((inv: any) => {
      const d = (inv.invoice_date || '').slice(0, 10);
      return d >= invRange.from && d <= invRange.to;
    });
  }, [invList, invPeriod, invRange.from, invRange.to]);

  const filteredStatusCounts: Record<string, number> = useMemo(() => {
    const out: Record<string, number> = {};
    filteredInvoices.forEach((inv: any) => {
      out[inv.status] = (out[inv.status] || 0) + 1;
    });
    return out;
  }, [filteredInvoices]);
  const filteredTotal = useMemo(
    () => filteredInvoices.reduce((s: number, i: any) => s + (Number(i.total) || 0), 0),
    [filteredInvoices]
  );
  const recentFiltered = useMemo(
    () => [...filteredInvoices].sort((a: any, b: any) => (b.invoice_date || '').localeCompare(a.invoice_date || '')).slice(0, 5),
    [filteredInvoices]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!businesses.length) {
    return (
      <View style={styles.center}>
        <Ionicons name="business-outline" size={64} color={colors.gray300} />
        <Text style={styles.emptyTitle}>Welcome to BillFlow!</Text>
        <Text style={styles.emptyDesc}>Set up your business to get started</Text>
        <TouchableOpacity style={styles.setupBtn} onPress={() => navigation.navigate('Onboarding')}>
          <Text style={styles.setupBtnText}>Setup Business</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Bento KPI cards — receivables/payables (large), then expenses/stock/customers (small)
  const receivables = summary?.total_outstanding || 0;
  const payables = purchaseSummary?.total_payable || 0;

  // Recent 5
  const recentTasks = Array.isArray(tasks) ? tasks.slice(0, 5) : [];

  // Greeting (time-based)
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const bizName = businesses[0]?.business_name || 'Welcome';
  const bizInitial = bizName.trim().charAt(0).toUpperCase();

  const navigateToTab = (tabName: string) => {
    try {
      // Reset target stack to its root list screen (avoids landing on a previously-pushed form)
      const rootScreens: Record<string, string> = {
        Invoices: 'InvoiceList',
        Expenses: 'ExpenseList',
        Customers: 'CustomerList',
        Items: 'ItemList',
        Quotations: 'QuotationList',
        Vendors: 'VendorList',
        PurchaseOrders: 'POList',
        PurchaseBills: 'PBList',
        Employees: 'EmployeeList',
        Payroll: 'PayrollHome',
        Payments: 'PaymentList',
        PurchasePayments: 'PurchasePaymentList',
        Reports: 'ReportsHome',
        Settings: 'SettingsHome',
        Notifications: 'NotificationsHome',
        Tasks: 'TaskList',
        Inventory: 'InventoryHome',
        Business: 'BusinessList',
        GST: 'GSTHome',
      };
      const screen = rootScreens[tabName];
      if (screen) {
        navigation.getParent()?.navigate(tabName, { screen });
      } else {
        navigation.getParent()?.navigate(tabName);
      }
    } catch {}
  };

  const openCreate = (tabName: string, screen: string) => {
    try {
      navigation.getParent()?.navigate(tabName, { screen });
    } catch {}
  };

  const priorityColor = (p: string) => {
    switch (p) {
      case 'Urgent': return colors.danger;
      case 'High': return '#f97316';
      case 'Medium': return colors.warning;
      default: return colors.info;
    }
  };

  // Task helpers
  const taskStatusCounts: Record<string, number> = {};
  (Array.isArray(tasks) ? tasks : []).forEach((t: any) => {
    taskStatusCounts[t.status] = (taskStatusCounts[t.status] || 0) + 1;
  });

  const dueChip = (task: any): { text: string; bg: string; fg: string; icon: any } => {
    const d = task.due_date || task.task_date;
    if (!d) return { text: 'No due', bg: '#f3f4f6', fg: colors.gray500, icon: 'time-outline' };
    const due = new Date(d);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
    if (task.status === 'Completed') return { text: 'Done', bg: '#dcfce7', fg: '#16a34a', icon: 'checkmark-circle' };
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, bg: '#fee2e2', fg: '#dc2626', icon: 'alert-circle' };
    if (diff === 0) return { text: 'Due today', bg: '#fef3c7', fg: '#b45309', icon: 'flame' };
    if (diff === 1) return { text: 'Tomorrow', bg: '#fef3c7', fg: '#b45309', icon: 'time' };
    if (diff <= 7) return { text: `In ${diff}d`, bg: '#dbeafe', fg: '#1d4ed8', icon: 'time-outline' };
    return { text: due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), bg: '#f3f4f6', fg: colors.gray500, icon: 'calendar-outline' };
  };

  const taskInitial = (task: any) => {
    const n = task.employee_name || task.customer_name || 'U';
    return String(n).trim().charAt(0).toUpperCase();
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero — greeting + business avatar */}
      <View style={styles.hero}>
        <View style={styles.heroBgAccent} />
        <View style={styles.heroBgAccent2} />
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroGreeting}>{greeting}</Text>
            <Text style={styles.heroBiz} numberOfLines={1}>{bizName}</Text>
            <View style={styles.heroDateChip}>
              <Ionicons name="calendar-outline" size={11} color="rgba(255,255,255,0.85)" />
              <Text style={styles.heroDateText}>
                {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.heroAvatar}
            activeOpacity={0.8}
            onPress={() => navigateToTab('Settings')}
          >
            <Text style={styles.heroAvatarText}>{bizInitial}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick actions */}
      <View style={styles.quickRow}>
        {[
          { label: 'Invoice', icon: 'document-text' as const, color: '#4f46e5', onPress: () => navigateToTab('Invoices') },
          { label: 'Expense', icon: 'receipt' as const, color: '#f59e0b', onPress: () => openCreate('Expenses', 'ExpenseList') },
          { label: 'Payment', icon: 'cash' as const, color: '#10b981', onPress: () => navigateToTab('Payments') },
          { label: 'Task', icon: 'checkbox' as const, color: '#0ea5e9', onPress: () => openCreate('Tasks', 'TaskForm') },
        ].map(q => (
          <TouchableOpacity key={q.label} style={styles.quickBtn} activeOpacity={0.75} onPress={q.onPress}>
            <View style={[styles.quickIconWrap, { backgroundColor: q.color + '15' }]}>
              <Ionicons name={q.icon} size={20} color={q.color} />
            </View>
            <Text style={styles.quickLabel}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bento KPI Grid */}
      <View style={styles.bento}>
        {/* Row 1 — two big cards */}
        <View style={styles.bentoRow}>
          <TouchableOpacity
            style={[styles.bentoBig, { backgroundColor: '#10B981' }]}
            activeOpacity={0.85}
            onPress={() => navigateToTab('Payments')}
          >
            <View style={styles.bentoBigHeader}>
              <View style={styles.bentoChip}>
                <Ionicons name="arrow-down-circle-outline" size={14} color="#ffffff" />
                <Text style={styles.bentoChipText}>Receivable</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
            </View>
            <Text style={styles.bentoBigLabel}>Total Receivables</Text>
            <CurrencyText amount={receivables} style={styles.bentoBigValue} />
            <Text style={styles.bentoBigFoot}>From customers</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bentoBig, { backgroundColor: '#EF4444' }]}
            activeOpacity={0.85}
            onPress={() => navigateToTab('PurchasePayments')}
          >
            <View style={styles.bentoBigHeader}>
              <View style={styles.bentoChip}>
                <Ionicons name="arrow-up-circle-outline" size={14} color="#ffffff" />
                <Text style={styles.bentoChipText}>Payable</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
            </View>
            <Text style={styles.bentoBigLabel}>Total Payables</Text>
            <CurrencyText amount={payables} style={styles.bentoBigValue} />
            <Text style={styles.bentoBigFoot}>To vendors</Text>
          </TouchableOpacity>
        </View>

        {/* Row 2 — three small cards */}
        <View style={styles.bentoRow}>
          <TouchableOpacity style={styles.bentoSmall} activeOpacity={0.85} onPress={() => navigateToTab('Expenses')}>
            <View style={[styles.bentoSmallIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="receipt-outline" size={18} color="#D97706" />
            </View>
            <Text style={styles.bentoSmallLabel}>Today's Expenses</Text>
            <CurrencyText amount={todayExpense.total} style={styles.bentoSmallValue} />
            <Text style={styles.bentoSmallHint}>{todayExpense.count} {todayExpense.count === 1 ? 'entry' : 'entries'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bentoSmall} activeOpacity={0.85} onPress={() => navigateToTab('Items')}>
            <View style={[styles.bentoSmallIcon, { backgroundColor: '#CCFBF1' }]}>
              <Ionicons name="cube-outline" size={18} color="#0F766E" />
            </View>
            <Text style={styles.bentoSmallLabel}>Stock Items</Text>
            <Text style={styles.bentoSmallValue}>{itemCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bentoSmall} activeOpacity={0.85} onPress={() => navigateToTab('Customers')}>
            <View style={[styles.bentoSmallIcon, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="people-outline" size={18} color="#1D4ED8" />
            </View>
            <Text style={styles.bentoSmallLabel}>Customers</Text>
            <Text style={styles.bentoSmallValue}>{customerCount}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Revenue Overview — selectable period */}
      <View style={styles.section}>
        <View style={styles.revHeader}>
          <View>
            <Text style={styles.sectionTitle}>Revenue Overview</Text>
            <Text style={styles.revPeriodText}>{periodLabel}</Text>
          </View>
          <TouchableOpacity style={styles.revFilterBtn} onPress={() => setRevModalOpen(true)} activeOpacity={0.8}>
            <Ionicons name="options-outline" size={14} color={colors.primary} />
            <Text style={styles.revFilterText}>Filter</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          {(() => {
            const max = Math.max(revenue.sales, revenue.purchases, 1);
            const net = revenue.sales - revenue.purchases;
            return (
              <>
                <View style={styles.revenueRow}>
                  <View style={styles.revItem}>
                    <View style={styles.revLabelRow}>
                      <View style={[styles.revDot, { backgroundColor: '#3b82f6' }]} />
                      <Text style={styles.revLabel}>Sales</Text>
                    </View>
                    <CurrencyText amount={revenue.sales} style={styles.revValue} />
                    <View style={styles.barBg}>
                      <View style={[styles.bar, { width: `${(revenue.sales / max) * 100}%`, backgroundColor: '#3b82f6' }]} />
                    </View>
                  </View>
                  <View style={styles.revItem}>
                    <View style={styles.revLabelRow}>
                      <View style={[styles.revDot, { backgroundColor: '#ef4444' }]} />
                      <Text style={styles.revLabel}>Purchases</Text>
                    </View>
                    <CurrencyText amount={revenue.purchases} style={styles.revValue} />
                    <View style={styles.barBg}>
                      <View style={[styles.bar, { width: `${(revenue.purchases / max) * 100}%`, backgroundColor: '#ef4444' }]} />
                    </View>
                  </View>
                </View>
                <View style={styles.netRow}>
                  <Text style={styles.netLabel}>Net</Text>
                  <CurrencyText amount={net} style={[styles.netValue, { color: net >= 0 ? '#10B981' : '#EF4444' }]} />
                </View>
                {revenueLoading && <Text style={styles.revLoadingText}>Updating…</Text>}
              </>
            );
          })()}
        </View>
      </View>

      {/* Invoices — unified creative card */}
      <View style={styles.section}>
        <View style={styles.revHeader}>
          <View>
            <Text style={styles.sectionTitle}>Invoices</Text>
            <Text style={styles.revPeriodText}>{invPeriodLabel}</Text>
          </View>
          <TouchableOpacity style={styles.revFilterBtn} onPress={() => setInvModalOpen(true)} activeOpacity={0.8}>
            <Ionicons name="options-outline" size={14} color={colors.primary} />
            <Text style={styles.revFilterText}>Filter</Text>
          </TouchableOpacity>
        </View>

        {/* All-invoices hero chip */}
        <TouchableOpacity
          style={styles.invHero}
          activeOpacity={0.85}
          onPress={() => navigateToTab('Invoices')}
        >
          <View style={styles.invHeroIconWrap}>
            <Ionicons name="document-text" size={22} color="#ffffff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.invHeroLabel}>All Invoices</Text>
            <View style={styles.invHeroValueRow}>
              <Text style={styles.invHeroCount}>{filteredInvoices.length}</Text>
              <Text style={styles.invHeroSep}>•</Text>
              <CurrencyText amount={filteredTotal} style={styles.invHeroAmount} />
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        {/* Status chips */}
        <View style={styles.statusGrid}>
          {[
            { key: 'Draft', label: 'Drafted', color: '#6B7280', bg: '#F3F4F6', icon: 'create-outline' },
            { key: 'Sent', label: 'Sent', color: '#2563EB', bg: '#DBEAFE', icon: 'send-outline' },
            { key: 'Paid', label: 'Paid', color: '#059669', bg: '#D1FAE5', icon: 'checkmark-circle-outline' },
            { key: 'Partially Paid', label: 'Partial', color: '#D97706', bg: '#FEF3C7', icon: 'time-outline' },
            { key: 'Overdue', label: 'Overdue', color: '#DC2626', bg: '#FEE2E2', icon: 'alert-circle-outline' },
          ].map(s => (
            <View key={s.key} style={styles.statusChip}>
              <View style={[styles.statusChipIcon, { backgroundColor: s.bg }]}>
                <Ionicons name={s.icon as any} size={14} color={s.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statusChipLabel}>{s.label}</Text>
                <Text style={[styles.statusChipCount, { color: s.color }]}>{filteredStatusCounts[s.key] || 0}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Recent 5 within period */}
        <View style={styles.recentBlock}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>Recent</Text>
            {filteredInvoices.length > 5 && (
              <TouchableOpacity onPress={() => navigateToTab('Invoices')}>
                <Text style={styles.viewAll}>View all</Text>
              </TouchableOpacity>
            )}
          </View>
          {recentFiltered.length === 0 ? (
            <View style={styles.recentEmpty}>
              <Ionicons name="document-outline" size={28} color={colors.gray300} />
              <Text style={styles.noData}>No invoices in this period</Text>
            </View>
          ) : (
            recentFiltered.map((inv: any) => (
              <TouchableOpacity
                key={inv.id}
                style={styles.invMiniRow}
                activeOpacity={0.7}
                onPress={() =>
                  navigation.getParent()?.navigate('Invoices', {
                    screen: 'InvoiceDetail',
                    params: { id: inv.id },
                  })
                }
              >
                <View style={styles.invMiniBullet} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.invMiniNumber}>{inv.invoice_number}</Text>
                  <Text style={styles.invMiniSub} numberOfLines={1}>{inv.customer_name || 'N/A'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <CurrencyText amount={inv.total} style={styles.invMiniAmount} />
                  <StatusBadge status={inv.status} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      {/* GST Summary intentionally removed — see /gst tab */}

      {/* Tasks — creative ticket style */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.sectionTitle}>Recent Tasks</Text>
            {tasks.length > 0 && (
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{tasks.length}</Text>
              </View>
            )}
          </View>
          {tasks.length > 5 && (
            <TouchableOpacity onPress={() => navigateToTab('Tasks')}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Status summary strip */}
        {tasks.length > 0 && (
          <View style={styles.taskStatRow}>
            {[
              { key: 'Pending', label: 'Pending', color: '#6b7280', icon: 'ellipse-outline' as const },
              { key: 'In Progress', label: 'Active', color: '#2563eb', icon: 'play-circle' as const },
              { key: 'Completed', label: 'Done', color: '#16a34a', icon: 'checkmark-circle' as const },
              { key: 'Delayed', label: 'Delayed', color: '#dc2626', icon: 'alert-circle' as const },
            ].map(s => (
              <View key={s.key} style={styles.taskStatChip}>
                <Ionicons name={s.icon} size={14} color={s.color} />
                <Text style={styles.taskStatLabel}>{s.label}</Text>
                <Text style={[styles.taskStatCount, { color: s.color }]}>{taskStatusCounts[s.key] || 0}</Text>
              </View>
            ))}
          </View>
        )}

        {recentTasks.length === 0 ? (
          <View style={styles.tasksEmpty}>
            <Ionicons name="clipboard-outline" size={36} color={colors.gray300} />
            <Text style={styles.noData}>No tasks yet</Text>
          </View>
        ) : (
          recentTasks.map((task: any) => {
            const chip = dueChip(task);
            const pColor = priorityColor(task.priority);
            return (
              <TouchableOpacity
                key={task.id}
                style={styles.ticket}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.getParent()?.navigate('Tasks', {
                    screen: 'TaskDetail',
                    params: { id: task.id },
                  })
                }
              >
                <View style={[styles.ticketStrip, { backgroundColor: pColor }]} />
                <View style={styles.ticketBody}>
                  <View style={styles.ticketTopRow}>
                    <View style={[styles.avatar, { backgroundColor: pColor + '22', borderColor: pColor }]}>
                      <Text style={[styles.avatarText, { color: pColor }]}>{taskInitial(task)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ticketTitle} numberOfLines={1}>{task.title}</Text>
                      <View style={styles.ticketMeta}>
                        {task.employee_name ? (
                          <View style={styles.metaItem}>
                            <Ionicons name="person-outline" size={11} color={colors.gray500} />
                            <Text style={styles.metaText} numberOfLines={1}>{task.employee_name}</Text>
                          </View>
                        ) : null}
                        {task.customer_name ? (
                          <View style={styles.metaItem}>
                            <Ionicons name="business-outline" size={11} color={colors.gray500} />
                            <Text style={styles.metaText} numberOfLines={1}>{task.customer_name}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <StatusBadge status={task.status} />
                  </View>
                  <View style={styles.ticketBottom}>
                    <View style={[styles.priorityTag, { backgroundColor: pColor + '15' }]}>
                      <View style={[styles.priorityDot, { backgroundColor: pColor }]} />
                      <Text style={[styles.priorityTagText, { color: pColor }]}>{task.priority}</Text>
                    </View>
                    <View style={[styles.dueChip, { backgroundColor: chip.bg }]}>
                      <Ionicons name={chip.icon} size={11} color={chip.fg} />
                      <Text style={[styles.dueChipText, { color: chip.fg }]}>{chip.text}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={{ height: 40 }} />

      {/* Period picker modal */}
      <Modal visible={revModalOpen} transparent animationType="slide" onRequestClose={() => setRevModalOpen(false)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setRevModalOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Period</Text>

            <View style={styles.tabRow}>
              {(['month', 'year', 'custom'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.tab, period.type === t && styles.tabActive]}
                  onPress={() => setPeriod(p => ({ ...p, type: t }))}
                >
                  <Text style={[styles.tabText, period.type === t && styles.tabTextActive]}>
                    {t === 'month' ? 'Month' : t === 'year' ? 'Year' : 'Custom'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {period.type === 'month' && (
              <>
                <Text style={styles.fieldLabel}>Year</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setPeriod(p => ({ ...p, year: p.year - 1 }))}>
                    <Ionicons name="chevron-back" size={18} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.stepValue}>{period.year}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setPeriod(p => ({ ...p, year: p.year + 1 }))}>
                    <Ionicons name="chevron-forward" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.fieldLabel}>Month</Text>
                <View style={styles.monthGrid}>
                  {monthLabels.map((m, i) => {
                    const sel = period.month === i + 1;
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[styles.monthChip, sel && styles.monthChipActive]}
                        onPress={() => setPeriod(p => ({ ...p, month: i + 1 }))}
                      >
                        <Text style={[styles.monthChipText, sel && styles.monthChipTextActive]}>{m}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {period.type === 'year' && (
              <>
                <Text style={styles.fieldLabel}>Year</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setPeriod(p => ({ ...p, year: p.year - 1 }))}>
                    <Ionicons name="chevron-back" size={18} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.stepValue}>{period.year}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setPeriod(p => ({ ...p, year: p.year + 1 }))}>
                    <Ionicons name="chevron-forward" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </>
            )}

            {period.type === 'custom' && (
              <>
                <Text style={styles.fieldLabel}>From</Text>
                <DateInput value={period.from} onChange={(d) => setPeriod(p => ({ ...p, from: d }))} placeholder="Start date" />
                <View style={{ height: spacing.sm }} />
                <Text style={styles.fieldLabel}>To</Text>
                <DateInput value={period.to} onChange={(d) => setPeriod(p => ({ ...p, to: d }))} placeholder="End date" />
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.gray100 }]}
                onPress={() => setPeriod({ type: 'month', month: today.getMonth() + 1, year: today.getFullYear(), from: '', to: '' })}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary, flex: 2 }]}
                onPress={() => setRevModalOpen(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.white }]}>Apply</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Invoice period picker modal */}
      <Modal visible={invModalOpen} transparent animationType="slide" onRequestClose={() => setInvModalOpen(false)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setInvModalOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Filter Invoices</Text>

            <View style={styles.tabRow}>
              {(['month', 'year', 'custom'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.tab, invPeriod.type === t && styles.tabActive]}
                  onPress={() => setInvPeriod(p => ({ ...p, type: t }))}
                >
                  <Text style={[styles.tabText, invPeriod.type === t && styles.tabTextActive]}>
                    {t === 'month' ? 'Month' : t === 'year' ? 'Year' : 'Custom'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {invPeriod.type === 'month' && (
              <>
                <Text style={styles.fieldLabel}>Year</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setInvPeriod(p => ({ ...p, year: p.year - 1 }))}>
                    <Ionicons name="chevron-back" size={18} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.stepValue}>{invPeriod.year}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setInvPeriod(p => ({ ...p, year: p.year + 1 }))}>
                    <Ionicons name="chevron-forward" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.fieldLabel}>Month</Text>
                <View style={styles.monthGrid}>
                  {monthLabels.map((m, i) => {
                    const sel = invPeriod.month === i + 1;
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[styles.monthChip, sel && styles.monthChipActive]}
                        onPress={() => setInvPeriod(p => ({ ...p, month: i + 1 }))}
                      >
                        <Text style={[styles.monthChipText, sel && styles.monthChipTextActive]}>{m}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {invPeriod.type === 'year' && (
              <>
                <Text style={styles.fieldLabel}>Year</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setInvPeriod(p => ({ ...p, year: p.year - 1 }))}>
                    <Ionicons name="chevron-back" size={18} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.stepValue}>{invPeriod.year}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setInvPeriod(p => ({ ...p, year: p.year + 1 }))}>
                    <Ionicons name="chevron-forward" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </>
            )}

            {invPeriod.type === 'custom' && (
              <>
                <Text style={styles.fieldLabel}>From</Text>
                <DateInput value={invPeriod.from} onChange={(d) => setInvPeriod(p => ({ ...p, from: d }))} placeholder="Start date" />
                <View style={{ height: spacing.sm }} />
                <Text style={styles.fieldLabel}>To</Text>
                <DateInput value={invPeriod.to} onChange={(d) => setInvPeriod(p => ({ ...p, to: d }))} placeholder="End date" />
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.gray100 }]}
                onPress={() => setInvPeriod({ type: 'month', month: today.getMonth() + 1, year: today.getFullYear(), from: '', to: '' })}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary, flex: 2 }]}
                onPress={() => setInvModalOpen(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.white }]}>Apply</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: '#f6f7fb',
  },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.primary, marginTop: spacing.md },
  emptyDesc: { fontSize: fontSize.sm, color: colors.gray500, marginTop: spacing.xs },
  setupBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  setupBtnText: { color: colors.white, fontWeight: '600', fontSize: fontSize.md },

  // Hero greeting strip
  hero: {
    backgroundColor: colors.primary,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: 22,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md + 4,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  heroBgAccent: {
    position: 'absolute',
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -60, right: -40,
  },
  heroBgAccent2: {
    position: 'absolute',
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -30, left: -20,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroGreeting: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  heroBiz: { color: '#ffffff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  heroDateChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
  },
  heroDateText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600' },
  heroAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
  },
  heroAvatarText: { color: '#ffffff', fontSize: 18, fontWeight: '800' },

  // Quick actions
  quickRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  quickIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  quickLabel: { fontSize: 11, color: colors.gray700, fontWeight: '600' },


  // Bento KPI Grid
  bento: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  bentoRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  bentoBig: {
    flex: 1, borderRadius: 18, padding: spacing.md, minHeight: 130,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  bentoBigHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  bentoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999,
  },
  bentoChipText: { color: '#ffffff', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  bentoBigLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '500', marginBottom: 2 },
  bentoBigValue: { color: '#ffffff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  bentoBigFoot: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 4 },
  bentoSmall: {
    flex: 1, backgroundColor: colors.white, borderRadius: 16, padding: spacing.sm + 2,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  bentoSmallIcon: {
    width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  bentoSmallLabel: { fontSize: 11, color: colors.gray500, fontWeight: '500', marginBottom: 2 },
  bentoSmallValue: { fontSize: 15, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  bentoSmallHint: { fontSize: 10, color: colors.gray500, marginTop: 2 },

  // Revenue overview header + filter
  revHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.sm },
  revPeriodText: { fontSize: 11, color: colors.gray500, marginTop: 2, fontWeight: '500' },
  revFilterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: colors.primary + '12',
    borderRadius: 999,
  },
  revFilterText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  netRow: {
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.gray100,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  netLabel: { fontSize: 12, color: colors.gray500, fontWeight: '600' },
  netValue: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  revLoadingText: { marginTop: 6, fontSize: 10, color: colors.gray500, textAlign: 'right' },

  // Period modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xl,
  },
  modalHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.gray300, marginBottom: spacing.md },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  tabRow: { flexDirection: 'row', backgroundColor: colors.gray100, borderRadius: 10, padding: 4, marginBottom: spacing.md },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: colors.white, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  tabText: { fontSize: 13, color: colors.gray500, fontWeight: '600' },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  fieldLabel: { fontSize: 12, color: colors.gray500, fontWeight: '600', marginBottom: 6, marginTop: spacing.sm },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.gray100, borderRadius: 10, padding: 4 },
  stepBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  monthChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.gray100, minWidth: 56, alignItems: 'center' },
  monthChipActive: { backgroundColor: colors.primary },
  monthChipText: { fontSize: 12, color: colors.text, fontWeight: '600' },
  monthChipTextActive: { color: colors.white },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalBtnText: { fontSize: 14, fontWeight: '700' },

  // KPI Grid (legacy)
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
  kpiCard: {
    width: '30.5%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    margin: '1.4%',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  kpiLabel: { fontSize: 11, color: colors.gray500, marginBottom: 2 },
  kpiValue: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },

  // Section
  section: { paddingHorizontal: spacing.md, marginTop: spacing.lg },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  viewAll: { fontSize: fontSize.sm, color: colors.accent, fontWeight: '600' },

  // Invoice creative section
  invHero: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 18, padding: spacing.md,
    shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  invHeroIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  invHeroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', marginBottom: 2 },
  invHeroValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  invHeroCount: { color: '#ffffff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  invHeroSep: { color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '700' },
  invHeroAmount: { color: '#ffffff', fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },

  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    width: '48.5%',
    backgroundColor: colors.white,
    borderRadius: 12, padding: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  statusChipIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statusChipLabel: { fontSize: 10, color: colors.gray500, fontWeight: '600', letterSpacing: 0.2, textTransform: 'uppercase' },
  statusChipCount: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },

  recentBlock: {
    marginTop: spacing.md,
    backgroundColor: colors.white,
    borderRadius: 14, padding: spacing.sm + 2,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 6 },
  recentTitle: { fontSize: 12, fontWeight: '700', color: colors.gray500, letterSpacing: 0.4, textTransform: 'uppercase' },
  recentEmpty: { alignItems: 'center', paddingVertical: spacing.lg, gap: 6 },
  invMiniRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  invMiniBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  invMiniNumber: { fontSize: 13, fontWeight: '700', color: colors.text },
  invMiniSub: { fontSize: 11, color: colors.gray500, marginTop: 1 },
  invMiniAmount: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 4 },

  // Card
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  // Revenue
  revenueRow: { gap: spacing.md },
  revItem: { marginBottom: spacing.xs },
  revLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  revDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs },
  revLabel: { fontSize: fontSize.sm, color: colors.gray500 },
  revValue: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  barBg: {
    height: 8,
    backgroundColor: colors.gray100,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: { height: 8, borderRadius: 4 },

  // Invoice Status Pills
  statusRow: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.xs },
  statusPill: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    minWidth: 70,
  },
  statusPillCount: { fontSize: fontSize.lg, fontWeight: '700', color: colors.primary },
  statusPillLabel: { fontSize: 11, color: colors.gray500, marginTop: 2 },

  // GST
  gstRow: { flexDirection: 'row' },
  gstItem: { flex: 1, alignItems: 'center' },
  gstItemBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.gray100,
  },
  gstLabel: { fontSize: 11, color: colors.gray500, marginBottom: 4 },
  gstValue: { fontSize: fontSize.sm, fontWeight: '700' },

  // List cards
  listCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    alignItems: 'center',
  },
  listTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  listSub: { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },
  listAmount: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: 4 },

  // Tasks — creative ticket
  priorityStrip: { width: 4, borderRadius: 2, alignSelf: 'stretch' },
  countPill: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  countPillText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  taskStatRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.sm },
  taskStatChip: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 6,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  taskStatLabel: { fontSize: 10, color: colors.gray500, fontWeight: '600' },
  taskStatCount: { fontSize: 13, fontWeight: '800', marginLeft: 2 },
  tasksEmpty: { alignItems: 'center', paddingVertical: spacing.xl, gap: 8 },
  ticket: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  ticketStrip: { width: 4 },
  ticketBody: { flex: 1, padding: spacing.sm + 2, gap: 8 },
  ticketTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  avatarText: { fontSize: 14, fontWeight: '800' },
  ticketTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  ticketMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '60%' },
  metaText: { fontSize: 11, color: colors.gray500, fontWeight: '500' },
  ticketBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.gray100,
  },
  priorityTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  priorityTagText: { fontSize: 11, fontWeight: '700' },
  dueChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  dueChipText: { fontSize: 11, fontWeight: '700' },

  noData: { color: colors.gray400, fontSize: fontSize.sm },
});
