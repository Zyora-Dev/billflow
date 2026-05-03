import React, { useRef, useState } from 'react';
import { Pressable, Modal, View, StyleSheet, Animated, TouchableWithoutFeedback, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import haptic from '../lib/haptics';

interface Props {
  /** The visible row content */
  children: React.ReactNode;
  /** What to render in the floating preview card */
  preview: React.ReactNode;
  /** Tap handler (normal press) */
  onPress?: () => void;
  /** Long-press delay in ms */
  delay?: number;
  /** Wrapper style */
  style?: any;
}

const { width, height } = Dimensions.get('window');

/**
 * LongPressPreview — long-press the child row to open a focused preview card with blur background.
 * Tap anywhere outside to dismiss. Tap the preview to navigate.
 */
export default function LongPressPreview({ children, preview, onPress, delay = 350, style }: Props) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const overlay = useRef(new Animated.Value(0)).current;
  const rowScale = useRef(new Animated.Value(1)).current;

  const openPreview = () => {
    haptic.medium();
    setOpen(true);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(overlay, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  };

  const closePreview = () => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 0.9, duration: 180, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(overlay, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setOpen(false);
      scale.setValue(0.85);
    });
  };

  const handlePressIn = () => Animated.spring(rowScale, { toValue: 0.98, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(rowScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();

  return (
    <>
      <Pressable
        onPress={onPress}
        onLongPress={openPreview}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        delayLongPress={delay}
        style={style}
      >
        <Animated.View style={{ transform: [{ scale: rowScale }] }}>{children}</Animated.View>
      </Pressable>

      <Modal visible={open} transparent animationType="none" onRequestClose={closePreview} statusBarTranslucent>
        <View style={StyleSheet.absoluteFill}>
          <TouchableWithoutFeedback onPress={closePreview}>
            <Animated.View style={[styles.overlay, { opacity: overlay }]} />
          </TouchableWithoutFeedback>
          <View style={[styles.center, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 60 }]}>
            <Animated.View
              style={[
                styles.previewCard,
                { opacity, transform: [{ scale }], maxHeight: height - insets.top - insets.bottom - 120 },
              ]}
            >
              <Pressable
                onPress={() => {
                  closePreview();
                  setTimeout(() => onPress?.(), 200);
                }}
              >
                {preview}
              </Pressable>
            </Animated.View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 20,
  },
});
