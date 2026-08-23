import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { spacing } from '@/constants/theme';
import { PLATFORMS } from '@/types/db';
import type { ContentItem } from '@/types/db';
import { PlatformCard } from './PlatformCard';
import { useAsync } from '@/lib/useAsync';
import { getPlatformConnections } from '@/lib/repositories/platformPosts';

export function PlatformsTab({ item, canEdit, isAdmin }: { item: ContentItem; canEdit: boolean; isAdmin: boolean }) {
  const { data: connections } = useAsync(() => getPlatformConnections(), []);
  const isConnected = (p: string) => !!connections?.find((c: any) => c.platform === p)?.is_connected;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {PLATFORMS.map((platform) => (
        <View key={platform} style={{ marginBottom: spacing.lg }}>
          <PlatformCard contentItem={item} platform={platform} canEdit={canEdit} isAdmin={isAdmin} isConnected={isConnected(platform)} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 120 }
});
