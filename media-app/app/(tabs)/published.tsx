import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { colors, radii, spacing } from '@/constants/theme';
import { useAsync } from '@/lib/useAsync';
import { listContentItemSummaries } from '@/lib/repositories/contentItems';
import { latestMediaThumbnails } from '@/lib/repositories/media';
import { ContentCard } from '@/components/ContentCard';

export default function Published() {
  const [query, setQuery] = useState('');
  const { data: items, loading, reload } = useAsync(() => listContentItemSummaries({ stage: 'published' }), []);
  const { data: thumbnails } = useAsync(() => latestMediaThumbnails((items ?? []).map((i) => i.id)), [items?.map((i) => i.id).join(',')]);

  const filtered = (items ?? []).filter((i) => i.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.navy} />}
    >
      <View style={styles.searchRow}>
        <Feather name="search" size={16} color={colors.textSecondary} />
        <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search published content…" placeholderTextColor={colors.textSecondary} />
      </View>

      {loading && !items && <ActivityIndicator color={colors.navy} style={{ marginTop: 40 }} />}
      {!loading && filtered.length === 0 && <Text style={styles.empty}>Nothing published yet — it'll land here the moment it goes live.</Text>}

      <View style={{ gap: spacing.md }}>
        {filtered.map((item) => (
          <ContentCard key={item.id} item={item} thumb={thumbnails?.get(item.id)} showStage={false} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.textPrimary },
  empty: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', textAlign: 'center', marginTop: 40 }
});
