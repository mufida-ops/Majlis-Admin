import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '@/constants/theme';
import { useMessageImage } from '@/lib/useMessageImage';

export function MessageImage({ storagePath, size = 220 }: { storagePath: string; size?: number }) {
  const url = useMessageImage(storagePath);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => url && !failed && setViewerOpen(true)}
        style={[styles.box, { width: size, height: size, borderRadius: theme.radius.md }]}
      >
        {url && !failed ? (
          <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" onError={() => setFailed(true)} />
        ) : url && failed ? (
          <Text style={styles.failedText}>Couldn't load photo</Text>
        ) : (
          <ActivityIndicator color={theme.colors.navy} />
        )}
      </Pressable>
      <Modal visible={viewerOpen} transparent animationType="fade" onRequestClose={() => setViewerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setViewerOpen(false)}>
          {url ? <Image source={{ uri: url }} style={styles.fullImage} contentFit="contain" /> : null}
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
  failedText: { color: theme.colors.muted, fontSize: 12, textAlign: 'center', paddingHorizontal: 8 },
  backdrop: { flex: 1, backgroundColor: '#000000dd', alignItems: 'center', justifyContent: 'center' },
  fullImage: { width: '92%', height: '80%' }
});
