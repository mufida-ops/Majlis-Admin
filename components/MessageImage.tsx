import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { theme } from '@/constants/theme';
import { useMessageImage } from '@/lib/useMessageImage';

export function MessageImage({ storagePath, size = 220 }: { storagePath: string; size?: number }) {
  const url = useMessageImage(storagePath);
  const [viewerOpen, setViewerOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => url && setViewerOpen(true)}
        style={[styles.box, { width: size, height: size, borderRadius: theme.radius.md }]}
      >
        {url ? (
          <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <ActivityIndicator color={theme.colors.navy} />
        )}
      </Pressable>
      <Modal visible={viewerOpen} transparent animationType="fade" onRequestClose={() => setViewerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setViewerOpen(false)}>
          {url ? <Image source={{ uri: url }} style={styles.fullImage} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: theme.colors.surfaceMuted,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center'
  },
  backdrop: { flex: 1, backgroundColor: '#000000dd', alignItems: 'center', justifyContent: 'center' },
  fullImage: { width: '92%', height: '80%' }
});
