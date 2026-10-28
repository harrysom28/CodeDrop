import { theme } from '@/theme';
import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        contentStyle: { backgroundColor: theme.bg },
        headerShadowVisible: false,
      }}
    />
  );
}
