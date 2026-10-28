import { Body, Button, Card, ErrorState, Loading, Screen } from '@/components/ui';
import { apiGet, apiPost } from '@/lib/api';
import { theme } from '@/theme';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

export default function MatchRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<'chat' | 'slips' | 'stats'>('chat');
  const [text, setText] = useState('');
  const q = useQuery({
    queryKey: ['room-messages', id],
    queryFn: () => apiGet<{ items: Array<{ _id: string; text?: string; kind: string; agreeCount?: number }> }>(`/rooms/${id}/messages`),
  });

  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />;

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <Body muted>Slow mode is on. Only verified tipsters can post slips here. Hold a message to report.</Body>
        <View style={{ flexDirection: 'row', gap: 8, marginVertical: 12 }}>
          {(['chat', 'slips', 'stats'] as const).map((t) => (
            <Button key={t} label={t} variant={tab === t ? 'primary' : 'outline'} onPress={() => setTab(t)} />
          ))}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {q.data?.items.map((m) => (
          <Pressable
            key={m._id}
            onLongPress={() => void apiPost(`/rooms/messages/${m._id}/report`)}
          >
            <Card style={{ marginBottom: 8 }}>
              <Text style={{ color: theme.text, fontFamily: theme.font.ui }}>{m.text ?? m.kind}</Text>
              <Button label={`Agree ${m.agreeCount ?? 0}`} variant="ghost" onPress={() => void apiPost(`/rooms/messages/${m._id}/agree`)} />
            </Card>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: theme.border }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message"
          placeholderTextColor={theme.textMuted}
          maxLength={500}
          style={{
            flex: 1,
            minHeight: 44,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.borderStrong,
            color: theme.text,
            paddingHorizontal: 12,
            backgroundColor: theme.surfaceSunken,
          }}
        />
        <Button
          label="Send"
          onPress={async () => {
            await apiPost(`/rooms/${id}/messages`, { text });
            setText('');
            void q.refetch();
          }}
        />
      </View>
    </Screen>
  );
}
