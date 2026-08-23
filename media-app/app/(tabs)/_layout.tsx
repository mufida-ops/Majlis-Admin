import React, { useEffect } from 'react';
import { Redirect, Tabs, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors } from '@/constants/theme';
import { NotificationBell } from '@/components/NotificationBell';

export default function TabsLayout() {
  const { loading, session } = useAuth();

  if (!loading && !session) return <Redirect href="/(auth)/sign-in" />;
  if (loading) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '700' },
        headerRight: () => (
          <View style={{ flexDirection: 'row', gap: 16, marginRight: 16 }}>
            <Pressable onPress={() => router.push('/search')} hitSlop={10}>
              <Feather name="search" size={20} color={colors.textPrimary} />
            </Pressable>
            <NotificationBell />
          </View>
        ),
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 62, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' }
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="pipeline" options={{ title: 'Pipeline', tabBarIcon: ({ color, size }) => <Feather name="trello" size={size} color={color} /> }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: ({ color, size }) => <Feather name="calendar" size={size} color={color} /> }} />
      <Tabs.Screen name="bank/index" options={{ title: 'Bank', tabBarIcon: ({ color, size }) => <Feather name="folder" size={size} color={color} /> }} />
      <Tabs.Screen name="approvals" options={{ title: 'Approvals', tabBarIcon: ({ color, size }) => <Feather name="check-circle" size={size} color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color, size }) => <Feather name="more-horizontal" size={size} color={color} /> }} />
      <Tabs.Screen name="published" options={{ href: null, title: 'Published' }} />
      <Tabs.Screen name="team" options={{ href: null, title: 'Team' }} />
      <Tabs.Screen name="insights" options={{ href: null, title: 'Insights' }} />
    </Tabs>
  );
}
