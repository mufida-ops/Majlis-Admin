import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/auth';
import { WorkspaceProvider } from '@/lib/workspace';

export default function RootLayout() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </WorkspaceProvider>
    </AuthProvider>
  );
}
