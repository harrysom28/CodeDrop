import { Badge, badgeFromVerification } from '@/components/Badge';
import { QualityLine, type Quality } from '@/components/Quality';
import { Body, Button, Card, Mono } from '@/components/ui';
import { theme } from '@/theme';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export function PickCard({
  pick,
  onCopy,
  lowData,
}: {
  pick: Record<string, unknown>;
  onCopy?: () => void;
  lowData?: boolean;
}) {
  const id = String(pick._id ?? pick.id ?? '');
  const result = String(pick.result ?? 'pending');
  const odds = Number(pick.totalOdds ?? 0);
  const copies = Number(pick.copyCount ?? 0);
  const kickoff = pick.firstKickoff ? new Date(String(pick.firstKickoff)) : null;
  const started = kickoff ? kickoff.getTime() <= Date.now() : false;
  const verification = badgeFromVerification(String(pick.verification ?? 'pick'));
  const profit = Number(pick.profitUnits ?? 0);
  const closed = result !== 'pending';

  return (
    <Pressable onPress={() => id && router.push(`/pick/${id}`)}>
      <Card style={{ marginBottom: theme.space[3] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: theme.font.uiSemi, color: theme.text, fontSize: 15 }}>
            {String(pick.tipsterHandle ?? 'Tipster')}
          </Text>
          <Badge kind={verification} />
        </View>
        {closed ? (
          <Mono style={{ marginTop: 8, color: profit >= 0 ? theme.accent : theme.loss, fontSize: 18 }}>
            {result.toUpperCase()} {profit >= 0 ? '+' : ''}
            {profit.toFixed(1)}u
          </Mono>
        ) : (
          <Mono style={{ marginTop: 8, color: theme.textMuted, fontSize: 12 }}>
            {odds.toFixed(2)} odds · {copies} copies
          </Mono>
        )}
        {!lowData && Array.isArray(pick.legs)
          ? (pick.legs as Array<{ homeTeam?: string; awayTeam?: string; selection?: string; odds?: number }>)
              .slice(0, 4)
              .map((l, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <Body style={{ flex: 1 }}>{l.homeTeam} vs {l.awayTeam}</Body>
                  <Mono style={{ color: theme.textMuted }}>{Number(l.odds ?? 0).toFixed(2)}</Mono>
                </View>
              ))
          : null}
        {!closed ? <QualityLine quality={pick.quality as Quality | undefined} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 }}>
          <View style={{ flex: 1 }}>
            {started ? (
              <Body muted>Copy closed · games started</Body>
            ) : (
              <Body muted>{kickoff ? countdown(kickoff) : ''}</Body>
            )}
          </View>
          <Button
            label="Copy"
            disabled={started || closed}
            onPress={() => {
              onCopy?.();
              if (id) router.push(`/pick/${id}?copy=1`);
            }}
          />
        </View>
      </Card>
    </Pressable>
  );
}

export function SpottedCard({ item, lowData }: { item: Record<string, unknown>; lowData?: boolean }) {
  const sighting = (item.firstSighting ?? {}) as { channel?: string; url?: string; code?: string; bookie?: string };
  const slip = (item.slip ?? {}) as {
    code?: string;
    legs?: Array<{ homeTeam?: string; awayTeam?: string; selection?: string; odds?: number }>;
  };
  const legs = Array.isArray(slip.legs) ? slip.legs : [];
  const odds = Number(item.totalOdds ?? 0);
  const others = Number(item.alsoPostedBy ?? 0);
  const kickoff = item.firstKickoff ? new Date(String(item.firstKickoff)) : null;
  return (
    <Card dashed style={{ marginBottom: theme.space[3] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Body style={{ flex: 1 }}>
          {String(sighting.channel ?? 'channel')}
          {others > 0 ? ` · +${others} other channel${others === 1 ? '' : 's'}` : ''}
        </Body>
        <Badge kind="unverified" />
      </View>
      <View
        style={{
          backgroundColor: theme.surfaceSunken,
          borderRadius: 12,
          padding: 12,
          marginTop: 10,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View>
          <Body muted style={{ fontSize: 13 }}>
            {String(sighting.bookie ?? 'Booking')} code · {legs.length} leg{legs.length === 1 ? '' : 's'}
          </Body>
          <Mono style={{ fontSize: 18 }}>{String(slip.code ?? sighting.code ?? '')}</Mono>
        </View>
        <Mono style={{ fontSize: 16 }}>{odds ? odds.toFixed(2) : ''}</Mono>
      </View>
      {!lowData
        ? legs.slice(0, 3).map((l, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Body style={{ flex: 1 }}>
                {l.homeTeam} vs {l.awayTeam}
                {l.selection ? ` · ${l.selection}` : ''}
              </Body>
              <Mono style={{ color: theme.textMuted }}>{Number(l.odds ?? 0).toFixed(2)}</Mono>
            </View>
          ))
        : null}
      {!lowData && legs.length > 3 ? <Body muted style={{ marginTop: 4 }}>+{legs.length - 3} more legs</Body> : null}
      <QualityLine quality={item.quality as Quality | undefined} />
      {kickoff ? <Body muted style={{ marginTop: 6 }}>{countdown(kickoff)}</Body> : null}
    </Card>
  );
}

function countdown(d: Date) {
  const mins = Math.max(0, Math.round((d.getTime() - Date.now()) / 60000));
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m to kickoff`;
  return `${mins}m to kickoff`;
}
