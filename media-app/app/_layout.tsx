import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/auth';
import { colors } from '@/constants/theme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="content/[id]"
          options={{ headerShown: true, title: '', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.navy }}
        />
        <Stack.Screen name="content/new" options={{ headerShown: true, title: 'New idea' }} />
        <Stack.Screen name="content/batch-add" options={{ headerShown: true, title: 'Batch add' }} />
        <Stack.Screen name="bank/[id]" options={{ headerShown: true, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.navy }} />
        <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notifications' }} />
        <Stack.Screen name="admin/campaigns-tags" options={{ headerShown: true, title: 'Campaigns & Tags' }} />
        <Stack.Screen name="admin/team" options={{ headerShown: true, title: 'Manage Roles' }} />
        <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
        <Stack.Screen name="search" options={{ headerShown: true, title: 'Search' }} />
      </Stack>
    </AuthProvider>
  );
}
