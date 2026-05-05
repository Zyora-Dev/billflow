import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import DateInput from '../../components/DateInput';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';
import { REPORTS, ReportDef } from './ReportsScreen';

function fmt(n: number | null | undefined) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));
}
function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ReportDetailScreen({ route, navigation }: any) {
  const { reportKey } = route.params;
  const def = REPORTS.find((r) => r.key === reportKey)!;

  const today = new Date();
  const fyStart = new Date(today.getFullYear() - (today.getMonth() < 3 ? 1 : 0), 3, 1);
  const [dateFrom, setDateFrom] = useState(fyStart.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(today.toISOString().slice(0, 10));
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('month');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [business, setBusiness] = useState<any>(null);

  useEffect(() => {
    navigation.setOptions({ title: def.title });
  }, [def.title]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let oid = orgId;
      if (!oid) {
        const biz = await api.get('/api/business');
        oid = biz.data[0]?.org_id;
        setOrgId(oid);
        setBusiness(biz.data[0] || null);
      }
      if (!oid) return;
      let url = `/api/reports/${def.key}?org_id=${oid}`;
      if (def.needsDateRange) url += `&date_from=${dateFrom}&date_to=${dateTo}`;
      if (def.key === 'sales-trend' || def.key === 'purchase-trend') url += `&group_by=${groupBy}`;
      if (def.needsMonthYear) url += `&month=${month}&year=${year}`;
      const r = await api.get(url);
      setData(r.data);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [def.key, dateFrom, dateTo, month, year, groupBy, orgId]);

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [def.key]);

  const downloadPDF = async () => {
    try {
      let sub = '';
      if (def.needsDateRange) sub = `${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`;
      else if (def.needsMonthYear) sub = `${['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month]} ${year}`;
      else sub = `As of ${fmtDate(new Date().toISOString())}`;

      const html = buildHTML(def, data, sub, business);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch (e) {
      Alert.alert('Error', 'Could not generate PDF');
    }
  };

  return (
    <View style={s.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Filters */}
        <View style={s.filterCard}>
          {def.needsDateRange && (
            <View style={s.dateRow}>
              <DateInput value={dateFrom} onChange={setDateFrom} label="From" style={{ flex: 1 }} />
              <DateInput value={dateTo} onChange={setDateTo} label="To" style={{ flex: 1 }} />
            </View>
          )}
          {(def.key === 'sales-trend' || def.key === 'purchase-trend') && (
            <View style={s.chipRow}>
              {(['day', 'week', 'month'] as const).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[s.chip, groupBy === g && s.chipActive]}
                  onPress={() => setGroupBy(g)}
                >
                  <Text style={[s.chipText, groupBy === g && s.chipTextActive]}>{g.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {def.needsMonthYear && (
            <View style={s.dateRow}>
              <View style={s.dateBtn}>
                <Text style={s.dateLabel}>Month</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <TouchableOpacity key={m} onPress={() => setMonth(m)} style={[s.miniChip, month === m && s.miniChipActive]}>
                      <Text style={[s.miniChipText, month === m && s.miniChipTextActive]}>
                        {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={s.dateBtn}>
                <Text style={s.dateLabel}>Year</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity onPress={() => setYear(year - 1)}><Ionicons name="remove-circle-outline" size={20} color={colors.primary} /></TouchableOpacity>
                  <Text style={s.dateValue}>{year}</Text>
                  <TouchableOpacity onPress={() => setYear(year + 1)}><Ionicons name="add-circle-outline" size={20} color={colors.primary} /></TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          <View style={s.actionRow}>
            <TouchableOpacity style={s.refreshBtn} onPress={fetchData} disabled={loading}>
              <Ionicons name="refresh" size={16} color={colors.white} />
              <Text style={s.refreshText}>{loading ? 'Loading…' : 'Refresh'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.pdfBtn} onPress={downloadPDF} disabled={loading || !data}>
              <Ionicons name="download-outline" size={16} color={colors.primary} />
              <Text style={s.pdfText}>PDF</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading && <ActivityIndicator size="large" style={{ marginTop: 40 }} />}
        {!loading && data && <RenderReport def={def} data={data} />}
      </ScrollView>

    </View>
  );
}

// =============== RENDERERS ===============
function RenderReport({ def, data }: { def: ReportDef; data: any }) {
  switch (def.key) {
    case 'aging': return <AgingView data={data} />;
    case 'profit-loss': return <PLView data={data} />;
    case 'cash-flow': return <CashFlowView data={data} />;
    case 'gst-summary': return <GstView data={data} />;
    case 'party-balance': return <PartyView data={data} />;
    case 'tasks': return <TasksView data={data} />;
    case 'sales-return':
    case 'purchase-return':
      return <ReturnsView data={data} kind={def.key === 'sales-return' ? 'Sales' : 'Purchase'} />;
    case 'day-book': return <DayBookView data={data} />;
    case 'sales-trend':
    case 'purchase-trend':
      return <TrendView data={data} />;
    default: return <TableView def={def} data={data} />;
  }
}

const COL_DEFS: Record<string, { key: string; label: string; right?: boolean }[]> = {
  'customer-wise-sales': [
    { key: 'customer_name', label: 'Customer' },
    { key: 'invoice_count', label: 'Inv', right: true },
    { key: 'total_sales', label: 'Sales', right: true },
    { key: 'balance', label: 'Bal', right: true },
  ],
  'vendor-wise-purchases': [
    { key: 'vendor_name', label: 'Vendor' },
    { key: 'bill_count', label: 'Bills', right: true },
    { key: 'total_purchases', label: 'Total', right: true },
    { key: 'balance', label: 'Bal', right: true },
  ],
  'item-wise-sales': [
    { key: 'item_name', label: 'Item' },
    { key: 'qty', label: 'Qty', right: true },
    { key: 'amount', label: 'Amount', right: true },
  ],
  'item-wise-purchases': [
    { key: 'item_name', label: 'Item' },
    { key: 'qty', label: 'Qty', right: true },
    { key: 'amount', label: 'Amount', right: true },
  ],
  'hsn-sales': [
    { key: 'hsn_code', label: 'HSN' },
    { key: 'tax_rate', label: 'Rate%', right: true },
    { key: 'taxable', label: 'Taxable', right: true },
    { key: 'tax_amount', label: 'Tax', right: true },
  ],
  'hsn-purchases': [
    { key: 'hsn_code', label: 'HSN' },
    { key: 'tax_rate', label: 'Rate%', right: true },
    { key: 'taxable', label: 'Taxable', right: true },
    { key: 'tax_amount', label: 'Tax', right: true },
  ],
  'low-stock': [
    { key: 'item_name', label: 'Item' },
    { key: 'stock', label: 'Stock', right: true },
    { key: 'alert_qty', label: 'Alert', right: true },
    { key: 'shortfall', label: 'Short', right: true },
  ],
  'stock-movement': [
    { key: 'item_name', label: 'Item' },
    { key: 'stock_in', label: 'In', right: true },
    { key: 'stock_out', label: 'Out', right: true },
    { key: 'txn_count', label: 'Txns', right: true },
  ],
  'attendance': [
    { key: 'name', label: 'Employee' },
    { key: 'present', label: 'P', right: true },
    { key: 'absent', label: 'A', right: true },
    { key: 'earned_days', label: 'Earned', right: true },
  ],
  'payroll': [
    { key: 'employee_name', label: 'Employee' },
    { key: 'net_pay', label: 'Net Pay', right: true },
    { key: 'status', label: 'Status' },
  ],
};

function TableView({ def, data }: { def: ReportDef; data: any[] }) {
  if (!Array.isArray(data) || data.length === 0)
    return <View style={s.empty}><Text style={s.emptyText}>No data</Text></View>;
  const cols = COL_DEFS[def.key] || Object.keys(data[0] || {}).slice(0, 4).map((k) => ({ key: k, label: k.toUpperCase() }));
  return (
    <View style={s.tableCard}>
      <View style={[s.tableRow, s.tableHeader]}>
        {cols.map((c) => (
          <Text key={c.key} style={[s.tableCell, c.right && s.right, s.headerCell]}>{c.label}</Text>
        ))}
      </View>
      {data.map((row, i) => (
        <View key={i} style={s.tableRow}>
          {cols.map((c) => {
            const v = row[c.key];
            const isNum = typeof v === 'number';
            return (
              <Text key={c.key} style={[s.tableCell, c.right && s.right]} numberOfLines={1}>
                {isNum ? fmt(v) : (v ?? '—')}
              </Text>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ----- Aging -----
function AgingView({ data }: { data: any }) {
  return (
    <>
      <SectionTitle title={`Receivables  (As of ${fmtDate(data.as_of)})`} />
      <AgingTable rows={data.receivables} totals={data.receivables_total} nameKey="customer_name" />
      <SectionTitle title="Payables" />
      <AgingTable rows={data.payables} totals={data.payables_total} nameKey="vendor_name" />
    </>
  );
}

function AgingTable({ rows, totals, nameKey }: any) {
  return (
    <View style={s.tableCard}>
      <View style={[s.tableRow, s.tableHeader]}>
        <Text style={[s.tableCell, s.headerCell, { flex: 2 }]}>Party</Text>
        <Text style={[s.tableCell, s.right, s.headerCell]}>0-30</Text>
        <Text style={[s.tableCell, s.right, s.headerCell]}>30-60</Text>
        <Text style={[s.tableCell, s.right, s.headerCell]}>60-90</Text>
        <Text style={[s.tableCell, s.right, s.headerCell]}>90+</Text>
        <Text style={[s.tableCell, s.right, s.headerCell]}>Total</Text>
      </View>
      {rows.map((r: any, i: number) => (
        <View key={i} style={s.tableRow}>
          <Text style={[s.tableCell, { flex: 2 }]} numberOfLines={1}>{r[nameKey]}</Text>
          <Text style={[s.tableCell, s.right]}>{fmt(r['0-30'])}</Text>
          <Text style={[s.tableCell, s.right]}>{fmt(r['30-60'])}</Text>
          <Text style={[s.tableCell, s.right]}>{fmt(r['60-90'])}</Text>
          <Text style={[s.tableCell, s.right, { color: colors.danger }]}>{fmt(r['90+'])}</Text>
          <Text style={[s.tableCell, s.right, { fontWeight: '700' }]}>{fmt(r.total)}</Text>
        </View>
      ))}
      <View style={[s.tableRow, { backgroundColor: colors.gray100, borderTopWidth: 2 }]}>
        <Text style={[s.tableCell, { flex: 2, fontWeight: '700' }]}>Total</Text>
        <Text style={[s.tableCell, s.right, { fontWeight: '700' }]}>{fmt(totals['0-30'])}</Text>
        <Text style={[s.tableCell, s.right, { fontWeight: '700' }]}>{fmt(totals['30-60'])}</Text>
        <Text style={[s.tableCell, s.right, { fontWeight: '700' }]}>{fmt(totals['60-90'])}</Text>
        <Text style={[s.tableCell, s.right, { fontWeight: '700', color: colors.danger }]}>{fmt(totals['90+'])}</Text>
        <Text style={[s.tableCell, s.right, { fontWeight: '700' }]}>{fmt(totals.total)}</Text>
      </View>
    </View>
  );
}

// ----- P&L -----
function PLView({ data }: { data: any }) {
  return (
    <View style={{ paddingHorizontal: spacing.md }}>
      <Card>
        <Text style={s.sectHeading}>Income</Text>
        <Line label="Sales" value={data.sales} />
        <Line label="(−) Sales Returns" value={-data.sales_returns} />
        <Line label="Net Sales" value={data.net_sales} bold />
      </Card>
      <Card>
        <Text style={s.sectHeading}>Expenses</Text>
        <Line label="Purchases" value={data.purchases} />
        <Line label="(−) Purchase Returns" value={-data.purchase_returns} />
        <Line label="Net Purchases" value={data.net_purchases} bold />
        {data.expenses_by_category?.map((c: any) => (
          <Line key={c.category} label={c.category} value={c.amount} />
        ))}
        <Line label="Total Expenses" value={data.expenses_total} bold />
      </Card>
      <Card emphasis>
        <Line label="Gross Profit" value={data.gross_profit} bold />
        <Line
          label="Net Profit"
          value={data.net_profit}
          bold
          color={data.net_profit >= 0 ? colors.success : colors.danger}
          big
        />
      </Card>
    </View>
  );
}

// ----- Cash Flow -----
function CashFlowView({ data }: { data: any }) {
  return (
    <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
      <Stat label="Received" value={data.received} color={colors.success} icon="arrow-down-circle-outline" />
      <Stat label="Paid Out" value={data.paid_out} color={colors.danger} icon="arrow-up-circle-outline" />
      <Stat label="Expenses" value={data.expenses} color={colors.warning} icon="receipt-outline" />
      <Stat label="Net Cash Flow" value={data.net_cash_flow} color={data.net_cash_flow >= 0 ? colors.success : colors.danger} icon="wallet-outline" big />
    </View>
  );
}

// ----- GST -----
function GstView({ data }: { data: any }) {
  return (
    <View style={{ paddingHorizontal: spacing.md }}>
      <Card>
        <Text style={s.sectHeading}>Output (Sales)</Text>
        <Line label="Output Taxable" value={data.output_taxable} />
        <Line label="(−) CN Tax" value={-data.credit_notes_tax} />
        <Line label="Output Tax" value={data.output_tax} bold />
      </Card>
      <Card>
        <Text style={s.sectHeading}>Input (Purchases)</Text>
        <Line label="Input Taxable" value={data.input_taxable} />
        <Line label="(−) DN Tax" value={-data.debit_notes_tax} />
        <Line label="Input Tax (ITC)" value={data.input_tax} bold />
      </Card>
      <Card emphasis>
        <Line
          label="Net GST Payable"
          value={data.net_payable}
          bold big
          color={data.net_payable > 0 ? colors.danger : colors.success}
        />
      </Card>
    </View>
  );
}

// ----- Party Balance -----
function PartyView({ data }: { data: any }) {
  return (
    <>
      <SectionTitle title={`Debtors  •  ₹${fmt(data.total_receivable)}`} />
      <View style={s.tableCard}>
        {data.debtors.map((d: any, i: number) => (
          <View key={i} style={s.tableRow}>
            <Text style={[s.tableCell, { flex: 2 }]} numberOfLines={1}>{d.name}</Text>
            <Text style={[s.tableCell, s.right, { color: colors.success, fontWeight: '600' }]}>₹{fmt(d.balance)}</Text>
          </View>
        ))}
        {data.debtors.length === 0 && <View style={s.empty}><Text style={s.emptyText}>None</Text></View>}
      </View>
      <SectionTitle title={`Creditors  •  ₹${fmt(data.total_payable)}`} />
      <View style={s.tableCard}>
        {data.creditors.map((c: any, i: number) => (
          <View key={i} style={s.tableRow}>
            <Text style={[s.tableCell, { flex: 2 }]} numberOfLines={1}>{c.name}</Text>
            <Text style={[s.tableCell, s.right, { color: colors.danger, fontWeight: '600' }]}>₹{fmt(c.balance)}</Text>
          </View>
        ))}
        {data.creditors.length === 0 && <View style={s.empty}><Text style={s.emptyText}>None</Text></View>}
      </View>
    </>
  );
}

// ----- Tasks -----
function TasksView({ data }: { data: any }) {
  return (
    <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
      <Stat label="Total Tasks" value={data.total} color={colors.primary} icon="list-outline" isCount />
      {data.by_status?.map((s2: any) => (
        <Stat key={s2.status} label={s2.status} value={s2.count} color={colors.gray500} icon="ellipse-outline" isCount />
      ))}
      <SectionTitle title="By Employee" />
      <View style={s.tableCard}>
        <View style={[s.tableRow, s.tableHeader]}>
          <Text style={[s.tableCell, s.headerCell, { flex: 2 }]}>Employee</Text>
          <Text style={[s.tableCell, s.right, s.headerCell]}>Total</Text>
          <Text style={[s.tableCell, s.right, s.headerCell]}>Done</Text>
          <Text style={[s.tableCell, s.right, s.headerCell]}>Pend</Text>
          <Text style={[s.tableCell, s.right, s.headerCell]}>Late</Text>
        </View>
        {data.by_employee.map((e: any, i: number) => (
          <View key={i} style={s.tableRow}>
            <Text style={[s.tableCell, { flex: 2 }]} numberOfLines={1}>{e.employee_name}</Text>
            <Text style={[s.tableCell, s.right]}>{e.total}</Text>
            <Text style={[s.tableCell, s.right, { color: colors.success }]}>{e.completed}</Text>
            <Text style={[s.tableCell, s.right, { color: colors.warning }]}>{e.pending}</Text>
            <Text style={[s.tableCell, s.right, { color: colors.danger }]}>{e.delayed}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ----- Returns -----
function ReturnsView({ data, kind }: { data: any; kind: string }) {
  return (
    <>
      <View style={{ flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.sm }}>
        <View style={[s.statBox, { flex: 1 }]}>
          <Text style={s.statLabel}>Total {kind} Returns</Text>
          <Text style={[s.statValue, { color: colors.danger }]}>₹{fmt(data.total)}</Text>
        </View>
        <View style={[s.statBox, { flex: 1 }]}>
          <Text style={s.statLabel}>Count</Text>
          <Text style={s.statValue}>{data.count}</Text>
        </View>
      </View>
      <View style={s.tableCard}>
        <View style={[s.tableRow, s.tableHeader]}>
          <Text style={[s.tableCell, s.headerCell]}>Date</Text>
          <Text style={[s.tableCell, s.headerCell, { flex: 1.4 }]}>{kind === 'Sales' ? 'Customer' : 'Vendor'}</Text>
          <Text style={[s.tableCell, s.right, s.headerCell]}>Total</Text>
        </View>
        {data.rows.map((r: any) => (
          <View key={r.id} style={s.tableRow}>
            <Text style={s.tableCell} numberOfLines={1}>{fmtDate(r.date)}</Text>
            <Text style={[s.tableCell, { flex: 1.4 }]} numberOfLines={1}>{r.customer_name || r.vendor_name}</Text>
            <Text style={[s.tableCell, s.right, { fontWeight: '600' }]}>₹{fmt(r.total)}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

// ----- Day Book -----
function DayBookView({ data }: { data: any[] }) {
  const totalDr = data.reduce((s2, r) => s2 + (r.debit || 0), 0);
  const totalCr = data.reduce((s2, r) => s2 + (r.credit || 0), 0);
  return (
    <View style={s.tableCard}>
      <View style={[s.tableRow, s.tableHeader]}>
        <Text style={[s.tableCell, s.headerCell]}>Date</Text>
        <Text style={[s.tableCell, s.headerCell]}>Type</Text>
        <Text style={[s.tableCell, s.headerCell, { flex: 1.5 }]}>Party</Text>
        <Text style={[s.tableCell, s.right, s.headerCell]}>Dr</Text>
        <Text style={[s.tableCell, s.right, s.headerCell]}>Cr</Text>
      </View>
      {data.map((r, i) => (
        <View key={i} style={s.tableRow}>
          <Text style={s.tableCell} numberOfLines={1}>{fmtDate(r.date)}</Text>
          <Text style={s.tableCell} numberOfLines={1}>{r.type}</Text>
          <Text style={[s.tableCell, { flex: 1.5 }]} numberOfLines={1}>{r.party}</Text>
          <Text style={[s.tableCell, s.right]}>{r.debit ? fmt(r.debit) : ''}</Text>
          <Text style={[s.tableCell, s.right]}>{r.credit ? fmt(r.credit) : ''}</Text>
        </View>
      ))}
      <View style={[s.tableRow, { backgroundColor: colors.gray100, borderTopWidth: 2 }]}>
        <Text style={[s.tableCell, { fontWeight: '700' }]}>Total</Text>
        <Text style={s.tableCell}> </Text>
        <Text style={[s.tableCell, { flex: 1.5 }]}> </Text>
        <Text style={[s.tableCell, s.right, { fontWeight: '700' }]}>{fmt(totalDr)}</Text>
        <Text style={[s.tableCell, s.right, { fontWeight: '700' }]}>{fmt(totalCr)}</Text>
      </View>
    </View>
  );
}

// ----- Trend (bar list) -----
function TrendView({ data }: { data: any[] }) {
  if (!data || data.length === 0) return <View style={s.empty}><Text style={s.emptyText}>No data</Text></View>;
  const max = Math.max(...data.map((d) => d.amount), 1);
  const total = data.reduce((s2, d) => s2 + d.amount, 0);
  return (
    <View style={{ paddingHorizontal: spacing.md }}>
      <Card>
        <Text style={s.statLabel}>Total</Text>
        <Text style={[s.statValue, { fontSize: 24 }]}>₹{fmt(total)}</Text>
      </Card>
      <Card>
        {data.map((d, i) => (
          <View key={i} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '600', color: colors.text }}>{d.period}</Text>
              <Text style={{ color: colors.textSecondary }}>₹{fmt(d.amount)} ({d.count})</Text>
            </View>
            <View style={{ height: 6, backgroundColor: colors.gray100, borderRadius: 4, marginTop: 4, overflow: 'hidden' }}>
              <View style={{ width: `${(d.amount / max) * 100}%`, height: '100%', backgroundColor: colors.primary }} />
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

// ===== Helpers =====
function Card({ children, emphasis }: { children: React.ReactNode; emphasis?: boolean }) {
  return (
    <View style={[s.cardBox, emphasis && { borderWidth: 2, borderColor: colors.primary }]}>{children}</View>
  );
}

function Line({ label, value, bold, big, color }: { label: string; value: number; bold?: boolean; big?: boolean; color?: string }) {
  return (
    <View style={s.lineRow}>
      <Text style={[s.lineLabel, bold && { fontWeight: '700' }, big && { fontSize: fontSize.md }]}>{label}</Text>
      <Text style={[s.lineValue, bold && { fontWeight: '700' }, big && { fontSize: fontSize.lg }, color && { color }]}>
        ₹{fmt(value)}
      </Text>
    </View>
  );
}

function Stat({ label, value, color, icon, big, isCount }: any) {
  return (
    <View style={s.statBox}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={icon} size={18} color={color} />
        <Text style={s.statLabel}>{label}</Text>
      </View>
      <Text style={[s.statValue, big && { fontSize: 24 }, { color }]}>
        {isCount ? value : `₹${fmt(value)}`}
      </Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={s.sectionTitle}>{title}</Text>;
}

// =============== HTML for PDF ===============
function buildHTML(def: ReportDef, data: any, sub: string, business: any): string {
  const css = `
    <style>
      body { font-family: -apple-system, Helvetica, sans-serif; padding: 20px; color: #1f2937; }
      .biz { text-align: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1.5px solid #1a1a40; }
      .biz-name { font-size: 16px; font-weight: 700; color: #1a1a40; margin: 0; }
      .biz-line { font-size: 10px; color: #6b7280; margin: 2px 0; }
      h1 { text-align: center; margin: 0; font-size: 18px; }
      .sub { text-align: center; color: #6b7280; font-size: 11px; margin: 4px 0 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 12px; }
      th, td { border: 1px solid #d1d5db; padding: 5px 8px; text-align: left; }
      th { background: #f3f4f6; font-weight: 700; }
      .right { text-align: right; }
      .total-row { background: #f9fafb; font-weight: 700; }
      .section { font-weight: 700; font-size: 12px; margin: 12px 0 6px; color: #1a1a40; }
      .summary-grid { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
      .summary-card { border: 1px solid #d1d5db; padding: 8px 12px; border-radius: 6px; min-width: 140px; }
      .summary-label { font-size: 10px; color: #6b7280; }
      .summary-value { font-size: 14px; font-weight: 700; }
    </style>
  `;
  const bizParts: string[] = [];
  if (business?.address) bizParts.push(business.address);
  const cl: string[] = [];
  if (business?.mobile) cl.push(`Ph: ${business.mobile}`);
  if (business?.email) cl.push(business.email);
  if (cl.length) bizParts.push(cl.join(' • '));
  const idl: string[] = [];
  if (business?.gst_number) idl.push(`GSTIN: ${business.gst_number}`);
  if (business?.pan) idl.push(`PAN: ${business.pan}`);
  if (idl.length) bizParts.push(idl.join(' • '));
  const bizHeader = business ? `
    <div class="biz">
      <div class="biz-name">${business.business_name || ''}</div>
      ${bizParts.map((p) => `<div class="biz-line">${p}</div>`).join('')}
    </div>
  ` : '';
  const head = `${bizHeader}<h1>${def.title}</h1><div class="sub">${sub}</div>`;
  const num = (v: any) => fmt(Number(v));

  let body = '';
  switch (def.key) {
    case 'aging': {
      const recRows = data.receivables.map((r: any) => `<tr><td>${r.customer_name}</td><td class="right">${num(r['0-30'])}</td><td class="right">${num(r['30-60'])}</td><td class="right">${num(r['60-90'])}</td><td class="right">${num(r['90+'])}</td><td class="right">${num(r.total)}</td></tr>`).join('');
      const payRows = data.payables.map((r: any) => `<tr><td>${r.vendor_name}</td><td class="right">${num(r['0-30'])}</td><td class="right">${num(r['30-60'])}</td><td class="right">${num(r['60-90'])}</td><td class="right">${num(r['90+'])}</td><td class="right">${num(r.total)}</td></tr>`).join('');
      body = `
        <div class="section">Receivables (As of ${fmtDate(data.as_of)})</div>
        <table><thead><tr><th>Party</th><th>0-30</th><th>30-60</th><th>60-90</th><th>90+</th><th>Total</th></tr></thead>
        <tbody>${recRows}<tr class="total-row"><td>Total</td><td class="right">${num(data.receivables_total['0-30'])}</td><td class="right">${num(data.receivables_total['30-60'])}</td><td class="right">${num(data.receivables_total['60-90'])}</td><td class="right">${num(data.receivables_total['90+'])}</td><td class="right">${num(data.receivables_total.total)}</td></tr></tbody></table>
        <div class="section">Payables</div>
        <table><thead><tr><th>Party</th><th>0-30</th><th>30-60</th><th>60-90</th><th>90+</th><th>Total</th></tr></thead>
        <tbody>${payRows}<tr class="total-row"><td>Total</td><td class="right">${num(data.payables_total['0-30'])}</td><td class="right">${num(data.payables_total['30-60'])}</td><td class="right">${num(data.payables_total['60-90'])}</td><td class="right">${num(data.payables_total['90+'])}</td><td class="right">${num(data.payables_total.total)}</td></tr></tbody></table>
      `;
      break;
    }
    case 'profit-loss':
      body = `
        <table><tbody>
          <tr><td>Sales</td><td class="right">${num(data.sales)}</td></tr>
          <tr><td>(−) Sales Returns</td><td class="right">${num(data.sales_returns)}</td></tr>
          <tr class="total-row"><td>Net Sales</td><td class="right">${num(data.net_sales)}</td></tr>
          <tr><td>Purchases</td><td class="right">${num(data.purchases)}</td></tr>
          <tr><td>(−) Purchase Returns</td><td class="right">${num(data.purchase_returns)}</td></tr>
          <tr class="total-row"><td>Net Purchases</td><td class="right">${num(data.net_purchases)}</td></tr>
          <tr><td>Gross Profit</td><td class="right">${num(data.gross_profit)}</td></tr>
          ${(data.expenses_by_category || []).map((c: any) => `<tr><td>${c.category}</td><td class="right">${num(c.amount)}</td></tr>`).join('')}
          <tr class="total-row"><td>Total Expenses</td><td class="right">${num(data.expenses_total)}</td></tr>
          <tr class="total-row" style="font-size:13px;background:#1a1a40;color:#fff"><td>Net Profit</td><td class="right">${num(data.net_profit)}</td></tr>
        </tbody></table>
      `;
      break;
    case 'cash-flow':
      body = `
        <div class="summary-grid">
          <div class="summary-card"><div class="summary-label">Received</div><div class="summary-value">₹${num(data.received)}</div></div>
          <div class="summary-card"><div class="summary-label">Paid Out</div><div class="summary-value">₹${num(data.paid_out)}</div></div>
          <div class="summary-card"><div class="summary-label">Expenses</div><div class="summary-value">₹${num(data.expenses)}</div></div>
          <div class="summary-card"><div class="summary-label">Net Cash Flow</div><div class="summary-value">₹${num(data.net_cash_flow)}</div></div>
        </div>
      `;
      break;
    case 'gst-summary':
      body = `
        <table><tbody>
          <tr><td>Output Taxable</td><td class="right">${num(data.output_taxable)}</td></tr>
          <tr><td>Output Tax</td><td class="right">${num(data.output_tax)}</td></tr>
          <tr><td>(−) Credit Notes Tax</td><td class="right">${num(data.credit_notes_tax)}</td></tr>
          <tr><td>Input Taxable</td><td class="right">${num(data.input_taxable)}</td></tr>
          <tr><td>Input Tax (ITC)</td><td class="right">${num(data.input_tax)}</td></tr>
          <tr><td>(−) Debit Notes Tax</td><td class="right">${num(data.debit_notes_tax)}</td></tr>
          <tr class="total-row"><td>Net GST Payable</td><td class="right">${num(data.net_payable)}</td></tr>
        </tbody></table>
      `;
      break;
    case 'party-balance': {
      const dr = data.debtors.map((d: any) => `<tr><td>${d.name}</td><td class="right">${num(d.balance)}</td></tr>`).join('');
      const cr = data.creditors.map((c: any) => `<tr><td>${c.name}</td><td class="right">${num(c.balance)}</td></tr>`).join('');
      body = `
        <div class="section">Debtors  (Total: ₹${num(data.total_receivable)})</div>
        <table><thead><tr><th>Customer</th><th>Balance</th></tr></thead><tbody>${dr || '<tr><td colspan="2">None</td></tr>'}</tbody></table>
        <div class="section">Creditors  (Total: ₹${num(data.total_payable)})</div>
        <table><thead><tr><th>Vendor</th><th>Balance</th></tr></thead><tbody>${cr || '<tr><td colspan="2">None</td></tr>'}</tbody></table>
      `;
      break;
    }
    case 'day-book': {
      const totalDr = (data || []).reduce((s2: number, r: any) => s2 + (r.debit || 0), 0);
      const totalCr = (data || []).reduce((s2: number, r: any) => s2 + (r.credit || 0), 0);
      const rows = (data || []).map((r: any) => `<tr><td>${fmtDate(r.date)}</td><td>${r.type}</td><td>${r.ref}</td><td>${r.party}</td><td class="right">${r.debit ? num(r.debit) : ''}</td><td class="right">${r.credit ? num(r.credit) : ''}</td></tr>`).join('');
      body = `<table><thead><tr><th>Date</th><th>Type</th><th>Ref</th><th>Party</th><th>Debit</th><th>Credit</th></tr></thead>
        <tbody>${rows}<tr class="total-row"><td colspan="4">Total</td><td class="right">${num(totalDr)}</td><td class="right">${num(totalCr)}</td></tr></tbody></table>`;
      break;
    }
    case 'tasks': {
      const empRows = data.by_employee.map((e: any) => `<tr><td>${e.employee_name}</td><td class="right">${e.total}</td><td class="right">${e.completed}</td><td class="right">${e.pending}</td><td class="right">${e.delayed}</td></tr>`).join('');
      body = `
        <div class="section">Total: ${data.total} tasks</div>
        ${(data.by_status || []).map((b: any) => `<div>${b.status}: ${b.count}</div>`).join('')}
        <div class="section">By Employee</div>
        <table><thead><tr><th>Employee</th><th>Total</th><th>Done</th><th>Pending</th><th>Delayed</th></tr></thead><tbody>${empRows}</tbody></table>
      `;
      break;
    }
    case 'sales-return':
    case 'purchase-return': {
      const isSales = def.key === 'sales-return';
      const rows = (data.rows || []).map((r: any) => `<tr><td>${fmtDate(r.date)}</td><td>${r.cn_number || r.dn_number}</td><td>${r.customer_name || r.vendor_name}</td><td>${r.invoice_number || r.bill_number}</td><td>${r.reason || ''}</td><td class="right">${num(r.total)}</td></tr>`).join('');
      body = `<table><thead><tr><th>Date</th><th>No.</th><th>${isSales ? 'Customer' : 'Vendor'}</th><th>Ref</th><th>Reason</th><th>Total</th></tr></thead>
        <tbody>${rows}<tr class="total-row"><td colspan="5">Total</td><td class="right">${num(data.total)}</td></tr></tbody></table>`;
      break;
    }
    case 'sales-trend':
    case 'purchase-trend': {
      const total = (data || []).reduce((s2: number, d: any) => s2 + d.amount, 0);
      const rows = (data || []).map((d: any) => `<tr><td>${d.period}</td><td class="right">${num(d.amount)}</td><td class="right">${d.count}</td></tr>`).join('');
      body = `<table><thead><tr><th>Period</th><th>Amount</th><th>Count</th></tr></thead>
        <tbody>${rows}<tr class="total-row"><td>Total</td><td class="right">${num(total)}</td><td></td></tr></tbody></table>`;
      break;
    }
    default: {
      const cols = COL_DEFS[def.key];
      if (cols && Array.isArray(data) && data.length > 0) {
        const header = cols.map((c) => `<th class="${c.right ? 'right' : ''}">${c.label}</th>`).join('');
        const rows = data.map((row: any) => `<tr>${cols.map((c) => {
          const v = row[c.key];
          const cls = c.right ? 'right' : '';
          return `<td class="${cls}">${typeof v === 'number' ? num(v) : (v ?? '')}</td>`;
        }).join('')}</tr>`).join('');
        body = `<table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
      } else {
        body = '<div>No data</div>';
      }
    }
  }
  return `<html><head>${css}</head><body>${head}${body}</body></html>`;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filterCard: {
    backgroundColor: colors.white, padding: spacing.md,
    margin: spacing.md, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  dateBtn: {
    flex: 1, padding: spacing.sm, borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.sm, backgroundColor: colors.gray50,
  },
  dateLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
  dateValue: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginTop: 2 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.xs, color: colors.text, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  miniChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, marginRight: 6, backgroundColor: colors.gray100 },
  miniChipActive: { backgroundColor: colors.primary },
  miniChipText: { fontSize: fontSize.xs, color: colors.text },
  miniChipTextActive: { color: colors.white, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  refreshBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.primary, paddingVertical: 10, borderRadius: borderRadius.sm,
  },
  refreshText: { color: colors.white, fontWeight: '700', fontSize: fontSize.sm },
  pdfBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.white,
  },
  pdfText: { color: colors.primary, fontWeight: '700', fontSize: fontSize.sm },

  sectionTitle: {
    fontSize: fontSize.md, fontWeight: '700', color: colors.text,
    paddingHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.xs,
  },
  tableCard: {
    backgroundColor: colors.white, marginHorizontal: spacing.md, marginBottom: spacing.sm,
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8, paddingHorizontal: 6 },
  tableHeader: { backgroundColor: colors.gray50 },
  tableCell: { flex: 1, fontSize: fontSize.xs, color: colors.text, paddingHorizontal: 4 },
  headerCell: { fontWeight: '700', color: colors.gray700 },
  right: { textAlign: 'right' },

  cardBox: {
    backgroundColor: colors.white, padding: spacing.md, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  sectHeading: { fontSize: fontSize.sm, fontWeight: '700', color: colors.primary, marginBottom: spacing.xs },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  lineLabel: { fontSize: fontSize.sm, color: colors.text, flex: 1 },
  lineValue: { fontSize: fontSize.sm, color: colors.text, fontVariant: ['tabular-nums'] },

  statBox: {
    backgroundColor: colors.white, padding: spacing.md, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  statLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: 4 },
  statValue: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },

  empty: { padding: spacing.lg, alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: fontSize.sm },
});
