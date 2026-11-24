import { Body, Mono } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { theme } from '@/theme';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

type Winner = {
  kind: 'pick' | 'spotted';
  _id: string;
  totalOdds: number;
  legs: number;
  channel?: string;
  profitUnits?: number;
};

/** Horizontal strip of real recent wins. Renders nothing until something has actually won. */
export function WinnersStrip() {
  const q = useQuery({
    queryKey: ['feed', 'winners'],
    queryFn: () => apiGet<{ windowHours: number; items: Winner[] }>('/feed/winners'),
    staleTime: 5 * 60_000,
  });
  const items = q.data?.items ?? [];
  if (!items.length) return null;
  const title = (q.data?.windowHours ?? 36) > 48 ? 'Won this week' : 'Recent winners';

  return (
    <View style={{ marginBottom: theme.space[3] }}>
      <Body style={{ color: theme.textMuted, fontSize: 13, marginBottom: 8 }}>{title}</Body>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {items.map((w) => (
          <Pressable
            key={w._id}
            accessibilityLabel={`Won at ${w.totalOdds.toFixed(2)} odds`}
            onPress={() => (w.kind === 'pick' ? router.push(`/pick/${w._id}`) : undefined)}
            style={{
              minHeight: 44,
              backgroundColor: theme.accentSurface,
              borderColor: theme.accentBorder,
              borderWidth: 1,
              borderRadius: theme.radius.card,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Mono style={{ color: theme.accent, fontSize: 15 }}>WON {w.totalOdds.toFixed(2)}</Mono>
            <Body style={{ fontSize: 12, color: theme.textSecondary }}>
              {w.kind === 'pick' ? 'Verified pick' : (w.channel ?? 'Spotted')} · {w.legs} leg{w.legs === 1 ? '' : 's'}
            </Body>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
