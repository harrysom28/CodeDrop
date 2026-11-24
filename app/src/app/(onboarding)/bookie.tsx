import { Body, Button, FooterNote, Screen, Title } from '@/components/ui';
import { apiPost } from '@/lib/api';
import { track } from '@/lib/analytics';
import { useSession } from '@/lib/session';
import { theme } from '@/theme';
import { BOOKIES, BOOKIE_LABELS, type ApiUser, type Bookie } from '@codedrop/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

const GRID: Bookie[] = [...BOOKIES];

export default function BookieScreen() {
  const { clubs } = useLocalSearchParams<{ clubs?: string }>();
  const [bookies, setBookies] = useState<Bookie[]>(['sportybet']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSession = useSession((s) => s.setSession);

  function toggle(b: Bookie) {
    setBookies((prev) => {
      if (prev.includes(b)) return prev.length === 1 ? prev : prev.filter((x) => x !== b);
      return [...prev, b];
    });
  }

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const favouriteClubs = (clubs ?? '').split(',').filter(Boolean);
      const user = await apiPost<ApiUser>('/me/onboarding', {
        over18Confirmed: true,
        favouriteClubs,
        favouriteBookies: bookies,
        mainBookie: bookies[0],
        unitNaira: 1000,
      });
      setSession({ user });
      track('onboarding_completed');
      router.replace('/(tabs)');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title style={{ marginTop: 24 }}>Your bookies</Title>
      <Body style={{ marginTop: 8 }}>
        Pick every app you use. We never take a stake — you copy codes into them yourself.
      </Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
        {GRID.map((b) => {
          const on = bookies.includes(b);
          return (
            <Pressable
              key={b}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => toggle(b)}
              style={{
                width: '48%',
                minHeight: 56,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: on ? theme.accentBorder : theme.border,
                backgroundColor: on ? theme.accentSurface : theme.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: on ? theme.accent : theme.text, fontFamily: theme.font.uiSemi }}>{BOOKIE_LABELS[b]}</Text>
            </Pressable>
          );
        })}
      </View>
      <Body muted style={{ marginTop: 12 }}>
        {bookies.length} selected
      </Body>
      {error ? <Body style={{ color: theme.loss, marginTop: 8 }}>{error}</Body> : null}
      <View style={{ marginTop: 24 }}>
        <Button label={busy ? 'Saving' : 'Show my feed'} disabled={busy || bookies.length === 0} onPress={() => void finish()} />
      </View>
      <FooterNote />
    </Screen>
  );
}
