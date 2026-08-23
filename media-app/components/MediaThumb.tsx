import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { colors, radii } from '@/constants/theme';
import { useThumbnail } from '@/lib/useThumbnail';
import type { MediaKind } from '@/types/db';

export function MediaThumb({
  storagePath, kind, size = 56, radius = radii.md
}: { storagePath: string | null; kind: MediaKind | undefined; size?: number; radius?: number }) {
  const url = useThumbnail(kind === 'image' ? storagePath : null);
  const isVideo = kind === 'video';

  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: radius }]}>
      {url ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={styles.placeholder}>
          <Feather name={isVideo ? 'film' : kind === 'pdf' ? 'file-text' : 'image'} size={size * 0.36} color={colors.gold} />
        </View>
      )}
      {isVideo && (
        <View style={styles.playBadge}>
          <Feather name="play" size={size * 0.22} color="#FFF" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.surfaceMuted, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  playBadge: {
    position: 'absolute', alignSelf: 'center', top: '50%', marginTop: -12,
    backgroundColor: '#00000066', borderRadius: 999, padding: 6
  }
});
