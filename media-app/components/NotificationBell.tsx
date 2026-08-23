import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { unreadCount } from '@/lib/repositories/notifications';
import { useAsync } from '@/lib/useAsync';
import { colors } from '@/constants/theme';

export function NotificationBell() {
  const { session } = useAuth();
  const { data } = useAsync(async () => (session ? unreadCount(session.user.id) : 0), [session?.user.id]);

  return (
    <Pressable onPress={() => router.push('/notifications')} hitSlop={10} style={{ position: 'relative' }}>
      <Feather name="bell" size={20} color={colors.textPrimary} />
      {!!data && data > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{data > 9 ? '9+' : data}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute', top: -6, right: -8, backgroundColor: colors.danger, borderRadius: 999,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '700' }
});
