import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '@/constants/theme';
import { useBookFileUrl } from '@/lib/useBookFileUrl';

/** Small icon-sized thumbnail for a photo attached to a book link or box item. */
export function BookFileThumb({ storagePath, size = 40 }: { storagePath: string; size?: number }) {
  const url = useBookFileUrl(storagePath);
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: theme.radius.sm }]}>
      {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: theme.colors.surfaceMuted, overflow: 'hidden' }
});
