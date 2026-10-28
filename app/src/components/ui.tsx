import { theme } from '@/theme';
import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type TextProps,
  View,
  type ViewStyle,
} from 'react-native';

export function Title({ children, style, ...rest }: TextProps) {
  return (
    <Text {...rest} style={[{ fontFamily: theme.font.title, fontSize: 24, color: theme.text }, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, muted, style, ...rest }: TextProps & { muted?: boolean }) {
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: theme.font.ui, fontSize: 14, color: muted ? theme.textMuted : theme.textSecondary, lineHeight: 20 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Mono({ children, style, ...rest }: TextProps) {
  return (
    <Text {...rest} style={[{ fontFamily: theme.font.mono, fontSize: 14, color: theme.text }, style]}>
      {children}
    </Text>
  );
}

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ flex: 1, backgroundColor: theme.bg, paddingHorizontal: theme.gutter }, style]}>{children}</View>;
}

export function Card({ children, dashed, style }: { children: ReactNode; dashed?: boolean; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          backgroundColor: theme.surface,
          borderColor: dashed ? theme.unverifiedBorder : theme.border,
          borderWidth: 1,
          borderStyle: dashed ? 'dashed' : 'solid',
          borderRadius: theme.radius.card,
          padding: theme.space[4],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const bg = variant === 'primary' ? theme.accent : 'transparent';
  const color = variant === 'primary' ? theme.accentOn : theme.text;
  const border = variant === 'outline' ? theme.borderStrong : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: theme.tap,
        borderRadius: theme.radius.card,
        backgroundColor: disabled ? theme.border : bg,
        borderWidth: variant === 'outline' ? 1 : 0,
        borderColor: border,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.space[4],
      }}
    >
      <Text style={{ fontFamily: theme.font.uiSemi, fontSize: 15, color: disabled ? theme.textMuted : color }}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minWidth: theme.tap, minHeight: theme.tap, alignItems: 'center', justifyContent: 'center' }}
    >
      {children}
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.accent} />
    </View>
  );
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.center}>
      <Title style={{ fontSize: 18 }}>{title}</Title>
      {body ? <Body style={{ marginTop: 8, textAlign: 'center' }}>{body}</Body> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Body>{message}</Body>
      {onRetry ? <View style={{ marginTop: 12 }}><Button label="Retry" onPress={onRetry} /></View> : null}
    </View>
  );
}

export function FooterNote() {
  return (
    <Body muted style={{ textAlign: 'center', fontSize: 12, marginVertical: theme.space[4] }}>
      18+ only. Bet with money you can afford to lose.
    </Body>
  );
}

export function TextLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href as never} style={{ fontFamily: theme.font.uiMed, color: theme.accent, fontSize: 14 }}>
      {children}
    </Link>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
