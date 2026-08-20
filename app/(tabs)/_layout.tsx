import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';

export default function TabsLayout() {
  const { session, loading } = useAuth();

  if (!loading && !session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1F3558',
        tabBarInactiveTintColor: '#8B8A84',
        tabBarStyle: {
          backgroundColor: '#FFFDF7',
          borderTopColor: '#E9E2D7',
          height: 68,
          paddingTop: 8,
          paddingBottom: 8
        }
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({color, size}) => <Ionicons name="home-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="drop" options={{ title: 'Drop', tabBarIcon: ({color, size}) => <Ionicons name="add-circle-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="projects" options={{ title: 'Projects', tabBarIcon: ({color, size}) => <Ionicons name="layers-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="decisions" options={{ title: 'Decisions', tabBarIcon: ({color, size}) => <Ionicons name="checkmark-done-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="crm" options={{ title: 'CRM', tabBarIcon: ({color, size}) => <Ionicons name="people-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="catch-up" options={{ href: null }} />
    </Tabs>
  );
}
