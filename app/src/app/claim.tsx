import { Body, Button, Card, Mono, Screen, Title } from '@/components/ui';
import { apiGet, apiPost } from '@/lib/api';
import { theme } from '@/theme';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

export default function Claim() {
  const [username, setUsername] = useState('');
  const [line, setLine] = useState<string | null>(null);
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen>
      <Title style={{ fontSize: 22 }}>Claim your channel</Title>
      <Body style={{ marginTop: 8 }}>
        Spotted history stays labelled and is never mixed into the leaderboard. Public channels only.
      </Body>
      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="@channel"
        placeholderTextColor={theme.textMuted}
        autoCapitalize="none"
        style={{
          marginTop: 16,
          minHeight: 44,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.borderStrong,
          color: theme.text,
          paddingHorizontal: 12,
          backgroundColor: theme.surfaceSunken,
        }}
      />
      <View style={{ marginTop: 12 }}>
        <Button
          label="Start claim"
          onPress={async () => {
            setError(null);
            try {
              const out = await apiPost<{ verifyLine: string }>(`/channels/${username.replace('@', '')}/claim/start`);
              setLine(out.verifyLine);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      </View>
      {line ? (
        <Card style={{ marginTop: 16 }}>
          <Body>Post this exact line in the channel:</Body>
          <Mono style={{ marginTop: 8 }}>{line}</Mono>
        </Card>
      ) : null}
      <View style={{ marginTop: 12 }}>
        <Button
          label="I've posted it"
          variant="outline"
          onPress={async () => {
            try {
              setRecord(await apiGet(`/me/channel-record`));
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      </View>
      {record ? (
        <Card style={{ marginTop: 12 }}>
          <Body>{String(record.note ?? 'Spotted history')}</Body>
          <Mono style={{ marginTop: 8 }}>Hit rate {record.hitRate != null ? String(record.hitRate) : '—'}</Mono>
        </Card>
      ) : null}
      {error ? <Body style={{ color: theme.loss, marginTop: 8 }}>{error}</Body> : null}
    </Screen>
  );
}
