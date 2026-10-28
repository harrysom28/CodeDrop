import { theme } from '@/theme';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function Label({ name, focused }: { name: string; focused: boolean }) {
  return (
    <Text style={{ fontFamily: theme.font.uiMed, fontSize: 12, color: focused ? theme.accent : theme.textMuted }}>
      {name}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          minHeight: 56,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Feed', tabBarLabel: ({ focused }) => <Label name="Feed" focused={focused} /> }} />
      <Tabs.Screen name="rooms" options={{ title: 'Rooms', tabBarLabel: ({ focused }) => <Label name="Rooms" focused={focused} /> }} />
      <Tabs.Screen name="leaders" options={{ title: 'Leaders', tabBarLabel: ({ focused }) => <Label name="Leaders" focused={focused} /> }} />
      <Tabs.Screen name="convert" options={{ title: 'Convert', tabBarLabel: ({ focused }) => <Label name="Convert" focused={focused} /> }} />
      <Tabs.Screen name="me" options={{ title: 'Me', tabBarLabel: ({ focused }) => <Label name="Me" focused={focused} /> }} />
    </Tabs>
  );
}
