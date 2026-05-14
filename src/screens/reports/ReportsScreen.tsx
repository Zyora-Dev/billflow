import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, Share, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import DateInput from '../../components/DateInput';
import api from '../../api/client';
import { colors, spacing, fontSize } from '../../theme';

// ── types (re-exported for ReportDetailScreen) ──
export type ReportKey =
  | 'aging' | 'customer-wise-sales' | 'vendor-wise-purchases'
  | 'item-wise-sales' | 'item-wise-purchases'
  | 'sales-trend' | 'purchase-trend'
  | 'profit-loss' | 'cash-flow' | 'day-book'
  | 'hsn-sales' | 'hsn-purchases' | 'gst-summary'
  | 'sales-return' | 'purchase-return'
  | 'low-stock' | 'stock-movement'
  | 'attendance' | 'payroll' | 'tasks' | 'party-balance';

export interface ReportDef {
  key: ReportKey;
  title: string;
  description: string;
  category: 'Sales' | 'Purchase' | 'Inventory' | 'Financial' | 'Tax' | 'Parties' | 'HR' | 'Tasks';
  icon: string;
  needsDateRange?: boolean;
  needsMonthYear?: boolean;
}

export const REPORTS: ReportDef[] = [
  { key: 'customer-wise-sales', title: 'Customer-wise Sales', description: 'Top customers', category: 'Sales', icon: 'people-outline', needsDateRange: true },
  { key: 'item-wise-sales', title: 'Item-wise Sales', description: 'Best-selling items', category: 'Sales', icon: 'cube-outline', needsDateRange: true },
  { key: 'sales-trend', title: 'Sales Trend', description: 'By day/week/month', category: 'Sales', icon: 'trending-up-outline', needsDateRange: true },
  { key: 'sales-return', title: 'Sales Returns', description: 'Credit notes', category: 'Sales', icon: 'arrow-undo-outline', needsDateRange: true },
  { key: 'vendor-wise-purchases', title: 'Vendor-wise Purchases', description: 'Top vendors', category: 'Purchase', icon: 'storefront-outline', needsDateRange: true },
  { key: 'item-wise-purchases', title: 'Item-wise Purchases', description: 'Most-bought items', category: 'Purchase', icon: 'bag-handle-outline', needsDateRange: true },
  { key: 'purchase-trend', title: 'Purchase Trend', description: 'By day/week/month', category: 'Purchase', icon: 'trending-down-outline', needsDateRange: true },
  { key: 'purchase-return', title: 'Purchase Returns', description: 'Debit notes', category: 'Purchase', icon: 'arrow-redo-outline', needsDateRange: true },
  { key: 'low-stock', title: 'Low Stock', description: 'Below alert qty', category: 'Inventory', icon: 'alert-circle-outline' },
  { key: 'stock-movement', title: 'Stock Movement', description: 'In/Out per item', category: 'Inventory', icon: 'swap-horizontal-outline', needsDateRange: true },
  { key: 'profit-loss', title: 'Profit & Loss', description: 'P&L statement', category: 'Financial', icon: 'stats-chart-outline', needsDateRange: true },
  { key: 'cash-flow', title: 'Cash Flow', description: 'Money in vs out', category: 'Financial', icon: 'wallet-outline', needsDateRange: true },
  { key: 'day-book', title: 'Day Book', description: 'All transactions', category: 'Financial', icon: 'book-outline', needsDateRange: true },
  { key: 'gst-summary', title: 'GST Summary', description: 'Output - Input', category: 'Tax', icon: 'receipt-outline', needsDateRange: true },
  { key: 'hsn-sales', title: 'HSN-wise Sales', description: 'By HSN & rate', category: 'Tax', icon: 'pricetags-outline', needsDateRange: true },
  { key: 'hsn-purchases', title: 'HSN-wise Purchases', description: 'By HSN & rate', category: 'Tax', icon: 'pricetag-outline', needsDateRange: true },
  { key: 'aging', title: 'Aging', description: '0-30/30-60/60-90/90+', category: 'Parties', icon: 'time-outline' },
  { key: 'party-balance', title: 'Party Balances', description: 'Debtors & creditors', category: 'Parties', icon: 'cash-outline' },
  { key: 'attendance', title: 'Attendance Report', description: 'Monthly summary', category: 'HR', icon: 'calendar-outline', needsMonthYear: true },
  { key: 'payroll', title: 'Payroll Report', description: 'Salary disbursed', category: 'HR', icon: 'briefcase-outline', needsMonthYear: true },
  { key: 'tasks', title: 'Task Report', description: 'By employee', category: 'Tasks', icon: 'checkbox-outline', needsDateRange: true },
];

// ── tab config ──
type TabKey = 'sales' | 'receivables' | 'purchase' | 'payables' | 'expenses' | 'service-payments' | 'payroll';
const TABS: { key: TabKey; label: string; icon: string; accent: string }[] = [
  { key: 'sales', label: 'Sales', icon: 'trending-up', accent: '#10b981' },
  { key: 'receivables', label: 'Receivables', icon: 'wallet', accent: '#3b82f6' },
  { key: 'purchase', label: 'Purchase', icon: 'cart', accent: '#f97316' },
  { key: 'payables', label: 'Payables', icon: 'card', accent: '#ef4444' },
  { key: 'expenses', label: 'Expenses', icon: 'receipt', accent: '#8b5cf6' },
  { key: 'service-payments', label: 'Svc Pay', icon: 'cash', accent: '#14b8a6' },
  { key: 'payroll', label: 'Payroll', icon: 'briefcase', accent: '#6366f1' },
];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmt(n: number | null | undefined) {
  return '\u20B9' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtD(n: number | null | undefined) {
  return '\u20B9' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pct(a: number, b: number) { return b > 0 ? ((a / b) * 100).toFixed(1) : '0'; }
function initial(s: string) { return (s || '?').charAt(0).toUpperCase(); }

export default function ReportsScreen({ navigation }: { navigation: any }) {
  const [tab, setTab] = useState<TabKey>('sales');
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [payrollMonth, setPayrollMonth] = useState(new Date().getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState(new Date().getFullYear());

  const [salesData, setSalesData] = useState<any>(null);
  const [invoiceList, setInvoiceList] = useState<any[]>([]);
  const [receivablesData, setReceivablesData] = useState<any[]>([]);
  const [purchaseData, setPurchaseData] = useState<any>(null);
  const [billList, setBillList] = useState<any[]>([]);
  const [payablesData, setPayablesData] = useState<any[]>([]);
  const [expenseData, setExpenseData] = useState<any>(null);
  const [serviceData, setServiceData] = useState<any>(null);
  const [servicePayments, setServicePayments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [serviceEmpFilter, setServiceEmpFilter] = useState<number | null>(null);
  const [payrollData, setPayrollData] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/api/business');
        const oid = r.data[0]?.org_id || '';
        setOrgId(oid);
        if (oid) {
          try {
            const empR = await api.get('/api/employees?org_id=' + oid);
            setEmployees(Array.isArray(empR.data) ? empR.data : []);
          } catch {}
        }
      } catch {}
    })();
  }, []);

  const dateParams = useCallback(() => {
    let p = '';
    if (dateFrom) p += '&date_from=' + dateFrom;
    if (dateTo) p += '&date_to=' + dateTo;
    return p;
  }, [dateFrom, dateTo]);

  const fetchTab = useCallback(async (t: TabKey) => {
    if (!orgId) return;
    setLoading(true);
    try {
      const dp = dateParams();
      switch (t) {
        case 'sales': {
          const [sumR, invR] = await Promise.all([
            api.get('/api/reports/summary?org_id=' + orgId + dp),
            api.get('/api/invoices?org_id=' + orgId + dp + '&limit=20'),
          ]);
          setSalesData(sumR.data);
          setInvoiceList(invR.data?.data || invR.data || []);
          break;
        }
        case 'receivables': {
          const r = await api.get('/api/reports/customer-outstanding?org_id=' + orgId + dp);
          setReceivablesData(r.data || []);
          break;
        }
        case 'purchase': {
          const [sumR, billR] = await Promise.all([
            api.get('/api/reports/purchase-summary?org_id=' + orgId + dp),
            api.get('/api/purchase-bills?org_id=' + orgId + dp + '&limit=20'),
          ]);
          setPurchaseData(sumR.data);
          setBillList(billR.data?.data || billR.data || []);
          break;
        }
        case 'payables': {
          const r = await api.get('/api/reports/vendor-outstanding?org_id=' + orgId + dp);
          setPayablesData(r.data || []);
          break;
        }
        case 'expenses': {
          const r = await api.get('/api/reports/expense-summary?org_id=' + orgId + dp);
          setExpenseData(r.data);
          break;
        }
        case 'service-payments': {
          try {
            const empQ = serviceEmpFilter ? '&employee_id=' + serviceEmpFilter : '';
            const [sumR, listR] = await Promise.all([
              api.get('/api/service-payments/summary?org_id=' + orgId + dp + empQ),
              api.get('/api/service-payments?org_id=' + orgId + dp + empQ),
            ]);
            setServiceData(sumR.data);
            setServicePayments(Array.isArray(listR.data) ? listR.data : []);
          } catch {
            setServiceData({ total: 0, count: 0, by_employee: [], by_method: {} });
            setServicePayments([]);
          }
          break;
        }
        case 'payroll': {
          const r = await api.get('/api/payroll?org_id=' + orgId + '&month=' + payrollMonth + '&year=' + payrollYear);
          setPayrollData(r.data || []);
          break;
        }
      }
    } catch {} finally { setLoading(false); }
  }, [orgId, dateParams, payrollMonth, payrollYear, serviceEmpFilter]);

  useEffect(() => { if (orgId) fetchTab(tab); }, [orgId, tab, fetchTab]);

  const onRefresh = async () => { setRefreshing(true); await fetchTab(tab); setRefreshing(false); };

  // ── Comprehensive PDF download ──
  async function downloadPDF() {
    const tabLabel = TABS.find(t => t.key === tab)?.label || 'Report';
    const dateRange = dateFrom || dateTo ? `${dateFrom || 'Start'} to ${dateTo || 'Today'}` : 'All Time';
    const genDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const genTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    // Fetch full data for PDF (not just screen data which may be limited)
    let fullInvoices: any[] = [];
    let fullBills: any[] = [];
    try {
      const dp = dateParams();
      if (tab === 'sales') {
        const r = await api.get('/api/invoices?org_id=' + orgId + dp + '&limit=500');
        fullInvoices = r.data?.data || r.data || [];
      } else if (tab === 'purchase') {
        const r = await api.get('/api/purchase-bills?org_id=' + orgId + dp + '&limit=500');
        fullBills = r.data?.data || r.data || [];
      }
    } catch {}

    const css = `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1f2937; font-size: 11px; line-height: 1.4; }
        .page { padding: 24px 28px; }
        .header { border-bottom: 3px solid #1a1a40; padding-bottom: 12px; margin-bottom: 16px; }
        .header h1 { font-size: 22px; font-weight: 900; color: #1a1a40; margin: 0; }
        .header-sub { display: flex; justify-content: space-between; margin-top: 4px; }
        .header-sub span { font-size: 10px; color: #6b7280; }
        .summary-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
        .summary-box { flex: 1; min-width: 120px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; }
        .summary-box .label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; font-weight: 700; }
        .summary-box .val { font-size: 16px; font-weight: 900; color: #1f2937; margin-top: 2px; }
        .summary-box .sub { font-size: 9px; color: #6b7280; margin-top: 1px; }
        .section { margin-bottom: 16px; }
        .section-title { font-size: 11px; font-weight: 800; color: #1a1a40; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        thead th { background: #1a1a40; color: #fff; padding: 7px 6px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }
        thead th.r { text-align: right; }
        thead th.c { text-align: center; }
        tbody td { padding: 6px; border-bottom: 1px solid #f3f4f6; }
        tbody tr:nth-child(even) { background: #fafbfc; }
        td.r { text-align: right; }
        td.c { text-align: center; }
        td.bold { font-weight: 700; }
        .total-row td { border-top: 2px solid #1a1a40; font-weight: 800; background: #f0f1f5; padding: 8px 6px; }
        .badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 8px; font-weight: 700; }
        .badge-paid { background: #dcfce7; color: #15803d; }
        .badge-partial { background: #dbeafe; color: #1d4ed8; }
        .badge-overdue { background: #fee2e2; color: #dc2626; }
        .badge-draft { background: #f3f4f6; color: #6b7280; }
        .badge-sent { background: #e0f2fe; color: #0369a1; }
        .badge-cancelled { background: #f3f4f6; color: #9ca3af; }
        .metric-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f3f4f6; }
        .metric-row .k { color: #6b7280; }
        .metric-row .v { font-weight: 700; }
        .bar-container { height: 6px; background: #f3f4f6; border-radius: 3px; overflow: hidden; margin-top: 3px; }
        .bar-fill { height: 6px; border-radius: 3px; }
        .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 9px; color: #9ca3af; }
        .highlight { color: #ef4444; font-weight: 700; }
        .green { color: #059669; }
        .amber { color: #d97706; }
        .red { color: #dc2626; }
      </style>`;

    function badgeHtml(status: string) {
      const cls: Record<string, string> = { Paid: 'badge-paid', 'Partially Paid': 'badge-partial', Overdue: 'badge-overdue', Draft: 'badge-draft', Sent: 'badge-sent', Received: 'badge-sent', Cancelled: 'badge-cancelled' };
      return `<span class="badge ${cls[status] || 'badge-draft'}">${status}</span>`;
    }
    function fmtP(n: number) { return '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function fmtI(n: number) { return '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
    function pctP(a: number, b: number) { return b > 0 ? ((a / b) * 100).toFixed(1) : '0.0'; }

    let body = '';

    if (tab === 'sales' && salesData) {
      const d = salesData;
      const inv = fullInvoices.length ? fullInvoices : invoiceList;
      const colRate = pctP(d.total_received, d.total_invoiced);
      body = `
        <div class="summary-grid">
          <div class="summary-box"><div class="label">Total Invoiced</div><div class="val">${fmtI(d.total_invoiced)}</div><div class="sub">${d.total_invoices} invoices</div></div>
          <div class="summary-box"><div class="label">Amount Received</div><div class="val green">${fmtI(d.total_received)}</div><div class="sub">${d.total_payments || 0} payments</div></div>
          <div class="summary-box"><div class="label">Outstanding</div><div class="val amber">${fmtI(d.total_outstanding)}</div><div class="sub">${d.unpaid_count} unpaid</div></div>
          <div class="summary-box"><div class="label">Collection Rate</div><div class="val">${colRate}%</div><div class="sub">${d.overdue_count} overdue</div></div>
        </div>
        <div class="section">
          <div class="section-title">Financial Summary</div>
          <div class="metric-row"><span class="k">Gross Invoiced</span><span class="v">${fmtP(d.total_invoiced)}</span></div>
          <div class="metric-row"><span class="k">Less: Credit Notes</span><span class="v red">- ${fmtP(d.total_credit_notes || 0)}</span></div>
          <div class="metric-row" style="border-top:2px solid #e5e7eb"><span class="k" style="font-weight:800">Net Invoiced</span><span class="v" style="font-size:13px">${fmtP(d.net_invoiced || d.total_invoiced)}</span></div>
          <div class="metric-row"><span class="k">Amount Received</span><span class="v green">${fmtP(d.total_received)}</span></div>
          <div class="metric-row"><span class="k">Balance Outstanding</span><span class="v amber">${fmtP(d.total_outstanding)}</span></div>
        </div>
        <div class="section">
          <div class="section-title">Invoice Status Breakdown</div>
          <div class="metric-row"><span class="k">Paid</span><span class="v green">${d.paid_count} (${pctP(d.paid_count, d.total_invoices)}%)</span></div>
          <div class="bar-container"><div class="bar-fill" style="width:${pctP(d.paid_count, d.total_invoices)}%;background:#10b981"></div></div>
          <div class="metric-row"><span class="k">Unpaid</span><span class="v amber">${d.unpaid_count} (${pctP(d.unpaid_count, d.total_invoices)}%)</span></div>
          <div class="bar-container"><div class="bar-fill" style="width:${pctP(d.unpaid_count, d.total_invoices)}%;background:#f59e0b"></div></div>
          <div class="metric-row"><span class="k">Overdue</span><span class="v red">${d.overdue_count} (${pctP(d.overdue_count, d.total_invoices)}%)</span></div>
          <div class="bar-container"><div class="bar-fill" style="width:${pctP(d.overdue_count, d.total_invoices)}%;background:#ef4444"></div></div>
        </div>
        <div class="section">
          <div class="section-title">Invoice Register (${inv.length} records)</div>
          <table>
            <thead><tr><th>#</th><th>Invoice #</th><th>Customer</th><th>Date</th><th>Due Date</th><th class="c">Status</th><th class="r">Total</th><th class="r">Paid</th><th class="r">Balance</th></tr></thead>
            <tbody>
              ${inv.map((i: any, idx: number) => `<tr>
                <td>${idx + 1}</td><td class="bold">${i.invoice_number}</td><td>${i.customer_name || '—'}</td>
                <td>${i.invoice_date || '—'}</td><td>${i.due_date || '—'}</td>
                <td class="c">${badgeHtml(i.status)}</td>
                <td class="r">${fmtP(i.total)}</td><td class="r green">${fmtP(i.amount_paid)}</td>
                <td class="r ${(i.balance_due > 0) ? 'highlight' : ''}">${fmtP(i.balance_due)}</td>
              </tr>`).join('')}
              <tr class="total-row">
                <td colspan="6" style="text-align:right">TOTAL (${inv.length} invoices)</td>
                <td class="r">${fmtP(inv.reduce((s: number, i: any) => s + (i.total || 0), 0))}</td>
                <td class="r">${fmtP(inv.reduce((s: number, i: any) => s + (i.amount_paid || 0), 0))}</td>
                <td class="r">${fmtP(inv.reduce((s: number, i: any) => s + (i.balance_due || 0), 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>`;
    } else if (tab === 'receivables') {
      const sorted = [...receivablesData].filter((c: any) => c.balance_due > 0).sort((a: any, b: any) => b.balance_due - a.balance_due);
      const totalDue = receivablesData.reduce((s: number, c: any) => s + (c.balance_due || 0), 0);
      const totalInv = receivablesData.reduce((s: number, c: any) => s + (c.total_invoiced || 0), 0);
      const totalPaid = receivablesData.reduce((s: number, c: any) => s + (c.total_paid || 0), 0);
      body = `
        <div class="summary-grid">
          <div class="summary-box"><div class="label">Total Receivable</div><div class="val highlight">${fmtI(totalDue)}</div><div class="sub">${sorted.length} customers with dues</div></div>
          <div class="summary-box"><div class="label">Total Invoiced</div><div class="val">${fmtI(totalInv)}</div><div class="sub">${receivablesData.length} customers</div></div>
          <div class="summary-box"><div class="label">Total Received</div><div class="val green">${fmtI(totalPaid)}</div><div class="sub">${pctP(totalPaid, totalInv)}% collected</div></div>
        </div>
        <div class="section">
          <div class="section-title">Customer-wise Outstanding (${sorted.length} parties)</div>
          <table>
            <thead><tr><th>#</th><th>Customer</th><th class="r">Invoices</th><th class="r">Total Invoiced</th><th class="r">Total Paid</th><th class="r">Balance Due</th><th class="r">% Outstanding</th></tr></thead>
            <tbody>
              ${sorted.map((c: any, idx: number) => `<tr>
                <td>${idx + 1}</td><td class="bold">${c.customer_name}</td>
                <td class="r">${c.invoice_count || '—'}</td>
                <td class="r">${fmtP(c.total_invoiced)}</td>
                <td class="r green">${fmtP(c.total_paid || 0)}</td>
                <td class="r highlight">${fmtP(c.balance_due)}</td>
                <td class="r">${pctP(c.balance_due, totalDue)}%</td>
              </tr>`).join('')}
              <tr class="total-row">
                <td colspan="3" style="text-align:right">TOTAL</td>
                <td class="r">${fmtP(totalInv)}</td>
                <td class="r">${fmtP(totalPaid)}</td>
                <td class="r">${fmtP(totalDue)}</td>
                <td class="r">100%</td>
              </tr>
            </tbody>
          </table>
        </div>`;
    } else if (tab === 'purchase' && purchaseData) {
      const d = purchaseData;
      const bills = fullBills.length ? fullBills : billList;
      const payRate = pctP(d.total_paid, d.total_billed);
      body = `
        <div class="summary-grid">
          <div class="summary-box"><div class="label">Total Billed</div><div class="val">${fmtI(d.total_billed)}</div><div class="sub">${d.total_bills} bills</div></div>
          <div class="summary-box"><div class="label">Amount Paid</div><div class="val green">${fmtI(d.total_paid)}</div><div class="sub">${d.total_payments || 0} payments</div></div>
          <div class="summary-box"><div class="label">Payable</div><div class="val highlight">${fmtI(d.total_payable)}</div><div class="sub">${d.unpaid_count} unpaid</div></div>
          <div class="summary-box"><div class="label">Payment Rate</div><div class="val">${payRate}%</div><div class="sub">${d.overdue_count} overdue</div></div>
        </div>
        <div class="section">
          <div class="section-title">Financial Summary</div>
          <div class="metric-row"><span class="k">Gross Billed</span><span class="v">${fmtP(d.total_billed)}</span></div>
          <div class="metric-row"><span class="k">Less: Debit Notes</span><span class="v red">- ${fmtP(d.total_debit_notes || 0)}</span></div>
          <div class="metric-row" style="border-top:2px solid #e5e7eb"><span class="k" style="font-weight:800">Net Billed</span><span class="v" style="font-size:13px">${fmtP(d.net_billed || d.total_billed)}</span></div>
          <div class="metric-row"><span class="k">Amount Paid</span><span class="v green">${fmtP(d.total_paid)}</span></div>
          <div class="metric-row"><span class="k">Balance Payable</span><span class="v red">${fmtP(d.total_payable)}</span></div>
        </div>
        <div class="section">
          <div class="section-title">Purchase Bill Register (${bills.length} records)</div>
          <table>
            <thead><tr><th>#</th><th>Bill #</th><th>Vendor</th><th>Date</th><th>Due Date</th><th class="c">Status</th><th class="r">Total</th><th class="r">Paid</th><th class="r">Balance</th></tr></thead>
            <tbody>
              ${bills.map((b: any, idx: number) => `<tr>
                <td>${idx + 1}</td><td class="bold">${b.bill_number}</td><td>${b.vendor_name || '—'}</td>
                <td>${b.bill_date || '—'}</td><td>${b.due_date || '—'}</td>
                <td class="c">${badgeHtml(b.status)}</td>
                <td class="r">${fmtP(b.total)}</td><td class="r green">${fmtP(b.amount_paid)}</td>
                <td class="r ${(b.balance_due > 0) ? 'highlight' : ''}">${fmtP(b.balance_due)}</td>
              </tr>`).join('')}
              <tr class="total-row">
                <td colspan="6" style="text-align:right">TOTAL (${bills.length} bills)</td>
                <td class="r">${fmtP(bills.reduce((s: number, b: any) => s + (b.total || 0), 0))}</td>
                <td class="r">${fmtP(bills.reduce((s: number, b: any) => s + (b.amount_paid || 0), 0))}</td>
                <td class="r">${fmtP(bills.reduce((s: number, b: any) => s + (b.balance_due || 0), 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>`;
    } else if (tab === 'payables') {
      const sorted = [...payablesData].filter((v: any) => v.balance_due > 0).sort((a: any, b: any) => b.balance_due - a.balance_due);
      const totalDue = payablesData.reduce((s: number, v: any) => s + (v.balance_due || 0), 0);
      const totalBilled = payablesData.reduce((s: number, v: any) => s + (v.total_billed || 0), 0);
      const totalPaid = payablesData.reduce((s: number, v: any) => s + (v.total_paid || 0), 0);
      body = `
        <div class="summary-grid">
          <div class="summary-box"><div class="label">Total Payable</div><div class="val highlight">${fmtI(totalDue)}</div><div class="sub">${sorted.length} vendors with dues</div></div>
          <div class="summary-box"><div class="label">Total Billed</div><div class="val">${fmtI(totalBilled)}</div><div class="sub">${payablesData.length} vendors</div></div>
          <div class="summary-box"><div class="label">Total Paid</div><div class="val green">${fmtI(totalPaid)}</div><div class="sub">${pctP(totalPaid, totalBilled)}% settled</div></div>
        </div>
        <div class="section">
          <div class="section-title">Vendor-wise Outstanding (${sorted.length} parties)</div>
          <table>
            <thead><tr><th>#</th><th>Vendor</th><th class="r">Bills</th><th class="r">Total Billed</th><th class="r">Total Paid</th><th class="r">Balance Due</th><th class="r">% of Total</th></tr></thead>
            <tbody>
              ${sorted.map((v: any, idx: number) => `<tr>
                <td>${idx + 1}</td><td class="bold">${v.vendor_name}</td>
                <td class="r">${v.bill_count || '—'}</td>
                <td class="r">${fmtP(v.total_billed)}</td>
                <td class="r green">${fmtP(v.total_paid || 0)}</td>
                <td class="r highlight">${fmtP(v.balance_due)}</td>
                <td class="r">${pctP(v.balance_due, totalDue)}%</td>
              </tr>`).join('')}
              <tr class="total-row">
                <td colspan="3" style="text-align:right">TOTAL</td>
                <td class="r">${fmtP(totalBilled)}</td>
                <td class="r">${fmtP(totalPaid)}</td>
                <td class="r">${fmtP(totalDue)}</td>
                <td class="r">100%</td>
              </tr>
            </tbody>
          </table>
        </div>`;
    } else if (tab === 'expenses' && expenseData) {
      const d = expenseData;
      const cats: any[] = (d.by_category || []).sort((a: any, b: any) => b.amount - a.amount);
      const maxCat = cats.length ? Math.max(...cats.map((c: any) => c.amount)) : 1;
      body = `
        <div class="summary-grid">
          <div class="summary-box"><div class="label">Total Expenses</div><div class="val">${fmtI(d.total_expenses)}</div><div class="sub">${d.expense_count} entries</div></div>
          <div class="summary-box"><div class="label">Categories</div><div class="val">${cats.length}</div><div class="sub">expense types</div></div>
          <div class="summary-box"><div class="label">Avg per Entry</div><div class="val">${fmtI(d.expense_count > 0 ? d.total_expenses / d.expense_count : 0)}</div><div class="sub">average</div></div>
        </div>
        <div class="section">
          <div class="section-title">Category-wise Breakdown</div>
          <table>
            <thead><tr><th>#</th><th>Category</th><th class="r">Amount</th><th class="r">% of Total</th><th style="width:30%">Distribution</th></tr></thead>
            <tbody>
              ${cats.map((cat: any, idx: number) => `<tr>
                <td>${idx + 1}</td><td class="bold">${cat.category}</td>
                <td class="r">${fmtP(cat.amount)}</td>
                <td class="r">${pctP(cat.amount, d.total_expenses)}%</td>
                <td><div class="bar-container"><div class="bar-fill" style="width:${((cat.amount / maxCat) * 100).toFixed(0)}%;background:#8b5cf6"></div></div></td>
              </tr>`).join('')}
              <tr class="total-row">
                <td colspan="2" style="text-align:right">TOTAL</td>
                <td class="r">${fmtP(d.total_expenses)}</td>
                <td class="r">100%</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>`;
    } else if (tab === 'service-payments' && serviceData) {
      const d = serviceData;
      const employees: any[] = (d.by_employee || []).sort((a: any, b: any) => b.total - a.total);
      const methods = Object.entries(d.by_method || {}).sort((a: any, b: any) => b[1] - a[1]);
      body = `
        <div class="summary-grid">
          <div class="summary-box"><div class="label">Total Collected</div><div class="val green">${fmtI(d.total)}</div><div class="sub">${d.count} payments</div></div>
          <div class="summary-box"><div class="label">Staff Count</div><div class="val">${employees.length}</div><div class="sub">service employees</div></div>
          <div class="summary-box"><div class="label">Avg per Payment</div><div class="val">${fmtI(d.count > 0 ? d.total / d.count : 0)}</div><div class="sub">average</div></div>
        </div>
        <div class="section">
          <div class="section-title">Employee-wise Collection (${employees.length} staff)</div>
          <table>
            <thead><tr><th>#</th><th>Employee</th><th class="r">Payments</th><th class="r">Amount</th><th class="r">% of Total</th></tr></thead>
            <tbody>
              ${employees.map((emp: any, idx: number) => `<tr>
                <td>${idx + 1}</td><td class="bold">${emp.employee_name || emp.name}</td>
                <td class="r">${emp.count}</td>
                <td class="r">${fmtP(emp.total)}</td>
                <td class="r">${pctP(emp.total, d.total)}%</td>
              </tr>`).join('')}
              <tr class="total-row">
                <td colspan="2" style="text-align:right">TOTAL</td>
                <td class="r">${d.count}</td>
                <td class="r">${fmtP(d.total)}</td>
                <td class="r">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
        ${methods.length > 0 ? `
        <div class="section">
          <div class="section-title">Payment Method Breakdown</div>
          <table>
            <thead><tr><th>#</th><th>Method</th><th class="r">Amount</th><th class="r">% of Total</th></tr></thead>
            <tbody>
              ${methods.map(([method, amount]: any, idx: number) => `<tr>
                <td>${idx + 1}</td><td class="bold">${method}</td>
                <td class="r">${fmtP(amount)}</td>
                <td class="r">${pctP(amount, d.total)}%</td>
              </tr>`).join('')}
              <tr class="total-row">
                <td colspan="2" style="text-align:right">TOTAL</td>
                <td class="r">${fmtP(d.total)}</td>
                <td class="r">100%</td>
              </tr>
            </tbody>
          </table>
        </div>` : ''}`;
    } else if (tab === 'payroll') {
      const totalSalary = payrollData.reduce((s: number, p: any) => s + (p.salary_amount || 0), 0);
      const totalEarned = payrollData.reduce((s: number, p: any) => s + (p.earned_amount || 0), 0);
      const totalDed = payrollData.reduce((s: number, p: any) => s + (p.deductions || 0), 0);
      const totalNet = payrollData.reduce((s: number, p: any) => s + (p.net_pay || 0), 0);
      const paidCount = payrollData.filter((p: any) => p.status === 'Paid').length;
      const monthName = MONTHS_SHORT[payrollMonth - 1] + ' ' + payrollYear;
      body = `
        <div class="summary-grid">
          <div class="summary-box"><div class="label">Net Payroll</div><div class="val">${fmtI(totalNet)}</div><div class="sub">${payrollData.length} employees</div></div>
          <div class="summary-box"><div class="label">Gross Salary</div><div class="val">${fmtI(totalSalary)}</div><div class="sub">before attendance</div></div>
          <div class="summary-box"><div class="label">Earned</div><div class="val green">${fmtI(totalEarned)}</div><div class="sub">after attendance</div></div>
          <div class="summary-box"><div class="label">Deductions</div><div class="val red">${fmtI(totalDed)}</div><div class="sub">advances etc.</div></div>
        </div>
        <div class="section">
          <div class="section-title">Payroll Sheet — ${monthName} (${payrollData.length} employees, ${paidCount} paid)</div>
          <table>
            <thead><tr><th>#</th><th>Employee</th><th class="c">Working</th><th class="c">Present</th><th class="c">Attendance</th><th class="r">Salary</th><th class="r">Earned</th><th class="r">Deductions</th><th class="r">Net Pay</th><th class="c">Status</th></tr></thead>
            <tbody>
              ${payrollData.map((p: any, idx: number) => {
                const attPct = p.working_days > 0 ? ((p.present_days / p.working_days) * 100).toFixed(0) : '0';
                return `<tr>
                  <td>${idx + 1}</td><td class="bold">${p.employee_name}</td>
                  <td class="c">${p.working_days}</td><td class="c">${p.present_days}</td>
                  <td class="c">${attPct}%</td>
                  <td class="r">${fmtP(p.salary_amount)}</td>
                  <td class="r">${fmtP(p.earned_amount)}</td>
                  <td class="r red">${fmtP(p.deductions)}</td>
                  <td class="r bold">${fmtP(p.net_pay)}</td>
                  <td class="c">${badgeHtml(p.status)}</td>
                </tr>`;
              }).join('')}
              <tr class="total-row">
                <td colspan="5" style="text-align:right">TOTAL (${payrollData.length})</td>
                <td class="r">${fmtP(totalSalary)}</td>
                <td class="r">${fmtP(totalEarned)}</td>
                <td class="r">${fmtP(totalDed)}</td>
                <td class="r">${fmtP(totalNet)}</td>
                <td class="c">${paidCount}/${payrollData.length}</td>
              </tr>
            </tbody>
          </table>
        </div>`;
    } else {
      body = '<p style="text-align:center;color:#9ca3af;padding:40px 0">No data available for this report</p>';
    }

    const periodDisplay = tab === 'payroll'
      ? MONTHS_SHORT[payrollMonth - 1] + ' ' + payrollYear
      : dateRange;

    const html = `<html><head><meta charset="utf-8"/>${css}</head><body>
      <div class="page">
        <div class="header">
          <h1>${tabLabel} Report</h1>
          <div class="header-sub">
            <span>Period: ${periodDisplay}</span>
            <span>Generated: ${genDate} at ${genTime}</span>
          </div>
        </div>
        ${body}
        <div class="footer">This is a computer-generated report. Generated via BillFlow.</div>
      </div>
    </body></html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: tabLabel + ' Report' });
      } else {
        Alert.alert('PDF Saved', uri);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to generate PDF');
    }
  }

  // ────────── TAB RENDERERS ──────────

  function renderSales() {
    if (!salesData) return <Empty />;
    const d = salesData;
    const rate = pct(d.total_received, d.total_invoiced);
    return (
      <>
        <View style={st.grid2}>
          <StatCard label="Total Invoiced" value={fmt(d.total_invoiced)} sub={d.total_invoices + ' invoices'} icon="document-text" accent="#10b981" />
          <StatCard label="Received" value={fmt(d.total_received)} sub={(d.total_payments || 0) + ' payments'} icon="arrow-down-circle" accent="#3b82f6" />
        </View>
        <View style={st.grid2}>
          <StatCard label="Outstanding" value={fmt(d.total_outstanding)} sub={d.unpaid_count + ' unpaid'} icon="arrow-up-circle" accent="#f59e0b" />
          <StatCard label="Collection" value={rate + '%'} sub={d.overdue_count + ' overdue'} icon="trending-up" accent="#8b5cf6" />
        </View>

        <View style={st.card}>
          <Text style={st.cardTitle}>Invoice Status Breakdown</Text>
          <BarRow label="Paid" value={d.paid_count} total={d.total_invoices} color="#10b981" />
          <BarRow label="Unpaid" value={d.unpaid_count} total={d.total_invoices} color="#f59e0b" />
          <BarRow label="Overdue" value={d.overdue_count} total={d.total_invoices} color="#ef4444" />
        </View>

        <View style={st.grid2}>
          <View style={st.card}>
            <Text style={st.cardTitle}>Financial Summary</Text>
            <SumRow label="Gross Invoiced" value={fmtD(d.total_invoiced)} />
            <SumRow label="Credit Notes" value={'- ' + fmtD(d.total_credit_notes || 0)} color="#ef4444" />
            <View style={st.divider} />
            <SumRow label="Net Invoiced" value={fmtD(d.net_invoiced || d.total_invoiced)} bold />
          </View>
          <View style={st.card}>
            <Text style={st.cardTitle}>Cash Flow</Text>
            <SumRow label="Received" value={fmtD(d.total_received)} color="#10b981" />
            <SumRow label="Outstanding" value={fmtD(d.total_outstanding)} color="#f59e0b" />
            <View style={st.divider} />
            <SumRow label="Collection %" value={rate + '%'} bold />
          </View>
        </View>

        {invoiceList.length > 0 && (
          <View style={st.card}>
            <Text style={st.cardTitle}>Recent Invoices</Text>
            {invoiceList.slice(0, 10).map((inv: any) => (
              <View key={inv.id} style={st.listItem}>
                <View style={[st.avatar, { backgroundColor: '#d1fae5' }]}>
                  <Text style={[st.avatarText, { color: '#059669' }]}>{initial(inv.customer_name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.listPrimary} numberOfLines={1}>{inv.invoice_number}</Text>
                  <Text style={st.listSecondary} numberOfLines={1}>{inv.customer_name || '\u2014'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={st.listAmount}>{fmtD(inv.total)}</Text>
                  <StatusBadge status={inv.status} />
                </View>
              </View>
            ))}
          </View>
        )}
      </>
    );
  }

  function renderReceivables() {
    if (!receivablesData.length) return <Empty msg="No receivables data" />;
    const totalDue = receivablesData.reduce((s, c: any) => s + (c.balance_due || 0), 0);
    const totalInv = receivablesData.reduce((s, c: any) => s + (c.total_invoiced || 0), 0);
    return (
      <>
        <View style={st.grid2}>
          <StatCard label="Total Receivable" value={fmt(totalDue)} sub={receivablesData.length + ' customers'} icon="wallet" accent="#3b82f6" />
          <StatCard label="Total Invoiced" value={fmt(totalInv)} sub="all customers" icon="document-text" accent="#10b981" />
        </View>
        <View style={st.card}>
          <Text style={st.cardTitle}>Customer Outstanding</Text>
          <View style={st.tblHeader}>
            <Text style={[st.tblH, { flex: 2 }]}>Customer</Text>
            <Text style={[st.tblH, st.tblR]}>Invoiced</Text>
            <Text style={[st.tblH, st.tblR]}>Balance</Text>
          </View>
          {receivablesData.filter((c: any) => c.balance_due > 0).sort((a: any, b: any) => b.balance_due - a.balance_due).map((c: any) => (
            <View key={c.customer_id} style={st.tblRow}>
              <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[st.miniAvatar, { backgroundColor: '#dbeafe' }]}>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#1d4ed8' }}>{initial(c.customer_name)}</Text>
                </View>
                <Text style={st.tblCell} numberOfLines={1}>{c.customer_name}</Text>
              </View>
              <Text style={[st.tblCell, st.tblR]}>{fmt(c.total_invoiced)}</Text>
              <Text style={[st.tblCell, st.tblR, { color: '#ef4444', fontWeight: '700' }]}>{fmt(c.balance_due)}</Text>
            </View>
          ))}
          <View style={[st.tblRow, { backgroundColor: '#f9fafb', borderTopWidth: 2, borderTopColor: '#e5e7eb' }]}>
            <Text style={[st.tblCell, { flex: 2, fontWeight: '800' }]}>Total</Text>
            <Text style={[st.tblCell, st.tblR, { fontWeight: '800' }]}>{fmt(totalInv)}</Text>
            <Text style={[st.tblCell, st.tblR, { fontWeight: '800', color: '#ef4444' }]}>{fmt(totalDue)}</Text>
          </View>
        </View>
      </>
    );
  }

  function renderPurchase() {
    if (!purchaseData) return <Empty />;
    const d = purchaseData;
    const rate = pct(d.total_paid, d.total_billed);
    return (
      <>
        <View style={st.grid2}>
          <StatCard label="Total Billed" value={fmt(d.total_billed)} sub={d.total_bills + ' bills'} icon="cart" accent="#f97316" />
          <StatCard label="Amount Paid" value={fmt(d.total_paid)} sub={(d.total_payments || 0) + ' payments'} icon="checkmark-circle" accent="#10b981" />
        </View>
        <View style={st.grid2}>
          <StatCard label="Payable" value={fmt(d.total_payable)} sub={d.unpaid_count + ' unpaid'} icon="card" accent="#ef4444" />
          <StatCard label="Payment Rate" value={rate + '%'} sub={d.overdue_count + ' overdue'} icon="trending-down" accent="#8b5cf6" />
        </View>
        <View style={st.card}>
          <Text style={st.cardTitle}>Bill Status Breakdown</Text>
          <BarRow label="Paid" value={d.paid_count} total={d.total_bills} color="#10b981" />
          <BarRow label="Unpaid" value={d.unpaid_count} total={d.total_bills} color="#f59e0b" />
          <BarRow label="Overdue" value={d.overdue_count} total={d.total_bills} color="#ef4444" />
        </View>
        <View style={st.grid2}>
          <View style={st.card}>
            <Text style={st.cardTitle}>Financial Summary</Text>
            <SumRow label="Gross Billed" value={fmtD(d.total_billed)} />
            <SumRow label="Debit Notes" value={'- ' + fmtD(d.total_debit_notes || 0)} color="#ef4444" />
            <View style={st.divider} />
            <SumRow label="Net Billed" value={fmtD(d.net_billed || d.total_billed)} bold />
          </View>
          <View style={st.card}>
            <Text style={st.cardTitle}>Payment Flow</Text>
            <SumRow label="Paid" value={fmtD(d.total_paid)} color="#10b981" />
            <SumRow label="Payable" value={fmtD(d.total_payable)} color="#ef4444" />
            <View style={st.divider} />
            <SumRow label="Payment %" value={rate + '%'} bold />
          </View>
        </View>
        {billList.length > 0 && (
          <View style={st.card}>
            <Text style={st.cardTitle}>Recent Bills</Text>
            {billList.slice(0, 10).map((bill: any) => (
              <View key={bill.id} style={st.listItem}>
                <View style={[st.avatar, { backgroundColor: '#ffedd5' }]}>
                  <Text style={[st.avatarText, { color: '#ea580c' }]}>{initial(bill.vendor_name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.listPrimary} numberOfLines={1}>{bill.bill_number}</Text>
                  <Text style={st.listSecondary} numberOfLines={1}>{bill.vendor_name || '\u2014'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={st.listAmount}>{fmtD(bill.total)}</Text>
                  <StatusBadge status={bill.status} />
                </View>
              </View>
            ))}
          </View>
        )}
      </>
    );
  }

  function renderPayables() {
    if (!payablesData.length) return <Empty msg="No payables data" />;
    const totalDue = payablesData.reduce((s, v: any) => s + (v.balance_due || 0), 0);
    const totalBilled = payablesData.reduce((s, v: any) => s + (v.total_billed || 0), 0);
    return (
      <>
        <View style={st.grid2}>
          <StatCard label="Total Payable" value={fmt(totalDue)} sub={payablesData.length + ' vendors'} icon="card" accent="#ef4444" />
          <StatCard label="Total Billed" value={fmt(totalBilled)} sub="all vendors" icon="cart" accent="#f97316" />
        </View>
        <View style={st.card}>
          <Text style={st.cardTitle}>Vendor Outstanding</Text>
          <View style={st.tblHeader}>
            <Text style={[st.tblH, { flex: 2 }]}>Vendor</Text>
            <Text style={[st.tblH, st.tblR]}>Billed</Text>
            <Text style={[st.tblH, st.tblR]}>Balance</Text>
          </View>
          {payablesData.filter((v: any) => v.balance_due > 0).sort((a: any, b: any) => b.balance_due - a.balance_due).map((v: any) => (
            <View key={v.vendor_id} style={st.tblRow}>
              <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[st.miniAvatar, { backgroundColor: '#ffedd5' }]}>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#ea580c' }}>{initial(v.vendor_name)}</Text>
                </View>
                <Text style={st.tblCell} numberOfLines={1}>{v.vendor_name}</Text>
              </View>
              <Text style={[st.tblCell, st.tblR]}>{fmt(v.total_billed)}</Text>
              <Text style={[st.tblCell, st.tblR, { color: '#ef4444', fontWeight: '700' }]}>{fmt(v.balance_due)}</Text>
            </View>
          ))}
          <View style={[st.tblRow, { backgroundColor: '#f9fafb', borderTopWidth: 2, borderTopColor: '#e5e7eb' }]}>
            <Text style={[st.tblCell, { flex: 2, fontWeight: '800' }]}>Total</Text>
            <Text style={[st.tblCell, st.tblR, { fontWeight: '800' }]}>{fmt(totalBilled)}</Text>
            <Text style={[st.tblCell, st.tblR, { fontWeight: '800', color: '#ef4444' }]}>{fmt(totalDue)}</Text>
          </View>
        </View>
      </>
    );
  }

  function renderExpenses() {
    if (!expenseData) return <Empty />;
    const d = expenseData;
    const cats: { category: string; amount: number }[] = d.by_category || [];
    const maxCat = cats.length ? Math.max(...cats.map((c: any) => c.amount)) : 1;
    return (
      <>
        <View style={st.grid2}>
          <StatCard label="Total Expenses" value={fmt(d.total_expenses)} sub={d.expense_count + ' entries'} icon="receipt" accent="#8b5cf6" />
          <StatCard label="Categories" value={String(cats.length)} sub="expense types" icon="grid" accent="#6366f1" />
        </View>
        <View style={st.card}>
          <Text style={st.cardTitle}>Category Breakdown</Text>
          {cats.length === 0 ? (
            <Text style={st.emptyText}>No expenses recorded</Text>
          ) : (
            cats.sort((a, b) => b.amount - a.amount).map((cat) => (
              <View key={cat.category} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>{cat.category}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Text style={{ fontSize: 11, color: '#9ca3af' }}>{pct(cat.amount, d.total_expenses)}%</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1f2937' }}>{fmtD(cat.amount)}</Text>
                  </View>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: '#f3f4f6', overflow: 'hidden' }}>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: '#8b5cf6', width: ((cat.amount / maxCat) * 100) + '%' } as any} />
                </View>
              </View>
            ))
          )}
        </View>
      </>
    );
  }

  function renderServicePayments() {
    if (!serviceData) return <Empty />;
    const d = serviceData;

    const fmtDateShort = (ds: string) => {
      if (!ds) return '—';
      try { return new Date(ds).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return ds; }
    };
    const methodColor = (m: string) => {
      const ml = (m || '').toLowerCase();
      if (ml === 'cash') return '#10b981';
      if (ml === 'upi') return '#8b5cf6';
      if (ml.includes('bank') || ml.includes('transfer')) return '#3b82f6';
      if (ml.includes('cheque') || ml.includes('check')) return '#f59e0b';
      if (ml.includes('card')) return '#ec4899';
      return '#6b7280';
    };

    return (
      <>
        {/* Employee Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}>
          <TouchableOpacity
            style={[st.empChip, !serviceEmpFilter && st.empChipActive]}
            onPress={() => setServiceEmpFilter(null)}
          >
            <Ionicons name="people" size={13} color={!serviceEmpFilter ? '#fff' : '#14b8a6'} />
            <Text style={[st.empChipText, !serviceEmpFilter && st.empChipTextActive]}>All Staff</Text>
          </TouchableOpacity>
          {employees.filter(e => e.status === 'Active').map(emp => {
            const active = serviceEmpFilter === emp.id;
            return (
              <TouchableOpacity
                key={emp.id}
                style={[st.empChip, active && st.empChipActive]}
                onPress={() => setServiceEmpFilter(active ? null : emp.id)}
              >
                <Text style={[st.empChipText, active && st.empChipTextActive]}>{emp.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Stats */}
        <View style={st.grid2}>
          <StatCard label="Total Collected" value={fmt(d.total)} sub={d.count + ' payments'} icon="cash" accent="#14b8a6" />
          <StatCard label="Avg / Payment" value={fmt(d.count > 0 ? d.total / d.count : 0)} sub="per transaction" icon="analytics" accent="#3b82f6" />
        </View>

        {/* Payment Records */}
        <View style={st.card}>
          <Text style={st.cardTitle}>Payment Records ({servicePayments.length})</Text>
          {servicePayments.length === 0 ? (
            <Text style={st.emptyText}>No payments found</Text>
          ) : (
            <>
              {servicePayments.map((sp: any, idx: number) => (
                <View key={sp.id || idx} style={{ paddingVertical: 10, borderBottomWidth: idx < servicePayments.length - 1 ? 1 : 0, borderBottomColor: '#f3f4f6' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[st.avatar, { backgroundColor: '#ccfbf1', width: 34, height: 34, borderRadius: 10 }]}>
                      <Text style={[st.avatarText, { color: '#0d9488' }]}>{initial(sp.employee_name || '?')}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#1f2937' }} numberOfLines={1}>
                        {sp.customer_name || sp.task_title || 'Service Payment'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        {sp.employee_name && <Text style={{ fontSize: 11, color: '#6b7280' }}>{sp.employee_name}</Text>}
                        {sp.employee_name && <Text style={{ fontSize: 11, color: '#d1d5db' }}>·</Text>}
                        <Text style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDateShort(sp.payment_date)}</Text>
                      </View>
                      {sp.task_title && sp.customer_name && (
                        <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }} numberOfLines={1}>Task: {sp.task_title}</Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#14b8a6' }}>{fmtD(sp.amount)}</Text>
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: methodColor(sp.payment_method) + '12', marginTop: 2 }}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: methodColor(sp.payment_method) }}>{sp.payment_method || 'Cash'}</Text>
                      </View>
                    </View>
                  </View>
                  {sp.notes ? <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, marginLeft: 44 }} numberOfLines={2}>{sp.notes}</Text> : null}
                </View>
              ))}
              <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 2, borderTopColor: '#e5e7eb', flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#1f2937' }}>Total ({servicePayments.length})</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#14b8a6' }}>{fmtD(d.total)}</Text>
              </View>
            </>
          )}
        </View>
      </>
    );
  }

  function renderPayroll() {
    const totalNet = payrollData.reduce((s, p: any) => s + (p.net_pay || 0), 0);
    const totalEarned = payrollData.reduce((s, p: any) => s + (p.earned_amount || 0), 0);
    const totalDed = payrollData.reduce((s, p: any) => s + (p.deductions || 0), 0);
    const paidCount = payrollData.filter((p: any) => p.status === 'Paid').length;
    return (
      <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 4 }}>
          {MONTHS_SHORT.map((m, i) => {
            const active = payrollMonth === i + 1;
            return (
              <TouchableOpacity key={m} onPress={() => setPayrollMonth(i + 1)}
                style={[st.monthChip, active && { backgroundColor: '#6366f1', borderColor: '#6366f1' }]}>
                <Text style={[st.monthChipText, active && { color: '#fff', fontWeight: '800' }]}>{m}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
          <TouchableOpacity onPress={() => setPayrollYear(payrollYear - 1)}>
            <Ionicons name="chevron-back-circle" size={22} color="#6366f1" />
          </TouchableOpacity>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{payrollYear}</Text>
          <TouchableOpacity onPress={() => setPayrollYear(payrollYear + 1)}>
            <Ionicons name="chevron-forward-circle" size={22} color="#6366f1" />
          </TouchableOpacity>
        </View>
        <View style={st.grid2}>
          <StatCard label="Net Payroll" value={fmt(totalNet)} sub={payrollData.length + ' employees'} icon="briefcase" accent="#6366f1" />
          <StatCard label="Earned" value={fmt(totalEarned)} sub="gross earnings" icon="trending-up" accent="#10b981" />
        </View>
        <View style={st.grid2}>
          <StatCard label="Deductions" value={fmt(totalDed)} sub="total deductions" icon="trending-down" accent="#ef4444" />
          <StatCard label="Paid" value={paidCount + '/' + payrollData.length} sub={paidCount === payrollData.length ? 'all paid' : 'pending'} icon="checkmark-done" accent="#8b5cf6" />
        </View>
        {payrollData.length === 0 ? (
          <Empty msg={'No payroll for ' + MONTHS_SHORT[payrollMonth - 1] + ' ' + payrollYear} />
        ) : (
          <View style={st.card}>
            <Text style={st.cardTitle}>Payroll Details</Text>
            {payrollData.map((p: any) => (
              <View key={p.id} style={st.listItem}>
                <View style={[st.avatar, { backgroundColor: '#e0e7ff' }]}>
                  <Text style={[st.avatarText, { color: '#4338ca' }]}>{initial(p.employee_name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.listPrimary}>{p.employee_name}</Text>
                  <Text style={st.listSecondary}>{p.present_days}/{p.working_days} days{p.deductions > 0 ? ' \u00B7 Ded: ' + fmt(p.deductions) : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={st.listAmount}>{fmt(p.net_pay)}</Text>
                  <StatusBadge status={p.status} />
                </View>
              </View>
            ))}
            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 2, borderTopColor: '#e5e7eb' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#1f2937' }}>Total ({payrollData.length})</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#1f2937' }}>{fmt(totalNet)}</Text>
              </View>
            </View>
          </View>
        )}
      </>
    );
  }

  const renderers: Record<TabKey, () => React.ReactNode> = {
    sales: renderSales, receivables: renderReceivables, purchase: renderPurchase,
    payables: renderPayables, expenses: renderExpenses, 'service-payments': renderServicePayments,
    payroll: renderPayroll,
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f6f7fb' }}
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Toolbar */}
      <View style={st.toolbar}>
        <TouchableOpacity style={st.toolBtn} onPress={downloadPDF}>
          <Ionicons name="download-outline" size={16} color={colors.primary} />
          <Text style={st.toolBtnText}>PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.toolBtn} onPress={async () => {
          try {
            const tabLabel = TABS.find(t => t.key === tab)?.label || 'Report';
            await Share.share({ message: `${tabLabel} Report — Generated on ${new Date().toLocaleDateString('en-IN')}` });
          } catch {}
        }}>
          <Ionicons name="share-outline" size={16} color={colors.primary} />
          <Text style={st.toolBtnText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.toolBtn} onPress={() => navigation.navigate('AllReports')}>
          <Ionicons name="analytics-outline" size={16} color={colors.primary} />
          <Text style={st.toolBtnText}>All Reports</Text>
        </TouchableOpacity>
      </View>

      {/* Tab pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.tabScroll} contentContainerStyle={st.tabContainer}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <TouchableOpacity key={t.key} style={[st.tabPill, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => setTab(t.key)} activeOpacity={0.8}>
              <Ionicons name={t.icon as any} size={14} color={active ? '#fff' : '#6b7280'} />
              <Text style={[st.tabText, active && { color: '#fff', fontWeight: '800' }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Date filter (not payroll) */}
      {tab !== 'payroll' && (
        <View style={st.filterRow}>
          <View style={{ flex: 1 }}>
            <DateInput value={dateFrom} onChange={setDateFrom} label="From" />
          </View>
          <View style={{ flex: 1 }}>
            <DateInput value={dateTo} onChange={setDateTo} label="To" />
          </View>
        </View>
      )}

      {/* Content */}
      <View style={{ paddingHorizontal: spacing.md, marginTop: 8 }}>
        {loading ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : renderers[tab]()}
      </View>

      {/* Detailed reports shortcuts */}
      <View style={{ paddingHorizontal: spacing.md, marginTop: 20 }}>
        <Text style={st.sectionLabel}>Detailed Reports</Text>
        <View style={{ gap: 6 }}>
          {[
            { key: 'profit-loss', title: 'Profit & Loss', icon: 'stats-chart-outline', color: '#f59e0b' },
            { key: 'cash-flow', title: 'Cash Flow', icon: 'wallet-outline', color: '#3b82f6' },
            { key: 'aging', title: 'Aging Analysis', icon: 'time-outline', color: '#ef4444' },
            { key: 'gst-summary', title: 'GST Summary', icon: 'receipt-outline', color: '#8b5cf6' },
            { key: 'day-book', title: 'Day Book', icon: 'book-outline', color: '#6366f1' },
            { key: 'party-balance', title: 'Party Balances', icon: 'cash-outline', color: '#14b8a6' },
          ].map(r => (
            <TouchableOpacity key={r.key} style={st.shortcutCard}
              onPress={() => navigation.navigate('ReportDetail', { reportKey: r.key })} activeOpacity={0.8}>
              <View style={[st.shortcutIcon, { backgroundColor: r.color + '15' }]}>
                <Ionicons name={r.icon as any} size={16} color={r.color} />
              </View>
              <Text style={st.shortcutLabel}>{r.title}</Text>
              <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[st.shortcutCard, { backgroundColor: colors.primary + '08', borderColor: colors.primary + '20' }]}
            onPress={() => navigation.navigate('AllReports')} activeOpacity={0.8}>
            <View style={[st.shortcutIcon, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="layers-outline" size={16} color={colors.primary} />
            </View>
            <Text style={[st.shortcutLabel, { color: colors.primary, fontWeight: '800' }]}>View All Reports</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

// ──────────── HELPERS ────────────

function StatCard({ label, value, sub, icon, accent }: { label: string; value: string; sub: string; icon: string; accent: string }) {
  return (
    <View style={st.statCard}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={st.statLabel}>{label}</Text>
          <Text style={st.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
          <Text style={st.statSub}>{sub}</Text>
        </View>
        <View style={[st.statIcon, { backgroundColor: accent + '15' }]}>
          <Ionicons name={icon as any} size={16} color={accent} />
        </View>
      </View>
    </View>
  );
}

function BarRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const p = total > 0 ? (value / total) * 100 : 0;
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 12, color: '#4b5563' }}>{label}</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#1f2937' }}>{value} <Text style={{ fontWeight: '400', color: '#9ca3af' }}>({p.toFixed(0)}%)</Text></Text>
      </View>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: '#f3f4f6', overflow: 'hidden' }}>
        <View style={{ height: 5, borderRadius: 3, backgroundColor: color, width: p + '%' } as any} />
      </View>
    </View>
  );
}

function SumRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
      <Text style={{ fontSize: 11, color: '#6b7280', fontWeight: bold ? '700' : '400' }}>{label}</Text>
      <Text style={{ fontSize: 11, fontWeight: bold ? '800' : '500', color: color || '#1f2937' }}>{value}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    Paid: { bg: '#dcfce7', fg: '#15803d' },
    'Partially Paid': { bg: '#dbeafe', fg: '#1d4ed8' },
    Sent: { bg: '#e0f2fe', fg: '#0369a1' },
    Received: { bg: '#e0f2fe', fg: '#0369a1' },
    Overdue: { bg: '#fee2e2', fg: '#dc2626' },
    Draft: { bg: '#f3f4f6', fg: '#6b7280' },
    Cancelled: { bg: '#f3f4f6', fg: '#9ca3af' },
  };
  const c = map[status] || map.Draft;
  return (
    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: c.bg, marginTop: 2 }}>
      <Text style={{ fontSize: 9, fontWeight: '700', color: c.fg }}>{status}</Text>
    </View>
  );
}

function Empty({ msg }: { msg?: string }) {
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
      <Ionicons name="bar-chart-outline" size={32} color="#d1d5db" />
      <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 8 }}>{msg || 'No data for selected period'}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 4,
  },
  toolBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  toolBtnText: { fontSize: 11, fontWeight: '700', color: colors.primary },

  tabScroll: { marginTop: 4 },
  tabContainer: { paddingHorizontal: spacing.md, gap: 6 },
  tabPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  tabText: { fontSize: 11, fontWeight: '600', color: '#6b7280' },

  filterRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: spacing.md, marginTop: 10, marginBottom: 4,
  },

  grid2: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statCard: {
    flex: 1, backgroundColor: '#fff', padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: '#f3f4f6',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  statLabel: { fontSize: 10, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.3 },
  statValue: { fontSize: 18, fontWeight: '900', color: '#1f2937', marginTop: 4 },
  statSub: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  card: {
    backgroundColor: '#fff', padding: 16, borderRadius: 14,
    borderWidth: 1, borderColor: '#f3f4f6', marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  cardTitle: { fontSize: 10, fontWeight: '800', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 6 },

  listItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f9fafb',
  },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '800' },
  miniAvatar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  listPrimary: { fontSize: 12, fontWeight: '700', color: '#1f2937' },
  listSecondary: { fontSize: 10, color: '#9ca3af', marginTop: 1 },
  listAmount: { fontSize: 12, fontWeight: '800', color: '#1f2937' },

  tblHeader: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 4, backgroundColor: '#f9fafb', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tblH: { flex: 1, fontSize: 9, fontWeight: '800', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 },
  tblRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tblCell: { flex: 1, fontSize: 11, color: '#374151' },
  tblR: { textAlign: 'right' },
  emptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 20 },

  monthChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb',
  },
  monthChipText: { fontSize: 11, fontWeight: '600', color: '#6b7280' },

  empChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#99f6e4',
  },
  empChipActive: { backgroundColor: '#14b8a6', borderColor: '#14b8a6' },
  empChipText: { fontSize: 12, fontWeight: '600', color: '#14b8a6' },
  empChipTextActive: { color: '#fff', fontWeight: '700' },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  shortcutCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#f3f4f6',
  },
  shortcutIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: '#374151' },
});
