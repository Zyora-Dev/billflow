import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

export default function HelpSupportScreen() {
  const phone = '+91 99941 73707';
  const email = 'info@spectratechnologies.solutions';
  const whatsapp = '919994173707';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Hero */}
      <View style={s.hero}>
        <View style={s.heroIcon}>
          <Ionicons name="headset-outline" size={32} color="#fff" />
        </View>
        <Text style={s.heroTitle}>Help & Support</Text>
        <Text style={s.heroSub}>We're here to help you with anything</Text>
      </View>

      {/* WhatsApp CTA */}
      <TouchableOpacity
        style={s.waBtn}
        activeOpacity={0.8}
        onPress={() => Linking.openURL(`https://wa.me/${whatsapp}?text=Hi, I need help with SpectraBooks`).catch(() => {})}
      >
        <Ionicons name="logo-whatsapp" size={22} color="#fff" />
        <View style={{ flex: 1 }}>
          <Text style={s.waBtnTitle}>Chat on WhatsApp</Text>
          <Text style={s.waBtnSub}>Fastest way to reach us</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      {/* Phone */}
      <TouchableOpacity
        style={s.card}
        activeOpacity={0.7}
        onPress={() => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`).catch(() => {})}
      >
        <View style={[s.iconCircle, { backgroundColor: '#eff6ff' }]}>
          <Ionicons name="call-outline" size={20} color="#3b82f6" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>Phone</Text>
          <Text style={s.cardValue}>{phone}</Text>
          <Text style={s.cardHint}>Mon–Sat, 9:00 AM – 8:00 PM</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.gray300} />
      </TouchableOpacity>

      {/* Email */}
      <TouchableOpacity
        style={s.card}
        activeOpacity={0.7}
        onPress={() => Linking.openURL(`mailto:${email}`).catch(() => {})}
      >
        <View style={[s.iconCircle, { backgroundColor: '#fef3c7' }]}>
          <Ionicons name="mail-outline" size={20} color="#d97706" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>Email</Text>
          <Text style={s.cardValue}>{email}</Text>
          <Text style={s.cardHint}>We'll respond within 24 hours</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.gray300} />
      </TouchableOpacity>

      {/* Location */}
      <View style={s.card}>
        <View style={[s.iconCircle, { backgroundColor: '#ecfdf5' }]}>
          <Ionicons name="location-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>Location</Text>
          <Text style={s.cardValue}>Spectra Technologies</Text>
          <Text style={s.cardHint}>New Port Street, WCC Rd</Text>
          <Text style={s.cardHint}>Near Indian Bank</Text>
          <Text style={s.cardHint}>Nagercoil, Tamil Nadu – 629001</Text>
        </View>
      </View>

      {/* Business Hours */}
      <View style={s.hoursCard}>
        <Ionicons name="time-outline" size={18} color={colors.primary} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.hoursTitle}>Business Hours</Text>
          <Text style={s.hoursRow}>Monday – Saturday: 9:00 AM – 8:00 PM</Text>
          <Text style={s.hoursRow}>Sunday: Closed</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 40 },

  hero: { alignItems: 'center', paddingVertical: spacing.lg },
  heroIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  heroSub: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },

  waBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#25D366',
    padding: spacing.md, borderRadius: borderRadius.lg, gap: 12, marginBottom: spacing.md,
  },
  waBtnTitle: { color: '#fff', fontSize: fontSize.md, fontWeight: '700' },
  waBtnSub: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.xs, marginTop: 1 },

  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    padding: spacing.md, borderRadius: borderRadius.lg, gap: 12,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardValue: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginTop: 2 },
  cardHint: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 1 },

  hoursCard: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#f0fdf4',
    padding: spacing.md, borderRadius: borderRadius.lg, marginTop: spacing.sm,
    borderWidth: 1, borderColor: '#bbf7d0',
  },
  hoursTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text, marginBottom: 4 },
  hoursRow: { fontSize: fontSize.xs, color: colors.textSecondary, lineHeight: 18 },
});
