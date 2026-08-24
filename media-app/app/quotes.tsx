import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/constants/theme';
import { QUOTES, randomQuoteIndex } from '@/lib/quotes';

export default function Quotes() {
  const [index, setIndex] = useState(() => randomQuoteIndex());
  const quote = QUOTES[index];

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Feather name="sun" size={22} color={colors.gold} style={{ marginBottom: spacing.md }} />
        <Text style={styles.text}>"{quote.text}"</Text>
        <Text style={styles.author}>— {quote.author}</Text>
      </View>

      <Pressable style={styles.button} onPress={() => setIndex((i) => randomQuoteIndex(i))}>
        <Feather name="refresh-cw" size={16} color="#FFF" />
        <Text style={styles.buttonText}>Another one</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: 'center', gap: spacing.xl },
  card: {
    backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.xl, alignItems: 'center', gap: spacing.sm
  },
  text: { fontSize: 19, fontWeight: '600', color: colors.textPrimary, textAlign: 'center', lineHeight: 27 },
  author: { fontSize: 13, fontWeight: '700', color: colors.gold, marginTop: spacing.sm },
  button: {
    alignSelf: 'center', backgroundColor: colors.navy, borderRadius: radii.pill, paddingVertical: 12, paddingHorizontal: 22,
    flexDirection: 'row', alignItems: 'center', gap: 8
  },
  buttonText: { color: '#FFF', fontWeight: '700', fontSize: 14 }
});
