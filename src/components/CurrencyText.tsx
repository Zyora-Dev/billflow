import React from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';

export default function CurrencyText({
  amount,
  style,
  symbolStyle,
}: {
  amount: number;
  style?: StyleProp<TextStyle>;
  symbolStyle?: StyleProp<TextStyle>;
}) {
  return (
    <Text style={style}>
      <Text style={[{ fontSize: 13, fontWeight: '600', opacity: 0.75 }, symbolStyle]}>₹ </Text>
      {(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </Text>
  );
}
