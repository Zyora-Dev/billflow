import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image, Dimensions } from 'react-native';
import { colors, fontSize } from '../theme';

const { width } = Dimensions.get('window');

interface Props {
  onFinish: () => void;
}

export default function AnimatedSplashScreen({ onFinish }: Props) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslate = useRef(new Animated.Value(20)).current;
  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;
  const finalFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(taglineTranslate, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.loop(
          Animated.parallel([
            Animated.timing(ringScale, { toValue: 1.6, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(ringOpacity, { toValue: 0, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          ]),
          { iterations: 2 }
        ),
      ]),
      Animated.delay(250),
      Animated.timing(finalFade, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(() => onFinish());
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: finalFade }]}>
      <View style={styles.center}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            { transform: [{ scale: ringScale }], opacity: ringOpacity },
          ]}
        />
        <Animated.View style={{ transform: [{ scale }], opacity }}>
          <Image source={require('../../assets/billflow.png')} style={styles.logo} resizeMode="contain" />
        </Animated.View>
      </View>
      <Animated.View style={{ opacity: taglineOpacity, transform: [{ translateY: taglineTranslate }], alignItems: 'center' }}>
        <Text style={styles.brand}>BillFlow</Text>
        <Text style={styles.tagline}>GST Invoicing • Made Simple</Text>
      </Animated.View>
      <View style={{ height: 80 }} />
    </Animated.View>
  );
}

const LOGO_SIZE = Math.min(width * 0.42, 180);
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'space-between', paddingTop: 140 },
  center: { alignItems: 'center', justifyContent: 'center' },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  ring: {
    position: 'absolute',
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  brand: { color: colors.white, fontSize: 38, fontWeight: '800', letterSpacing: 1.2, marginTop: 24 },
  tagline: { color: 'rgba(255,255,255,0.75)', fontSize: fontSize.md, marginTop: 8, fontWeight: '500', letterSpacing: 0.4 },
});
