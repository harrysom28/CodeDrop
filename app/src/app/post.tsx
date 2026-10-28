import { Body, Button, Card, Mono, Screen } from '@/components/ui';
import { apiGet, apiPost } from '@/lib/api';
import { track } from '@/lib/analytics';
import { theme } from '@/theme';
import { BOOKIE_LABELS, type Bookie } from '@codedrop/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

export default function PostPick() {
  const [code, setCode] = useState('');
  const [bookie, setBookie] = useState<Bookie>('sportybet');
  const [stake, setStake] = useState(1);
  const [note, setNote] = useState('');
  const [vip, setVip] = useState(false);
  const [legs, setLegs] = useState<unknown[] | null>(null);
  const [odds, setOdds] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function preview() {
    setError(null);
    try {
      const slip = await apiGet<{ legs: unknown[]; totalOdds?: number }>(`/picks/preview/${bookie}/${code}`);
      setLegs(slip.legs);
      const total = (slip.legs as Array<{ odds: number }>).reduce((a, l) => a * l.odds, 1);
      setOdds(total);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function lock() {
    setError(null);
    try {
      await apiPost('/picks', { code, bookie, stakeUnits: stake, note, visibility: vip ? 'vip' : 'public' });
      track('pick_locked');
      setConfirm(false);
      router.back();
    } catch (e) {
      setConfirm(false);
      setError((e as Error).message);
    }
  }

  return (
    <Screen>
      <Title style={{ fontSize: 22 }}>Lock a pick</Title>
      <Body muted style={{ marginTop: 6 }}>Hashed and timestamped. It can't be edited after lock.</Body>
      <TextInput
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        placeholder="Booking code"
        placeholderTextColor={theme.textMuted}
        style={input}
      />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        {(['sportybet', 'bet9ja', 'betking'] as Bookie[]).map((b) => (
          <Button key={b} label={BOOKIE_LABELS[b]} variant={bookie === b ? 'primary' : 'outline'} onPress={() => setBookie(b)} />
        ))}
      </View>
      <View style={{ marginTop: 12 }}>
        <Button label="Load legs" onPress={() => void preview()} />
      </View>
      {legs ? (
        <Card style={{ marginTop: 12 }}>
          <Mono>{odds?.toFixed(2)} total odds · {legs.length} legs</Mono>
        </Card>
      ) : null}
      <Body style={{ marginTop: 16 }}>Stake</Body>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        {[0.5, 1, 2, 5].map((u) => (
          <Pressable
            key={u}
            onPress={() => setStake(u)}
            style={{
              minHeight: 44,
              paddingHorizontal: 14,
              borderRadius: 999,
              backgroundColor: stake === u ? theme.accent : theme.surface,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: stake === u ? theme.accentOn : theme.text, fontFamily: theme.font.mono }}>{u}u</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={note}
        onChangeText={setNote}
        maxLength={500}
        placeholder="Optional reason"
        placeholderTextColor={theme.textMuted}
        style={[input, { marginTop: 12 }]}
      />
      <View style={{ marginTop: 12 }}>
        <Button label={vip ? 'VIP only' : 'Everyone'} variant="outline" onPress={() => setVip((v) => !v)} />
      </View>
      {error ? <Body style={{ color: theme.loss, marginTop: 8 }}>{error}</Body> : null}
      <View style={{ marginTop: 16 }}>
        <Button label="Lock pick" disabled={!code} onPress={() => setConfirm(true)} />
      </View>
      <Modal visible={confirm} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 }}>
          <Card>
            <Title style={{ fontSize: 18 }}>This can't be edited or deleted.</Title>
            <Body style={{ marginTop: 8 }}>Lock only before kickoff. Fake or late picks are not counted.</Body>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <View style={{ flex: 1 }}>
                <Button label="Cancel" variant="outline" onPress={() => setConfirm(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Lock" onPress={() => void lock()} />
              </View>
            </View>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

const input = {
  marginTop: 16,
  minHeight: 44,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: theme.borderStrong,
  backgroundColor: theme.surfaceSunken,
  color: theme.text,
  paddingHorizontal: 16,
  fontFamily: theme.font.ui,
} as const;
