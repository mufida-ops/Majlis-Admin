import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { initials } from '@/lib/format';

const PALETTE = [colors.navy, colors.gold, colors.info, colors.success, colors.warning, colors.danger, colors.stageIdea];

function colorFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % PALETTE.length;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function Avatar({ name, size = 28 }: { name: string | null | undefined; size?: number }) {
  const label = name ?? '?';
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colorFor(label) }
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.4 }]}>{initials(label)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#FFF', fontWeight: '700' }
});
