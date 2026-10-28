import { Body, Card, Empty, ErrorState, Loading, Screen } from '@/components/ui';
import { apiGet, apiPatch } from '@/lib/api';
import { theme } from '@/theme';
import { useQuery } from '@tanstack/react-query';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useState } from 'react';

export default function Notifications() {
  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiGet<{ items: Array<{ _id: string; title: string; body: string }> }>('/me/notifications'),
  });
  const prefs = useQuery({
    queryKey: ['notif-prefs'],
    queryFn: () => apiGet<Record<string, boolean | number>>('/me/notification-prefs'),
  });
  const [tipsterPick, setTipsterPick] = useState(true);

  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />;

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ flex: 1, color: theme.text, fontFamily: theme.font.uiMed }}>Tipster locks a pick</Text>
          <Switch
            value={Boolean(prefs.data?.tipsterPick ?? tipsterPick)}
            onValueChange={(v) => {
              setTipsterPick(v);
              void apiPatch('/me/notification-prefs', { tipsterPick: v });
            }}
            trackColor={{ true: theme.accentBorder }}
            thumbColor={theme.accent}
          />
        </View>
        {!q.data?.items.length ? (
          <Empty title="No notifications" body="Quiet hours default to 1am–7am." />
        ) : (
          q.data.items.map((n) => (
            <Card key={n._id} style={{ marginBottom: 8 }}>
              <Text style={{ color: theme.text, fontFamily: theme.font.uiSemi }}>{n.title}</Text>
              <Body style={{ marginTop: 4 }}>{n.body}</Body>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
