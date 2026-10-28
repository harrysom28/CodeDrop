import { Body, Button, Card, ErrorState, Loading, Mono, Screen, Title } from '@/components/ui';
import { apiGet, apiPost } from '@/lib/api';
import { track } from '@/lib/analytics';
import { theme } from '@/theme';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

export default function TipsterProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({
    queryKey: ['tipster', id],
    queryFn: () =>
      apiGet<{
        tipster: { handle?: string; displayName?: string; idVerified?: boolean };
        score: { profitUnits?: number; roi?: number; avgClv?: number; settled?: number; maxDrawdownUnits?: number; picksToRank?: number } | null;
        followers: number;
        isFollowing: boolean;
      }>(`/tipsters/${id}`),
  });

  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />;
  const t = q.data!.tipster;
  const s = q.data!.score;

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Title>{t.displayName ?? t.handle ?? 'Tipster'}</Title>
        <Body muted>
          {q.data!.followers} followers {t.idVerified ? '· ID VERIFIED' : ''}
        </Body>
        <View style={{ marginTop: 12 }}>
          <Button
            label={q.data!.isFollowing ? 'Following' : 'Follow'}
            onPress={() => {
              track('follow', { id });
              void apiPost(`/follows/${id}`);
              void q.refetch();
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {[
            ['Profit', s ? `${s.profitUnits}u` : '—'],
            ['ROI', s ? `${((s.roi ?? 0) * 100).toFixed(1)}%` : '—'],
            ['Beat close', s?.avgClv != null ? `${(s.avgClv * 100).toFixed(1)}%` : '—'],
            ['Picks', String(s?.settled ?? 0)],
            ['Worst run', s ? `${s.maxDrawdownUnits}u` : '—'],
            ['To rank', String(s?.picksToRank ?? 100)],
          ].map(([k, v]) => (
            <Card key={k} style={{ width: '48%' }}>
              <Body muted>{k}</Body>
              <Mono style={{ marginTop: 4 }}>{v}</Mono>
            </Card>
          ))}
        </View>
        <Body muted style={{ marginTop: 16 }}>
          Every pick locked on-chain before kickoff · Audit record
        </Body>
        <Card style={{ marginTop: 12, backgroundColor: theme.accentSurface, borderColor: theme.accentBorder }}>
          <Body>VIP stays in escrow for the month. Positive verified month pays the tipster minus the platform fee. Negative month refunds 50%.</Body>
        </Card>
      </ScrollView>
    </Screen>
  );
}
