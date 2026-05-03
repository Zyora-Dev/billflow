import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, Alert, ScrollView, Image, Animated, Easing, Pressable,
  TouchableWithoutFeedback, Keyboard, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { colors, spacing, fontSize } from '../../theme';

export default function LoginScreen({ navigation }: { navigation: NativeStackNavigationProp<any> }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [focus, setFocus] = useState<'email' | 'password' | null>(null);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslate = useRef(new Animated.Value(-30)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formTranslate = useRef(new Animated.Value(40)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoFloat = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const blobA = useRef(new Animated.Value(0)).current;
  const blobB = useRef(new Animated.Value(0)).current;

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

  const handleLogin = async () => {
    if (!email || !password) { triggerShake(); return Alert.alert('Required', 'Email and password are required'); }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (e: any) {
      triggerShake();
      Alert.alert('Login Failed', e.response?.data?.detail || 'Invalid credentials');
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.blob, styles.blobTop, { transform: [{ translateY: blobAY }] }]} />
      <Animated.View style={[styles.blob, styles.blobMid, { transform: [{ translateY: blobBY }] }]} />
      <Animated.View style={[styles.blob, styles.blobBottom]} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View>
              <Animated.View style={[styles.header, { opacity: headerOpacity, transform: [{ translateY: headerTranslate }] }]}>
                <Animated.View style={[styles.logoWrap, { transform: [{ scale: logoScale }, { translateY: logoY }] }]}>
                  <Image source={require('../../../assets/billflow.png')} style={styles.logo} resizeMode="contain" />
                </Animated.View>
                <Text style={styles.brand}>BillFlow</Text>
                <Text style={styles.subtitle}>GST Invoicing • Made Simple</Text>
              </Animated.View>

              <Animated.View style={[styles.form, { opacity: formOpacity, transform: [{ translateY: formTranslate }, { translateX: shakeX }] }]}>
                <Text style={styles.welcome}>Welcome back 👋</Text>
                <Text style={styles.welcomeSub}>Sign in to continue</Text>

                <Text style={styles.label}>Email Address</Text>
                <View style={[styles.inputWrap, focus === 'email' && styles.inputWrapFocus]}>
                  <Ionicons name="mail-outline" size={18} color={focus === 'email' ? colors.white : 'rgba(255,255,255,0.55)'} />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setFocus('email')}
                    onBlur={() => setFocus(null)}
                    placeholder="you@example.com"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                  {email.length > 3 && email.includes('@') && email.includes('.') && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  )}
                </View>

                <Text style={styles.label}>Password</Text>
                <View style={[styles.inputWrap, focus === 'password' && styles.inputWrapFocus]}>
                  <Ionicons name="lock-closed-outline" size={18} color={focus === 'password' ? colors.white : 'rgba(255,255,255,0.55)'} />
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setFocus('password')}
                    onBlur={() => setFocus(null)}
                    placeholder="Enter your password"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    secureTextEntry={!showPwd}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <Pressable onPress={() => setShowPwd((s) => !s)} hitSlop={10}>
                    <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color="rgba(255,255,255,0.7)" />
                  </Pressable>
                </View>

                <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={({ pressed }) => [{ alignSelf: 'flex-end', marginTop: spacing.sm, opacity: pressed ? 0.6 : 1 }]} hitSlop={6}>
                  <Text style={styles.linkSmall}>Forgot password?</Text>
                </Pressable>

                <Animated.View style={{ transform: [{ scale: btnScale }], marginTop: spacing.lg }}>
                  <Pressable onPress={handleLogin} onPressIn={onPressIn} onPressOut={onPressOut} disabled={loading} style={[styles.btn, loading && { opacity: 0.7 }]}>
                    <Text style={styles.btnText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
                    {!loading && <Ionicons name="arrow-forward" size={18} color={colors.primary} style={{ marginLeft: 8 }} />}
                  </Pressable>
                </Animated.View>

                <Pressable onPress={() => navigation.navigate('Register')} style={({ pressed }) => [{ alignSelf: 'center', marginTop: spacing.lg, opacity: pressed ? 0.6 : 1 }]}>
                  <Text style={styles.bottomLink}>
                    New here? <Text style={styles.bottomLinkAccent}>Create an account</Text>
                  </Text>
                </Pressable>
              </Animated.View>
            </View>
          </TouchableWithoutFeedback>
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

  header: { alignItems: 'center', marginBottom: spacing.xl },
  logoWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', marginBottom: 14 },
  logo: { width: 50, height: 50 },
  brand: { fontSize: 30, fontWeight: '800', color: colors.white, letterSpacing: 0.8 },
  subtitle: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.65)', marginTop: 4, letterSpacing: 0.5 },

  form: {},
  welcome: { fontSize: 22, fontWeight: '800', color: colors.white, letterSpacing: 0.2 },
  welcomeSub: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.6)', marginTop: 2, marginBottom: spacing.md },

  label: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginTop: spacing.md, marginBottom: 6, letterSpacing: 0.8, textTransform: 'uppercase' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 14, paddingHorizontal: spacing.md, backgroundColor: 'rgba(255,255,255,0.08)', gap: 10 },
  inputWrapFocus: { borderColor: 'rgba(255,255,255,0.55)', backgroundColor: 'rgba(255,255,255,0.14)' },
  input: { flex: 1, paddingVertical: 13, fontSize: fontSize.md, color: colors.white },

  linkSmall: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.sm, fontWeight: '600' },

  btn: { backgroundColor: colors.white, borderRadius: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 },
  btnText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '700', letterSpacing: 0.4 },

  bottomLink: { color: 'rgba(255,255,255,0.65)', fontSize: fontSize.sm },
  bottomLinkAccent: { color: colors.white, fontWeight: '700' },
});
