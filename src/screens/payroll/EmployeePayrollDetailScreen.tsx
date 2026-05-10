import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import api from '../../api/client';
import { colors, spacing, borderRadius } from '../../theme';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function ordinal(n: number) {
  if (n === 1 || n === 21 || n === 31) return n + 'st';
  if (n === 2 || n === 22) return n + 'nd';
  if (n === 3 || n === 23) return n + 'rd';
  return n + 'th';
}

export default function EmployeePayrollDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const { employeeId, employeeName } = route.params;
  const [employee, setEmployee] = useState<any>(null);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [business, setBusiness] = useState<any>(null);
  const [orgId, setOrgId] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const biz = await api.get('/api/business');
        const oid = biz.data[0]?.org_id;
        if (oid) {
          setOrgId(oid);
          setBusiness(biz.data[0]);
          const [empRes, payRes] = await Promise.all([
            api.get(`/api/employees/${employeeId}`),
            api.get(`/api/payroll?org_id=${oid}&year=${year}`),
          ]);
          setEmployee(empRes.data);
          const empPayroll = (Array.isArray(payRes.data) ? payRes.data : []).filter((p: any) => p.employee_id === employeeId);
          setPayroll(empPayroll);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, [employeeId, year]);

  const fetchPayroll = async (yr?: number) => {
    try {
      const res = await api.get(`/api/payroll?org_id=${orgId}&year=${yr || year}`);
      const empPayroll = (Array.isArray(res.data) ? res.data : []).filter((p: any) => p.employee_id === employeeId);
      setPayroll(empPayroll);
    } catch {}
  };

  const markPaid = (id: number) => {
    Alert.alert('Mark Paid', 'Confirm payment?', [
      { text: 'Cancel' },
      { text: 'Confirm', onPress: async () => {
        try { await api.patch(`/api/payroll/${id}/pay`); fetchPayroll(); } catch {}
      }},
    ]);
  };

  // Summary stats
  const summary = useMemo(() => {
    const months = payroll.length;
    const totalEarned = payroll.reduce((s, p) => s + (parseFloat(p.earned_amount) || 0), 0);
    const totalBonus = payroll.reduce((s, p) => s + (parseFloat(p.bonus) || 0) + (parseFloat(p.incentives) || 0), 0);
    const totalNet = payroll.reduce((s, p) => s + (parseFloat(p.net_pay) || 0), 0);
    const totalPaid = payroll.filter(p => p.status === 'Paid').reduce((s, p) => s + (parseFloat(p.net_pay) || 0), 0);
    return { months, totalEarned, totalBonus, totalNet, totalPaid };
  }, [payroll]);

  // Parse deduction_details JSON
  const parseDeductions = (p: any) => {
    try {
      if (p.deduction_details) {
        const parsed = typeof p.deduction_details === 'string' ? JSON.parse(p.deduction_details) : p.deduction_details;
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  };

  // Salary Slip PDF
  const generateSalaryPDF = async (p: any) => {
    const deds = parseDeductions(p);
    const earningsRows = [
      { label: 'Gross Salary', amount: parseFloat(p.salary_amount) || 0 },
      { label: 'Earned Salary', amount: parseFloat(p.earned_amount) || 0 },
    ];
    if (parseFloat(p.bonus) > 0) earningsRows.push({ label: 'Bonus', amount: parseFloat(p.bonus) });
    if (parseFloat(p.incentives) > 0) earningsRows.push({ label: 'Incentives', amount: parseFloat(p.incentives) });
    const totalEarnings = earningsRows.reduce((s, r) => s + r.amount, 0) - (parseFloat(p.salary_amount) || 0);

    const deductionRows = [];
    if (parseFloat(p.deductions) > 0) deductionRows.push({ label: 'Salary Advance', amount: parseFloat(p.deductions) });
    deds.forEach((d: any) => deductionRows.push({ label: d.label, amount: d.amount }));
    if (parseFloat(p.other_deductions) > 0 && deds.length === 0) deductionRows.push({ label: 'Other Deductions', amount: parseFloat(p.other_deductions) });

    const html = `<html><head><meta charset="utf-8"/><style>
      body{font-family:-apple-system,sans-serif;padding:30px;color:#1f2937;font-size:12px}
      h1{font-size:22px;color:#1a1a40;margin:0 0 2px;text-align:center}
      .sub{text-align:center;font-size:11px;color:#6b7280;margin-bottom:20px}
      .biz{text-align:center;font-size:10px;color:#9ca3af;margin-bottom:6px}
      .info{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;background:#f9fafb;padding:14px;border-radius:8px}
      .info-item{flex:1;min-width:45%}.info-label{font-size:9px;color:#9ca3af;text-transform:uppercase;font-weight:700;letter-spacing:.3px}
      .info-value{font-size:12px;color:#1f2937;font-weight:600;margin-top:1px}
      table{width:100%;border-collapse:collapse}
      th{background:#1a1a40;color:#fff;padding:8px;text-align:left;font-size:10px;text-transform:uppercase;font-weight:700}
      td{padding:7px 8px;border-bottom:1px solid #f3f4f6;font-size:11px}
      .r{text-align:right}.bold{font-weight:700}
      .total{background:#f0f1f5}
      .net{background:#059669;color:#fff;padding:14px;border-radius:8px;text-align:center;margin-top:20px}
      .net-label{font-size:10px;text-transform:uppercase;letter-spacing:.5px;opacity:.8}
      .net-value{font-size:24px;font-weight:900;margin-top:2px}
      .paid{text-align:center;font-size:10px;color:#059669;margin-top:8px;font-weight:600}
      .footer{text-align:center;font-size:9px;color:#9ca3af;margin-top:30px;border-top:1px solid #e5e7eb;padding-top:10px}
    </style></head><body>
      <h1>SALARY SLIP</h1>
      <div class="sub">${MONTHS[p.month - 1]} ${p.year}</div>
      ${business ? `<div class="biz">${business.business_name || ''}${business.address ? ' · ' + business.address : ''}</div>` : ''}
      <div class="info">
        <div class="info-item"><div class="info-label">Employee</div><div class="info-value">${employee?.name || p.employee_name || ''}</div></div>
        <div class="info-item"><div class="info-label">Salary Type</div><div class="info-value">${employee?.salary_type || 'monthly'}</div></div>
        <div class="info-item"><div class="info-label">Working Days</div><div class="info-value">${p.present_days}/${p.working_days}</div></div>
        ${employee?.mobile ? `<div class="info-item"><div class="info-label">Mobile</div><div class="info-value">${employee.mobile}</div></div>` : ''}
        ${employee?.pan ? `<div class="info-item"><div class="info-label">PAN</div><div class="info-value">${employee.pan}</div></div>` : ''}
        ${employee?.bank_name ? `<div class="info-item"><div class="info-label">Bank</div><div class="info-value">${employee.bank_name} - ${employee.bank_account || ''}</div></div>` : ''}
      </div>
      <table>
        <thead><tr><th>Earnings</th><th class="r">Amount</th></tr></thead>
        <tbody>
          ${earningsRows.map(r => `<tr><td>${r.label}</td><td class="r">₹${r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>`).join('')}
        </tbody>
      </table>
      ${deductionRows.length > 0 ? `
        <table style="margin-top:12px">
          <thead><tr><th style="background:#dc2626">Deductions</th><th class="r" style="background:#dc2626">Amount</th></tr></thead>
          <tbody>
            ${deductionRows.map(r => `<tr><td>${r.label}</td><td class="r">₹${(r.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>`).join('')}
          </tbody>
        </table>
      ` : ''}
      <div class="net">
        <div class="net-label">Net Pay</div>
        <div class="net-value">₹${(parseFloat(p.net_pay) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
      ${p.status === 'Paid' && p.paid_date ? `<div class="paid">Paid on ${new Date(p.paid_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>` : ''}
      <div class="footer">Generated via BillFlow</div>
    </body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch { Alert.alert('Error', 'Could not generate PDF'); }
  };

  // Year Report PDF
  const exportYearReport = async () => {
    if (payroll.length === 0) return Alert.alert('Nothing to export');
    setExporting(true);
    try {
      const rows = payroll.sort((a, b) => a.month - b.month).map((p, i) => `<tr>
        <td>${MONTHS[p.month - 1]}</td>
        <td>${p.present_days}/${p.working_days}</td>
        <td class="r">₹${(parseFloat(p.salary_amount) || 0).toLocaleString('en-IN')}</td>
        <td class="r">₹${(parseFloat(p.earned_amount) || 0).toLocaleString('en-IN')}</td>
        <td class="r">₹${((parseFloat(p.bonus) || 0) + (parseFloat(p.incentives) || 0)).toLocaleString('en-IN')}</td>
        <td class="r">₹${(parseFloat(p.deductions) || 0).toLocaleString('en-IN')}</td>
        <td class="r bold">₹${(parseFloat(p.net_pay) || 0).toLocaleString('en-IN')}</td>
        <td>${p.status}</td>
      </tr>`).join('');

      const html = `<html><head><meta charset="utf-8"/><style>
        body{font-family:-apple-system,sans-serif;padding:24px;color:#1f2937;font-size:11px}
        h1{font-size:18px;color:#1a1a40;margin:0 0 4px}
        .sub{font-size:10px;color:#6b7280;margin-bottom:14px}
        .grid{display:flex;gap:8px;margin-bottom:14px}
        .box{flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px}
        .box .l{font-size:8px;text-transform:uppercase;letter-spacing:.4px;color:#9ca3af;font-weight:700}
        .box .v{font-size:14px;font-weight:900;color:#1f2937;margin-top:2px}
        table{width:100%;border-collapse:collapse;font-size:10px}
        th{background:#1a1a40;color:#fff;padding:7px 6px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase}
        td{padding:6px;border-bottom:1px solid #f3f4f6}
        tr:nth-child(even){background:#fafbfc}
        .r{text-align:right}.bold{font-weight:700}
        .total td{border-top:2px solid #1a1a40;font-weight:800;background:#f0f1f5;padding:8px 6px}
        .footer{margin-top:16px;text-align:center;font-size:9px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:8px}
      </style></head><body>
        <h1>${employee?.name || employeeName} — Year Report ${year}</h1>
        <div class="sub">${business?.business_name || ''} · Generated: ${new Date().toLocaleDateString('en-IN')}</div>
        <div class="grid">
          <div class="box"><div class="l">Months</div><div class="v">${summary.months}</div></div>
          <div class="box"><div class="l">Total Earned</div><div class="v">₹${summary.totalEarned.toLocaleString('en-IN')}</div></div>
          <div class="box"><div class="l">Bonus+Inc</div><div class="v">₹${summary.totalBonus.toLocaleString('en-IN')}</div></div>
          <div class="box"><div class="l">Net Pay</div><div class="v" style="color:#059669">₹${summary.totalNet.toLocaleString('en-IN')}</div></div>
        </div>
        <table><thead><tr><th>Month</th><th>Attendance</th><th class="r">Gross</th><th class="r">Earned</th><th class="r">Bonus</th><th class="r">Deductions</th><th class="r">Net Pay</th><th>Status</th></tr></thead>
        <tbody>${rows}
          <tr class="total">
            <td colspan="3" style="text-align:right">TOTALS</td>
            <td class="r">₹${summary.totalEarned.toLocaleString('en-IN')}</td>
            <td class="r">₹${summary.totalBonus.toLocaleString('en-IN')}</td>
            <td class="r">₹${payroll.reduce((s, p) => s + (parseFloat(p.deductions) || 0), 0).toLocaleString('en-IN')}</td>
            <td class="r">₹${summary.totalNet.toLocaleString('en-IN')}</td>
            <td></td>
          </tr>
        </tbody></table>
        <div class="footer">Generated via BillFlow</div>
      </body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch { Alert.alert('Error', 'Could not generate PDF'); } finally { setExporting(false); }
  };

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
  );

  const sortedPayroll = [...payroll].sort((a, b) => a.month - b.month);

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.hero}>
          <View style={s.heroAccent} />
          <View style={s.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.heroName}>{employee?.name || employeeName}</Text>
              <Text style={s.heroSub}>
                ₹{(employee?.salary_amount || 0).toLocaleString('en-IN')} / {employee?.salary_type || 'monthly'}
              </Text>
            </View>
            <TouchableOpacity style={s.heroPDF} onPress={exportYearReport} disabled={exporting} activeOpacity={0.85}>
              {exporting ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Ionicons name="document-text-outline" size={13} color="#fff" />
                  <Text style={s.heroPDFText}>Year Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Year picker */}
          <View style={s.yearRow}>
            <TouchableOpacity onPress={() => setYear(y => y - 1)}>
              <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
            <Text style={s.yearLabel}>{year}</Text>
            <TouchableOpacity onPress={() => setYear(y => y + 1)}>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary Cards */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Months</Text>
            <Text style={s.statValue}>{summary.months}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Total Earned</Text>
            <Text style={s.statValue}>₹{summary.totalEarned.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Bonus + Inc.</Text>
            <Text style={[s.statValue, { color: '#2563eb' }]}>₹{summary.totalBonus.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
          </View>
        </View>
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Net Pay</Text>
            <Text style={[s.statValue, { color: '#059669' }]}>₹{summary.totalNet.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Total Paid</Text>
            <Text style={[s.statValue, { color: '#7c3aed' }]}>₹{summary.totalPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
          </View>
        </View>

        {/* Monthly Cards */}
        {sortedPayroll.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Ionicons name="wallet-outline" size={40} color="#e5e7eb" />
            <Text style={{ fontSize: 14, color: '#9ca3af', marginTop: 8 }}>No payroll records for {year}</Text>
          </View>
        ) : (
          sortedPayroll.map((p: any) => {
            const isPaid = p.status === 'Paid';
            const deds = parseDeductions(p);
            const bonus = parseFloat(p.bonus) || 0;
            const incentives = parseFloat(p.incentives) || 0;
            const salaryAdvance = parseFloat(p.deductions) || 0;
            const otherDed = parseFloat(p.other_deductions) || 0;
            return (
              <View key={p.id} style={s.monthCard}>
                {/* Month header */}
                <View style={s.monthHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="calendar" size={14} color={colors.primary} />
                    <Text style={s.monthTitle}>{MONTHS[p.month - 1]}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={s.attendance}>{p.present_days}/{p.working_days} days</Text>
                    <View style={[s.statusBadge, isPaid ? { backgroundColor: '#dcfce7' } : { backgroundColor: '#fef3c7' }]}>
                      <Ionicons name={isPaid ? 'checkmark-circle' : 'time-outline'} size={10} color={isPaid ? '#15803d' : '#b45309'} />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: isPaid ? '#15803d' : '#b45309' }}>{p.status}</Text>
                    </View>
                  </View>
                </View>

                {/* Details grid */}
                <View style={s.detailGrid}>
                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>Gross</Text>
                    <Text style={s.detailValue}>₹{(parseFloat(p.salary_amount) || 0).toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>Earned</Text>
                    <Text style={s.detailValue}>₹{(parseFloat(p.earned_amount) || 0).toLocaleString('en-IN')}</Text>
                  </View>
                  {bonus > 0 && (
                    <View style={s.detailItem}>
                      <Text style={[s.detailLabel, { color: '#059669' }]}>Bonus</Text>
                      <Text style={[s.detailValue, { color: '#059669' }]}>+₹{bonus.toLocaleString('en-IN')}</Text>
                    </View>
                  )}
                  {incentives > 0 && (
                    <View style={s.detailItem}>
                      <Text style={[s.detailLabel, { color: '#2563eb' }]}>Incentives</Text>
                      <Text style={[s.detailValue, { color: '#2563eb' }]}>+₹{incentives.toLocaleString('en-IN')}</Text>
                    </View>
                  )}
                  {salaryAdvance > 0 && (
                    <View style={s.detailItem}>
                      <Text style={[s.detailLabel, { color: '#dc2626' }]}>Sal. Advance</Text>
                      <Text style={[s.detailValue, { color: '#dc2626' }]}>-₹{salaryAdvance.toLocaleString('en-IN')}</Text>
                    </View>
                  )}
                  {deds.map((d: any, i: number) => (
                    <View key={i} style={s.detailItem}>
                      <Text style={[s.detailLabel, { color: '#dc2626' }]}>{d.label}</Text>
                      <Text style={[s.detailValue, { color: '#dc2626' }]}>-₹{(d.amount || 0).toLocaleString('en-IN')}</Text>
                    </View>
                  ))}
                  {otherDed > 0 && deds.length === 0 && (
                    <View style={s.detailItem}>
                      <Text style={[s.detailLabel, { color: '#dc2626' }]}>Other Ded.</Text>
                      <Text style={[s.detailValue, { color: '#dc2626' }]}>-₹{otherDed.toLocaleString('en-IN')}</Text>
                    </View>
                  )}
                </View>

                {/* Net pay row */}
                <View style={s.netRow}>
                  <Text style={s.netLabel}>Net Pay</Text>
                  <Text style={s.netValue}>₹{(parseFloat(p.net_pay) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                </View>

                {/* Actions */}
                <View style={s.actionRow}>
                  {!isPaid && (
                    <TouchableOpacity style={s.payBtn} onPress={() => markPaid(p.id)} activeOpacity={0.85}>
                      <Ionicons name="checkmark-done" size={13} color="#fff" />
                      <Text style={s.payBtnText}>Mark Paid</Text>
                    </TouchableOpacity>
                  )}
                  {isPaid && p.paid_date && (
                    <Text style={{ fontSize: 11, color: '#059669', fontWeight: '600' }}>
                      Paid on {new Date(p.paid_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </Text>
                  )}
                  <TouchableOpacity style={s.slipBtn} onPress={() => generateSalaryPDF(p)} activeOpacity={0.85}>
                    <Ionicons name="document-text-outline" size={13} color={colors.primary} />
                    <Text style={s.slipBtnText}>Salary Slip</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {/* Year Totals */}
        {payroll.length > 0 && (
          <View style={s.totalCard}>
            <Text style={s.totalTitle}>Year Totals — {year}</Text>
            <View style={s.detailGrid}>
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>Total Earned</Text>
                <Text style={s.detailValue}>₹{summary.totalEarned.toLocaleString('en-IN')}</Text>
              </View>
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>Total Bonus</Text>
                <Text style={[s.detailValue, { color: '#059669' }]}>₹{summary.totalBonus.toLocaleString('en-IN')}</Text>
              </View>
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>Total Deductions</Text>
                <Text style={[s.detailValue, { color: '#dc2626' }]}>₹{payroll.reduce((s, p) => s + (parseFloat(p.deductions) || 0) + (parseFloat(p.other_deductions) || 0), 0).toLocaleString('en-IN')}</Text>
              </View>
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>Total Net Pay</Text>
                <Text style={[s.detailValue, { color: '#059669', fontSize: 16 }]}>₹{summary.totalNet.toLocaleString('en-IN')}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f7fb' },

  hero: { backgroundColor: colors.primary, margin: spacing.md, borderRadius: 20, padding: spacing.md, overflow: 'hidden' },
  heroAccent: { position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.06)' },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroName: { fontSize: 20, fontWeight: '900', color: '#fff' },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  heroPDF: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  heroPDFText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 14, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingVertical: 8 },
  yearLabel: { fontSize: 18, fontWeight: '900', color: '#fff' },

  statsRow: { flexDirection: 'row', gap: 8, marginHorizontal: spacing.md, marginBottom: 8 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#f3f4f6' },
  statLabel: { fontSize: 10, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.3 },
  statValue: { fontSize: 15, fontWeight: '900', color: '#1f2937', marginTop: 2 },

  monthCard: { backgroundColor: '#fff', marginHorizontal: spacing.md, marginBottom: 8, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  monthTitle: { fontSize: 15, fontWeight: '800', color: '#1f2937' },
  attendance: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },

  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  detailItem: { width: '47%' },
  detailLabel: { fontSize: 10, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.2 },
  detailValue: { fontSize: 13, fontWeight: '700', color: '#1f2937', marginTop: 1 },

  netRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, marginBottom: 8 },
  netLabel: { fontSize: 12, fontWeight: '700', color: '#065f46' },
  netValue: { fontSize: 18, fontWeight: '900', color: '#059669' },

  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#059669', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  payBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  slipBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0f1f5', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  slipBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },

  totalCard: { backgroundColor: '#fff', marginHorizontal: spacing.md, marginBottom: 8, borderRadius: 14, padding: 14, borderWidth: 2, borderColor: colors.primary },
  totalTitle: { fontSize: 14, fontWeight: '800', color: colors.primary, marginBottom: 10 },
});
