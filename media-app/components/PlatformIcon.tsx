import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import type { PlatformName } from '@/types/db';

const ICON: Record<PlatformName, keyof typeof Ionicons.glyphMap> = {
  instagram: 'logo-instagram',
  tiktok: 'logo-tiktok',
  linkedin: 'logo-linkedin'
};

export function PlatformIcon({ platform, size = 16, muted = false }: { platform: PlatformName; size?: number; muted?: boolean }) {
  return <Ionicons name={ICON[platform]} size={size} color={muted ? colors.textSecondary + '80' : colors[platform]} />;
}

export function PlatformRow({ platforms, size = 14 }: { platforms: PlatformName[]; size?: number }) {
  if (platforms.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {platforms.map((p) => <PlatformIcon key={p} platform={p} size={size} />)}
    </View>
  );
}
