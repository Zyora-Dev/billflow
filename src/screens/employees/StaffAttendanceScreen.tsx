import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import api from '../../api/client';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

const STATUS_CYCLE = ['Present', 'Absent', 'Half Day', 'Leave'];
const STATUS_COLORS: Record<string, string> = { Present: '#22c55e', Absent: '#ef4444', 'Half Day': '#f59e0b', Leave: '#3b82f6' };
const STATUS_BG: Record<string, string> = { Present: '#dcfce7', Absent: '#fee2e2', 'Half Day': '#fef3c7', Leave: '#dbeafe' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function StaffAttendanceScreen() {
  const { user } = useAuth();
  const employeeId = user?.employee_id;
  const orgId = user?.org_id;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [attendance, setAttendance] = useState<any[]>([]);
  const [employeeName, setEmployeeName] = useState('');
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (employeeId) {
      api.get(`/api/employees/${employeeId}`)
        .then(r => setEmployeeName(r.data?.name || ''))
        .catch(() => {});
    }
  }, [employeeId]);

  const fetchAttendance = useCallback(async () => {
    if (!orgId || !employeeId) return;
    try {
      const res = await api.get(`/api/attendance?org_id=${orgId}&employee_id=${employeeId}&month=${month}&year=${year}`);
      setAttendance(Array.isArray(res.data) ? res.data : []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId, employeeId, month, year]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const attMap: Record<string, string> = {};
  attendance.forEach(a => { attMap[a.date] = a.status; });
  const todayStatus = attMap[todayStr] || null;

  const markToday = async (status: string) => {
    if (!orgId || !employeeId) return;
    setMarking(true);
    try {
      await api.post('/api/attendance', {
        org_id: orgId, employee_id: employeeId, date: todayStr, status, remarks: null,
      });
      fetchAttendance();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally { setMarking(false); }
  };

  // Calendar
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const presentCount = attendance.filter(a => a.status === 'Present').length;
  const absentCount = attendance.filter(a => a.status === 'Absent').length;
  const halfDayCount = attendance.filter(a => a.status === 'Half Day').length;
  const leaveCount = attendance.filter(a => a.status === 'Leave').length;

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAttendance(); }} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>My Attendance</Text>
        {employeeName ? <Text style={s.subtitle}>{employeeName}</Text> : null}
      </View>

      {/* Mark Today */}
      <View style={s.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View>
            <Text style={s.cardTitle}>Today's Attendance</Text>
            <Text style={s.cardSub}>{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          </View>
          {todayStatus && (
            <View style={[s.badge, { backgroundColor: STATUS_BG[todayStatus] }]}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: STATUS_COLORS[todayStatus] }}>{todayStatus}</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {STATUS_CYCLE.map(st => (
            <TouchableOpacity
              key={st}
              style={[s.markBtn, todayStatus === st && { backgroundColor: STATUS_COLORS[st] }]}
              onPress={() => markToday(st)}
              disabled={marking}
              activeOpacity={0.7}
            >
              <Ionicons
                name={st === 'Present' ? 'checkmark-circle' : st === 'Absent' ? 'close-circle' : st === 'Half Day' ? 'time' : 'calendar'}
                size={16}
                color={todayStatus === st ? '#fff' : STATUS_COLORS[st]}
              />
              <Text style={[s.markBtnText, todayStatus === st && { color: '#fff' }]}>{st === 'Half Day' ? 'Half' : st}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {!todayStatus && <Text style={s.hint}>Tap a button to mark your attendance for today</Text>}
      </View>

      {/* Monthly View */}
      <View style={s.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={s.cardTitle}>Monthly View</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity onPress={() => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }}>
              <Ionicons name="chevron-back" size={20} color={colors.gray500} />
            </TouchableOpacity>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{MONTHS[month - 1]} {year}</Text>
            <TouchableOpacity onPress={() => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }}>
              <Ionicons name="chevron-forward" size={20} color={colors.gray500} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary cards */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
          {[
            { label: 'Present', count: presentCount, color: '#22c55e', bg: '#dcfce7' },
            { label: 'Absent', count: absentCount, color: '#ef4444', bg: '#fee2e2' },
            { label: 'Half Day', count: halfDayCount, color: '#f59e0b', bg: '#fef3c7' },
            { label: 'Leave', count: leaveCount, color: '#3b82f6', bg: '#dbeafe' },
          ].map(item => (
            <View key={item.label} style={[s.summaryCard, { backgroundColor: item.bg }]}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: item.color }}>{item.count}</Text>
              <Text style={{ fontSize: 9, fontWeight: '600', color: item.color }}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={{ flexDirection: 'row', marginBottom: 4 }}>
          {DAYS.map(d => (
            <View key={d} style={s.calHeader}>
              <Text style={s.calHeaderText}>{d}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {Array.from({ length: firstDay }).map((_, i) => <View key={`e${i}`} style={s.calCell} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const status = attMap[dateStr];
            const isToday = dateStr === todayStr;
            const isFuture = dateStr > todayStr;
            return (
              <View key={day} style={s.calCell}>
                <View style={[
                  s.calDay,
                  status && { backgroundColor: STATUS_BG[status] },
                  isToday && !status && { borderWidth: 2, borderColor: colors.primary },
                  isFuture && { opacity: 0.4 },
                ]}>
                  <Text style={[
                    s.calDayText,
                    status && { color: STATUS_COLORS[status], fontWeight: '700' },
                    isToday && !status && { color: colors.primary, fontWeight: '700' },
                  ]}>{day}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Legend */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
          {STATUS_CYCLE.map(st => (
            <View key={st} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: STATUS_COLORS[st] }} />
              <Text style={{ fontSize: 11, color: colors.gray500 }}>{st}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.gray500, marginTop: 2 },
  card: { backgroundColor: '#fff', marginHorizontal: spacing.md, marginTop: 12, borderRadius: 16, padding: spacing.md },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  markBtn: {
    flex: 1, flexDirection: 'column', alignItems: 'center', gap: 4,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
  },
  markBtnText: { fontSize: 10, fontWeight: '600', color: colors.gray600 },
  hint: { fontSize: 11, color: colors.gray400, textAlign: 'center', marginTop: 10 },
  summaryCard: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  calHeader: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  calHeaderText: { fontSize: 10, fontWeight: '600', color: colors.gray400 },
  calCell: { width: '14.28%', aspectRatio: 1, padding: 2 },
  calDay: { flex: 1, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  calDayText: { fontSize: 12, color: colors.gray600 },
});
