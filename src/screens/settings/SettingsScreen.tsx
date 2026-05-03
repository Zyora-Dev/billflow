import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import api from '../../api/client';
import { useToast } from '../../components/Toast';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

export default function SettingsScreen({ navigation }: { navigation: any }) {
  const toast = useToast();
  const {
    user, logout,
    stealthActive, stealthConfigured,
    configureStealth, enterStealth, exitStealth, removeStealth,
  } = useAuth();
  const [business, setBusiness] = useState<any>(null);
  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Stealth UI state
  const [showStealth, setShowStealth] = useState(false);
  const [stealthMode, setStealthMode] = useState<'configure' | 'unlock'>('configure');
  const [stEmail, setStEmail] = useState('');
  const [stPassword, setStPassword] = useState('');
  const [stPin, setStPin] = useState('');
  const [stBusy, setStBusy] = useState(false);

  useEffect(() => {
    api.get('/api/business').then(r => setBusiness(r.data[0])).catch(() => {});
  }, []);

  const changePassword = async () => {
    if (!currentPw || !newPw) return Alert.alert('Error', 'Fill all fields');
    if (newPw.length < 6) return Alert.alert('Error', 'Min 6 characters');
    setPwLoading(true);
    try {
      await api.put('/api/auth/change-password', { current_password: currentPw, new_password: newPw });
      toast.success('Password changed');
      setShowChangePw(false); setCurrentPw(''); setNewPw('');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally { setPwLoading(false); }
  };

  const handleLogout = () => Alert.alert('Logout', 'Are you sure?', [{ text: 'Cancel' }, { text: 'Logout', style: 'destructive', onPress: logout }]);

  const submitStealth = async () => {
    if (stealthMode === 'configure') {
      if (!stEmail || !stPassword || !stPin) return Alert.alert('Error', 'Fill all fields');
      if (!/^\d{4,8}$/.test(stPin)) return Alert.alert('Error', 'PIN must be 4–8 digits');
      setStBusy(true);
      try {
        await configureStealth(stEmail, stPassword, stPin);
        toast.success('Private account configured', 'Sign in privately using your PIN');
        setShowStealth(false); setStEmail(''); setStPassword(''); setStPin('');
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Could not configure');
      } finally { setStBusy(false); }
    } else {
      if (!stPin) return Alert.alert('Error', 'Enter your PIN');
      setStBusy(true);
      try {
        await enterStealth(stPin);
        setShowStealth(false); setStPin('');
      } catch (e: any) {
        Alert.alert('Error', 'Wrong PIN');
      } finally { setStBusy(false); }
    }
  };

  const handleExitStealth = () => {
    Alert.alert('Exit private mode', 'Switch back to your primary account?', [
      { text: 'Cancel' },
      { text: 'Exit', onPress: async () => { try { await exitStealth(); } catch (e: any) { Alert.alert('Error', e.message || 'Failed'); } } },
    ]);
  };

  const handleRemoveStealth = () => {
    Alert.alert('Remove private account', 'You will need to configure it again to use it.', [
      { text: 'Cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await removeStealth(); toast.success('Private account removed'); } },
    ]);
  };

  return (
    <ScrollView style={s.container}>
      {stealthActive && (
        <View style={s.stealthBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={s.stealthDot} />
            <Text style={s.stealthBannerText}>Private mode active</Text>
          </View>
          <TouchableOpacity onPress={handleExitStealth} style={s.stealthExitBtn}>
            <Text style={s.stealthExitText}>Exit</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Profile */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Profile</Text>
        <View style={s.row}><Ionicons name="mail-outline" size={18} color={colors.gray500} /><Text style={s.rowLabel}>Email</Text><Text style={s.rowValue}>{user?.email}</Text></View>
        <View style={s.row}><Ionicons name="shield-outline" size={18} color={colors.gray500} /><Text style={s.rowLabel}>Role</Text><Text style={s.rowValue}>{user?.role || 'admin'}</Text></View>
        <View style={s.row}><Ionicons name="finger-print-outline" size={18} color={colors.gray500} /><Text style={s.rowLabel}>User ID</Text><Text style={s.rowValue}>{user?.id}</Text></View>
      </View>

      {/* Change Password */}
      <View style={s.card}>
        <TouchableOpacity onPress={() => setShowChangePw(!showChangePw)} style={s.expandRow}>
          <Text style={s.cardTitle}>Change Password</Text>
          <Ionicons name={showChangePw ? 'chevron-up' : 'chevron-down'} size={20} color={colors.gray500} />
        </TouchableOpacity>
        {showChangePw && (
          <View>
            <TextInput style={s.input} value={currentPw} onChangeText={setCurrentPw} placeholder="Current password" placeholderTextColor={colors.placeholder} secureTextEntry />
            <TextInput style={[s.input, { marginTop: spacing.sm }]} value={newPw} onChangeText={setNewPw} placeholder="New password" placeholderTextColor={colors.placeholder} secureTextEntry />
            <TouchableOpacity style={[s.btn, pwLoading && { opacity: 0.6 }]} onPress={changePassword} disabled={pwLoading}>
              <Text style={s.btnText}>{pwLoading ? 'Changing...' : 'Change Password'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Private Account */}
      <View style={s.card}>
        <TouchableOpacity onPress={() => { setShowStealth(!showStealth); setStealthMode(stealthConfigured ? 'unlock' : 'configure'); }} style={s.expandRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Private Account</Text>
            <Text style={s.cardSub}>
              {stealthActive ? 'Currently signed in privately' :
                stealthConfigured ? 'Configured — sign in with your PIN' :
                'Add a second account locked behind a PIN'}
            </Text>
          </View>
          <Ionicons name={showStealth ? 'chevron-up' : 'chevron-down'} size={20} color={colors.gray500} />
        </TouchableOpacity>

        {showStealth && (
          <View style={{ marginTop: spacing.md }}>
            {!stealthConfigured && (
              <>
                <Text style={s.helpText}>Sign in to a second BillFlow account once. Its credentials are stored encrypted on this device with your PIN.</Text>
                <TextInput style={s.input} value={stEmail} onChangeText={setStEmail} placeholder="Email" placeholderTextColor={colors.placeholder} keyboardType="email-address" autoCapitalize="none" />
                <TextInput style={[s.input, { marginTop: spacing.sm }]} value={stPassword} onChangeText={setStPassword} placeholder="Password" placeholderTextColor={colors.placeholder} secureTextEntry />
                <TextInput style={[s.input, { marginTop: spacing.sm }]} value={stPin} onChangeText={setStPin} placeholder="PIN (4–8 digits)" placeholderTextColor={colors.placeholder} keyboardType="number-pad" secureTextEntry maxLength={8} />
                <TouchableOpacity style={[s.btn, stBusy && { opacity: 0.6 }]} onPress={submitStealth} disabled={stBusy}>
                  <Text style={s.btnText}>{stBusy ? 'Saving...' : 'Configure'}</Text>
                </TouchableOpacity>
              </>
            )}

            {stealthConfigured && !stealthActive && (
              <>
                <Text style={s.helpText}>Enter your PIN to sign in privately. Your primary session is preserved — exit anytime.</Text>
                <TextInput style={s.input} value={stPin} onChangeText={setStPin} placeholder="PIN" placeholderTextColor={colors.placeholder} keyboardType="number-pad" secureTextEntry maxLength={8} />
                <TouchableOpacity style={[s.btn, stBusy && { opacity: 0.6 }]} onPress={submitStealth} disabled={stBusy}>
                  <Text style={s.btnText}>{stBusy ? 'Unlocking...' : 'Sign in privately'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.dangerBtn} onPress={handleRemoveStealth}>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text style={s.dangerBtnText}>Remove private account</Text>
                </TouchableOpacity>
              </>
            )}

            {stealthActive && (
              <>
                <Text style={s.helpText}>You are currently in private mode. Exit to return to your primary account.</Text>
                <TouchableOpacity style={s.btn} onPress={handleExitStealth}>
                  <Text style={s.btnText}>Exit private mode</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>

      {/* Business Info */}
      {business && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Business</Text>
          <View style={s.row}><Ionicons name="business-outline" size={18} color={colors.gray500} /><Text style={s.rowLabel}>Name</Text><Text style={s.rowValue}>{business.business_name}</Text></View>
          <View style={s.row}><Ionicons name="call-outline" size={18} color={colors.gray500} /><Text style={s.rowLabel}>Mobile</Text><Text style={s.rowValue}>{business.mobile || '-'}</Text></View>
          <View style={s.row}><Ionicons name="location-outline" size={18} color={colors.gray500} /><Text style={s.rowLabel}>Address</Text><Text style={s.rowValue} numberOfLines={2}>{business.address || '-'}</Text></View>
          {business.gst_number && <View style={s.row}><Ionicons name="receipt-outline" size={18} color={colors.gray500} /><Text style={s.rowLabel}>GST</Text><Text style={s.rowValue}>{business.gst_number}</Text></View>}
        </View>
      )}

      {/* About */}
      <View style={s.card}>
        <Text style={s.cardTitle}>About</Text>
        <Text style={s.aboutText}>BillFlow - GST Invoice & Billing</Text>
        <Text style={s.aboutSub}>Version 1.0.0</Text>
        <Text style={s.aboutSub}>by Spectra Technologies</Text>
      </View>

      {/* Logout */}
      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color={colors.danger} />
        <Text style={s.logoutText}>Logout</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { backgroundColor: colors.white, margin: spacing.md, marginBottom: 0, borderRadius: borderRadius.md, padding: spacing.md, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cardTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  cardSub: { fontSize: fontSize.sm, color: colors.gray500, marginTop: -spacing.xs },
  helpText: { fontSize: fontSize.sm, color: colors.gray500, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  rowLabel: { fontSize: fontSize.sm, color: colors.gray500, marginLeft: spacing.sm, width: 70 },
  rowValue: { flex: 1, fontSize: fontSize.md, color: colors.text, textAlign: 'right' },
  expandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, padding: spacing.md, fontSize: fontSize.md, color: colors.text },
  btn: { backgroundColor: colors.primary, borderRadius: borderRadius.sm, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  btnText: { color: colors.white, fontWeight: '600' },
  aboutText: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  aboutSub: { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: spacing.md, padding: spacing.md, backgroundColor: colors.white, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.danger },
  logoutText: { color: colors.danger, fontSize: fontSize.md, fontWeight: '600', marginLeft: spacing.sm },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm, padding: spacing.sm },
  dangerBtnText: { color: colors.danger, fontSize: fontSize.sm, fontWeight: '600', marginLeft: spacing.xs },
  stealthBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', margin: spacing.md, marginBottom: 0, padding: spacing.md, borderRadius: borderRadius.md },
  stealthDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white, marginRight: spacing.sm },
  stealthBannerText: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
  stealthExitBtn: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
  stealthExitText: { color: colors.white, fontSize: fontSize.sm, fontWeight: '600' },
});
