import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null;
  const label = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Could not save';
  const color = state === 'error' ? colors.danger : colors.textSecondary;
  return (
    <View style={styles.row}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 2 },
  text: { fontSize: 12, fontStyle: 'italic' }
});
