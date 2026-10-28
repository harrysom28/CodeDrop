import { Body, Button, Card, Empty, ErrorState, Loading, Mono, Screen, Title } from '@/components/ui';
import { apiGet, apiPost } from '@/lib/api';
import { theme } from '@/theme';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

export default function MyBets() {
  const month = new Date().toISOString().slice(0, 7);
  const [tab, setTab] = useState<'open' | 'settled'>('open');
  const [code, setCode] = useState('');
  const summary = useQuery({
    queryKey: ['bets-summary', month],
    queryFn: () =>
      apiGet<{ totalPlNaira: number; singlesPlNaira: number; longAccasPlNaira: number; copiedPlNaira: number; insight: string }>(
        `/me/bets/summary?month=${month}`,
      ),
  });
  const list = useQuery({
    queryKey: ['bets', tab],
    queryFn: () => apiGet<{ items: Array<{ _id: string; code?: string; result: string; stakeNaira: number }> }>(`/me/bets?status=${tab}`),
  });

  if (list.isLoading) return <Loading />;
  if (list.isError) return <ErrorState message={(list.error as Error).message} onRetry={() => void list.refetch()} />;

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Mono style={{ fontSize: 28, color: (summary.data?.totalPlNaira ?? 0) >= 0 ? theme.accent : theme.loss }}>
          ₦{(summary.data?.totalPlNaira ?? 0).toLocaleString('en-NG')}
        </Mono>
        <Body muted>
          Singles ₦{summary.data?.singlesPlNaira ?? 0} · Accas 5+ ₦{summary.data?.longAccasPlNaira ?? 0} · Copied ₦
          {summary.data?.copiedPlNaira ?? 0}
        </Body>
        {summary.data?.insight ? (
          <Card style={{ marginTop: 12, backgroundColor: theme.warnSurface, borderColor: theme.unverifiedBorder }}>
            <Body style={{ color: theme.warn }}>{summary.data.insight}</Body>
          </Card>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <Button label="Open" variant={tab === 'open' ? 'primary' : 'outline'} onPress={() => setTab('open')} />
          <Button label="Settled" variant={tab === 'settled' ? 'primary' : 'outline'} onPress={() => setTab('settled')} />
        </View>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="Add code"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="characters"
          style={{
            marginTop: 12,
            minHeight: 44,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.borderStrong,
            color: theme.text,
            paddingHorizontal: 12,
            fontFamily: theme.font.mono,
            backgroundColor: theme.surfaceSunken,
          }}
        />
        <View style={{ marginTop: 8 }}>
          <Button
            label="Track"
            onPress={async () => {
              await apiPost('/me/bets', { code, bookie: 'sportybet', stakeNaira: 1000, source: 'imported' });
              setCode('');
              void list.refetch();
            }}
          />
        </View>
        {!list.data?.items.length ? (
          <Empty title="No bets" body="Track a code you placed on your own bookie. We never hold the stake." />
        ) : (
          list.data.items.map((b) => (
            <Card key={b._id} style={{ marginTop: 8 }}>
              <Mono>{b.code}</Mono>
              <Body>
                {b.result} · ₦{b.stakeNaira}
              </Body>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
