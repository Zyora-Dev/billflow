import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { colors, spacing, fontSize } from '../../theme';
import EmptyState from '../../components/EmptyState';

const STATUSES = ['Present', 'Absent', 'Half Day', 'Leave'] as const;
const STATUS_META: Record<string, { color: string; bg: string; letter: string }> = {
  Present:    { color: '#15803d', bg: '#dcfce7', letter: 'P' },
  Absent:     { color: '#dc2626', bg: '#fee2e2', letter: 'A' },
  'Half Day': { color: '#b45309', bg: '#fef3c7', letter: 'H' },
  Leave:      { color: '#1d4ed8', bg: '#dbeafe', letter: 'L' },
};
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const AVATAR_COLORS = [
  { bg: '#dbeafe', fg: '#1d4ed8' },
  { bg: '#fce7f3', fg: '#be185d' },
  { bg: '#dcfce7', fg: '#15803d' },
  { bg: '#fef3c7', fg: '#b45309' },
  { bg: '#ede9fe', fg: '#6d28d9' },
  { bg: '#cffafe', fg: '#0e7490' },
];
function avatarColor(name: string) {
  return AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

export default function AttendanceScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const isStaff = user?.role === 'staff';
  const staffEmpId = user?.employee_id;
  const now = new Date();
  const [view, setView] = useState<'daily' | 'monthly'>('daily');
  const [orgId, setOrgId] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Daily view
  const [selectedDate, setSelectedDate] = useState(now.toISOString().split('T')[0]);
  const [marks, setMarks] = useState<Record<number, string>>({});

  // Monthly view
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [monthlyData, setMonthlyData] = useState<any[]>([]);

  const fetchEmployees = useCallback(async () => {
    try {
      const biz = await api.get('/api/business');
      const oid = biz.data[0]?.org_id;
      if (oid) {
        setOrgId(oid);
        const res = await api.get(`/api/employees?org_id=${oid}&status=Active`);
        let emps = Array.isArray(res.data) ? res.data : [];
        // Staff only sees their own record
        if (isStaff && staffEmpId) {
          emps = emps.filter((e: any) => e.id === staffEmpId);
        }
        setEmployees(emps);
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isStaff, staffEmpId]);

  const fetchDailyAttendance = useCallback(async () => {
    if (!orgId) return;
    const d = new Date(selectedDate);
    try {
      const res = await api.get(`/api/attendance?org_id=${orgId}&month=${d.getMonth() + 1}&year=${d.getFullYear()}`);
      const all = Array.isArray(res.data) ? res.data : [];
      const dayMarks: Record<number, string> = {};
      all.filter((a: any) => a.date === selectedDate).forEach((a: any) => { dayMarks[a.employee_id] = a.status; });
      setMarks(dayMarks);
    } catch {}
  }, [orgId, selectedDate]);

  const fetchMonthlyData = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await api.get(`/api/attendance?org_id=${orgId}&month=${viewMonth}&year=${viewYear}`);
      setMonthlyData(Array.isArray(res.data) ? res.data : []);
    } catch {}
  }, [orgId, viewMonth, viewYear]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => { navigation.addListener('focus', fetchEmployees); }, [navigation, fetchEmployees]);
  useEffect(() => { if (orgId && view === 'daily') fetchDailyAttendance(); }, [orgId, selectedDate, view, fetchDailyAttendance]);
  useEffect(() => { if (orgId && view === 'monthly') fetchMonthlyData(); }, [orgId, viewMonth, viewYear, view, fetchMonthlyData]);

  const markEmployee = (empId: number, status: string) => {
    setMarks(p => {
      if (p[empId] === status) {
        const next = { ...p };
        delete next[empId];
        return next;
      }
      return { ...p, [empId]: status };
    });
  };

  const markAllPresent = () => {
    const m: Record<number, string> = {};
    employees.forEach(e => { m[e.id] = 'Present'; });
    setMarks(m);
  };

  const handleSave = async () => {
    if (!orgId) return;
    const records = Object.entries(marks).map(([empId, status]) => ({
      employee_id: parseInt(empId), status, remarks: null,
    }));
    if (records.length === 0) return Alert.alert('No attendance marked');
    setSaving(true);
    try {
      await api.post('/api/attendance/bulk', { org_id: orgId, date: selectedDate, records });
      Alert.alert('Saved', `Attendance saved for ${records.length} employees`);
      fetchDailyAttendance();
    } catch (e: any) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); } finally { setSaving(false); }
  };

  // Date navigation
  const changeDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const dateParts = selectedDate.split('-');
  const dateDisplay = `${parseInt(dateParts[2])} ${MONTHS_SHORT[parseInt(dateParts[1]) - 1]} ${dateParts[0]}`;
  const isToday = selectedDate === now.toISOString().split('T')[0];

  // Monthly calendar
  const daysInViewMonth = new Date(viewYear, viewMonth, 0).getDate();
  const firstDayOfMonth = new Date(viewYear, viewMonth - 1, 1).getDay();

  const dayTotals = useMemo(() => {
    const totals: Record<number, Record<string, number>> = {};
    monthlyData.forEach((a: any) => {
      const day = parseInt(a.date.split('-')[2]);
      if (!totals[day]) totals[day] = { Present: 0, Absent: 0, 'Half Day': 0, Leave: 0 };
      if (totals[day][a.status] !== undefined) totals[day][a.status]++;
    });
    return totals;
  }, [monthlyData]);

  const markedCount = Object.keys(marks).length;
  const presentCount = Object.values(marks).filter(s => s === 'Present').length;

  const prevMonth = () => viewMonth === 1 ? (setViewMonth(12), setViewYear(y => y - 1)) : setViewMonth(m => m - 1);
  const nextMonth = () => viewMonth === 12 ? (setViewMonth(1), setViewYear(y => y + 1)) : setViewMonth(m => m + 1);

  const renderDailyItem = ({ item }: { item: any }) => {
    const a = avatarColor(item.name || '?');
    const current = marks[item.id];
    return (
      <View style={s.empCard}>
        <TouchableOpacity
          style={s.empRow}
          onPress={() => !isStaff && navigation.navigate('EmployeeDetail', { id: item.id })}
          activeOpacity={isStaff ? 1 : 0.85}
        >
          <View style={[s.avatar, { backgroundColor: a.bg }]}>
            <Text style={[s.avatarText, { color: a.fg }]}>{(item.name || '?')[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.empName} numberOfLines={1}>{item.name}</Text>
            {item.designation ? <Text style={s.empSub}>{item.designation}</Text> : null}
          </View>
        </TouchableOpacity>
        <View style={s.statusBtns}>
          {STATUSES.map(st => {
            const m = STATUS_META[st];
            const active = current === st;
            return (
              <TouchableOpacity
                key={st}
                style={[s.statusBtn, active && { backgroundColor: m.bg, borderColor: m.color }]}
                onPress={() => markEmployee(item.id, st)}
                activeOpacity={0.85}
              >
                <Text style={[s.statusBtnText, active && { color: m.color, fontWeight: '800' }]}>{m.letter}</Text>
                <Text style={[s.statusBtnLabel, active && { color: m.color }]}>{st === 'Half Day' ? 'Half' : st}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // Monthly calendar cells
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInViewMonth; d++) calendarCells.push(d);
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  return (
    <View style={s.container}>
      {/* Hero */}
      <View style={s.hero}>
        <View style={s.heroAccent} />
        <View style={s.heroTopRow}>
          <View>
            <Text style={s.heroEyebrow}>{isStaff ? 'My Attendance' : 'Attendance'}</Text>
            <Text style={s.heroValue}>{isStaff ? (employees[0]?.name || 'You') : employees.length}</Text>
            <Text style={s.heroSub}>{isStaff ? 'Mark your attendance' : 'active employees'}</Text>
          </View>
          {!isStaff && (
          <View style={s.viewToggle}>
            <TouchableOpacity
              style={[s.toggleBtn, view === 'daily' && s.toggleActive]}
              onPress={() => setView('daily')}
              activeOpacity={0.85}
            >
              <Text style={[s.toggleText, view === 'daily' && s.toggleTextActive]}>Daily</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.toggleBtn, view === 'monthly' && s.toggleActive]}
              onPress={() => setView('monthly')}
              activeOpacity={0.85}
            >
              <Text style={[s.toggleText, view === 'monthly' && s.toggleTextActive]}>Monthly</Text>
            </TouchableOpacity>
          </View>
          )}
        </View>
      </View>

      {view === 'daily' ? (
        <>
          {/* Date + Action bar */}
          <View style={s.dateBar}>
            {!isStaff && (
            <TouchableOpacity onPress={() => changeDate(-1)} style={s.dateArrow}>
              <Ionicons name="chevron-back" size={18} color={colors.primary} />
            </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setSelectedDate(now.toISOString().split('T')[0])}>
              <Text style={s.dateText}>{isToday ? 'Today' : dateDisplay}</Text>
            </TouchableOpacity>
            {!isStaff && (
            <TouchableOpacity onPress={() => changeDate(1)} style={s.dateArrow}>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </TouchableOpacity>
            )}
          </View>

          {/* Quick actions */}
          <View style={s.actionBar}>
            {!isStaff && (
            <TouchableOpacity style={s.markAllBtn} onPress={markAllPresent} activeOpacity={0.85}>
              <Ionicons name="checkmark-done" size={14} color="#15803d" />
              <Text style={s.markAllText}>Mark All Present</Text>
            </TouchableOpacity>
            )}
            <View style={s.counterBadge}>
              <Text style={s.counterText}>{presentCount}/{employees.length}</Text>
            </View>
            <TouchableOpacity
              style={[s.saveBtn, (saving || markedCount === 0) && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving || markedCount === 0}
              activeOpacity={0.85}
            >
              {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Ionicons name="save" size={14} color="#fff" />
                  <Text style={s.saveBtnText}>Save ({markedCount})</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <FlatList
            data={employees}
            keyExtractor={item => `att-${item.id}`}
            renderItem={renderDailyItem}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEmployees(); }} />}
            contentContainerStyle={{ paddingBottom: 30 }}
            ListEmptyComponent={loading ? (
              <View style={{ paddingTop: 60, alignItems: 'center' }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <View style={{ paddingTop: 40 }}>
                <EmptyState icon="people-outline" title="No active employees" subtitle="Add employees first" />
              </View>
            )}
          />
        </>
      ) : !isStaff ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEmployees(); }} />}
        >
          {/* Month picker */}
          <View style={s.monthBar}>
            <TouchableOpacity onPress={prevMonth} style={s.dateArrow}>
              <Ionicons name="chevron-back" size={18} color={colors.primary} />
            </TouchableOpacity>
            <Text style={s.monthText}>{MONTHS_SHORT[viewMonth - 1]} {viewYear}</Text>
            <TouchableOpacity onPress={nextMonth} style={s.dateArrow}>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Legend */}
          <View style={s.legend}>
            {STATUSES.map(st => {
              const m = STATUS_META[st];
              return (
                <View key={st} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: m.color }]} />
                  <Text style={s.legendText}>{st}</Text>
                </View>
              );
            })}
          </View>

          {/* Calendar */}
          <View style={s.calSection}>
            {/* Day headers */}
            <View style={s.calRow}>
              {DAY_NAMES.map((d, i) => (
                <View key={i} style={s.calCell}>
                  <Text style={s.calDayHeader}>{d}</Text>
                </View>
              ))}
            </View>
            {/* Day cells */}
            <View style={s.calGrid}>
              {calendarCells.map((day, i) => {
                if (day === null) return <View key={i} style={s.calCell} />;
                const totals = dayTotals[day];
                return (
                  <TouchableOpacity
                    key={i}
                    style={s.calCell}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedDate(`${viewYear}-${pad(viewMonth)}-${pad(day)}`);
                      setView('daily');
                    }}
                  >
                    <View style={s.calDayBox}>
                      <Text style={s.calDayNum}>{day}</Text>
                      {totals ? (
                        <View style={s.calCountRow}>
                          {totals.Present > 0 && <Text style={[s.calCount, { backgroundColor: '#dcfce7', color: '#15803d' }]}>{totals.Present}P</Text>}
                          {totals.Absent > 0 && <Text style={[s.calCount, { backgroundColor: '#fee2e2', color: '#dc2626' }]}>{totals.Absent}A</Text>}
                          {totals['Half Day'] > 0 && <Text style={[s.calCount, { backgroundColor: '#fef3c7', color: '#b45309' }]}>{totals['Half Day']}H</Text>}
                          {totals.Leave > 0 && <Text style={[s.calCount, { backgroundColor: '#dbeafe', color: '#1d4ed8' }]}>{totals.Leave}L</Text>}
                        </View>
                      ) : (
                        <Text style={s.calNoData}>—</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },

  hero: {
    backgroundColor: colors.primary,
    margin: spacing.md,
    borderRadius: 20,
    padding: spacing.md,
    overflow: 'hidden',
  },
  heroAccent: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.05)', top: -60, right: -50,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroEyebrow: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  heroValue: { color: '#fff', fontSize: 34, fontWeight: '900', marginTop: 2, lineHeight: 38 },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2, fontWeight: '600' },

  viewToggle: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10, padding: 2,
  },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  toggleActive: { backgroundColor: '#fff' },
  toggleText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  toggleTextActive: { color: colors.primary },

  dateBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16,
    paddingVertical: 8, marginHorizontal: spacing.md,
  },
  dateArrow: { padding: 6, backgroundColor: colors.primary + '10', borderRadius: 999 },
  dateText: { fontSize: 15, fontWeight: '800', color: colors.text },

  actionBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: spacing.md, paddingBottom: 10,
  },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#bbf7d0',
  },
  markAllText: { fontSize: 11, fontWeight: '800', color: '#15803d' },
  counterBadge: {
    backgroundColor: colors.primary + '12', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
  },
  counterText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto',
    backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10,
  },
  saveBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  empCard: {
    backgroundColor: '#fff',
    marginHorizontal: spacing.md, marginBottom: 8,
    borderRadius: 14, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, elevation: 1,
  },
  empRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800' },
  empName: { fontSize: 14, fontWeight: '700', color: colors.text },
  empSub: { fontSize: 11, color: colors.gray500, fontWeight: '600', marginTop: 1 },

  statusBtns: { flexDirection: 'row', gap: 6 },
  statusBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fafafa',
  },
  statusBtnText: { fontSize: 14, fontWeight: '700', color: '#9ca3af' },
  statusBtnLabel: { fontSize: 8, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', marginTop: 1 },

  // Monthly view
  monthBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16,
    paddingVertical: 10,
  },
  monthText: { fontSize: 15, fontWeight: '800', color: colors.primary, minWidth: 80, textAlign: 'center' },

  legend: {
    flexDirection: 'row', justifyContent: 'center', gap: 14,
    paddingHorizontal: spacing.md, paddingBottom: 10,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, fontWeight: '700', color: colors.gray500 },

  calSection: {
    backgroundColor: '#fff',
    marginHorizontal: spacing.md,
    borderRadius: 16, padding: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  calRow: { flexDirection: 'row' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: '14.28%' as any, alignItems: 'center', paddingVertical: 3 },
  calDayHeader: { fontSize: 10, fontWeight: '800', color: colors.gray400, textTransform: 'uppercase' },
  calDayBox: {
    width: '92%', minHeight: 52, borderRadius: 8,
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fafafa',
    padding: 3, alignItems: 'center',
  },
  calDayNum: { fontSize: 11, fontWeight: '700', color: colors.text },
  calCountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 1, marginTop: 2, justifyContent: 'center' },
  calCount: { fontSize: 7, fontWeight: '800', paddingHorizontal: 3, paddingVertical: 1, borderRadius: 3, overflow: 'hidden' },
  calNoData: { fontSize: 9, color: '#d1d5db', marginTop: 4 },
});
