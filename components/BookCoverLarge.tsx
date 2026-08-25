import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { useBookCoverImage } from '@/lib/useBookCoverImage';

/** Full-width book cover for the FS2 list — sized to the image's real (usually A4) proportions instead of cropped to an icon. */
export function BookCoverLarge({ storagePath }: { storagePath: string | null }) {
  const url = useBookCoverImage(storagePath);
  const [aspectRatio, setAspectRatio] = useState(1 / Math.SQRT2);
  const [failed, setFailed] = useState(false);

  if (!storagePath) {
    return (
      <View style={[styles.placeholder, { aspectRatio: 1 / Math.SQRT2 }]}>
        <Ionicons name="image-outline" size={28} color={theme.colors.muted} />
        <Text style={styles.placeholderText}>No cover yet</Text>
      </View>
    );
  }

  if (!url || failed) {
    return (
      <View style={[styles.placeholder, { aspectRatio }]}>
        {!url ? (
          <ActivityIndicator color={theme.colors.navy} />
        ) : (
          <>
            <Ionicons name="alert-circle-outline" size={22} color={theme.colors.muted} />
            <Text style={styles.placeholderText}>Couldn't load cover</Text>
          </>
        )}
      </View>
    );
  }

  return (
    <Image
      source={{ uri: url }}
      style={[styles.image, { aspectRatio }]}
      contentFit="contain"
      onError={() => setFailed(true)}
      onLoad={event => {
        const { width, height } = event.source;
        if (width && height) setAspectRatio(width / height);
      }}
    />
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceMuted },
  placeholder: {
    width: '100%',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  placeholderText: { color: theme.colors.muted, fontSize: 13, fontWeight: '600' }
});
