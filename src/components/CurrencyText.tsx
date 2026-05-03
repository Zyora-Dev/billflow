import React from 'react';
import { Text } from 'react-native';

export default function CurrencyText({ amount, style }: { amount: number; style?: any }) {
  return <Text style={style}>₹{(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>;
}
