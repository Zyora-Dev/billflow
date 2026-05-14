import React, { useRef, useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import api, { BASE_URL } from '../api/client';
import { colors } from '../theme';
import { useNetwork } from './NetworkProvider';

type Props = {
  title?: string;
  subtitle?: string;
  showMenu?: boolean;
  onBack?: () => void;
  onMenu?: () => void;
  onSearch?: () => void;
  onBell?: () => void;
  onTitleTriplePress?: () => void;
  notificationCount?: number;
  showQuickNav?: boolean;
};

const QUICK_NAV: { key: string; label: string; icon: any; tab: string; bg: string; iconColor: string }[] = [
  { key: 'invoice',   label: 'Invoice',   icon: 'document-text',  tab: 'Invoices',   bg: 'rgba(99,102,241,0.18)',  iconColor: '#c7d2fe' },
  { key: 'purchase',  label: 'Purchase',  icon: 'bag-handle',     tab: 'Purchase',   bg: 'rgba(244,114,182,0.18)', iconColor: '#fbcfe8' },
  { key: 'quotation', label: 'Quotation', icon: 'reader',         tab: 'Quotations', bg: 'rgba(34,197,94,0.18)',   iconColor: '#bbf7d0' },
  { key: 'task',      label: 'Task',      icon: 'checkmark-done', tab: 'Tasks',      bg: 'rgba(251,191,36,0.18)',  iconColor: '#fde68a' },
];

/**
 * Modern, two-row header with curved bottom edge.
 * Row 1: menu/back · greeting + business name · search · bell · avatar
 * Row 2: large bold page title with accent bar
 */
export default function AppHeader({
  title = '',
  subtitle,
  showMenu,
  onBack,
  onMenu,
  onSearch,
  onBell,
  onTitleTriplePress,
  notificationCount = 0,
  showQuickNav = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const { user, stealthActive } = useAuth();
  const { online, pendingCount, flushing } = useNetwork();
  const navigation = useNavigation<any>();
  const [bizName, setBizName] = useState<string>('');
  const [bizLogo, setBizLogo] = useState<string | null>(null);

  const tapCount = useRef(0);
  const tapTimer = useRef<any>(null);

  useEffect(() => {
    if (user?.role === 'staff') return; // Staff can't list businesses
    (async () => {
      try {
        const r = await api.get('/api/business');
        const biz = r.data?.[0];
        if (biz?.business_name) setBizName(biz.business_name);
        if (biz?.business_logo) setBizLogo(biz.business_logo);
      } catch {}
    })();
  }, [user?.role]);

  const onTitleTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 600);
    if (tapCount.current >= 3) {
      tapCount.current = 0;
      if (tapTimer.current) clearTimeout(tapTimer.current);
      onTitleTriplePress?.();
    }
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const initial = useMemo(() => {
    const src = bizName || user?.email || 'B';
    return src.trim().charAt(0).toUpperCase();
  }, [bizName, user]);

  const baseColor = stealthActive ? '#0e3d2c' : colors.primary;
  const lightColor = stealthActive ? '#15553e' : colors.primaryLight;

  return (
    <View>
      <View style={{ height: insets.top, backgroundColor: baseColor }} />

      <View style={[s.wrap, { backgroundColor: baseColor }]}>
        <View style={[s.stripe, { backgroundColor: lightColor }]} />

        <View style={s.row1}>
          {onBack ? (
            <TouchableOpacity style={s.iconBtn} onPress={onBack} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={22} color={colors.white} />
            </TouchableOpacity>
          ) : showMenu && onMenu ? (
            <TouchableOpacity style={s.iconBtn} onPress={onMenu} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="menu-outline" size={22} color={colors.white} />
            </TouchableOpacity>
          ) : (
            <View style={s.iconBtn} />
          )}

          <TouchableOpacity
            style={s.brandBlock}
            activeOpacity={0.85}
            onPress={onTitleTap}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={s.brandText}>SpectraBooks</Text>
            {stealthActive && (
              <View style={s.brandPrivateDot}>
                <Ionicons name="shield-checkmark" size={10} color="#86efac" />
              </View>
            )}
          </TouchableOpacity>

          <View style={s.actions}>
            {onSearch && (
              <TouchableOpacity style={s.actionBtn} onPress={onSearch} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
                <Ionicons name="search-outline" size={18} color={colors.white} />
              </TouchableOpacity>
            )}
            {onBell && (
              <TouchableOpacity style={s.actionBtn} onPress={onBell} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
                <Ionicons name="notifications-outline" size={18} color={colors.white} />
                {notificationCount > 0 && (
                  <View style={s.bellBadge}>
                    <Text style={s.bellBadgeText}>{notificationCount > 99 ? '99+' : notificationCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.avatar, stealthActive && { backgroundColor: '#22c55e' }]}
              onPress={() => {
                // Staff has no Settings tab
                if (user?.role === 'staff') return;
                navigation.navigate('Settings');
              }}
              activeOpacity={0.85}
            >
              {stealthActive ? (
                <Ionicons name="shield-checkmark" size={16} color={colors.white} />
              ) : bizLogo ? (
                <Image source={{ uri: `${BASE_URL}/assets/logos/${bizLogo}` }} style={s.avatarImg} />
              ) : (
                <Text style={s.avatarText}>{initial}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Title row only on sub-screens (with back button). Root screens just show greeting row. */}
        {!!onBack && (
          <TouchableOpacity activeOpacity={0.85} onPress={onTitleTap} hitSlop={{ top: 6, bottom: 6, left: 12, right: 12 }} style={s.row2}>
            <View style={s.accentBar} />
            <View style={{ flex: 1 }}>
              <Text style={s.title} numberOfLines={1}>{title}</Text>
              {!!subtitle && <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text>}
            </View>
          </TouchableOpacity>
        )}
      </View>
      {(!online || pendingCount > 0) && (
        <View style={[s.offlineBar, { backgroundColor: !online ? '#b91c1c' : '#ca8a04' }]}>
          <Ionicons name={!online ? 'cloud-offline-outline' : (flushing ? 'sync' : 'cloud-upload-outline')} size={12} color={colors.white} />
          <Text style={s.offlineText}>
            {!online
              ? `Offline${pendingCount > 0 ? ` · ${pendingCount} pending` : ' · viewing cached data'}`
              : flushing
                ? `Syncing ${pendingCount} change${pendingCount > 1 ? 's' : ''}…`
                : `${pendingCount} change${pendingCount > 1 ? 's' : ''} queued`}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 6 },
    }),
  },
  stripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.5,
  },
  row1: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    gap: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetBlock: {
    flex: 1,
    minWidth: 0,
  },
  greetSmall: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  greetName: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 1,
  },
  brandBlock: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    includeFontPadding: false,
  },
  brandPrivateDot: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(34,197,94,0.22)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(134,239,172,0.5)',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.danger,
    borderRadius: 999,
    minWidth: 14,
    height: 14,
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  bellBadgeText: {
    color: colors.white,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '800',
    textAlign: 'center',
    includeFontPadding: false,
  },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  accentBar: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: colors.primaryLight,
  },
  title: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
    letterSpacing: 0.3,
  },
  quickNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 22,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  quickItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 2,
  },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  quickLabel: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  offlineText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
