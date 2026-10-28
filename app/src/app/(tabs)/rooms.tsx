import { Body, Card, Empty, ErrorState, Loading, Screen, Title } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { track } from '@/lib/analytics';
import { theme } from '@/theme';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, ScrollView } from 'react-native';

export default function RoomsList() {
  const q = useQuery({
    queryKey: ['rooms'],
    queryFn: () => apiGet<{ items: Array<{ _id: string; title: string; kind: string }> }>('/rooms'),
  });

  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />;
  if (!q.data?.items.length) return <Empty title="No rooms yet" body="Match rooms open an hour before kickoff." />;

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {q.data.items.map((r) => (
          <Pressable
            key={r._id}
            onPress={() => {
              track('room_joined', { id: r._id });
              router.push(`/room/${r._id}`);
            }}
          >
            <Card style={{ marginBottom: 10 }}>
              <Title style={{ fontSize: 16 }}>{r.title}</Title>
              <Body muted style={{ marginTop: 4, textTransform: 'capitalize' }}>{r.kind}</Body>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
