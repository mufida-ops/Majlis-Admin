import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/auth';
import { WorkspaceProvider } from '@/lib/workspace';
import { AlertHost } from '@/lib/alert';

export default function RootLayout() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <StatusBar style="auto" />
        <AlertHost />
        <Stack screenOptions={{ headerShown: false }} />
      </WorkspaceProvider>
    </AuthProvider>
  );
}
