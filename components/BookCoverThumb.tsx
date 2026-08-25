import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '@/constants/theme';
import { useBookCoverImage } from '@/lib/useBookCoverImage';

/** Small square thumbnail for a book's cover — renders nothing if the book has no cover set. */
export function BookCoverThumb({ storagePath, size = 44 }: { storagePath: string | null; size?: number }) {
  const url = useBookCoverImage(storagePath);
  if (!storagePath) return null;
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: theme.radius.sm }]}>
      {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: theme.colors.surfaceMuted, overflow: 'hidden' }
});
