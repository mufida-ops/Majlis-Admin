import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { theme } from '@/constants/theme';
import { useMessageAudioUrl } from '@/lib/useMessageAudio';

export function formatClipDuration(seconds: number | null): string {
  if (seconds == null) return '';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VoiceMessage({ storagePath, durationSeconds }: { storagePath: string; durationSeconds: number | null }) {
  const url = useMessageAudioUrl(storagePath);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  const toggle = async () => {
    if (!url) return;
    if (soundRef.current) {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
      } else {
        await soundRef.current.playFromPositionAsync(0);
        setPlaying(true);
      }
      return;
    }
    setLoading(true);
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true }, status => {
        if (status.isLoaded && status.didJustFinish) setPlaying(false);
      });
      soundRef.current = sound;
      setPlaying(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable onPress={toggle} style={styles.row} disabled={loading || !url}>
      {loading || !url ? (
        <ActivityIndicator color={theme.colors.navy} size="small" style={styles.icon} />
      ) : (
        <Ionicons name={playing ? 'pause-circle' : 'play-circle'} size={34} color={theme.colors.navy} style={styles.icon} />
      )}
      <Text style={styles.duration}>{formatClipDuration(durationSeconds)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  icon: { width: 34, height: 34 },
  duration: { color: theme.colors.text, fontSize: 14, fontWeight: '600' }
});
