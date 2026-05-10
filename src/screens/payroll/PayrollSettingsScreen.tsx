import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  TextInput, Switch, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateInput from '../../components/DateInput';
import api from '../../api/client';
import { colors, spacing, borderRadius } from '../../theme';

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);
const WEEK_DAYS = ['None', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function PayrollSettingsScreen({ navigation }: { navigation: any }) {
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings
  const [payrollDate, setPayrollDate] = useState(1);
  const [defaultWorkingDays, setDefaultWorkingDays] = useState(26);
  const [weeklyOff, setWeeklyOff] = useState('Sunday');
  const [autoPayroll, setAutoPayroll] = useState(false);

  // Public holidays
  const [holidays, setHolidays] = useState<any[]>([]);
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [addingHoliday, setAddingHoliday] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const biz = await api.get('/api/business');
        const oid = biz.data[0]?.org_id;
        if (oid) {
          setOrgId(oid);
          const [sRes, hRes] = await Promise.all([
            api.get(`/api/payroll-settings?org_id=${oid}`),
            api.get(`/api/public-holidays?org_id=${oid}&year=${holidayYear}`),
          ]);
          const s = sRes.data;
          if (s) {
            setPayrollDate(s.payroll_date || 1);
            setDefaultWorkingDays(s.default_working_days || 26);
            setWeeklyOff(s.weekly_off || 'Sunday');
            setAutoPayroll(s.auto_payroll || false);
          }
          setHolidays(Array.isArray(hRes.data) ? hRes.data : []);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const fetchHolidays = async (yr?: number) => {
    try {
      const res = await api.get(`/api/public-holidays?org_id=${orgId}&year=${yr || holidayYear}`);
      setHolidays(Array.isArray(res.data) ? res.data : []);
    } catch {}
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/api/payroll-settings', {
        org_id: orgId,
        payroll_date: payrollDate,
        default_working_days: defaultWorkingDays,
        weekly_off: weeklyOff,
        auto_payroll: autoPayroll,
      });
      Alert.alert('Saved', 'Payroll settings updated');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const addHoliday = async () => {
    if (!newHolidayDate || !newHolidayName.trim()) return Alert.alert('Validation', 'Enter date and name');
    setAddingHoliday(true);
    try {
      await api.post('/api/public-holidays', {
        org_id: orgId,
        holiday_date: newHolidayDate,
        name: newHolidayName.trim(),
      });
      setNewHolidayDate('');
      setNewHolidayName('');
      fetchHolidays();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to add holiday');
    } finally { setAddingHoliday(false); }
  };

  const deleteHoliday = (id: number, name: string) => {
    Alert.alert('Delete Holiday', `Remove "${name}"?`, [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/api/public-holidays/${id}`); fetchHolidays(); } catch {}
      }},
    ]);
  };

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
  );

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* General Settings */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Ionicons name="settings-outline" size={18} color={colors.primary} />
            <Text style={s.sectionTitle}>General Settings</Text>
          </View>

          {/* Processing Date */}
          <Text style={s.label}>Payroll Processing Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
            {[1, 5, 10, 15, 20, 25, 28].map(d => {
              const active = payrollDate === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => setPayrollDate(d)}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>{d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Default Working Days */}
          <Text style={s.label}>Default Working Days</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity style={s.stepBtn} onPress={() => setDefaultWorkingDays(Math.max(1, defaultWorkingDays - 1))}>
              <Ionicons name="remove" size={18} color={colors.primary} />
            </TouchableOpacity>
            <View style={s.daysDisplay}>
              <Text style={s.daysValue}>{defaultWorkingDays}</Text>
              <Text style={s.daysLabel}>days</Text>
            </View>
            <TouchableOpacity style={s.stepBtn} onPress={() => setDefaultWorkingDays(Math.min(31, defaultWorkingDays + 1))}>
              <Ionicons name="add" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Weekly Off */}
          <Text style={s.label}>Weekly Off</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
            {WEEK_DAYS.map(d => {
              const active = weeklyOff === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[s.chip, active && { backgroundColor: '#dc2626', borderColor: '#dc2626' }]}
                  onPress={() => setWeeklyOff(d)}
                >
                  <Text style={[s.chipText, active && { color: '#fff' }]}>{d === 'None' ? d : d.slice(0, 3)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Auto Payroll */}
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.toggleLabel}>Auto Generate Payroll</Text>
              <Text style={s.toggleSub}>Automatically generate payroll on processing date</Text>
            </View>
            <Switch
              value={autoPayroll}
              onValueChange={setAutoPayroll}
              trackColor={{ false: '#e5e7eb', true: '#86efac' }}
              thumbColor={autoPayroll ? '#059669' : '#9ca3af'}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.6 }]}
            onPress={saveSettings}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator size="small" color="#fff" /> : (
              <>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={s.saveBtnText}>Save Settings</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Public Holidays */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Ionicons name="calendar" size={18} color="#dc2626" />
            <Text style={s.sectionTitle}>Public Holidays</Text>
          </View>

          {/* Year selector */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <TouchableOpacity onPress={() => { const y = holidayYear - 1; setHolidayYear(y); fetchHolidays(y); }}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
            </TouchableOpacity>
            <View style={s.yearBadge}>
              <Text style={s.yearText}>{holidayYear}</Text>
            </View>
            <TouchableOpacity onPress={() => { const y = holidayYear + 1; setHolidayYear(y); fetchHolidays(y); }}>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>{holidays.length} holidays</Text>
          </View>

          {/* Add holiday row */}
          <View style={s.addRow}>
            <View style={{ flex: 1 }}>
              <DateInput value={newHolidayDate} onChange={setNewHolidayDate} placeholder="Date" />
            </View>
            <TextInput
              style={[s.holidayInput, { flex: 2 }]}
              value={newHolidayName}
              onChangeText={setNewHolidayName}
              placeholder="Holiday name"
              placeholderTextColor="#d1d5db"
            />
            <TouchableOpacity
              style={[s.addBtn, addingHoliday && { opacity: 0.6 }]}
              onPress={addHoliday}
              disabled={addingHoliday}
            >
              {addingHoliday ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>

          {/* Holiday list */}
          {holidays.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Ionicons name="calendar-outline" size={32} color="#e5e7eb" />
              <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>No holidays added for {holidayYear}</Text>
            </View>
          ) : (
            holidays.map((h: any) => (
              <View key={h.id} style={s.holidayCard}>
                <View style={s.holidayDot} />
                <View style={{ flex: 1 }}>
                  <Text style={s.holidayName}>{h.name}</Text>
                  <Text style={s.holidayDate}>
                    {new Date(h.holiday_date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => deleteHoliday(h.id, h.name)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f7fb' },
  section: { backgroundColor: '#fff', margin: spacing.md, borderRadius: 16, padding: spacing.md, borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1f2937' },
  label: { fontSize: 12, fontWeight: '700', color: '#374151', marginTop: 14, marginBottom: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb' },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  chipTextActive: { color: '#fff' },
  stepBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f1f5', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  daysDisplay: { flexDirection: 'row', alignItems: 'baseline', gap: 4, backgroundColor: '#f0f1f5', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  daysValue: { fontSize: 22, fontWeight: '900', color: colors.primary },
  daysLabel: { fontSize: 12, color: '#9ca3af', fontWeight: '600' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 10, padding: 12, marginTop: 14 },
  toggleLabel: { fontSize: 13, fontWeight: '700', color: '#1f2937' },
  toggleSub: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  saveBtn: { flexDirection: 'row', gap: 6, backgroundColor: colors.primary, paddingVertical: 13, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  yearBadge: { backgroundColor: '#f0f1f5', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  yearText: { fontSize: 16, fontWeight: '800', color: colors.primary },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 },
  holidayInput: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 13, color: '#1f2937' },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  holidayCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#fecaca' },
  holidayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#dc2626' },
  holidayName: { fontSize: 13, fontWeight: '700', color: '#1f2937' },
  holidayDate: { fontSize: 11, color: '#6b7280', marginTop: 1 },
});
