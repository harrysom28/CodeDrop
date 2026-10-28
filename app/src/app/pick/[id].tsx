import { Badge, badgeFromVerification } from '@/components/Badge';
import { Body, Button, Card, ErrorState, Loading, Mono, Screen, Title } from '@/components/ui';
import { apiGet, apiPost } from '@/lib/api';
import { track } from '@/lib/analytics';
import { useSession } from '@/lib/session';
import { theme } from '@/theme';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';

export default function SlipDetail() {
  const { id, copy } = useLocalSearchParams<{ id: string; copy?: string }>();
  const unit = useSession((s) => s.user?.unitNaira ?? 1000);
  const [sheet, setSheet] = useState(copy === '1');
  const q = useQuery({
    queryKey: ['pick', id],
    queryFn: () => apiGet<Record<string, unknown>>(`/picks/${id}`),
  });

  useEffect(() => {
    if (copy === '1') {
      setSheet(true);
      track('copy_opened', { id });
    }
  }, [copy, id]);

  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />;
  const p = q.data ?? {};
  const legs = (p.legs as Array<Record<string, unknown>>) ?? [];
  const kickoff = p.firstKickoff ? new Date(String(p.firstKickoff)) : null;
  const closed = kickoff ? kickoff.getTime() <= Date.now() : false;

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Badge kind={badgeFromVerification(String(p.verification ?? 'pick'))} />
        <Title style={{ marginTop: 12, fontSize: 22 }}>{String(p.result ?? 'pending').toUpperCase()}</Title>
        <Mono style={{ marginTop: 8 }}>{Number(p.totalOdds ?? 0).toFixed(2)} odds</Mono>
        {legs.map((l, i) => (
          <Card key={i} style={{ marginTop: 8 }}>
            <Text style={{ color: theme.text, fontFamily: theme.font.uiMed }}>
              {String(l.homeTeam)} vs {String(l.awayTeam)}
            </Text>
            <Body>
              {String(l.market)} · {String(l.selection)}
            </Body>
            <Mono>{Number(l.odds ?? 0).toFixed(2)}</Mono>
          </Card>
        ))}
        <Body muted style={{ marginTop: 12 }}>
          Locked {p.lockedAt ? new Date(String(p.lockedAt)).toLocaleString() : ''} ·{' '}
          <Text onPress={() => router.push(`/proof/${id}`)} style={{ color: theme.accent }}>
            proof
          </Text>
        </Body>
        <View style={{ marginTop: 16 }}>
          <Button
            label={closed ? 'Copy closed · games started' : 'Copy'}
            disabled={closed}
            onPress={() => {
              setSheet(true);
              track('copy_opened', { id });
            }}
          />
        </View>
      </ScrollView>
      <Modal visible={sheet} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }}>
          <View style={{ backgroundColor: theme.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}>
            <Title style={{ fontSize: 18 }}>Copy this slip</Title>
            <View style={{ backgroundColor: theme.warnSurface, borderRadius: 12, padding: 12, marginTop: 12 }}>
              <Body style={{ color: theme.warn }}>Odds can move. You're copying the current bookie price, not a guarantee.</Body>
            </View>
            <Mono style={{ marginTop: 12 }}>Suggested stake ₦{unit.toLocaleString('en-NG')} (1u)</Mono>
            <View style={{ marginTop: 16, gap: 8 }}>
              <Button
                label="Copy & track"
                onPress={async () => {
                  await apiPost(`/picks/${id}/copy`, { bookie: 'sportybet', stakeNaira: unit });
                  track('copy_completed', { id });
                  setSheet(false);
                }}
              />
              <Button label="Close" variant="outline" onPress={() => setSheet(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
