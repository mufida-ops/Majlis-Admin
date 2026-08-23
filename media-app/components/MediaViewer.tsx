import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Feather } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { useThumbnail } from '@/lib/useThumbnail';
import type { MediaKind } from '@/types/db';

function VideoPlayerBody({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.play();
  });
  return <VideoView style={StyleSheet.absoluteFill} player={player} allowsFullscreen nativeControls contentFit="contain" />;
}

export function MediaViewer({ visible, storagePath, kind, onClose }: {
  visible: boolean; storagePath: string | null; kind: MediaKind | undefined; onClose: () => void;
}) {
  const url = useThumbnail(visible ? storagePath : null);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} transparent={false}>
      <View style={styles.screen}>
        <Pressable style={styles.closeButton} onPress={onClose} hitSlop={12}>
          <Feather name="x" size={24} color="#FFF" />
        </Pressable>
        {!url ? (
          <ActivityIndicator color="#FFF" />
        ) : kind === 'video' ? (
          <VideoPlayerBody uri={url} />
        ) : kind === 'image' ? (
          <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="contain" />
        ) : (
          <Text style={styles.fallback}>This file type opens outside the app.</Text>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  closeButton: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  fallback: { color: '#FFF', fontSize: 14 }
});
