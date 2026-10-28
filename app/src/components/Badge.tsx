import { theme } from '@/theme';
import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

export type BadgeKind = 'stake' | 'receipt' | 'pick' | 'unverified';

const COPY: Record<BadgeKind, { label: string; bg: string; color: string; dashed?: boolean }> = {
  stake: { label: 'STAKE VERIFIED', bg: theme.accent, color: theme.accentOn },
  receipt: { label: 'RECEIPT VERIFIED', bg: theme.accentSurface, color: theme.accent },
  pick: { label: 'PICK VERIFIED', bg: theme.pickVerified, color: theme.textSecondary },
  unverified: {
    label: 'UNVERIFIED',
    bg: theme.warnSurface,
    color: theme.warn,
    dashed: true,
  },
};

export function Badge({ kind }: { kind: BadgeKind }) {
  const c = COPY[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${c.label}. Opens explainer.`}
      onPress={() => router.push('/badge')}
      style={{
        alignSelf: 'flex-start',
        backgroundColor: c.bg,
        borderRadius: theme.radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 6,
        minHeight: 28,
        borderWidth: c.dashed ? 1 : 0,
        borderStyle: c.dashed ? 'dashed' : 'solid',
        borderColor: c.dashed ? theme.unverifiedBorder : 'transparent',
      }}
    >
      <Text style={{ fontFamily: theme.font.uiSemi, fontSize: 11, letterSpacing: 0.4, color: c.color }}>{c.label}</Text>
    </Pressable>
  );
}

export function badgeFromVerification(v?: string): BadgeKind {
  if (v === 'stake') return 'stake';
  if (v === 'receipt') return 'receipt';
  if (v === 'unverified') return 'unverified';
  return 'pick';
}
