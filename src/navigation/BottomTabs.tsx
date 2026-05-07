import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Dimensions, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import api from '../api/client';
import { colors, spacing, fontSize, borderRadius } from '../theme';

// Screens
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import InvoiceListScreen from '../screens/invoices/InvoiceListScreen';
import InvoiceDetailScreen from '../screens/invoices/InvoiceDetailScreen';
import InvoiceFormScreen from '../screens/invoices/InvoiceFormScreen';
import CustomerListScreen from '../screens/customers/CustomerListScreen';
import CustomerDetailScreen from '../screens/customers/CustomerDetailScreen';
import CustomerFormScreen from '../screens/customers/CustomerFormScreen';
import ItemListScreen from '../screens/items/ItemListScreen';
import ItemFormScreen from '../screens/items/ItemFormScreen';
import ExpenseListScreen from '../screens/expenses/ExpenseListScreen';
import QuotationListScreen from '../screens/quotations/QuotationListScreen';
import QuotationDetailScreen from '../screens/quotations/QuotationDetailScreen';
import QuotationFormScreen from '../screens/quotations/QuotationFormScreen';
import VendorListScreen from '../screens/vendors/VendorListScreen';
import VendorDetailScreen from '../screens/vendors/VendorDetailScreen';
import VendorFormScreen from '../screens/vendors/VendorFormScreen';
import POListScreen from '../screens/purchase-orders/POListScreen';
import PODetailScreen from '../screens/purchase-orders/PODetailScreen';
import POFormScreen from '../screens/purchase-orders/POFormScreen';
import PBListScreen from '../screens/purchase-bills/PBListScreen';
import PBDetailScreen from '../screens/purchase-bills/PBDetailScreen';
import PBFormScreen from '../screens/purchase-bills/PBFormScreen';
import EmployeeListScreen from '../screens/employees/EmployeeListScreen';
import EmployeeDetailScreen from '../screens/employees/EmployeeDetailScreen';
import EmployeeFormScreen from '../screens/employees/EmployeeFormScreen';
import PaymentListScreen from '../screens/payments/PaymentListScreen';
import PaymentDetailScreen from '../screens/payments/PaymentDetailScreen';
import ReportsScreen from '../screens/reports/ReportsScreen';
import ReportDetailScreen from '../screens/reports/ReportDetailScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import TemplatesScreen from '../screens/settings/TemplatesScreen';
import PayrollScreen from '../screens/payroll/PayrollScreen';
import TaskListScreen from '../screens/tasks/TaskListScreen';
import TaskDetailScreen from '../screens/tasks/TaskDetailScreen';
import TaskFormScreen from '../screens/tasks/TaskFormScreen';
import InventoryScreen from '../screens/inventory/InventoryScreen';
import PurchasePaymentListScreen from '../screens/purchase-payments/PurchasePaymentListScreen';
import PurchasePaymentDetailScreen from '../screens/purchase-payments/PurchasePaymentDetailScreen';
import PayablesScreen from '../screens/payables/PayablesScreen';
import VendorLedgerScreen from '../screens/payables/VendorLedgerScreen';
import BusinessListScreen from '../screens/business/BusinessListScreen';
import GSTScreen from '../screens/gst/GSTScreen';
import EwayBillListScreen from '../screens/eway-bills/EwayBillListScreen';
import EwayBillDetailScreen from '../screens/eway-bills/EwayBillDetailScreen';
import EwayBillFormScreen from '../screens/eway-bills/EwayBillFormScreen';
import ReceivablesScreen from '../screens/receivables/ReceivablesScreen';
import CustomerLedgerScreen from '../screens/receivables/CustomerLedgerScreen';
import CreditNoteListScreen from '../screens/credit-notes/CreditNoteListScreen';
import CreditNoteDetailScreen from '../screens/credit-notes/CreditNoteDetailScreen';
import CreditNoteFormScreen from '../screens/credit-notes/CreditNoteFormScreen';
import DebitNoteListScreen from '../screens/debit-notes/DebitNoteListScreen';
import DebitNoteDetailScreen from '../screens/debit-notes/DebitNoteDetailScreen';
import DebitNoteFormScreen from '../screens/debit-notes/DebitNoteFormScreen';
import RecurringInvoiceListScreen from '../screens/recurring-invoices/RecurringInvoiceListScreen';
import DeliveryChallanListScreen from '../screens/delivery-challans/DeliveryChallanListScreen';
import DeliveryChallanDetailScreen from '../screens/delivery-challans/DeliveryChallanDetailScreen';
import DeliveryChallanFormScreen from '../screens/delivery-challans/DeliveryChallanFormScreen';
import ContractorListScreen from '../screens/contracts/ContractorListScreen';
import ContractorPayoutScreen from '../screens/contracts/ContractorPayoutScreen';
import LedgerScreen from '../screens/ledger/LedgerScreen';
import SubscriptionScreen from '../screens/settings/SubscriptionScreen';
import HelpSupportScreen from '../screens/settings/HelpSupportScreen';
import ReceiptListScreen from '../screens/receipts/ReceiptListScreen';
import ReceiptDetailScreen from '../screens/receipts/ReceiptDetailScreen';
import PaymentVoucherListScreen from '../screens/payment-vouchers/PaymentVoucherListScreen';
import PaymentVoucherDetailScreen from '../screens/payment-vouchers/PaymentVoucherDetailScreen';
import PaymentReminderScreen from '../screens/payment-reminders/PaymentReminderScreen';
import CustomFieldScreen from '../screens/custom-fields/CustomFieldScreen';
import CustomTabBar from './CustomTabBar';
import { QuickAddProvider } from '../components/QuickAddFAB';
import { GlobalSearchProvider, useGlobalSearch } from '../components/GlobalSearch';
import { PreviewProvider } from '../components/Preview';
import AppHeader from '../components/AppHeader';

// Drawer context
const DrawerContext = createContext<{ open: () => void; close: () => void }>({ open: () => {}, close: () => {} });
export const useDrawer = () => useContext(DrawerContext);

// Stealth prompt context
const StealthPromptContext = createContext<{ prompt: () => void }>({ prompt: () => {} });
export const useStealthPrompt = () => useContext(StealthPromptContext);

// Notification bell
function NotificationBell() {
  const navigation = useNavigation<any>();
  const [count, setCount] = useState(0);
  const fetchCount = async () => { try { const b = await api.get('/api/business'); const o = b.data[0]?.org_id; if (o) { const r = await api.get(`/api/notifications/count?org_id=${o}`); setCount(r.data.total || 0); } } catch {} };
  useEffect(() => {
    fetchCount();
    const i = setInterval(fetchCount, 60000);
    const unsub = navigation.addListener('state', fetchCount);
    return () => { clearInterval(i); unsub(); };
  }, [navigation]);
  return (
    <TouchableOpacity style={bellS.container} onPress={() => navigation.navigate('Notifications')}>
      <Ionicons name="notifications-outline" size={24} color={colors.white} />
      {count > 0 && <View style={bellS.badge}><Text style={bellS.badgeText}>{count > 99 ? '99+' : count}</Text></View>}
    </TouchableOpacity>
  );
}
const bellS = StyleSheet.create({
  container: { marginRight: 16, paddingTop: 6, paddingRight: 8, overflow: 'visible' },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.danger,
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  badgeText: { color: colors.white, fontSize: 10, lineHeight: 12, fontWeight: '800', textAlign: 'center', includeFontPadding: false },
});

function StealthPill() {
  const { stealthActive } = useAuth();
  const navigation = useNavigation<any>();
  if (!stealthActive) return null;
  return (
    <TouchableOpacity style={pillS.pill} onPress={() => navigation.navigate('Settings')}>
      <View style={pillS.dot} />
      <Text style={pillS.text}>Private</Text>
    </TouchableOpacity>
  );
}
const pillS = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.95)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginRight: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white, marginRight: 5 },
  text: { color: colors.white, fontSize: 11, fontWeight: '700' },
});

function HeaderRight() {
  const { open: openSearch } = useGlobalSearch();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <TouchableOpacity
        onPress={openSearch}
        style={{ marginRight: 4, padding: 8 }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
      >
        <Ionicons name="search" size={22} color={colors.white} />
      </TouchableOpacity>
      <StealthPill />
      <NotificationBell />
    </View>
  );
}

function MenuButton() {
  const { open } = useDrawer();
  return (
    <TouchableOpacity
      style={{ marginLeft: 8, paddingVertical: 10, paddingHorizontal: 12 }}
      onPress={open}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      activeOpacity={0.6}
    >
      <Ionicons name="menu" size={26} color={colors.white} />
    </TouchableOpacity>
  );
}

// Triple-tap title for stealth trigger
function BrandTitle({ children, tintColor }: { children?: any; tintColor?: string }) {
  const { prompt } = useStealthPrompt();
  const tapCount = useRef(0);
  const tapTimer = useRef<any>(null);
  const onTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 600);
    if (tapCount.current >= 3) {
      tapCount.current = 0;
      if (tapTimer.current) clearTimeout(tapTimer.current);
      prompt();
    }
  };
  return (
    <TouchableOpacity onPress={onTap} activeOpacity={0.85} hitSlop={{ top: 14, bottom: 14, left: 24, right: 24 }}>
      <Text style={{ color: tintColor || colors.white, fontSize: 17, fontWeight: '700' }}>{children}</Text>
    </TouchableOpacity>
  );
}

const hOpts = { headerStyle: { backgroundColor: colors.primary }, headerTintColor: colors.white, headerRight: () => <HeaderRight /> };
const rootOpts = {
  ...hOpts,
  headerLeft: () => <MenuButton />,
  headerTitle: ({ children, tintColor }: any) => <BrandTitle tintColor={tintColor}>{children}</BrandTitle>,
};

// Modern custom header used by every native-stack navigator
function ScreenHeader({ navigation, route, options, back }: any) {
  const { open: openDrawer } = useDrawer();
  const { open: openSearch } = useGlobalSearch();
  const { prompt } = useStealthPrompt();
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    const f = async () => {
      try {
        const b = await api.get('/api/business');
        const o = b.data[0]?.org_id;
        if (o) {
          const r = await api.get(`/api/notifications/count?org_id=${o}`);
          setNotifCount(r.data.total || 0);
        }
      } catch {}
    };
    f();
    const i = setInterval(f, 60000);
    const unsub = navigation.addListener('focus', f);
    return () => { clearInterval(i); unsub(); };
  }, [navigation]);

  const title = options.title ?? route.name;
  const subtitle = options.headerSubtitle;
  const isRoot = !back;

  return (
    <AppHeader
      title={title}
      subtitle={subtitle}
      showMenu={isRoot}
      onMenu={isRoot ? openDrawer : undefined}
      onBack={back ? () => navigation.goBack() : undefined}
      onSearch={openSearch}
      onBell={() => navigation.navigate('Notifications')}
      onTitleTriplePress={prompt}
      notificationCount={notifCount}
    />
  );
}

const navHeader = { header: (props: any) => <ScreenHeader {...props} /> } as any;

// All stacks
const Stack = createNativeStackNavigator();

function DashboardStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="DashboardHome" component={DashboardScreen} options={{ title: 'SpectraBooks' }} />
    <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ title: 'Setup Business' }} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
  </Stack.Navigator>);
}

function InvoiceStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="InvoiceList" component={InvoiceListScreen} options={{ title: 'Invoices' }} />
    <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} options={{ title: 'Invoice' }} />
    <Stack.Screen name="InvoiceForm" component={InvoiceFormScreen} options={({ route }: any) => ({ title: route.params?.id ? 'Edit Invoice' : 'New Invoice' })} />
    <Stack.Screen name="Receivables" component={ReceivablesScreen} options={{ title: 'Total Receivables' }} />
    <Stack.Screen name="CustomerLedger" component={CustomerLedgerScreen} options={{ title: 'Customer Ledger' }} />
  </Stack.Navigator>);
}

function CustomerStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="CustomerList" component={CustomerListScreen} options={{ title: 'Customers' }} />
    <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: 'Customer' }} />
    <Stack.Screen name="CustomerForm" component={CustomerFormScreen} options={({ route }: any) => ({ title: route.params?.id ? 'Edit Customer' : 'New Customer' })} />
  </Stack.Navigator>);
}

function ExpenseStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="ExpenseList" component={ExpenseListScreen} options={{ title: 'Expenses' }} />
  </Stack.Navigator>);
}

function ItemStackNav() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="ItemList" component={ItemListScreen} options={{ title: 'Items' }} />
    <Stack.Screen name="ItemForm" component={ItemFormScreen} options={({ route }: any) => ({ title: route.params?.id ? 'Edit Item' : 'New Item' })} />
  </Stack.Navigator>);
}

function QuotationStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="QuotationList" component={QuotationListScreen} options={{ title: 'Quotations' }} />
    <Stack.Screen name="QuotationDetail" component={QuotationDetailScreen} options={{ title: 'Quotation' }} />
    <Stack.Screen name="QuotationForm" component={QuotationFormScreen} options={({ route }: any) => ({ title: route.params?.id ? 'Edit Quotation' : 'New Quotation' })} />
  </Stack.Navigator>);
}

function VendorStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="VendorList" component={VendorListScreen} options={{ title: 'Vendors' }} />
    <Stack.Screen name="VendorDetail" component={VendorDetailScreen} options={{ title: 'Vendor' }} />
    <Stack.Screen name="VendorForm" component={VendorFormScreen} options={({ route }: any) => ({ title: route.params?.id ? 'Edit Vendor' : 'New Vendor' })} />
  </Stack.Navigator>);
}

function POStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="POList" component={POListScreen} options={{ title: 'Purchase Orders' }} />
    <Stack.Screen name="PODetail" component={PODetailScreen} options={{ title: 'Purchase Order' }} />
    <Stack.Screen name="POForm" component={POFormScreen} options={({ route }: any) => ({ title: route.params?.id ? 'Edit PO' : 'New PO' })} />
  </Stack.Navigator>);
}

function PBStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="PBList" component={PBListScreen} options={{ title: 'Purchase Bills' }} />
    <Stack.Screen name="PBDetail" component={PBDetailScreen} options={{ title: 'Purchase Bill' }} />
    <Stack.Screen name="PBForm" component={PBFormScreen} options={({ route }: any) => ({ title: route.params?.id ? 'Edit Bill' : 'New Bill' })} />
    <Stack.Screen name="Payables" component={PayablesScreen} options={{ title: 'Total Payables' }} />
    <Stack.Screen name="VendorLedger" component={VendorLedgerScreen} options={{ title: 'Vendor Ledger' }} />
  </Stack.Navigator>);
}

function EmployeeStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="EmployeeList" component={EmployeeListScreen} options={{ title: 'Employees' }} />
    <Stack.Screen name="EmployeeDetail" component={EmployeeDetailScreen} options={{ title: 'Employee' }} />
    <Stack.Screen name="EmployeeForm" component={EmployeeFormScreen} options={({ route }: any) => ({ title: route.params?.id ? 'Edit Employee' : 'New Employee' })} />
  </Stack.Navigator>);
}

function PayrollStackNav() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="PayrollHome" component={PayrollScreen} options={{ title: 'Payroll' }} />
  </Stack.Navigator>);
}

function TaskBackButton() {
  const nav = useNavigation<any>();
  return (
    <TouchableOpacity
      style={{ marginLeft: 8, flexDirection: 'row', alignItems: 'center' }}
      onPress={() => nav.canGoBack() ? nav.goBack() : nav.navigate('TaskList')}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name="chevron-back" size={26} color={colors.white} />
    </TouchableOpacity>
  );
}

function TaskStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="TaskList" component={TaskListScreen} options={{ title: 'Tasks & Orders' }} />
    <Stack.Screen
      name="TaskDetail"
      component={TaskDetailScreen}
      options={({ route }: any) => ({
        title: route.params?.task_type === 'order' ? 'Order' : 'Task',
        headerLeft: () => <TaskBackButton />,
      })}
    />
    <Stack.Screen
      name="TaskForm"
      component={TaskFormScreen}
      options={({ route }: any) => ({
        title: route.params?.id
          ? (route.params?.task_type === 'order' ? 'Edit Order' : 'Edit Task')
          : (route.params?.task_type === 'order' ? 'New Order' : 'New Task'),
        headerLeft: () => <TaskBackButton />,
      })}
    />
  </Stack.Navigator>);
}

function InventoryStackNav() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="InventoryHome" component={InventoryScreen} options={{ title: 'Inventory' }} />
  </Stack.Navigator>);
}

function PurchasePaymentStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="PurchasePaymentList" component={PurchasePaymentListScreen} options={{ title: 'Purchase Payments' }} />
    <Stack.Screen name="PurchasePaymentDetail" component={PurchasePaymentDetailScreen} options={{ title: 'Payment Voucher' }} />
  </Stack.Navigator>);
}

function BusinessStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="BusinessList" component={BusinessListScreen} options={{ title: 'Businesses' }} />
    <Stack.Screen name="Onboarding" component={OnboardingScreen} options={({ route }: any) => ({ title: route.params?.editId ? 'Edit Business' : 'Add Business' })} />
  </Stack.Navigator>);
}

function GSTStackNav() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="GSTHome" component={GSTScreen} options={{ title: 'GST Returns' }} />
  </Stack.Navigator>);
}

function EwayBillStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="EwayBillList" component={EwayBillListScreen} options={{ title: 'E-Way Bills' }} />
    <Stack.Screen name="EwayBillDetail" component={EwayBillDetailScreen} options={{ title: 'E-Way Bill' }} />
    <Stack.Screen name="EwayBillForm" component={EwayBillFormScreen} options={{ title: 'E-Way Bill' }} />
  </Stack.Navigator>);
}

function CreditNoteStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="CreditNoteList" component={CreditNoteListScreen} options={{ title: 'Credit Notes' }} />
    <Stack.Screen name="CreditNoteDetail" component={CreditNoteDetailScreen} options={{ title: 'Credit Note' }} />
    <Stack.Screen name="CreditNoteForm" component={CreditNoteFormScreen} options={({ route }: any) => ({ title: route.params?.id ? 'Edit Credit Note' : 'New Credit Note' })} />
  </Stack.Navigator>);
}

function DebitNoteStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="DebitNoteList" component={DebitNoteListScreen} options={{ title: 'Debit Notes' }} />
    <Stack.Screen name="DebitNoteDetail" component={DebitNoteDetailScreen} options={{ title: 'Debit Note' }} />
    <Stack.Screen name="DebitNoteForm" component={DebitNoteFormScreen} options={({ route }: any) => ({ title: route.params?.id ? 'Edit Debit Note' : 'New Debit Note' })} />
  </Stack.Navigator>);
}

function RecurringInvoiceStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="RecurringInvoiceList" component={RecurringInvoiceListScreen} options={{ title: 'Recurring Invoices' }} />
  </Stack.Navigator>);
}

function DeliveryChallanStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="DCList" component={DeliveryChallanListScreen} options={{ title: 'Delivery Challans' }} />
    <Stack.Screen name="DCDetail" component={DeliveryChallanDetailScreen} options={{ title: 'Delivery Challan' }} />
    <Stack.Screen name="DCForm" component={DeliveryChallanFormScreen} options={({ route }: any) => ({ title: route.params?.id ? 'Edit Challan' : 'New Challan' })} />
  </Stack.Navigator>);
}

function ContractStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="ContractorList" component={ContractorListScreen} options={{ title: 'Contractors' }} />
    <Stack.Screen name="ContractorPayouts" component={ContractorPayoutScreen} options={{ title: 'Payouts' }} />
  </Stack.Navigator>);
}

function LedgerStackNav() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="LedgerHome" component={LedgerScreen} options={{ title: 'Ledger' }} />
  </Stack.Navigator>);
}

function ReceiptStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="ReceiptList" component={ReceiptListScreen} options={{ title: 'Receipts' }} />
    <Stack.Screen name="ReceiptDetail" component={ReceiptDetailScreen} options={{ title: 'Receipt' }} />
  </Stack.Navigator>);
}

function PaymentVoucherStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="PaymentVoucherList" component={PaymentVoucherListScreen} options={{ title: 'Payment Vouchers' }} />
    <Stack.Screen name="PaymentVoucherDetail" component={PaymentVoucherDetailScreen} options={{ title: 'Payment Voucher' }} />
  </Stack.Navigator>);
}

function PaymentReminderStackNav() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="PaymentReminderHome" component={PaymentReminderScreen} options={{ title: 'Payment Reminders' }} />
  </Stack.Navigator>);
}

function CustomFieldStackNav() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="CustomFieldHome" component={CustomFieldScreen} options={{ title: 'Custom Fields' }} />
  </Stack.Navigator>);
}

function PaymentStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="PaymentList" component={PaymentListScreen} options={{ title: 'Payments' }} />
    <Stack.Screen name="PaymentDetail" component={PaymentDetailScreen} options={{ title: 'Receipt' }} />
  </Stack.Navigator>);
}

function ReportsStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="ReportsHome" component={ReportsScreen} options={{ title: 'Reports' }} />
    <Stack.Screen name="ReportDetail" component={ReportDetailScreen} options={{ title: 'Report' }} />
  </Stack.Navigator>);
}

function SettingsStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="SettingsHome" component={SettingsScreen} options={{ title: 'Settings' }} />
    <Stack.Screen name="Templates" component={TemplatesScreen} options={{ title: 'Document Templates' }} />
    <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ title: 'Subscription' }} />
    <Stack.Screen name="HelpSupport" component={HelpSupportScreen} options={{ title: 'Help & Support' }} />
  </Stack.Navigator>);
}

function NotificationsStack() {
  return (<Stack.Navigator screenOptions={navHeader}>
    <Stack.Screen name="NotificationsHome" component={NotificationsScreen} options={{ title: 'Notifications' }} />
  </Stack.Navigator>);
}

// Bottom Tabs
const Tab = createBottomTabNavigator();

function BottomTabs() {
  const insets = useSafeAreaInsets();
  const { stealthActive } = useAuth();

  // Visible tabs change based on stealth mode
  // Normal: Dashboard, Invoices, Expenses, Purchase
  // Private: Dashboard, Invoices, Purchase, Customers, Vendors
  const visibleSet = stealthActive
    ? new Set(['Dashboard', 'Invoices', 'Purchase', 'Customers', 'Vendors'])
    : new Set(['Dashboard', 'Invoices', 'Expenses', 'Purchase']);

  const hidden = (name: string) => visibleSet.has(name) ? undefined : { tabBarItemStyle: { display: 'none' as const } };

  return (
    <QuickAddProvider>
    <GlobalSearchProvider>
    <PreviewProvider>
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.gray400,
      tabBarStyle: { height: 65 + insets.bottom, paddingTop: 8, paddingBottom: 10 + insets.bottom, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e5e7eb', elevation: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
      tabBarIcon: ({ color }) => {
        const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
          Dashboard: 'grid', Invoices: 'document-text', Expenses: 'receipt', Customers: 'people', Purchase: 'bag-handle', Vendors: 'storefront',
        };
        return <Ionicons name={icons[route.name] || 'ellipsis-horizontal'} size={24} color={color} />;
      },
    })}>
      <Tab.Screen name="Dashboard" component={DashboardStack} options={hidden('Dashboard')} />
      <Tab.Screen
        name="Invoices"
        component={InvoiceStack}
        options={hidden('Invoices')}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('Invoices', { screen: 'InvoiceList' });
          },
        })}
      />
      <Tab.Screen name="Expenses" component={ExpenseStack} options={hidden('Expenses')} />
      <Tab.Screen name="Customers" component={CustomerStack} options={hidden('Customers')} />
      <Tab.Screen
        name="Purchase"
        component={PBStack}
        options={hidden('Purchase')}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('Purchase', { screen: 'PBList' });
          },
        })}
      />
      {/* Hidden tabs — accessible from drawer only */}
      <Tab.Screen name="Items" component={ItemStackNav} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="Quotations" component={QuotationStack} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="Vendors" component={VendorStack} options={hidden('Vendors')} />
      <Tab.Screen name="PurchaseOrders" component={POStack} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="PurchaseBills" component={PBStack} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="Employees" component={EmployeeStack} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="Payroll" component={PayrollStackNav} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="Payments" component={PaymentStack} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="Reports" component={ReportsStack} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="Settings" component={SettingsStack} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="Notifications" component={NotificationsStack} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="Tasks" component={TaskStack} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="Inventory" component={InventoryStackNav} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="PurchasePayments" component={PurchasePaymentStack} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="Business" component={BusinessStack} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="GST" component={GSTStackNav} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="EwayBills" component={EwayBillStack} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="CreditNotes" component={CreditNoteStack} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="DebitNotes" component={DebitNoteStack} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="RecurringInvoices" component={RecurringInvoiceStack} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="DeliveryChallans" component={DeliveryChallanStack} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="Contracts" component={ContractStack} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="Ledger" component={LedgerStackNav} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="Receipts" component={ReceiptStack} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="PaymentVouchers" component={PaymentVoucherStack} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="PaymentReminders" component={PaymentReminderStackNav} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tab.Screen name="CustomFields" component={CustomFieldStackNav} options={{ tabBarItemStyle: { display: 'none' } }} />
    </Tab.Navigator>
    </PreviewProvider>
    </GlobalSearchProvider>
    </QuickAddProvider>
  );
}

// Drawer menu items
interface DrawerItem { label: string; icon: keyof typeof Ionicons.glyphMap; tab: string; screen?: string; hideWhenPrivate?: boolean; }
interface DrawerGroup { title: string; items: DrawerItem[]; hideWhenPrivate?: boolean; }

const drawerGroups: DrawerGroup[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', icon: 'grid-outline', tab: 'Dashboard' },
      { label: 'Notifications', icon: 'notifications-outline', tab: 'Notifications' },
    ],
  },
  {
    title: 'Sales',
    items: [
      { label: 'Invoices', icon: 'document-text-outline', tab: 'Invoices' },
      { label: 'Quotations', icon: 'document-outline', tab: 'Quotations' },
      { label: 'Recurring Invoices', icon: 'repeat-outline', tab: 'RecurringInvoices' },
      { label: 'Delivery Challans', icon: 'send-outline', tab: 'DeliveryChallans' },
      { label: 'Credit Notes', icon: 'remove-circle-outline', tab: 'CreditNotes' },
      { label: 'Payments', icon: 'cash-outline', tab: 'Payments' },
      { label: 'Receipts', icon: 'reader-outline', tab: 'Receipts' },
      { label: 'Customers', icon: 'people-outline', tab: 'Customers' },
    ],
  },
  {
    title: 'Purchases',
    items: [
      { label: 'Purchase Bills', icon: 'newspaper-outline', tab: 'PurchaseBills' },
      { label: 'Purchase Orders', icon: 'cart-outline', tab: 'PurchaseOrders' },
      { label: 'Debit Notes', icon: 'add-circle-outline', tab: 'DebitNotes' },
      { label: 'Purchase Payments', icon: 'card-outline', tab: 'PurchasePayments' },
      { label: 'Payment Vouchers', icon: 'document-attach-outline', tab: 'PaymentVouchers' },
      { label: 'Vendors', icon: 'storefront-outline', tab: 'Vendors' },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { label: 'Items', icon: 'cube-outline', tab: 'Items' },
      { label: 'Stock', icon: 'layers-outline', tab: 'Inventory' },
    ],
  },
  {
    title: 'People',
    items: [
      { label: 'Employees', icon: 'person-outline', tab: 'Employees' },
      { label: 'Payroll', icon: 'wallet-outline', tab: 'Payroll' },
      { label: 'Contractors', icon: 'briefcase-outline', tab: 'Contracts' },
    ],
  },
  {
    title: 'Services',
    items: [
      { label: 'Tasks & Orders', icon: 'checkbox-outline', tab: 'Tasks' },
      { label: 'Expenses', icon: 'receipt-outline', tab: 'Expenses' },
    ],
  },
  {
    title: 'Reports & Compliance',
    items: [
      { label: 'Reports', icon: 'bar-chart-outline', tab: 'Reports' },
      { label: 'Ledger', icon: 'book-outline', tab: 'Ledger' },
      { label: 'GST Returns', icon: 'calculator-outline', tab: 'GST', hideWhenPrivate: true },
      { label: 'E-Way Bills', icon: 'car-outline', tab: 'EwayBills', hideWhenPrivate: true },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Business', icon: 'business-outline', tab: 'Business' },
      { label: 'Payment Reminders', icon: 'alarm-outline', tab: 'PaymentReminders' },
      { label: 'Custom Fields', icon: 'options-outline', tab: 'CustomFields' },
      { label: 'Settings', icon: 'settings-outline', tab: 'Settings' },
      { label: 'Help & Support', icon: 'headset-outline', tab: 'Settings', screen: 'HelpSupport' },
    ],
  },
];

function DrawerNavigator({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const navigation = useNavigation<any>();
  const { user, logout, stealthActive } = useAuth();
  const isPrivate = stealthActive || !!user?.is_private;

  const navigateTab = (tab: string, screen?: string) => {
    onClose();
    setTimeout(() => {
      if (screen) { navigation.navigate(tab, { screen }); }
      else { navigation.navigate(tab); }
    }, 100);
  };
  const handleLogout = () => { onClose(); Alert.alert('Logout', 'Are you sure?', [{ text: 'Cancel' }, { text: 'Logout', style: 'destructive', onPress: logout }]); };

  const visibleGroups = drawerGroups
    .filter(g => !(isPrivate && g.hideWhenPrivate))
    .map(g => ({
      ...g,
      items: g.items.filter(i => !(isPrivate && i.hideWhenPrivate)),
    }))
    .filter(g => g.items.length > 0);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={dS.overlay}>
        <TouchableOpacity style={dS.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={dS.drawer}>
          <View style={[dS.header, stealthActive && { backgroundColor: '#0e3d2c' }]}>
            <View style={dS.avatar}><Ionicons name={stealthActive ? 'shield-checkmark' : 'person'} size={28} color={colors.white} /></View>
            <Text style={dS.email} numberOfLines={1}>{user?.email || 'User'}</Text>
            <Text style={dS.role}>{stealthActive ? 'Private mode' : (user?.role || 'admin')}</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: spacing.md }}>
            {visibleGroups.map((group, gi) => (
              <View key={gi} style={gi > 0 ? dS.groupSpacer : undefined}>
                <Text style={dS.groupTitle}>{group.title}</Text>
                {group.items.map((item, i) => (
                  <TouchableOpacity key={i} style={dS.menuItem} onPress={() => navigateTab(item.tab, item.screen)} activeOpacity={0.7}>
                    <View style={dS.menuIconWrap}>
                      <Ionicons name={item.icon} size={18} color={colors.primary} />
                    </View>
                    <Text style={dS.menuLabel}>{item.label}</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.gray300} />
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={dS.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={colors.danger} />
            <Text style={dS.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function StealthPinModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { stealthActive, stealthConfigured, enterStealth, exitStealth } = useAuth();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { if (!visible) { setPin(''); setErr(''); setBusy(false); } }, [visible]);

  const isExit = stealthActive;
  const cantConfigure = !stealthActive && !stealthConfigured;

  const handleSubmit = async () => {
    setErr('');
    if (isExit) {
      setBusy(true);
      try { await exitStealth(); onClose(); }
      catch (e: any) { setErr(e?.message || 'Failed'); }
      finally { setBusy(false); }
      return;
    }
    if (!pin) return setErr('Enter PIN');
    setBusy(true);
    try { await enterStealth(pin); onClose(); }
    catch (e: any) { setErr(e?.message || 'Wrong PIN'); setPin(''); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={pmS.overlay}>
        <TouchableOpacity style={pmS.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={pmS.card}>
          <View style={[pmS.iconCircle, isExit && { backgroundColor: '#10b98120' }]}>
            <Ionicons name={isExit ? 'lock-open-outline' : 'lock-closed-outline'} size={26} color={isExit ? '#10b981' : colors.primary} />
          </View>
          <Text style={pmS.title}>{isExit ? 'Exit private mode?' : 'Enter PIN'}</Text>
          <Text style={pmS.sub}>
            {isExit
              ? "You'll return to your primary account."
              : (cantConfigure
                  ? 'No private account configured. Set one up from Settings → Security.'
                  : 'Unlock your private account.')}
          </Text>

          {!isExit && !cantConfigure && (
            <TextInput
              style={pmS.input}
              value={pin}
              onChangeText={setPin}
              placeholder="••••"
              placeholderTextColor={colors.gray300}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              autoFocus
              onSubmitEditing={handleSubmit}
            />
          )}

          {err ? <Text style={pmS.err}>{err}</Text> : null}

          <View style={pmS.actions}>
            <TouchableOpacity style={pmS.btnGhost} onPress={onClose}>
              <Text style={pmS.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            {!cantConfigure && (
              <TouchableOpacity
                style={[pmS.btnPrimary, isExit && { backgroundColor: '#10b981' }, busy && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={busy}
              >
                {busy ? <ActivityIndicator size="small" color="#fff" /> : (
                  <Text style={pmS.btnPrimaryText}>{isExit ? 'Exit' : 'Unlock'}</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function AppWithDrawer() {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);
  const openDrawer = useCallback(() => setDrawerVisible(true), []);
  const closeDrawer = useCallback(() => setDrawerVisible(false), []);
  const promptPin = useCallback(() => setPinVisible(true), []);
  const closePin = useCallback(() => setPinVisible(false), []);

  return (
    <DrawerContext.Provider value={{ open: openDrawer, close: closeDrawer }}>
      <StealthPromptContext.Provider value={{ prompt: promptPin }}>
        <View style={{ flex: 1 }}>
          <BottomTabs />
          <DrawerNavigator visible={drawerVisible} onClose={closeDrawer} />
          <StealthPinModal visible={pinVisible} onClose={closePin} />
        </View>
      </StealthPromptContext.Provider>
    </DrawerContext.Provider>
  );
}

const { width } = Dimensions.get('window');
const dS = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawer: { width: width * 0.78, backgroundColor: colors.white, position: 'absolute', left: 0, top: 0, bottom: 0, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
  header: { backgroundColor: colors.primary, padding: spacing.lg, paddingTop: 60 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  email: { color: colors.white, fontSize: fontSize.md, fontWeight: '600', marginTop: spacing.sm },
  role: { color: colors.gray300, fontSize: fontSize.sm, marginTop: 2, textTransform: 'capitalize' },
  groupTitle: { fontSize: 11, fontWeight: '800', color: colors.gray500, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 6 },
  groupSpacer: { borderTopWidth: 1, borderTopColor: colors.gray100, marginTop: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 11, gap: 12 },
  menuIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primary + '10', alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: fontSize.md, color: colors.gray800, flex: 1, fontWeight: '600' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.gray100, marginBottom: 30 },
  logoutText: { color: colors.danger, fontSize: fontSize.md, fontWeight: '600', marginLeft: spacing.md },
});

const pmS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  backdrop: { ...StyleSheet.absoluteFillObject },
  card: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 20, padding: 22, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14, elevation: 8 },
  iconCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4 },
  sub: { fontSize: 13, color: colors.gray500, textAlign: 'center', marginBottom: 14, fontWeight: '500' },
  input: { width: '100%', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 22, fontWeight: '700', textAlign: 'center', letterSpacing: 8, color: colors.text, marginBottom: 4 },
  err: { color: colors.danger, fontSize: 12, marginTop: 8, fontWeight: '600', textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16, width: '100%' },
  btnGhost: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: colors.gray100 },
  btnGhostText: { fontSize: 14, fontWeight: '700', color: colors.gray700 },
  btnPrimary: { flex: 1.4, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  btnPrimaryText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
