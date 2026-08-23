import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radii, spacing } from '@/constants/theme';
import { useAsync } from '@/lib/useAsync';
import { globalSearch } from '@/lib/repositories/search';
import { latestMediaThumbnails } from '@/lib/repositories/media';
import { ContentCard } from '@/components/ContentCard';
import { router } from 'expo-router';
import { MediaThumb } from '@/components/MediaThumb';
import { Pressable } from 'react-native';

export default function Search() {
  const [query, setQuery] = useState('');
  const { data, loading } = useAsync(() => globalSearch(query), [query]);
  const { data: thumbnails } = useAsync(
    () => latestMediaThumbnails((data?.contentItems ?? []).map((i) => i.id)),
    [data?.contentItems.map((i) => i.id).join(',')]
  );

  return (
    <View style={styles.screen}>
      <View style={styles.searchRow}>
        <TextInput
          autoFocus
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search titles, campaigns, tags, captions, filenames…"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      {loading && <ActivityIndicator color={colors.navy} style={{ marginTop: 24 }} />}

      <ScrollView contentContainerStyle={styles.content}>
        {!!query && (data?.contentItems.length ?? 0) === 0 && (data?.mediaAssets.length ?? 0) === 0 && !loading && (
          <Text style={styles.empty}>Nothing found for "{query}".</Text>
        )}

        {(data?.contentItems.length ?? 0) > 0 && (
          <View style={{ gap: spacing.md }}>
            <Text style={styles.sectionLabel}>Content</Text>
            {(data?.contentItems as any[]).map((item) => (
              <ContentCard key={item.id} item={{ ...item, owner: null, campaign: null, content_type: null, platform_posts: [] }} thumb={thumbnails?.get(item.id)} />
            ))}
          </View>
        )}

        {(data?.mediaAssets.length ?? 0) > 0 && (
          <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
            <Text style={styles.sectionLabel}>Media</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
              {data?.mediaAssets.map((a) => (
                <Pressable key={a.id} onPress={() => router.push(a.is_bank_item ? `/bank/${a.id}` : `/content/${a.content_item_id}`)}>
                  <MediaThumb storagePath={null} kind={a.kind} size={90} />
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  searchRow: { padding: spacing.lg },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
  empty: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', textAlign: 'center', marginTop: 24 }
});
