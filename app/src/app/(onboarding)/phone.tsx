import { Body, Button, FooterNote, Screen, Title } from '@/components/ui';
import { apiPost } from '@/lib/api';
import { useSession } from '@/lib/session';
import { theme } from '@/theme';
import type { ApiUser } from '@codedrop/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

export default function PhoneScreen() {
  const [phone, setPhone] = useState('+234');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSession = useSession((s) => s.setSession);

  async function next() {
    setBusy(true);
    setError(null);
    try {
      // Firebase native OTP needs an EAS build. Dev mode logs in by phone against AUTH_MODE=dev.
      const user = await apiPost<ApiUser>('/dev/login', { phone });
      setSession({ userId: user.id, user });
      router.push('/(onboarding)/otp');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title style={{ marginTop: 24 }}>Your number</Title>
      <Body style={{ marginTop: 8 }}>We'll text a code. Dev builds accept the number and skip SMS.</Body>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="+234…"
        placeholderTextColor={theme.textMuted}
        accessibilityLabel="Phone number"
        style={{
          marginTop: 24,
          minHeight: 44,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.borderStrong,
          backgroundColor: theme.surfaceSunken,
          color: theme.text,
          paddingHorizontal: 16,
          fontFamily: theme.font.mono,
          fontSize: 16,
        }}
      />
      {error ? <Body style={{ color: theme.loss, marginTop: 8 }}>{error}</Body> : null}
      <View style={{ marginTop: 24 }}>
        <Button label={busy ? 'Please wait' : 'Send code'} disabled={busy || phone.length < 10} onPress={() => void next()} />
      </View>
      <FooterNote />
    </Screen>
  );
}
