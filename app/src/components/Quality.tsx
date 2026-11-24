import { Body, Mono } from '@/components/ui';
import { theme } from '@/theme';
import { View } from 'react-native';

export type Quality = {
  tier: 'proven' | 'tracking' | 'new';
  chance: number;
  label: string;
  consistent: boolean;
};

export function chanceText(chance: number) {
  const pct = chance * 100;
  if (pct < 1) return 'under 1% chance';
  return `about ${pct < 10 ? pct.toFixed(1) : Math.round(pct)}% chance`;
}

/** One line under each card: how likely the slip is, and how good its source has been. */
export function QualityLine({ quality }: { quality?: Quality }) {
  if (!quality) return null;
  const tierColor = quality.tier === 'proven' ? theme.accent : quality.tier === 'tracking' ? theme.textSecondary : theme.textMuted;
  return (
    <View style={{ marginTop: 10, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Mono style={{ color: quality.chance >= 0.4 ? theme.accent : quality.chance >= 0.15 ? theme.text : theme.warn, fontSize: 13 }}>
          {chanceText(quality.chance)}
        </Mono>
        {quality.consistent ? (
          <View style={{ backgroundColor: theme.accentSurface, borderRadius: theme.radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Body style={{ color: theme.accent, fontSize: 12 }}>Wins often, pays small</Body>
          </View>
        ) : null}
      </View>
      <Body style={{ color: tierColor, fontSize: 13 }}>{quality.label}</Body>
    </View>
  );
}
