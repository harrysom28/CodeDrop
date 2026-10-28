import { theme } from '@/theme';
import { useSession } from '@/lib/session';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Archivo_800ExtraBold,
  useFonts as useArchivo,
} from '@expo-google-fonts/archivo';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  useFonts as usePlex,
} from '@expo-google-fonts/ibm-plex-sans';
import {
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
  useFonts as useMono,
} from '@expo-google-fonts/ibm-plex-mono';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [client] = useState(() => new QueryClient());
  const [a] = useArchivo({ Archivo_800ExtraBold });
  const [p] = usePlex({ IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold });
  const [m] = useMono({ IBMPlexMono_500Medium, IBMPlexMono_600SemiBold });
  const hydrated = useSession((s) => s.hydrated);
  const ready = a && p && m && hydrated;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.bg }}>
      <QueryClientProvider client={client}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.bg },
            headerTintColor: theme.text,
            headerTitleStyle: { fontFamily: theme.font.uiSemi },
            contentStyle: { backgroundColor: theme.bg },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
          <Stack.Screen name="post" options={{ title: 'Post a pick' }} />
          <Stack.Screen name="pick/[id]" options={{ title: 'Slip' }} />
          <Stack.Screen name="tipster/[id]" options={{ title: 'Tipster' }} />
          <Stack.Screen name="bets" options={{ title: 'My bets' }} />
          <Stack.Screen name="claim" options={{ title: 'Claim your profile' }} />
          <Stack.Screen name="badge" options={{ title: 'Verification' }} />
          <Stack.Screen name="limits" options={{ title: 'Limits & take a break' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="room/[id]" options={{ title: 'Room' }} />
          <Stack.Screen name="proof/[id]" options={{ title: 'Proof' }} />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
