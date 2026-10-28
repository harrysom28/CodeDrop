import { Body, Button, Card, Empty, ErrorState, Loading, Mono, Screen } from '@/components/ui';
import { apiGet, apiPost } from '@/lib/api';
import { track } from '@/lib/analytics';
import { theme } from '@/theme';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

export default function Leaders() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () =>
      apiGet<{
        items: Array<{
          tipsterId: string;
          rank: number;
          adjustedRoi: number;
          settled: number;
          avgClv?: number;
          tipster?: { handle?: string; displayName?: string };
        }>;
      }>('/leaderboard?days=90'),
  });
  const follow = useMutation({
    mutationFn: (id: string) => apiPost(`/follows/${id}`),
    onMutate: () => track('follow'),
    onSettled: () => qc.invalidateQueries({ queryKey: ['leaderboard'] }),
  });

  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />;

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Body muted>
          Ranked on adjusted ROI after 100 settled picks. A lucky weekend cannot jump a long honest record.
        </Body>
        {!q.data?.items.length ? (
          <Empty title="Nobody ranked yet" body="ID-verified tipsters appear after 100 settled locked picks." />
        ) : (
          q.data.items.map((row) => (
            <Pressable key={row.tipsterId} onPress={() => router.push(`/tipster/${row.tipsterId}`)}>
              <Card style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Mono style={{ width: 28, color: theme.accent }}>{row.rank}</Mono>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontFamily: theme.font.uiSemi }}>
                    {row.tipster?.handle ?? row.tipster?.displayName ?? 'tipster'}
                  </Text>
                  <Body muted>
                    {row.settled} picks · CLV {row.avgClv != null ? `${(row.avgClv * 100).toFixed(1)}%` : '—'}
                  </Body>
                </View>
                <Mono style={{ color: theme.accent }}>{(row.adjustedRoi * 100).toFixed(1)}%</Mono>
                <Button label="Follow" variant="outline" onPress={() => follow.mutate(row.tipsterId)} />
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
