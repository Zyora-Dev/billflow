import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../theme';

interface DateInputProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  placeholder?: string;
  label?: string;
  style?: any;
}

export default function DateInput({ value, onChange, placeholder = 'Select date', label, style }: DateInputProps) {
  const [show, setShow] = useState(false);

  const parseDate = (str: string) => {
    if (!str) return new Date();
    const parts = str.split('-');
    if (parts.length === 3) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return new Date();
  };

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const displayDate = (str: string) => {
    if (!str) return '';
    const d = parseDate(str);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleChange = (_: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (selectedDate) onChange(formatDate(selectedDate));
  };

  if (Platform.OS === 'ios') {
    return (
      <View style={style}>
        {label && <Text style={s.label}>{label}</Text>}
        <TouchableOpacity style={s.btn} onPress={() => setShow(true)}>
          <Text style={value ? s.text : s.placeholder}>{value ? displayDate(value) : placeholder}</Text>
          <Ionicons name="calendar-outline" size={20} color={colors.gray500} />
        </TouchableOpacity>
        <Modal visible={show} transparent animationType="fade" onRequestClose={() => setShow(false)}>
          <View style={s.overlay}>
            <View style={s.modal}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>{placeholder}</Text>
                <TouchableOpacity onPress={() => setShow(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={s.doneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={parseDate(value)}
                mode="date"
                display="spinner"
                onChange={handleChange}
                style={{ height: 200 }}
              />
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // Android
  return (
    <View style={style}>
      {label && <Text style={s.label}>{label}</Text>}
      <TouchableOpacity style={s.btn} onPress={() => setShow(true)}>
        <Text style={value ? s.text : s.placeholder}>{value ? displayDate(value) : placeholder}</Text>
        <Ionicons name="calendar-outline" size={20} color={colors.gray500} />
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={parseDate(value)}
          mode="date"
          display="default"
          onChange={handleChange}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700, marginBottom: spacing.xs, marginTop: spacing.sm },
  btn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, padding: spacing.md },
  text: { fontSize: fontSize.md, color: colors.text },
  placeholder: { fontSize: fontSize.md, color: colors.placeholder },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 30 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  modalTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  doneText: { fontSize: fontSize.md, fontWeight: '700', color: colors.primary },
});
