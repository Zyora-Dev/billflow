import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Alert, ScrollView, KeyboardAvoidingView,
  Platform, Animated, Easing, Pressable, Image, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { colors, spacing, fontSize } from '../../theme';

export default function RegisterScreen({ navigation }: { navigation: NativeStackNavigationProp<any> }) {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [focus, setFocus] = useState<'email' | 'password' | 'confirm' | null>(null);
  const [agreed, setAgreed] = useState(true);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslate = useRef(new Animated.Value(-30)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formTranslate = useRef(new Animated.Value(40)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoFloat = useRef(new Animated.Value(0)).current;
  const blobA = useRef(new Animated.Value(0)).current;
  const blobB = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
        Animated.timing(headerOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(headerTranslate, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(formTranslate, { toValue: 0, duration: 600, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      ]),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(logoFloat, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(blobA, { toValue: 1, duration: 5000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(blobA, { toValue: 0, duration: 5000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(blobB, { toValue: 1, duration: 6500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(blobB, { toValue: 0, duration: 6500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const triggerShake = () => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const strength = (() => {
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 10) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return Math.min(s, 4);
  })();
  const strengthLabels = ['Too short', 'Weak', 'Okay', 'Strong', 'Very strong'];
  const strengthColors = ['rgba(255,255,255,0.25)', colors.danger, colors.warning, colors.info, colors.success];

  const handleRegister = async () => {
    if (!email || !password) { triggerShake(); return Alert.alert('Required', 'All fields are required'); }
    if (!agreed) { triggerShake(); return Alert.alert('Terms', 'Please accept the Terms & Privacy Policy'); }
    if (password !== confirm) { triggerShake(); return Alert.alert('Mismatch', 'Passwords do not match'); }
    if (password.length < 6) { triggerShake(); return Alert.alert('Weak', 'Password must be at least 6 characters'); }
    setLoading(true);
    try {
      await register(email.trim().toLowerCase(), password);
      setSuccess(true);
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, friction: 5, tension: 50, useNativeDriver: true }),
        Animated.timing(successOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
      setTimeout(() => navigation.navigate('Login'), 1600);
    } catch (e: any) {
      triggerShake();
      Alert.alert('Error', e.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const onPressIn = () => Animated.spring(btnScale, { toValue: 0.95, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(btnScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();

  const logoY = logoFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const blobAY = blobA.interpolate({ inputRange: [0, 1], outputRange: [0, 30] });
  const blobBY = blobB.interpolate({ inputRange: [0, 1], outputRange: [0, -25] });
  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] });

  if (success) {
    return (
      <View style={styles.successContainer}>
        <StatusBar barStyle="light-content" />
        <Animated.View style={[styles.successCircle, { transform: [{ scale: successScale }], opacity: successOpacity }]}>
          <Ionicons name="checkmark" size={72} color="#fff" />
        </Animated.View>
        <Animated.Text style={[styles.successTitle, { opacity: successOpacity }]}>Welcome aboard! 🎉</Animated.Text>
        <Animated.Text style={[styles.successDesc, { opacity: successOpacity }]}>Your account is ready. Redirecting…</Animated.Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.blob, styles.blobTop, { transform: [{ translateY: blobAY }] }]} />
      <Animated.View style={[styles.blob, styles.blobMid, { transform: [{ translateY: blobBY }] }]} />
      <Animated.View style={[styles.blob, styles.blobBottom]} />

      <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]} hitSlop={10}>
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </Pressable>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.header, { opacity: headerOpacity, transform: [{ translateY: headerTranslate }] }]}>
            <Animated.View style={[styles.logoWrap, { transform: [{ scale: logoScale }, { translateY: logoY }] }]}>
              <Image source={require('../../../assets/billflow.png')} style={styles.logo} resizeMode="contain" />
            </Animated.View>
            <Text style={styles.brand}>Join BillFlow</Text>
            <Text style={styles.subtitle}>Free forever • No credit card needed</Text>
          </Animated.View>

          <Animated.View style={[styles.form, { opacity: formOpacity, transform: [{ translateY: formTranslate }, { translateX: shakeX }] }]}>
            <Text style={styles.welcome}>Create your account</Text>
            <Text style={styles.welcomeSub}>Get started in less than a minute</Text>

            <Text style={styles.label}>Email Address</Text>
            <View style={[styles.inputWrap, focus === 'email' && styles.inputWrapFocus]}>
              <Ionicons name="mail-outline" size={18} color={focus === 'email' ? colors.white : 'rgba(255,255,255,0.55)'} />
              <TextInput style={styles.input} value={email} onChangeText={setEmail} onFocus={() => setFocus('email')} onBlur={() => setFocus(null)} placeholder="you@example.com" placeholderTextColor="rgba(255,255,255,0.4)" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
              {email.length > 3 && email.includes('@') && email.includes('.') && (
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              )}
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputWrap, focus === 'password' && styles.inputWrapFocus]}>
              <Ionicons name="lock-closed-outline" size={18} color={focus === 'password' ? colors.white : 'rgba(255,255,255,0.55)'} />
              <TextInput style={styles.input} value={password} onChangeText={setPassword} onFocus={() => setFocus('password')} onBlur={() => setFocus(null)} placeholder="At least 6 characters" placeholderTextColor="rgba(255,255,255,0.4)" secureTextEntry={!showPwd} />
              <Pressable onPress={() => setShowPwd((s) => !s)} hitSlop={10}>
                <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color="rgba(255,255,255,0.7)" />
              </Pressable>
            </View>

            {password.length > 0 && (
              <View style={styles.strengthRow}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={[styles.strengthBar, { backgroundColor: i < strength ? strengthColors[strength] : 'rgba(255,255,255,0.18)' }]} />
                ))}
                <Text style={[styles.strengthLabel, { color: strengthColors[strength] }]}>{strengthLabels[strength]}</Text>
              </View>
            )}

            <Text style={styles.label}>Confirm Password</Text>
            <View style={[styles.inputWrap, focus === 'confirm' && styles.inputWrapFocus, confirm.length > 0 && password !== confirm && { borderColor: colors.danger }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color={focus === 'confirm' ? colors.white : 'rgba(255,255,255,0.55)'} />
              <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} onFocus={() => setFocus('confirm')} onBlur={() => setFocus(null)} placeholder="Repeat password" placeholderTextColor="rgba(255,255,255,0.4)" secureTextEntry={!showPwd} />
              {confirm.length > 0 && password === confirm && <Ionicons name="checkmark-circle" size={20} color={colors.success} />}
              {confirm.length > 0 && password !== confirm && <Ionicons name="close-circle" size={20} color={colors.danger} />}
            </View>

            <Pressable onPress={() => setAgreed((a) => !a)} style={styles.termsRow} hitSlop={6}>
              <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
                {agreed && <Ionicons name="checkmark" size={14} color={colors.primary} />}
              </View>
              <Text style={styles.termsText}>
                I agree to the <Text style={styles.termsLink}>Terms</Text> & <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </Pressable>

            <Animated.View style={{ transform: [{ scale: btnScale }], marginTop: spacing.md }}>
              <Pressable onPress={handleRegister} onPressIn={onPressIn} onPressOut={onPressOut} disabled={loading} style={[styles.btn, loading && { opacity: 0.7 }]}>
                <Text style={styles.btnText}>{loading ? 'Creating account…' : 'Create Account'}</Text>
                {!loading && <Ionicons name="rocket" size={18} color={colors.primary} style={{ marginLeft: 8 }} />}
              </Pressable>
            </Animated.View>

            <Pressable onPress={() => navigation.navigate('Login')} style={({ pressed }) => [{ alignSelf: 'center', marginTop: spacing.lg, opacity: pressed ? 0.6 : 1 }]}>
              <Text style={styles.bottomLink}>
                Already have an account? <Text style={styles.bottomLinkAccent}>Sign in</Text>
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },

  blob: { position: 'absolute', borderRadius: 999 },
  blobTop: { top: -120, right: -80, width: 280, height: 280, backgroundColor: colors.accent + '30' },
  blobMid: { top: 120, left: -100, width: 240, height: 240, backgroundColor: colors.primaryLight + '40' },
  blobBottom: { bottom: -150, right: -60, width: 320, height: 320, backgroundColor: colors.accent + '20' },

  backBtn: { position: 'absolute', top: 50, left: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', zIndex: 10 },

  header: { alignItems: 'center', marginBottom: spacing.lg },
  logoWrap: { width: 64, height: 64, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', marginBottom: 12 },
  logo: { width: 44, height: 44 },
  brand: { fontSize: 24, fontWeight: '800', color: colors.white, letterSpacing: 0.5 },
  subtitle: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.65)', marginTop: 4 },

  form: {},
  welcome: { fontSize: 20, fontWeight: '800', color: colors.white, letterSpacing: 0.2 },
  welcomeSub: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.6)', marginTop: 2, marginBottom: spacing.md },

  label: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginTop: spacing.md, marginBottom: 6, letterSpacing: 0.8, textTransform: 'uppercase' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 14, paddingHorizontal: spacing.md, backgroundColor: 'rgba(255,255,255,0.08)', gap: 10 },
  inputWrapFocus: { borderColor: 'rgba(255,255,255,0.55)', backgroundColor: 'rgba(255,255,255,0.14)' },
  input: { flex: 1, paddingVertical: 13, fontSize: fontSize.md, color: colors.white },

  strengthRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 5 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: '700', marginLeft: 6, minWidth: 70 },

  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.md },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.white, borderColor: colors.white },
  termsText: { flex: 1, fontSize: fontSize.sm, color: 'rgba(255,255,255,0.75)', lineHeight: 18 },
  termsLink: { color: colors.white, fontWeight: '700' },

  btn: { backgroundColor: colors.white, borderRadius: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 },
  btnText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '700', letterSpacing: 0.4 },

  bottomLink: { color: 'rgba(255,255,255,0.65)', fontSize: fontSize.sm },
  bottomLinkAccent: { color: colors.white, fontWeight: '700' },

  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, paddingHorizontal: spacing.lg },
  successCircle: { width: 140, height: 140, borderRadius: 70, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg, shadowColor: colors.success, shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  successTitle: { fontSize: 28, fontWeight: '800', color: colors.white, textAlign: 'center' },
  successDesc: { fontSize: fontSize.md, color: 'rgba(255,255,255,0.7)', marginTop: spacing.sm, textAlign: 'center' },
});
