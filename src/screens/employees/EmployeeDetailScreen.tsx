import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

const STATUS_CYCLE = ['', 'Present', 'Absent', 'Half Day', 'Leave'];
const STATUS_META: Record<string, { color: string; bg: string }> = {
  Present:    { color: '#15803d', bg: '#dcfce7' },
  Absent:     { color: '#dc2626', bg: '#fee2e2' },
  'Half Day': { color: '#b45309', bg: '#fef3c7' },
  Leave:      { color: '#1d4ed8', bg: '#dbeafe' },
};
const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const AVATAR_COLORS = [
  { bg: '#dbeafe', fg: '#1d4ed8' },
  { bg: '#fce7f3', fg: '#be185d' },
  { bg: '#dcfce7', fg: '#15803d' },
  { bg: '#fef3c7', fg: '#b45309' },
  { bg: '#ede9fe', fg: '#6d28d9' },
];

function avatarColor(name: string) {
  const idx = (name?.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}
function daysInMonth(m: number, y: number) { return new Date(y, m, 0).getDate(); }
function firstDayOfWeek(m: number, y: number) { return new Date(y, m - 1, 1).getDay(); }
function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

export default function EmployeeDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const { id } = route.params;
  const [emp, setEmp] = useState<any>(null);

  const now = new Date();
  const [attMonth, setAttMonth] = useState(now.getMonth() + 1);
  const [attYear, setAttYear] = useState(now.getFullYear());
  const [attSummary, setAttSummary] = useState<any>(null);
  const [attRecords, setAttRecords] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any>(null);
  const [loadingAtt, setLoadingAtt] = useState(false);
  const [generatingPayroll, setGeneratingPayroll] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);

  const fetchEmployee = async () => {
    try {
      const e = await api.get(`/api/employees/${id}`);
      setEmp(e.data);
      return e.data;
    } catch {} return null;
  };

  const fetchAttendanceAndPayroll = useCallback(async (orgId: string) => {
    if (!orgId) return;
    setLoadingAtt(true);
    try {
      const [summaryRes, recordsRes, payrollRes] = await Promise.all([
        api.get(`/api/attendance/summary?org_id=${orgId}&month=${attMonth}&year=${attYear}`),
        api.get(`/api/attendance?org_id=${orgId}&employee_id=${id}&month=${attMonth}&year=${attYear}`),
        api.get(`/api/payroll?org_id=${orgId}&month=${attMonth}&year=${attYear}`),
      ]);
      setAttSummary((summaryRes.data || []).find((a: any) => a.employee_id === id) || null);
      setAttRecords(recordsRes.data || []);
      setPayroll((payrollRes.data || []).find((p: any) => p.employee_id === id) || null);
    } catch {} finally { setLoadingAtt(false); }
  }, [id, attMonth, attYear]);

  useEffect(() => {
    (async () => {
      const e = await fetchEmployee();
      if (e) fetchAttendanceAndPayroll(e.org_id);
    })();
  }, [id]);

  useEffect(() => {
    if (emp?.org_id) fetchAttendanceAndPayroll(emp.org_id);
  }, [attMonth, attYear]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', async () => {
      const e = await fetchEmployee();
      if (e) fetchAttendanceAndPayroll(e.org_id);
    });
    return unsub;
  }, [navigation]);

  const handleDelete = () => Alert.alert('Delete employee', 'This will remove all attendance and payroll records.', [
    { text: 'Cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.delete(`/api/employees/${id}`); navigation.goBack(); } catch {} } },
  ]);

  const prevMonth = () => attMonth === 1 ? (setAttMonth(12), setAttYear(attYear - 1)) : setAttMonth(attMonth - 1);
  const nextMonth = () => attMonth === 12 ? (setAttMonth(1), setAttYear(attYear + 1)) : setAttMonth(attMonth + 1);

  const getStatusForDay = (day: number): string => {
    const dateStr = `${attYear}-${pad(attMonth)}-${pad(day)}`;
    return attRecords.find((r: any) => r.date === dateStr)?.status || '';
  };

  const handleDayTap = async (day: number) => {
    if (!emp?.org_id) return;
    const current = getStatusForDay(day);
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];
    const dateStr = `${attYear}-${pad(attMonth)}-${pad(day)}`;
    if (!next) {
      const rec = attRecords.find((r: any) => r.date === dateStr);
      if (rec) try { await api.delete(`/api/attendance/${rec.id}`); } catch {}
    } else {
      try { await api.post('/api/attendance', { org_id: emp.org_id, employee_id: id, date: dateStr, status: next }); } catch {}
    }
    fetchAttendanceAndPayroll(emp.org_id);
  };

  const handleGeneratePayroll = async () => {
    if (!emp?.org_id) return;
    setGeneratingPayroll(true);
    try {
      await api.post(`/api/payroll/generate?org_id=${emp.org_id}&month=${attMonth}&year=${attYear}&working_days=26`);
      await fetchAttendanceAndPayroll(emp.org_id);
    } catch (e: any) { Alert.alert('Error', e?.response?.data?.detail || 'Failed'); } finally { setGeneratingPayroll(false); }
  };

  const handleMarkPaid = async () => {
    if (!payroll) return;
    setMarkingPaid(true);
    try {
      await api.patch(`/api/payroll/${payroll.id}/pay`);
      await fetchAttendanceAndPayroll(emp.org_id);
    } catch (e: any) { Alert.alert('Error', e?.response?.data?.detail || 'Failed'); } finally { setMarkingPaid(false); }
  };

  if (!emp) return <View style={st.center}><ActivityIndicator color={colors.primary} /></View>;

  const a = avatarColor(emp.name || '?');
  const isActive = emp.status === 'Active';

  // Calendar grid
  const totalDays = daysInMonth(attMonth, attYear);
  const startDay = firstDayOfWeek(attMonth, attYear);
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const present = attSummary?.present || attSummary?.present_days || 0;
  const absent = attSummary?.absent || attSummary?.absent_days || 0;
  const halfDay = attSummary?.half_day || 0;
  const leave = attSummary?.leave || 0;
  const tracked = present + absent + halfDay + leave;

  return (
    <View style={{ flex: 1, backgroundColor: '#f6f7fb' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Hero */}
        <View style={st.hero}>
          <View style={st.heroAccent} />
          <View style={st.heroTopRow}>
            <View style={[st.bigAvatar, { backgroundColor: a.bg }]}>
              <Text style={[st.bigAvatarText, { color: a.fg }]}>
                {(emp.name || '?')[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={st.heroName}>{emp.name}</Text>
              <View style={st.heroMeta}>
                <View style={[st.heroStatusPill, { backgroundColor: isActive ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.15)' }]}>
                  <View style={[st.dotSmall, { backgroundColor: isActive ? '#86efac' : '#9ca3af' }]} />
                  <Text style={st.heroStatusText}>{emp.status}</Text>
                </View>
                {emp.joining_date ? (
                  <Text style={st.heroJoined}>Joined {emp.joining_date}</Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* Salary strip */}
          <View style={st.heroSalary}>
            <View>
              <Text style={st.heroSalaryLabel}>Salary</Text>
              <Text style={st.heroSalaryValue}>
                ₹{Number(emp.salary_amount || 0).toLocaleString('en-IN')}
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>/{emp.salary_type === 'monthly' ? 'mo' : 'day'}</Text>
              </Text>
            </View>
            {emp.mobile ? (
              <TouchableOpacity style={st.heroAction} onPress={() => Linking.openURL(`tel:${emp.mobile}`)} activeOpacity={0.85}>
                <Ionicons name="call" size={14} color="#fff" />
                <Text style={st.heroActionText}>Call</Text>
              </TouchableOpacity>
            ) : null}
            {emp.email ? (
              <TouchableOpacity style={st.heroAction} onPress={() => Linking.openURL(`mailto:${emp.email}`)} activeOpacity={0.85}>
                <Ionicons name="mail" size={14} color="#fff" />
                <Text style={st.heroActionText}>Email</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Contact info */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Details</Text>
          <DetailRow icon="call-outline" label="Mobile" value={emp.mobile || '-'} />
          <DetailRow icon="mail-outline" label="Email" value={emp.email || '-'} />
          <DetailRow icon="card-outline" label="PAN" value={emp.pan || '-'} />
          <DetailRow icon="finger-print-outline" label="Aadhaar" value={emp.aadhaar || '-'} />
          {emp.bank_name ? (
            <View style={st.bankCard}>
              <Ionicons name="business-outline" size={14} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={st.bankName}>{emp.bank_name}</Text>
                <Text style={st.bankSub}>
                  {emp.bank_account ? `A/C ${emp.bank_account}` : ''}
                  {emp.bank_ifsc ? `  •  ${emp.bank_ifsc}` : ''}
                </Text>
                {emp.bank_branch ? <Text style={st.bankSub}>{emp.bank_branch}</Text> : null}
              </View>
            </View>
          ) : null}
        </View>

        {/* Attendance */}
        <View style={st.section}>
          <View style={st.sectionHead}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="calendar-outline" size={14} color={colors.gray500} />
              <Text style={st.sectionTitle}>Attendance</Text>
            </View>
            <View style={st.monthSwitcher}>
              <TouchableOpacity onPress={prevMonth} style={st.monthArrow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-back" size={16} color={colors.primary} />
              </TouchableOpacity>
              <Text style={st.monthText}>{MONTH_SHORT[attMonth - 1]} {attYear}</Text>
              <TouchableOpacity onPress={nextMonth} style={st.monthArrow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Mini stats */}
          <View style={st.attStatsRow}>
            <View style={[st.attStat, { backgroundColor: '#dcfce7' }]}>
              <Text style={[st.attStatVal, { color: '#15803d' }]}>{present}</Text>
              <Text style={[st.attStatLbl, { color: '#15803d' }]}>Present</Text>
            </View>
            <View style={[st.attStat, { backgroundColor: '#fee2e2' }]}>
              <Text style={[st.attStatVal, { color: '#dc2626' }]}>{absent}</Text>
              <Text style={[st.attStatLbl, { color: '#dc2626' }]}>Absent</Text>
            </View>
            <View style={[st.attStat, { backgroundColor: '#fef3c7' }]}>
              <Text style={[st.attStatVal, { color: '#b45309' }]}>{halfDay}</Text>
              <Text style={[st.attStatLbl, { color: '#b45309' }]}>Half</Text>
            </View>
            <View style={[st.attStat, { backgroundColor: '#dbeafe' }]}>
              <Text style={[st.attStatVal, { color: '#1d4ed8' }]}>{leave}</Text>
              <Text style={[st.attStatLbl, { color: '#1d4ed8' }]}>Leave</Text>
            </View>
          </View>

          {/* Calendar */}
          {loadingAtt ? (
            <View style={{ paddingVertical: 30, alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={st.calWrap}>
              <View style={st.calRow}>
                {DAY_NAMES.map((d, i) => (
                  <View key={i} style={st.calCell}>
                    <Text style={st.calDayHeader}>{d}</Text>
                  </View>
                ))}
              </View>
              <View style={st.calGrid}>
                {cells.map((day, i) => {
                  if (day === null) return <View key={i} style={st.calCell} />;
                  const status = getStatusForDay(day);
                  const m = status ? STATUS_META[status] : null;
                  const today = new Date();
                  const isToday = day === today.getDate() && attMonth === today.getMonth() + 1 && attYear === today.getFullYear();
                  return (
                    <TouchableOpacity
                      key={i}
                      style={st.calCell}
                      onPress={() => handleDayTap(day)}
                      activeOpacity={0.6}
                    >
                      <View style={[
                        st.calDay,
                        m ? { backgroundColor: m.bg, borderColor: m.color, borderWidth: 1.5 } : null,
                        !m && isToday ? { borderColor: colors.primary, borderWidth: 1.5 } : null,
                      ]}>
                        <Text style={[
                          st.calDayText,
                          m ? { color: m.color, fontWeight: '800' } : null,
                          !m && isToday ? { color: colors.primary, fontWeight: '800' } : null,
                        ]}>{day}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={st.calHint}>Tap a day to cycle: Present → Absent → Half Day → Leave → Clear</Text>
            </View>
          )}
        </View>

        {/* Payroll */}
        <View style={st.section}>
          <View style={st.sectionHead}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="wallet-outline" size={14} color={colors.gray500} />
              <Text style={st.sectionTitle}>Payroll • {MONTH_NAMES[attMonth - 1]} {attYear}</Text>
            </View>
          </View>

          {payroll ? (
            <View>
              <View style={st.payrollGrand}>
                <View>
                  <Text style={st.payrollGrandLabel}>Net Pay</Text>
                  <Text style={st.payrollGrandValue}>
                    ₹{Number(payroll.net_pay || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </Text>
                </View>
                <View style={[
                  st.payrollStatusPill,
                  payroll.status === 'Paid'
                    ? { backgroundColor: '#dcfce7' }
                    : { backgroundColor: '#fef3c7' },
                ]}>
                  <Ionicons
                    name={payroll.status === 'Paid' ? 'checkmark-circle' : 'time-outline'}
                    size={11}
                    color={payroll.status === 'Paid' ? '#15803d' : '#b45309'}
                  />
                  <Text style={[
                    st.payrollStatusText,
                    { color: payroll.status === 'Paid' ? '#15803d' : '#b45309' },
                  ]}>{payroll.status}</Text>
                </View>
              </View>

              <View style={st.payrollGrid}>
                <PayrollCell label="Working" value={String(payroll.working_days)} />
                <PayrollCell label="Present" value={String(payroll.present_days)} highlight />
                <PayrollCell label="Salary" value={`₹${Number(payroll.salary_amount || 0).toLocaleString('en-IN')}`} />
                <PayrollCell label="Earned" value={`₹${Number(payroll.earned_amount || 0).toLocaleString('en-IN')}`} />
                {payroll.deductions > 0 && (
                  <PayrollCell label="Deduction" value={`-₹${Number(payroll.deductions).toLocaleString('en-IN')}`} negative />
                )}
              </View>

              {payroll.status === 'Paid' ? (
                <View style={st.paidNote}>
                  <Ionicons name="checkmark-circle" size={14} color="#15803d" />
                  <Text style={st.paidNoteText}>Paid{payroll.paid_date ? ` on ${payroll.paid_date}` : ''}</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[st.payBtn, markingPaid && { opacity: 0.6 }]}
                  onPress={handleMarkPaid}
                  disabled={markingPaid}
                  activeOpacity={0.85}
                >
                  {markingPaid ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <Ionicons name="checkmark-done" size={16} color="#fff" />
                      <Text style={st.payBtnText}>Mark as Paid</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={st.payrollEmpty}>
              <Ionicons name="receipt-outline" size={28} color={colors.gray300} />
              <Text style={st.payrollEmptyText}>No payroll for this month</Text>
              <TouchableOpacity
                style={[st.generateBtn, generatingPayroll && { opacity: 0.6 }]}
                onPress={handleGeneratePayroll}
                disabled={generatingPayroll}
                activeOpacity={0.85}
              >
                {generatingPayroll ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <Ionicons name="calculator-outline" size={14} color="#fff" />
                    <Text style={st.payBtnText}>Generate Payroll</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={st.bottomBar}>
        <TouchableOpacity
          style={st.editBtn}
          onPress={() => navigation.navigate('EmployeeForm', { id })}
          activeOpacity={0.85}
        >
          <Ionicons name="create-outline" size={16} color={colors.primary} />
          <Text style={st.editBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={st.deleteBtn}
          onPress={handleDelete}
          activeOpacity={0.85}
        >
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={st.row}>
      <Ionicons name={icon} size={14} color={colors.gray500} />
      <Text style={st.rowLabel}>{label}</Text>
      <Text style={st.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function PayrollCell({ label, value, highlight, negative }: { label: string; value: string; highlight?: boolean; negative?: boolean }) {
  return (
    <View style={st.payrollCell}>
      <Text style={st.payrollCellLabel}>{label}</Text>
      <Text style={[
        st.payrollCellValue,
        highlight ? { color: colors.primary } : null,
        negative ? { color: colors.danger } : null,
      ]}>{value}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f7fb' },

  hero: {
    backgroundColor: colors.primary,
    margin: spacing.md,
    borderRadius: 20,
    padding: spacing.md,
    overflow: 'hidden',
  },
  heroAccent: {
    position: 'absolute',
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -70, right: -60,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center' },
  bigAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  bigAvatarText: { fontSize: 22, fontWeight: '800' },
  heroName: { color: '#fff', fontSize: 20, fontWeight: '900' },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  heroStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  dotSmall: { width: 6, height: 6, borderRadius: 3 },
  heroStatusText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  heroJoined: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '600' },

  heroSalary: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12,
    marginTop: 12,
  },
  heroSalaryLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  heroSalaryValue: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 1 },
  heroAction: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 999,
    marginLeft: 'auto',
  },
  heroActionText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  section: {
    backgroundColor: '#fff',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm + 2,
    borderRadius: 16,
    padding: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { fontSize: 11, color: colors.gray500, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  rowLabel: { fontSize: 11, color: colors.gray500, fontWeight: '700', width: 70, textTransform: 'uppercase', letterSpacing: 0.3 },
  rowValue: { flex: 1, fontSize: 13, color: colors.text, fontWeight: '600', textAlign: 'right' },

  bankCard: {
    flexDirection: 'row', gap: 8,
    backgroundColor: colors.primary + '08',
    borderRadius: 12,
    padding: 10, marginTop: 8,
  },
  bankName: { fontSize: 13, fontWeight: '700', color: colors.text },
  bankSub: { fontSize: 11, color: colors.gray500, fontWeight: '600', marginTop: 1 },

  // Month switcher
  monthSwitcher: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary + '10', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  monthArrow: { padding: 2 },
  monthText: { fontSize: 12, fontWeight: '800', color: colors.primary, minWidth: 70, textAlign: 'center' },

  // Mini attendance stats
  attStatsRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  attStat: { flex: 1, alignItems: 'center', borderRadius: 10, paddingVertical: 8 },
  attStatVal: { fontSize: 18, fontWeight: '900' },
  attStatLbl: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },

  // Calendar
  calWrap: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 8 },
  calRow: { flexDirection: 'row' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: '14.28%' as any, alignItems: 'center', paddingVertical: 3 },
  calDayHeader: { fontSize: 10, fontWeight: '800', color: colors.gray400, textTransform: 'uppercase' },
  calDay: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff',
  },
  calDayText: { fontSize: 12, fontWeight: '600', color: colors.gray700 },
  calHint: { fontSize: 10, color: colors.gray400, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },

  // Payroll
  payrollGrand: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.primary + '08',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  payrollGrandLabel: { fontSize: 11, color: colors.gray500, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  payrollGrandValue: { fontSize: 24, fontWeight: '900', color: colors.primary, marginTop: 2 },
  payrollStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  payrollStatusText: { fontSize: 11, fontWeight: '800' },

  payrollGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  payrollCell: { width: '50%' as any, paddingVertical: 6 },
  payrollCellLabel: { fontSize: 10, color: colors.gray500, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  payrollCellValue: { fontSize: 14, color: colors.text, fontWeight: '800', marginTop: 2 },

  paidNote: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: '#dcfce7',
    borderRadius: 10, paddingVertical: 10, marginTop: 8,
  },
  paidNoteText: { color: '#15803d', fontWeight: '800', fontSize: 12 },

  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: '#22c55e',
    borderRadius: 12, paddingVertical: 12, marginTop: 8,
  },
  payBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  payrollEmpty: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  payrollEmptyText: { fontSize: 12, color: colors.gray500, fontWeight: '600' },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: colors.primary,
    borderRadius: 12, paddingVertical: 11, paddingHorizontal: 18,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 18,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: colors.gray100,
  },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 12,
    backgroundColor: colors.primary + '12',
    borderRadius: 12,
  },
  editBtnText: { fontSize: 13, fontWeight: '800', color: colors.primary },
  deleteBtn: {
    width: 44, height: 44,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
});
