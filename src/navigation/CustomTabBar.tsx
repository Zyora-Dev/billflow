import React, { useEffect, useRef } from 'react';
import { View, Pressable, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { useQuickAdd } from '../components/QuickAddFAB';
import { useGlobalSearch } from '../components/GlobalSearch';
import { useAuth } from '../auth/AuthContext';
import haptic from '../lib/haptics';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'grid',
  Invoices: 'document-text',
  Expenses: 'receipt',
  Customers: 'people',
  Purchase: 'bag-handle',
  Vendors: 'storefront',
  Tasks: 'checkbox',
  MyAttendance: 'calendar',
};

interface TabItemProps {
  name: string;
  label: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function TabItem({ name, label, isFocused, onPress, onLongPress }: TabItemProps) {
  const anim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: isFocused ? 1 : 0,
      friction: 6,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [isFocused]);

  const iconScale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const iconY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });
  const dotScale = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const onPressIn = () => Animated.spring(press, { toValue: 0.9, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(press, { toValue: 1, friction: 4, useNativeDriver: true }).start();

  const filled = (ICONS[name] || 'ellipsis-horizontal') as keyof typeof Ionicons.glyphMap;
  const outlineName = ((ICONS[name] || 'ellipsis-horizontal') + '-outline') as keyof typeof Ionicons.glyphMap;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.itemPressable}
      android_ripple={{ color: 'transparent' }}
    >
      <Animated.View style={[styles.itemInner, { transform: [{ scale: press }] }]}>
        <Animated.View style={{ transform: [{ scale: iconScale }, { translateY: iconY }] }}>
          <Ionicons
            name={isFocused ? filled : outlineName}
            size={22}
            color={isFocused ? '#064e3b' : '#374151'}
          />
        </Animated.View>
        <Animated.Text
          numberOfLines={1}
          style={[
            styles.label,
            { color: isFocused ? '#064e3b' : '#374151' },
          ]}
        >
          {label}
        </Animated.Text>
        <Animated.View
          style={[
            styles.activeDot,
            { transform: [{ scale: dotScale }], opacity: dotScale },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { open: openQuickAdd, isOpen } = useQuickAdd();
  const { open: openSearch } = useGlobalSearch();
  const { user } = useAuth();
  const isStaff = user?.role === 'staff';
  const fabScale = useRef(new Animated.Value(1)).current;
  const fabRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fabRotate, { toValue: isOpen ? 1 : 0, friction: 6, tension: 100, useNativeDriver: true }).start();
  }, [isOpen]);

  const visibleRoutes = state.routes
    .map((route, index) => ({ route, index }))
    .filter(({ route }) => {
      const opts = descriptors[route.key].options;
      const itemStyle: any = opts.tabBarItemStyle;
      if (
        itemStyle &&
        (Array.isArray(itemStyle)
          ? itemStyle.some((s) => s?.display === 'none')
          : itemStyle.display === 'none')
      ) {
        return false;
      }
      return true;
    });

  // Split visible tabs around the center FAB
  const half = Math.ceil(visibleRoutes.length / 2);
  const leftRoutes = visibleRoutes.slice(0, half);
  const rightRoutes = visibleRoutes.slice(half);

  const renderTab = ({ route, index }: { route: any; index: number }) => {
    const { options } = descriptors[route.key];
    const isFocused = state.index === index;
    const label =
      typeof options.tabBarLabel === 'string'
        ? options.tabBarLabel
        : options.title ?? route.name;

    const onPress = () => {
      haptic.selection();
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name as any, route.params as any);
      }
    };
    const onLongPress = () => {
      navigation.emit({ type: 'tabLongPress', target: route.key });
    };

    return (
      <TabItem
        key={route.key}
        name={route.name}
        label={label as string}
        isFocused={isFocused}
        onPress={onPress}
        onLongPress={onLongPress}
      />
    );
  };

  const fabRotation = fabRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '135deg'] });

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom || 6 }]}>
      <View style={styles.bar}>
        {leftRoutes.map(renderTab)}

        {/* Center FAB slot — hidden for staff */}
        {!isStaff && (
        <View style={styles.fabSlot}>
          <Pressable
            onPress={() => {
              haptic.medium();
              openQuickAdd();
            }}
            onLongPress={() => {
              haptic.heavy();
              openSearch();
            }}
            delayLongPress={350}
            onPressIn={() => Animated.spring(fabScale, { toValue: 0.92, useNativeDriver: true }).start()}
            onPressOut={() => Animated.spring(fabScale, { toValue: 1, friction: 4, useNativeDriver: true }).start()}
            android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true, radius: 28 }}
            style={styles.fabPressable}
          >
            <Animated.View style={[styles.fab, { transform: [{ scale: fabScale }] }]}>
              <Animated.View style={{ transform: [{ rotate: fabRotation }] }}>
                <Ionicons name="diamond" size={26} color="#fff" />
              </Animated.View>
            </Animated.View>
          </Pressable>
        </View>
        )}

        {rightRoutes.map(renderTab)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 4,
    height: 58,
  },
  itemPressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 3,
    letterSpacing: 0.2,
  },
  activeDot: {
    position: 'absolute',
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  fabSlot: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabPressable: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginTop: -18,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
