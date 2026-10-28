import { Body, Button, Screen, Title } from '@/components/ui';
import { apiPost } from '@/lib/api';
import { theme } from '@/theme';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

export default function Limits() {
  const [limit, setLimit] = useState('50000');
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <Screen>
      <Title style={{ fontSize: 22 }}>Limits & take a break</Title>
      <Body style={{ marginTop: 8 }}>
        Weekly wallet spend (subscriptions only — never bet stakes). Raising a limit takes 24 hours. Lowering is instant.
      </Body>
      <TextInput
        value={limit}
        onChangeText={setLimit}
        keyboardType="number-pad"
        accessibilityLabel="Weekly spend limit in naira"
        style={{
          marginTop: 16,
          minHeight: 44,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.borderStrong,
          color: theme.text,
          paddingHorizontal: 12,
          fontFamily: theme.font.mono,
          backgroundColor: theme.surfaceSunken,
        }}
      />
      <View style={{ marginTop: 12 }}>
        <Button
          label="Save limit"
          onPress={async () => {
            await apiPost('/me/limits', { weeklyLimitNaira: Number(limit) });
            setMsg('Saved. Increases apply after 24 hours.');
          }}
        />
      </View>
      <Body muted style={{ marginTop: 24 }}>
        Take a break pauses the feed and alerts on this device. Contact support if you need a longer cooldown.
      </Body>
      {msg ? <Body style={{ color: theme.accent, marginTop: 12 }}>{msg}</Body> : null}
    </Screen>
  );
}
