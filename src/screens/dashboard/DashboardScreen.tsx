import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Animated,
  Easing,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
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

  // Hero animation
  const heroFade = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(20)).current;
  const heroPulse = useRef(new Animated.Value(0)).current;
  const [animReceivables, setAnimReceivables] = useState(0);
  const [animPayables, setAnimPayables] = useState(0);
  const [heroPage, setHeroPage] = useState(0);
  const [heroSliderWidth, setHeroSliderWidth] = useState(0);
  const heroScrollRef = useRef<ScrollView>(null);
  const [invStatusFilter, setInvStatusFilter] = useState<string>('All');
  const [quotations, setQuotations] = useState<any[]>([]);
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<string>('All');
  const [taskTab, setTaskTab] = useState<string>('All');

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
        const [sumRes, purchRes, expRes, todayExpRes, invRes, custRes, vendRes, itemRes, taskRes, gstRes, quoteRes] =
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
            api.get(`/api/quotations?org_id=${oid}`).catch(() => ({ data: [] })),
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
        const qList = Array.isArray(quoteRes.data) ? quoteRes.data : (quoteRes.data?.data || []);
        setQuotations(qList);
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

  // Hero entrance + counter animation when summary loads
  useEffect(() => {
    if (!summary && !purchaseSummary) return;
    Animated.parallel([
      Animated.timing(heroFade, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(heroSlide, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    // Tween counters (preserve paise — store as float)
    const recTarget = summary?.total_outstanding || 0;
    const payTarget = purchaseSummary?.total_payable || 0;
    const start = Date.now();
    const duration = 900;
    let raf: any;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimReceivables(recTarget * eased);
      setAnimPayables(payTarget * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else { setAnimReceivables(recTarget); setAnimPayables(payTarget); }
    };
    tick();
    return () => raf && cancelAnimationFrame(raf);
  }, [summary, purchaseSummary]);

  // Subtle pulse on the receivables badge
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(heroPulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(heroPulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
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

  // Status-filtered list of last 5 invoices for the elegant card
  const recentByStatus = useMemo(() => {
    const sorted = [...filteredInvoices].sort((a: any, b: any) => (b.invoice_date || '').localeCompare(a.invoice_date || ''));
    const filtered = invStatusFilter === 'All' ? sorted : sorted.filter((i: any) => i.status === invStatusFilter);
    return filtered.slice(0, 5);
  }, [filteredInvoices, invStatusFilter]);

  // Recent unique customers (last 6) from filtered invoices
  const recentCustomers = useMemo(() => {
    const sorted = [...filteredInvoices].sort((a: any, b: any) => (b.invoice_date || '').localeCompare(a.invoice_date || ''));
    const seen = new Set<string>();
    const out: { name: string; id?: any }[] = [];
    for (const inv of sorted) {
      const name = (inv.customer_name || '').trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push({ name, id: inv.customer_id });
      if (out.length >= 6) break;
    }
    return out;
  }, [filteredInvoices]);

  const customerColors = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0ea5e9', '#16a34a'];

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
        <Text style={styles.emptyTitle}>Welcome to SpectraBooks!</Text>
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
  const unpaidCount = summary?.unpaid_count || 0;
  const overdueCount = summary?.overdue_count || 0;
  const totalReceived = summary?.total_received || 0;
  const totalInvoiced = summary?.total_invoiced || 0;
  const collectionRate = totalInvoiced > 0 ? Math.min(100, Math.round((totalReceived / totalInvoiced) * 100)) : 0;
  const billsUnpaid = purchaseSummary?.unpaid_count || 0;
  const billsOverdue = purchaseSummary?.overdue_count || 0;
  const totalBilled = purchaseSummary?.total_billed || 0;
  const totalPaidOut = purchaseSummary?.total_paid || 0;
  const payRate = totalBilled > 0 ? Math.min(100, Math.round((totalPaidOut / totalBilled) * 100)) : 0;

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
      {/* Hero — welcome card with animated receivables */}
      <Animated.View
        style={[
          styles.hero,
          { opacity: heroFade, transform: [{ translateY: heroSlide }] },
        ]}
      >
        <View style={styles.heroBgAccent} />
        <View style={styles.heroBgAccent2} />
        <View style={styles.heroBgAccent3} />

        {/* Top: greeting + biz name + avatar */}
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroGreeting}>{greeting} 👋</Text>
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

        {/* Divider with sparkle */}
        <View style={styles.heroDivider}>
          <View style={styles.heroDividerLine} />
          <Ionicons name="sparkles" size={11} color="rgba(255,255,255,0.45)" />
          <View style={styles.heroDividerLine} />
        </View>

        {/* Receivables / Payables — swipeable slider */}
        <View
          style={styles.heroSliderWrap}
          onLayout={(e) => setHeroSliderWidth(e.nativeEvent.layout.width)}
        >
          {heroSliderWidth > 0 && (
            <ScrollView
              ref={heroScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / heroSliderWidth);
                setHeroPage(idx);
              }}
            >
              {/* PAGE 1 — Receivables */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => navigateToTab('Invoices')}
                style={[styles.heroRecBlock, { width: heroSliderWidth }]}
              >
                <View style={{ flex: 1 }}>
                  <View style={styles.heroRecLabelRow}>
                    <Animated.View
                      style={[
                        styles.heroPulseDot,
                        { backgroundColor: '#86efac',
                          opacity: heroPulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
                          transform: [{ scale: heroPulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) }],
                        },
                      ]}
                    />
                    <Text style={styles.heroRecLabel}>OVERALL RECEIVABLES</Text>
                  </View>
                  <View style={styles.heroRecAmountRow}>
                    <Text style={styles.heroRecCurrency}>₹</Text>
                    <Text style={styles.heroRecAmount} numberOfLines={1} adjustsFontSizeToFit>
                      {animReceivables.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View style={styles.heroMetaRow}>
                    {unpaidCount > 0 && (
                      <View style={styles.heroMetaPill}>
                        <Ionicons name="document-text-outline" size={10} color="#ffffff" />
                        <Text style={styles.heroMetaText}>{unpaidCount} unpaid</Text>
                      </View>
                    )}
                    {overdueCount > 0 && (
                      <View style={[styles.heroMetaPill, { backgroundColor: 'rgba(239,68,68,0.35)' }]}>
                        <Ionicons name="alert-circle-outline" size={10} color="#fecaca" />
                        <Text style={[styles.heroMetaText, { color: '#fecaca' }]}>{overdueCount} overdue</Text>
                      </View>
                    )}
                    {totalInvoiced > 0 && (
                      <View style={styles.heroMetaPill}>
                        <Ionicons name="trending-up" size={10} color="#86efac" />
                        <Text style={styles.heroMetaText}>{collectionRate}% collected</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.heroRecArrow}>
                  <Ionicons name="arrow-forward" size={18} color="#ffffff" />
                </View>
              </TouchableOpacity>

              {/* PAGE 2 — Payables */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => navigateToTab('PurchasePayments')}
                style={[styles.heroRecBlock, { width: heroSliderWidth }]}
              >
                <View style={{ flex: 1 }}>
                  <View style={styles.heroRecLabelRow}>
                    <Animated.View
                      style={[
                        styles.heroPulseDot,
                        { backgroundColor: '#fca5a5',
                          opacity: heroPulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
                          transform: [{ scale: heroPulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) }],
                        },
                      ]}
                    />
                    <Text style={styles.heroRecLabel}>OVERALL PAYABLES</Text>
                  </View>
                  <View style={styles.heroRecAmountRow}>
                    <Text style={styles.heroRecCurrency}>₹</Text>
                    <Text style={styles.heroRecAmount} numberOfLines={1} adjustsFontSizeToFit>
                      {animPayables.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View style={styles.heroMetaRow}>
                    {billsUnpaid > 0 && (
                      <View style={styles.heroMetaPill}>
                        <Ionicons name="document-text-outline" size={10} color="#ffffff" />
                        <Text style={styles.heroMetaText}>{billsUnpaid} unpaid</Text>
                      </View>
                    )}
                    {billsOverdue > 0 && (
                      <View style={[styles.heroMetaPill, { backgroundColor: 'rgba(239,68,68,0.35)' }]}>
                        <Ionicons name="alert-circle-outline" size={10} color="#fecaca" />
                        <Text style={[styles.heroMetaText, { color: '#fecaca' }]}>{billsOverdue} overdue</Text>
                      </View>
                    )}
                    {totalBilled > 0 && (
                      <View style={styles.heroMetaPill}>
                        <Ionicons name="trending-up" size={10} color="#fca5a5" />
                        <Text style={styles.heroMetaText}>{payRate}% paid</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.heroRecArrow}>
                  <Ionicons name="arrow-forward" size={18} color="#ffffff" />
                </View>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* Page indicators */}
          <View style={styles.heroDots}>
            {[0, 1].map(i => (
              <TouchableOpacity
                key={i}
                onPress={() => {
                  heroScrollRef.current?.scrollTo({ x: i * heroSliderWidth, animated: true });
                  setHeroPage(i);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={[styles.heroDot, heroPage === i && styles.heroDotActive]} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Animated.View>

      {/* Quick actions */}
      <View style={styles.quickSection}>
        <View style={styles.quickHeader}>
          <Text style={styles.quickSectionTitle}>Quick Actions</Text>
          <View style={styles.quickHeaderLine} />
        </View>
        <View style={styles.quickRow}>
          {[
            { label: 'Invoice', icon: 'document-text' as const, color: '#4f46e5', onPress: () => navigateToTab('Invoices') },
            { label: 'Quotation', icon: 'reader' as const, color: '#7c3aed', onPress: () => navigateToTab('Quotations') },
            { label: 'Expense', icon: 'receipt' as const, color: '#f59e0b', onPress: () => openCreate('Expenses', 'ExpenseList') },
            { label: 'Payment', icon: 'cash' as const, color: '#10b981', onPress: () => navigateToTab('Payments') },
            { label: 'Task', icon: 'checkbox' as const, color: '#0ea5e9', onPress: () => openCreate('Tasks', 'TaskForm') },
          ].map(q => (
            <TouchableOpacity key={q.label} style={styles.quickBtn} activeOpacity={0.7} onPress={q.onPress}>
              <View style={[styles.quickIconWrap, { backgroundColor: q.color + '18', borderColor: q.color + '35' }]}>
                <Ionicons name={q.icon} size={20} color={q.color} />
              </View>
              <Text style={styles.quickLabel} numberOfLines={1}>{q.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Bento KPI Grid — small cards only */}
      <View style={styles.bento}>
        {/* Three small cards */}
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

      {/* Invoices — elegant unified card */}
      <View style={styles.invCardWrap}>
        <View style={styles.invCard}>
          {/* Header: title + period filter */}
          <View style={styles.invCardHeader}>
            <View style={styles.invCardTitleRow}>
              <View style={styles.invCardTitleIcon}>
                <Ionicons name="receipt-outline" size={16} color="#4f46e5" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.invCardTitle}>Invoices</Text>
                <Text style={styles.invCardPeriod}>{invPeriodLabel}</Text>
              </View>
              <TouchableOpacity style={styles.invCardFilter} onPress={() => setInvModalOpen(true)} activeOpacity={0.75}>
                <Ionicons name="calendar-outline" size={13} color={colors.primary} />
                <Text style={styles.invCardFilterText}>Filter</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats strip — sales value + count */}
          <TouchableOpacity
            style={styles.invStatsStrip}
            activeOpacity={0.85}
            onPress={() => navigateToTab('Invoices')}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.invStatsLabel}>SALES VALUE</Text>
              <CurrencyText amount={filteredTotal} style={styles.invStatsValue} />
              <Text style={styles.invStatsSub}>
                <Text style={{ fontWeight: '700', color: colors.gray800 }}>{filteredInvoices.length}</Text>
                {' '}invoice{filteredInvoices.length === 1 ? '' : 's'}
                {totalReceived > 0 && (
                  <>
                    {'  ·  '}
                    <Text style={{ color: '#059669', fontWeight: '700' }}>₹{totalReceived.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                    {' received'}
                  </>
                )}
              </Text>
            </View>
            <View style={styles.invStatsArrow}>
              <Ionicons name="arrow-forward" size={16} color="#4f46e5" />
            </View>
          </TouchableOpacity>

          {/* Recent customers */}
          {recentCustomers.length > 0 && (
            <View style={styles.invCustomersBlock}>
              <Text style={styles.invSubHeading}>Recent Customers</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.invCustomersRow}>
                {recentCustomers.map((c, idx) => {
                  const color = customerColors[idx % customerColors.length];
                  const initial = c.name.trim().charAt(0).toUpperCase();
                  return (
                    <TouchableOpacity
                      key={`${c.name}-${idx}`}
                      style={styles.invCustomer}
                      activeOpacity={0.7}
                      onPress={() => navigateToTab('Customers')}
                    >
                      <View style={[styles.invCustomerAvatar, { backgroundColor: color + '18', borderColor: color + '40' }]}>
                        <Text style={[styles.invCustomerInitial, { color }]}>{initial}</Text>
                      </View>
                      <Text style={styles.invCustomerName} numberOfLines={1}>{c.name.split(' ')[0]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Status filter chips */}
          <View style={styles.invChipsBlock}>
            <Text style={styles.invSubHeading}>Recent Sales</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.invChipsRow}>
              {[
                { key: 'All', color: colors.primary },
                { key: 'Draft', color: '#6b7280' },
                { key: 'Sent', color: '#2563eb' },
                { key: 'Paid', color: '#059669' },
                { key: 'Partially Paid', label: 'Partial', color: '#d97706' },
                { key: 'Overdue', color: '#dc2626' },
              ].map((c: any) => {
                const active = invStatusFilter === c.key;
                const count = c.key === 'All' ? filteredInvoices.length : (filteredStatusCounts[c.key] || 0);
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[
                      styles.invChip,
                      active && { backgroundColor: c.color, borderColor: c.color },
                    ]}
                    activeOpacity={0.75}
                    onPress={() => setInvStatusFilter(c.key)}
                  >
                    <Text style={[styles.invChipText, active && { color: '#fff' }]}>
                      {c.label || c.key}
                    </Text>
                    <View style={[
                      styles.invChipCount,
                      active && { backgroundColor: 'rgba(255,255,255,0.25)' },
                    ]}>
                      <Text style={[styles.invChipCountText, active && { color: '#fff' }]}>{count}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Recent invoices list (last 5 by status) */}
          <View style={styles.invListBlock}>
            {recentByStatus.length === 0 ? (
              <View style={styles.invListEmpty}>
                <Ionicons name="document-outline" size={26} color={colors.gray300} />
                <Text style={styles.invListEmptyText}>No invoices to show</Text>
              </View>
            ) : (
              recentByStatus.map((inv: any, idx: number) => {
                const initial = (inv.customer_name || 'C').trim().charAt(0).toUpperCase();
                const color = customerColors[idx % customerColors.length];
                return (
                  <TouchableOpacity
                    key={inv.id}
                    style={[styles.invRow, idx === recentByStatus.length - 1 && { borderBottomWidth: 0 }]}
                    activeOpacity={0.7}
                    onPress={() =>
                      navigation.getParent()?.navigate('Invoices', {
                        screen: 'InvoiceDetail',
                        params: { id: inv.id },
                      })
                    }
                  >
                    <View style={[styles.invRowAvatar, { backgroundColor: color + '18' }]}>
                      <Text style={[styles.invRowInitial, { color }]}>{initial}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.invRowCustomer} numberOfLines={1}>{inv.customer_name || 'No customer'}</Text>
                      <Text style={styles.invRowMeta} numberOfLines={1}>
                        {inv.invoice_number} · {(inv.invoice_date || '').slice(0, 10)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <CurrencyText amount={inv.total} style={styles.invRowAmount} />
                      <StatusBadge status={inv.status} />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Footer view-all */}
          <TouchableOpacity style={styles.invFooter} activeOpacity={0.7} onPress={() => navigateToTab('Invoices')}>
            <Text style={styles.invFooterText}>View all invoices</Text>
            <Ionicons name="arrow-forward" size={13} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* GST Summary intentionally removed — see /gst tab */}

      {/* Tasks — modern board layout */}
      <View style={styles.taskWrap}>
        {/* Header card with completion ring */}
        <View style={styles.taskHero}>
          <View style={styles.taskHeroBgOrb1} />
          <View style={styles.taskHeroBgOrb2} />

          <View style={styles.taskHeroTopRow}>
            <View style={styles.taskHeroBadge}>
              <Ionicons name="layers" size={11} color="#fff" />
              <Text style={styles.taskHeroBadgeText}>WORKFLOW</Text>
            </View>
            <TouchableOpacity
              style={styles.taskHeroBtn}
              activeOpacity={0.85}
              onPress={() => openCreate('Tasks', 'TaskForm')}
            >
              <Ionicons name="add" size={14} color="#ffffff" />
              <Text style={styles.taskHeroBtnText}>New Task</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.taskHeroValueRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.taskHeroTitle}>Tasks Board</Text>
              <Text style={styles.taskHeroSub}>
                {tasks.length === 0
                  ? 'No tasks yet — create one to get started'
                  : `${tasks.length} total · ${taskStatusCounts['Completed'] || 0} completed`}
              </Text>
            </View>
            {tasks.length > 0 && (() => {
              const done = taskStatusCounts['Completed'] || 0;
              const pct = Math.round((done / tasks.length) * 100);
              return (
                <View style={styles.taskRingWrap}>
                  <View style={styles.taskRingOuter}>
                    <View style={styles.taskRingInner}>
                      <Text style={styles.taskRingPct}>{pct}%</Text>
                      <Text style={styles.taskRingLabel}>done</Text>
                    </View>
                  </View>
                </View>
              );
            })()}
          </View>

          {tasks.length > 0 && (
            <View style={styles.taskHeroMiniRow}>
              <View style={styles.taskHeroMini}>
                <View style={[styles.taskHeroMiniDot, { backgroundColor: '#94a3b8' }]} />
                <Text style={styles.taskHeroMiniNum}>{taskStatusCounts['Pending'] || 0}</Text>
                <Text style={styles.taskHeroMiniLabel}>To Do</Text>
              </View>
              <View style={styles.taskHeroMiniSep} />
              <View style={styles.taskHeroMini}>
                <View style={[styles.taskHeroMiniDot, { backgroundColor: '#60a5fa' }]} />
                <Text style={styles.taskHeroMiniNum}>{taskStatusCounts['In Progress'] || 0}</Text>
                <Text style={styles.taskHeroMiniLabel}>Active</Text>
              </View>
              <View style={styles.taskHeroMiniSep} />
              <View style={styles.taskHeroMini}>
                <View style={[styles.taskHeroMiniDot, { backgroundColor: '#34d399' }]} />
                <Text style={styles.taskHeroMiniNum}>{taskStatusCounts['Completed'] || 0}</Text>
                <Text style={styles.taskHeroMiniLabel}>Done</Text>
              </View>
              <View style={styles.taskHeroMiniSep} />
              <View style={styles.taskHeroMini}>
                <View style={[styles.taskHeroMiniDot, { backgroundColor: '#f87171' }]} />
                <Text style={styles.taskHeroMiniNum}>{taskStatusCounts['Delayed'] || 0}</Text>
                <Text style={styles.taskHeroMiniLabel}>Delayed</Text>
              </View>
            </View>
          )}
        </View>

        {/* Status filter pills */}
        {tasks.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.taskTabRow}
          >
            {[
              { key: 'All',         label: 'All',         color: colors.primary },
              { key: 'Pending',     label: 'To Do',       color: '#6b7280' },
              { key: 'In Progress', label: 'Active',      color: '#2563eb' },
              { key: 'Completed',   label: 'Done',        color: '#16a34a' },
              { key: 'Delayed',     label: 'Delayed',     color: '#dc2626' },
            ].map(t => {
              const active = taskTab === t.key;
              const count = t.key === 'All' ? tasks.length : (taskStatusCounts[t.key] || 0);
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.taskTab, active && { backgroundColor: t.color, borderColor: t.color }]}
                  activeOpacity={0.75}
                  onPress={() => setTaskTab(t.key)}
                >
                  <Text style={[styles.taskTabText, active && { color: '#fff' }]}>{t.label}</Text>
                  <View style={[styles.taskTabCount, active && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                    <Text style={[styles.taskTabCountText, active && { color: '#fff' }]}>{count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Spotlight carousel — large detailed cards, snap pager */}
        {tasks.length > 0 && (() => {
          const filtered = (taskTab === 'All' ? tasks : tasks.filter((t: any) => t.status === taskTab)).slice(0, 8);
          if (filtered.length === 0) {
            return (
              <View style={styles.taskSpotEmpty}>
                <Ionicons name="checkmark-done-circle-outline" size={36} color={colors.gray300} />
                <Text style={styles.taskSpotEmptyText}>No tasks in this filter</Text>
              </View>
            );
          }
          return (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={240}
              snapToAlignment="start"
              contentContainerStyle={styles.taskSpotRow}
            >
              {filtered.map((task: any) => {
                const pColor = priorityColor(task.priority);
                const chip = dueChip(task);
                const initial = taskInitial(task);
                return (
                  <TouchableOpacity
                    key={task.id}
                    style={[styles.taskSpot, { borderColor: pColor + '30' }]}
                    activeOpacity={0.85}
                    onPress={() =>
                      navigation.getParent()?.navigate('Tasks', {
                        screen: 'TaskDetail',
                        params: { id: task.id },
                      })
                    }
                  >
                    {/* compact top: avatar + title + arrow */}
                    <View style={styles.taskSpotTitleRow}>
                      <View style={[styles.taskSpotAvatar, { backgroundColor: pColor + '18', borderColor: pColor + '50' }]}>
                        <Text style={[styles.taskSpotAvatarText, { color: pColor }]}>{initial}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.taskSpotTitle} numberOfLines={1}>{task.title}</Text>
                        <Text style={styles.taskSpotSub} numberOfLines={1}>
                          {task.employee_name || task.customer_name || 'Unassigned'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={14} color={colors.gray400} />
                    </View>

                    {/* compact pill row */}
                    <View style={styles.taskSpotPills}>
                      <View style={[styles.taskSpotPriority, { backgroundColor: pColor + '15' }]}>
                        <View style={[styles.taskSpotPriorityDot, { backgroundColor: pColor }]} />
                        <Text style={[styles.taskSpotPriorityText, { color: pColor }]}>{(task.priority || 'Normal').toUpperCase()}</Text>
                      </View>
                      <View style={[styles.taskSpotDue, { backgroundColor: chip.bg }]}>
                        <Ionicons name={chip.icon} size={9} color={chip.fg} />
                        <Text style={[styles.taskSpotDueText, { color: chip.fg }]}>{chip.text}</Text>
                      </View>
                      <StatusBadge status={task.status} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          );
        })()}

        {tasks.length === 0 && (
          <View style={styles.taskEmptyCard}>
            <View style={styles.taskEmptyIcon}>
              <Ionicons name="clipboard-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.taskEmptyTitle}>Start your workflow</Text>
            <Text style={styles.taskEmptyDesc}>Create tasks to track work for your team</Text>
            <TouchableOpacity
              style={styles.taskEmptyBtn}
              activeOpacity={0.85}
              onPress={() => openCreate('Tasks', 'TaskForm')}
            >
              <Ionicons name="add-circle-outline" size={16} color="#ffffff" />
              <Text style={styles.taskEmptyBtnText}>Create First Task</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Quotations — fresh horizontal carousel design */}
      {(() => {
        const sortedQuotes = [...quotations].sort((a: any, b: any) => (b.quotation_date || '').localeCompare(a.quotation_date || ''));
        const statusCounts: Record<string, number> = {};
        sortedQuotes.forEach((q: any) => { statusCounts[q.status] = (statusCounts[q.status] || 0) + 1; });
        const totalQuoted = sortedQuotes.reduce((s: number, q: any) => s + (Number(q.total) || 0), 0);
        const accepted = statusCounts['Accepted'] || 0;
        const pending = statusCounts['Sent'] || 0;
        const draft = statusCounts['Draft'] || 0;
        const conversionPct = sortedQuotes.length > 0 ? Math.round((accepted / sortedQuotes.length) * 100) : 0;
        const recentQuotes = sortedQuotes.slice(0, 8);

        const statusMeta: Record<string, { color: string; bg: string; icon: any }> = {
          Draft:    { color: '#6b7280', bg: '#f3f4f6', icon: 'create-outline' },
          Sent:     { color: '#2563eb', bg: '#dbeafe', icon: 'paper-plane-outline' },
          Accepted: { color: '#059669', bg: '#d1fae5', icon: 'checkmark-circle' },
          Rejected: { color: '#dc2626', bg: '#fee2e2', icon: 'close-circle' },
          Expired:  { color: '#71717a', bg: '#f4f4f5', icon: 'time-outline' },
        };

        return (
          <View style={styles.quoWrap}>
            {/* Hero header — gradient-ish dark card */}
            <View style={styles.quoHero}>
              <View style={styles.quoHeroOrb1} />
              <View style={styles.quoHeroOrb2} />
              <View style={styles.quoHeroTopRow}>
                <View style={styles.quoHeroBadge}>
                  <Ionicons name="document-text" size={11} color="#fff" />
                  <Text style={styles.quoHeroBadgeText}>QUOTATIONS</Text>
                </View>
                <TouchableOpacity
                  style={styles.quoHeroAction}
                  activeOpacity={0.85}
                  onPress={() => openCreate('Quotations', 'QuotationForm')}
                >
                  <Ionicons name="add" size={14} color="#fff" />
                  <Text style={styles.quoHeroActionText}>New Quote</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.quoHeroValueRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quoHeroValueLabel}>Total Quoted</Text>
                  <CurrencyText amount={totalQuoted} style={styles.quoHeroValue} />
                </View>
                <View style={styles.quoHeroRing}>
                  <Text style={styles.quoHeroRingNum}>{conversionPct}%</Text>
                  <Text style={styles.quoHeroRingLabel}>WON</Text>
                </View>
              </View>

              {/* Mini stats pills */}
              <View style={styles.quoMiniRow}>
                <View style={styles.quoMini}>
                  <View style={[styles.quoMiniDot, { backgroundColor: '#10b981' }]} />
                  <Text style={styles.quoMiniNum}>{accepted}</Text>
                  <Text style={styles.quoMiniLabel}>Won</Text>
                </View>
                <View style={styles.quoMiniSep} />
                <View style={styles.quoMini}>
                  <View style={[styles.quoMiniDot, { backgroundColor: '#60a5fa' }]} />
                  <Text style={styles.quoMiniNum}>{pending}</Text>
                  <Text style={styles.quoMiniLabel}>Sent</Text>
                </View>
                <View style={styles.quoMiniSep} />
                <View style={styles.quoMini}>
                  <View style={[styles.quoMiniDot, { backgroundColor: '#a1a1aa' }]} />
                  <Text style={styles.quoMiniNum}>{draft}</Text>
                  <Text style={styles.quoMiniLabel}>Draft</Text>
                </View>
                <View style={styles.quoMiniSep} />
                <View style={styles.quoMini}>
                  <View style={[styles.quoMiniDot, { backgroundColor: '#f59e0b' }]} />
                  <Text style={styles.quoMiniNum}>{sortedQuotes.length}</Text>
                  <Text style={styles.quoMiniLabel}>Total</Text>
                </View>
              </View>
            </View>

            {/* Carousel of recent quotations */}
            {recentQuotes.length === 0 ? (
              <View style={styles.quoEmpty}>
                <View style={styles.quoEmptyIcon}>
                  <Ionicons name="document-text-outline" size={26} color="#7c3aed" />
                </View>
                <Text style={styles.quoEmptyTitle}>No quotations yet</Text>
                <Text style={styles.quoEmptyDesc}>Create your first quote to win new business</Text>
                <TouchableOpacity
                  style={styles.quoEmptyBtn}
                  activeOpacity={0.85}
                  onPress={() => openCreate('Quotations', 'QuotationForm')}
                >
                  <Ionicons name="add-circle-outline" size={15} color="#fff" />
                  <Text style={styles.quoEmptyBtnText}>Create Quotation</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.quoListHead}>
                  <Text style={styles.quoListTitle}>Recent Quotations</Text>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => navigateToTab('Quotations')} style={styles.quoListHeadLink}>
                    <Text style={styles.quoListHeadLinkText}>View all</Text>
                    <Ionicons name="arrow-forward" size={12} color="#7c3aed" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quoCarousel}
                  decelerationRate="fast"
                  snapToInterval={236}
                  snapToAlignment="start"
                >
                  {recentQuotes.map((q: any) => {
                    const meta = statusMeta[q.status] || statusMeta['Draft'];
                    const initial = (q.customer_name || 'C').trim().charAt(0).toUpperCase();
                    return (
                      <TouchableOpacity
                        key={q.id}
                        style={styles.quoCard}
                        activeOpacity={0.85}
                        onPress={() =>
                          navigation.getParent()?.navigate('Quotations', {
                            screen: 'QuotationDetail',
                            params: { id: q.id },
                          })
                        }
                      >
                        {/* Top: status ribbon */}
                        <View style={[styles.quoCardRibbon, { backgroundColor: meta.bg }]}>
                          <Ionicons name={meta.icon} size={11} color={meta.color} />
                          <Text style={[styles.quoCardRibbonText, { color: meta.color }]}>
                            {q.status}
                          </Text>
                        </View>

                        {/* Body */}
                        <View style={styles.quoCardBody}>
                          <View style={styles.quoCardCustomerRow}>
                            <View style={styles.quoCardAvatar}>
                              <Text style={styles.quoCardAvatarText}>{initial}</Text>
                            </View>
                            <Text style={styles.quoCardCustomer} numberOfLines={1}>
                              {q.customer_name || 'No customer'}
                            </Text>
                          </View>

                          <Text style={styles.quoCardNumber}>{q.quotation_number}</Text>
                          <Text style={styles.quoCardDate}>
                            {(q.quotation_date || '').slice(0, 10)}
                          </Text>
                        </View>

                        {/* Footer: amount */}
                        <View style={styles.quoCardFooter}>
                          <Text style={styles.quoCardAmountLabel}>AMOUNT</Text>
                          <CurrencyText amount={q.total} style={styles.quoCardAmount} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  {/* "See all" trailing card */}
                  <TouchableOpacity
                    style={styles.quoCardMore}
                    activeOpacity={0.85}
                    onPress={() => navigateToTab('Quotations')}
                  >
                    <View style={styles.quoCardMoreIcon}>
                      <Ionicons name="grid-outline" size={20} color="#7c3aed" />
                    </View>
                    <Text style={styles.quoCardMoreText}>See all{'\n'}quotations</Text>
                    <Ionicons name="arrow-forward" size={14} color="#7c3aed" />
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </View>
        );
      })()}

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
    borderRadius: 24,
    paddingHorizontal: spacing.md + 4,
    paddingVertical: spacing.md + 6,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  heroBgAccent: {
    position: 'absolute',
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(167,139,250,0.18)',
    top: -70, right: -50,
  },
  heroBgAccent2: {
    position: 'absolute',
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(99,102,241,0.14)',
    bottom: -50, left: -30,
  },
  heroBgAccent3: {
    position: 'absolute',
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: 40, right: 80,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroGreeting: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
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

  heroDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 14,
  },
  heroDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroRecBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroRecLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroPulseDot: {
    width: 7, height: 7, borderRadius: 4,
  },
  heroSliderWrap: {
    width: '100%',
  },
  heroDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  heroDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  heroDotActive: {
    width: 18,
    backgroundColor: '#ffffff',
  },
  heroRecLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  heroRecAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 6,
    gap: 2,
  },
  heroRecCurrency: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
  },
  heroRecAmount: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    flexShrink: 1,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  heroMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
  },
  heroMetaText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  heroRecArrow: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },

  // Quick actions
  quickSection: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  quickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  quickSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray500,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  quickHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray200,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 6,
  },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  quickIconWrap: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  quickLabel: {
    fontSize: 11,
    color: colors.gray800,
    fontWeight: '600',
    letterSpacing: 0.2,
  },


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

  // Invoice card — elegant unified
  invCardWrap: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  invCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#d8dcec',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  invCardHeader: {
    marginBottom: 14,
  },
  invCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  invCardTitleIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#eef0ff',
    alignItems: 'center', justifyContent: 'center',
  },
  invCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.gray900,
    letterSpacing: -0.2,
  },
  invCardPeriod: {
    fontSize: 11,
    color: colors.gray500,
    fontWeight: '500',
    marginTop: 1,
  },
  invCardFilter: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: '#eef0ff',
    borderRadius: 999,
  },
  invCardFilterText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
  },
  invStatsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8f9ff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eef0ff',
  },
  invStatsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gray500,
    letterSpacing: 1.2,
  },
  invStatsValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.gray900,
    letterSpacing: -0.5,
    marginTop: 4,
  },
  invStatsSub: {
    fontSize: 11,
    color: colors.gray600,
    marginTop: 4,
    fontWeight: '500',
  },
  invStatsArrow: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#eef0ff',
    alignItems: 'center', justifyContent: 'center',
  },
  invSubHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray500,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  invCustomersBlock: {
    marginTop: 18,
  },
  invCustomersRow: {
    flexDirection: 'row',
    gap: 14,
    paddingRight: 4,
  },
  invCustomer: {
    alignItems: 'center',
    gap: 6,
    width: 56,
  },
  invCustomerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  invCustomerInitial: {
    fontSize: 16,
    fontWeight: '800',
  },
  invCustomerName: {
    fontSize: 10.5,
    color: colors.gray700,
    fontWeight: '600',
    textAlign: 'center',
    width: 56,
  },
  invChipsBlock: {
    marginTop: 18,
  },
  invChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  invChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#f4f5f9',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e9ebf2',
  },
  invChipText: {
    fontSize: 11.5,
    color: colors.gray700,
    fontWeight: '700',
  },
  invChipCount: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: '#e2e5ee',
    minWidth: 18,
    alignItems: 'center',
  },
  invChipCountText: {
    fontSize: 10,
    color: colors.gray700,
    fontWeight: '800',
  },
  invListBlock: {
    marginTop: 14,
  },
  invListEmpty: {
    alignItems: 'center',
    paddingVertical: 22,
    gap: 8,
  },
  invListEmptyText: {
    color: colors.gray500,
    fontSize: 12,
    fontWeight: '500',
  },
  invRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f8',
  },
  invRowAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  invRowInitial: {
    fontSize: 13,
    fontWeight: '800',
  },
  invRowCustomer: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gray900,
    letterSpacing: -0.2,
  },
  invRowMeta: {
    fontSize: 11,
    color: colors.gray500,
    marginTop: 2,
    fontWeight: '500',
  },
  invRowAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.gray900,
  },
  invFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f8',
  },
  invFooterText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },

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

  // Tasks — modern board
  taskWrap: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  taskHero: {
    backgroundColor: '#1e1b4b',
    borderRadius: 22,
    padding: 18,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#1e1b4b',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  taskHeroBgOrb1: {
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(167,139,250,0.22)',
    top: -50, right: -30,
  },
  taskHeroBgOrb2: {
    position: 'absolute',
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(99,102,241,0.20)',
    bottom: -30, left: -20,
  },
  taskHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskHeroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  taskHeroBadgeText: { fontSize: 9.5, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  taskHeroValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  taskHeroLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  taskHeroTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  taskHeroSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
  taskHeroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  taskHeroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: '#7c3aed',
    borderRadius: 999,
  },
  taskHeroBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  taskHeroGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  taskHeroGhostText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '600',
    opacity: 0.85,
  },
  taskHeroMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  taskHeroMini: { flex: 1, alignItems: 'center', gap: 2 },
  taskHeroMiniDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 2 },
  taskHeroMiniNum: { fontSize: 15, fontWeight: '800', color: '#fff' },
  taskHeroMiniLabel: { fontSize: 9.5, color: 'rgba(255,255,255,0.55)', fontWeight: '600', letterSpacing: 0.4 },
  taskHeroMiniSep: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.1)' },
  taskRingWrap: {
    marginLeft: 12,
  },
  taskRingOuter: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderWidth: 3,
    borderColor: '#a78bfa',
    alignItems: 'center', justifyContent: 'center',
  },
  taskRingInner: {
    alignItems: 'center', justifyContent: 'center',
  },
  taskRingPct: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  taskRingLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  taskBoardRow: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 4,
  },
  // Spotlight carousel
  taskTabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
    marginBottom: 12,
  },
  taskTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#f4f5f9',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e9ebf2',
  },
  taskTabText: {
    fontSize: 11.5,
    color: colors.gray700,
    fontWeight: '700',
  },
  taskTabCount: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: '#e2e5ee',
    minWidth: 18,
    alignItems: 'center',
  },
  taskTabCountText: {
    fontSize: 10,
    color: colors.gray700,
    fontWeight: '800',
  },
  taskSpotRow: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 4,
    paddingBottom: 4,
    paddingTop: 2,
  },
  taskSpot: {
    width: 230,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  taskSpotTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  taskSpotAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
  },
  taskSpotAvatarText: {
    fontSize: 12,
    fontWeight: '800',
  },
  taskSpotTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.gray900,
    lineHeight: 16,
    letterSpacing: -0.1,
  },
  taskSpotSub: {
    fontSize: 10.5,
    color: colors.gray500,
    fontWeight: '500',
    marginTop: 1,
  },
  taskSpotPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  taskSpotPriority: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 999,
  },
  taskSpotPriorityDot: {
    width: 5, height: 5, borderRadius: 3,
  },
  taskSpotPriorityText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  taskSpotDue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 999,
  },
  taskSpotDueText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  taskSpotEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  taskSpotEmptyText: {
    fontSize: 12,
    color: colors.gray500,
    fontWeight: '500',
  },
  taskCol: {
    width: 220,
    backgroundColor: '#fafafa',
    borderRadius: 18,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#eef0f5',
  },
  taskColHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  taskColDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  taskColLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: colors.gray800,
    letterSpacing: -0.1,
  },
  taskColCount: {
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    alignItems: 'center',
  },
  taskColCountText: {
    fontSize: 11,
    fontWeight: '800',
  },
  taskColEmpty: {
    alignItems: 'center',
    paddingVertical: 18,
    gap: 4,
  },
  taskColEmptyText: {
    fontSize: 11,
    color: colors.gray400,
    fontWeight: '500',
  },
  taskMiniCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eef0f5',
  },
  taskMiniStrip: {
    width: 3,
  },
  taskMiniBody: {
    flex: 1,
    padding: 10,
    gap: 8,
  },
  taskMiniTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.gray900,
    lineHeight: 16,
    letterSpacing: -0.1,
  },
  taskMiniMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskMiniAvatar: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  taskMiniAvatarText: {
    fontSize: 10,
    fontWeight: '800',
  },
  taskMiniMeta: {
    flex: 1,
    fontSize: 10.5,
    color: colors.gray600,
    fontWeight: '600',
  },
  taskMiniFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  taskMiniPriority: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  taskMiniPriorityText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  taskMiniDue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  taskMiniDueText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  taskColMore: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  taskColMoreText: {
    fontSize: 11,
    fontWeight: '700',
  },
  taskEmptyCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 26,
    paddingHorizontal: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: '#eef0f5',
  },
  taskEmptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#eef0ff',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  taskEmptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.gray900,
  },
  taskEmptyDesc: {
    fontSize: 12,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: 4,
  },
  taskEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 999,
    marginTop: 4,
  },
  taskEmptyBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },

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

  // ===== Quotations section (carousel design) =====
  quoWrap: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  quoHero: {
    backgroundColor: '#1e1b4b',
    borderRadius: 20,
    padding: spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },
  quoHeroOrb1: {
    position: 'absolute',
    top: -40, right: -40,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: '#7c3aed',
    opacity: 0.35,
  },
  quoHeroOrb2: {
    position: 'absolute',
    bottom: -50, left: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#a855f7',
    opacity: 0.18,
  },
  quoHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quoHeroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  quoHeroBadgeText: { fontSize: 9.5, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  quoHeroAction: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 11, paddingVertical: 6,
    borderRadius: 999,
  },
  quoHeroActionText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  quoHeroValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  quoHeroValueLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '600', letterSpacing: 0.5 },
  quoHeroValue: { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 2 },
  quoHeroRing: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 3, borderColor: '#a855f7',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.2)',
  },
  quoHeroRingNum: { fontSize: 16, fontWeight: '800', color: '#fff' },
  quoHeroRingLabel: { fontSize: 8.5, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.8 },
  quoMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  quoMini: { flex: 1, alignItems: 'center', gap: 2 },
  quoMiniDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 2 },
  quoMiniNum: { fontSize: 15, fontWeight: '800', color: '#fff' },
  quoMiniLabel: { fontSize: 9.5, color: 'rgba(255,255,255,0.55)', fontWeight: '600', letterSpacing: 0.4 },
  quoMiniSep: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.1)' },

  quoListHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  quoListTitle: { fontSize: 14, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  quoListHeadLink: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  quoListHeadLinkText: { fontSize: 12, fontWeight: '700', color: '#7c3aed' },

  quoCarousel: {
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  quoCard: {
    width: 220,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  quoCardRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quoCardRibbonText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  quoCardBody: {
    padding: spacing.md,
    gap: 6,
  },
  quoCardCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  quoCardAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#f3e8ff',
    alignItems: 'center', justifyContent: 'center',
  },
  quoCardAvatarText: { fontSize: 12, fontWeight: '800', color: '#7c3aed' },
  quoCardCustomer: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
  quoCardNumber: { fontSize: 12, fontWeight: '700', color: colors.gray700 },
  quoCardDate: { fontSize: 11, color: colors.gray500, fontWeight: '500' },
  quoCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    backgroundColor: '#faf5ff',
  },
  quoCardAmountLabel: { fontSize: 9.5, fontWeight: '800', color: '#7c3aed', letterSpacing: 0.6 },
  quoCardAmount: { fontSize: 15, fontWeight: '800', color: '#1e1b4b' },

  quoCardMore: {
    width: 150,
    backgroundColor: '#faf5ff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e9d5ff',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: 8,
  },
  quoCardMoreIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#f3e8ff',
    alignItems: 'center', justifyContent: 'center',
  },
  quoCardMoreText: { fontSize: 12, fontWeight: '700', color: '#7c3aed', textAlign: 'center', lineHeight: 16 },

  quoEmpty: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  quoEmptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#f3e8ff',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  quoEmptyTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  quoEmptyDesc: { fontSize: 12.5, color: colors.gray500, marginTop: 4, marginBottom: spacing.md, textAlign: 'center' },
  quoEmptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 999,
  },
  quoEmptyBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
