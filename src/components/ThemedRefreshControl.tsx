import React from 'react';
import { RefreshControl, RefreshControlProps, Platform } from 'react-native';
import { colors } from '../theme';
import haptic from '../lib/haptics';

/** Themed RefreshControl with haptic feedback on trigger */
export default function ThemedRefreshControl(props: RefreshControlProps) {
  const { onRefresh, ...rest } = props;
  const wrapped = onRefresh
    ? () => {
        haptic.light();
        onRefresh();
      }
    : undefined;

  return (
    <RefreshControl
      {...rest}
      onRefresh={wrapped}
      tintColor={colors.primary}
      colors={[colors.primary, colors.accent]}
      progressBackgroundColor={Platform.OS === 'android' ? '#ffffff' : undefined}
    />
  );
}
