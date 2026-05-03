import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Alert, ScrollView, KeyboardAvoidingView,
  Platform, Animated, Easing, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/client';
import { useToast } from '../../components/Toast';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

export default function ForgotPasswordScreen({ navigation }: { navigation: any }) {
  const toast = useToast();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;
  const stepX = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const slideToOtp = () => {
    Animated.timing(stepX, { toValue: -1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      setStep('otp');
      stepX.setValue(0);
    });
  };

  const sendOtp = async () => {
    if (!email) return Alert.alert('Required', 'Enter your email');
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email: email.trim().toLowerCase() });
      slideToOtp();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!otp || !newPassword) return Alert.alert('Required', 'Fill all fields');
    if (newPassword.length < 6) return Alert.alert('Weak', 'Password must be at least 6 characters');
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { email: email.trim().toLowerCase(), otp, new_password: newPassword });
      toast.success('Password reset! Please sign in.');
      navigation.navigate('Login');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  const onPressIn = () => Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(btnScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity, transform: [{ translateY }] }}>
          <View style={styles.iconWrap}>
            <View style={styles.iconCircle}>
              <Ionicons name={step === 'email' ? 'mail-open' : 'shield-checkmark'} size={42} color={colors.primary} />
            </View>
          </View>
          <Text style={styles.title}>{step === 'email' ? 'Forgot Password?' : 'Verify & Reset'}</Text>
          <Text style={styles.subtitle}>
            {step === 'email'
              ? 'Enter your email and we\u2019ll send you a one-time password'
              : `OTP sent to ${email}`}
          </Text>

          <Animated.View style={[styles.card, { transform: [{ translateX: stepX.interpolate({ inputRange: [-1, 0], outputRange: [-40, 0] }) }] }]}>
            {step === 'email' ? (
              <>
                <Text style={styles.label}>Email Address</Text>
                <View style={[styles.inputWrap, focus === 'email' && styles.inputWrapFocus]}>
                  <Ionicons name="mail-outline" size={18} color={focus === 'email' ? colors.primary : colors.gray400} />
                  <TextInput style={styles.input} value={email} onChangeText={setEmail} onFocus={() => setFocus('email')} onBlur={() => setFocus(null)} placeholder="you@example.com" placeholderTextColor={colors.placeholder} keyboardType="email-address" autoCapitalize="none" />
                </View>

                <Animated.View style={{ transform: [{ scale: btnScale }], marginTop: spacing.lg }}>
                  <Pressable onPress={sendOtp} onPressIn={onPressIn} onPressOut={onPressOut} disabled={loading} style={[styles.btn, loading && { opacity: 0.7 }]}>
                    <Text style={styles.btnText}>{loading ? 'Sending OTP…' : 'Send OTP'}</Text>
                    {!loading && <Ionicons name="paper-plane" size={18} color="#fff" style={{ marginLeft: 8 }} />}
                  </Pressable>
                </Animated.View>
              </>
            ) : (
              <>
                <Text style={styles.label}>Enter OTP</Text>
                <View style={[styles.inputWrap, focus === 'otp' && styles.inputWrapFocus]}>
                  <Ionicons name="key-outline" size={18} color={focus === 'otp' ? colors.primary : colors.gray400} />
                  <TextInput style={[styles.input, { letterSpacing: 8, fontWeight: '700', fontSize: 18 }]} value={otp} onChangeText={setOtp} onFocus={() => setFocus('otp')} onBlur={() => setFocus(null)} placeholder="------" placeholderTextColor={colors.gray300} keyboardType="number-pad" maxLength={6} />
                </View>

                <Text style={styles.label}>New Password</Text>
                <View style={[styles.inputWrap, focus === 'pwd' && styles.inputWrapFocus]}>
                  <Ionicons name="lock-closed-outline" size={18} color={focus === 'pwd' ? colors.primary : colors.gray400} />
                  <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} onFocus={() => setFocus('pwd')} onBlur={() => setFocus(null)} placeholder="At least 6 characters" placeholderTextColor={colors.placeholder} secureTextEntry={!showPwd} />
                  <Pressable onPress={() => setShowPwd((s) => !s)} hitSlop={10}>
                    <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.gray500} />
                  </Pressable>
                </View>

                <Animated.View style={{ transform: [{ scale: btnScale }], marginTop: spacing.lg }}>
                  <Pressable onPress={resetPassword} onPressIn={onPressIn} onPressOut={onPressOut} disabled={loading} style={[styles.btn, loading && { opacity: 0.7 }]}>
                    <Text style={styles.btnText}>{loading ? 'Resetting…' : 'Reset Password'}</Text>
                    {!loading && <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginLeft: 8 }} />}
                  </Pressable>
                </Animated.View>

                <Pressable onPress={() => setStep('email')} style={({ pressed }) => [{ alignSelf: 'center', marginTop: spacing.md, opacity: pressed ? 0.6 : 1 }]}>
                  <Text style={styles.linkSmall}>Use a different email</Text>
                </Pressable>
              </>
            )}
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  scroll: { flexGrow: 1, padding: spacing.md, paddingTop: 40, justifyContent: 'center' },
  iconWrap: { alignItems: 'center', marginBottom: spacing.md },
  iconCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: colors.gray900, textAlign: 'center', marginTop: 4 },
  subtitle: { fontSize: fontSize.sm, color: colors.gray500, textAlign: 'center', marginTop: 6, marginBottom: spacing.lg, paddingHorizontal: spacing.lg },
  card: { backgroundColor: colors.white, borderRadius: 20, padding: spacing.lg, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700, marginTop: spacing.sm, marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, backgroundColor: colors.gray50, gap: 10 },
  inputWrapFocus: { borderColor: colors.primary, backgroundColor: '#fff' },
  input: { flex: 1, paddingVertical: 14, fontSize: fontSize.md, color: colors.gray900 },
  btn: { backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  btnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  linkSmall: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },
});
