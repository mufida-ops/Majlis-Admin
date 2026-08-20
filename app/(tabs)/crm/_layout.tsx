import { Stack } from 'expo-router';
import { theme } from '@/constants/theme';

export default function CrmLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="[id]"
        options={{
          headerShown: true,
          title: 'Organisation',
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.navy
        }}
      />
    </Stack>
  );
}
