import { Body, Button, Card, Mono, Screen, Title } from '@/components/ui';
import { apiPost } from '@/lib/api';
import { theme } from '@/theme';
import { BOOKIE_LABELS, type Bookie } from '@codedrop/shared';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

export default function Convert() {
  const [code, setCode] = useState('');
  const [from, setFrom] = useState<Bookie>('sportybet');
  const [to, setTo] = useState<Bookie>('bet9ja');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setResult(await apiPost('/convert', { code, from, to }));
    } catch (e) {
      setResult(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title style={{ marginTop: 8, fontSize: 22 }}>Convert</Title>
      <TextInput
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        placeholder="Booking code"
        placeholderTextColor={theme.textMuted}
        accessibilityLabel="Booking code"
        style={{
          marginTop: 16,
          minHeight: 44,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.borderStrong,
          backgroundColor: theme.surfaceSunken,
          color: theme.text,
          paddingHorizontal: 16,
          fontFamily: theme.font.mono,
        }}
      />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Button label={BOOKIE_LABELS[from]} variant="outline" onPress={() => setFrom(from === 'sportybet' ? 'bet9ja' : 'sportybet')} />
        <Button
          label="Swap"
          variant="ghost"
          onPress={() => {
            setFrom(to);
            setTo(from);
          }}
        />
        <Button label={BOOKIE_LABELS[to]} variant="outline" onPress={() => setTo(to === 'bet9ja' ? 'msport' : 'bet9ja')} />
      </View>
      <View style={{ marginTop: 16 }}>
        <Button label={busy ? 'Converting' : 'Convert'} disabled={busy || code.length < 4} onPress={() => void run()} />
      </View>
      {error ? <Body style={{ color: theme.loss, marginTop: 12 }}>{error}</Body> : null}
      {result ? (
        <Card style={{ marginTop: 16 }}>
          <Mono>
            {String(result.legsAvailable)} of {String(result.legsTotal)} legs available
          </Mono>
          <Body style={{ marginTop: 8 }}>{String(result.note ?? '')}</Body>
        </Card>
      ) : null}
    </Screen>
  );
}
