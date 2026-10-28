import { Body, Button, Card, Mono, Screen, Title } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { useSession } from '@/lib/session';
import { theme } from '@/theme';
import type { ApiUser } from '@codedrop/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

export default function Me() {
  const sessionUser = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const me = useQuery({ queryKey: ['me'], queryFn: () => apiGet<ApiUser>('/me'), initialData: sessionUser ?? undefined });
  const wallet = useQuery({
    queryKey: ['wallet'],
    queryFn: () => apiGet<{ balanceNaira: number; note: string }>('/me/wallet'),
  });
  const bets = useQuery({
    queryKey: ['bets', 'open'],
    queryFn: () => apiGet<{ items: unknown[] }>('/me/bets?status=open'),
  });

  const u = me.data;

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Title>{u?.displayName ?? u?.handle ?? 'You'}</Title>
        <Body muted>@{u?.handle ?? 'set-a-handle'}</Body>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <Card style={{ flex: 1 }}>
            <Body muted>My ROI</Body>
            <Mono style={{ fontSize: 18, marginTop: 4 }}>—</Mono>
          </Card>
          <Card style={{ flex: 1 }}>
            <Body muted>My bets</Body>
            <Mono style={{ fontSize: 18, marginTop: 4 }}>{bets.data?.items.length ?? 0} open</Mono>
            <View style={{ marginTop: 8 }}>
              <Button label="Open" variant="outline" onPress={() => router.push('/bets')} />
            </View>
          </Card>
        </View>
        <Card style={{ marginTop: 12 }}>
          <Body muted>Wallet</Body>
          <Mono style={{ fontSize: 22, marginTop: 4 }}>₦{(wallet.data?.balanceNaira ?? 0).toLocaleString('en-NG')}</Mono>
          <Body style={{ marginTop: 8 }}>{wallet.data?.note ?? 'For subscriptions and tipster earnings. Never holds bet stakes.'}</Body>
        </Card>
        <View style={{ gap: 8, marginTop: 16 }}>
          <Button label="Settings" variant="outline" onPress={() => router.push('/settings')} />
          <Button label="Limits & take a break" variant="outline" onPress={() => router.push('/limits')} />
          <Button label="Claim your profile" variant="outline" onPress={() => router.push('/claim')} />
          <Button
            label="Sign out"
            variant="ghost"
            onPress={() => {
              signOut();
              router.replace('/(onboarding)/phone');
            }}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
