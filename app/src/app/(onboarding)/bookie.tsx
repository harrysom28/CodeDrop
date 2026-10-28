import { Body, Button, FooterNote, Screen, Title } from '@/components/ui';
import { apiPost } from '@/lib/api';
import { track } from '@/lib/analytics';
import { useSession } from '@/lib/session';
import { theme } from '@/theme';
import { BOOKIE_LABELS, type ApiUser, type Bookie } from '@codedrop/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

const GRID: Bookie[] = ['sportybet', 'bet9ja', 'betking', 'msport', 'betway', '1xbet'];

export default function BookieScreen() {
  const { clubs } = useLocalSearchParams<{ clubs?: string }>();
  const [bookie, setBookie] = useState<Bookie>('sportybet');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSession = useSession((s) => s.setSession);

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const favouriteClubs = (clubs ?? '').split(',').filter(Boolean);
      const user = await apiPost<ApiUser>('/me/onboarding', {
        over18Confirmed: true,
        favouriteClubs,
        mainBookie: bookie,
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
      <Title style={{ marginTop: 24 }}>Your bookie</Title>
      <Body style={{ marginTop: 8 }}>We never take a stake. Copy codes into the app you already use.</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
        {GRID.map((b) => {
          const on = bookie === b;
          return (
            <Pressable
              key={b}
              onPress={() => setBookie(b)}
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
      {error ? <Body style={{ color: theme.loss, marginTop: 8 }}>{error}</Body> : null}
      <View style={{ marginTop: 24 }}>
        <Button label={busy ? 'Saving' : 'Show my feed'} disabled={busy} onPress={() => void finish()} />
      </View>
      <FooterNote />
    </Screen>
  );
}
