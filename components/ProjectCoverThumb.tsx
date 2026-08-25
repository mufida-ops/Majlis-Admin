import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '@/constants/theme';
import { useProjectCoverImage } from '@/lib/useProjectCoverImage';

/** Small square thumbnail for a project's cover image on list rows — renders nothing if the project has no cover. */
export function ProjectCoverThumb({ storagePath, size = 44 }: { storagePath: string | null; size?: number }) {
  const url = useProjectCoverImage(storagePath);
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
