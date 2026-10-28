import { Body, Button, FooterNote, Screen, Title } from '@/components/ui';
import { theme } from '@/theme';
import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

export default function OtpScreen() {
  const [code, setCode] = useState('');
  return (
    <Screen>
      <Title style={{ marginTop: 24 }}>Enter the code</Title>
      <Body style={{ marginTop: 8 }}>In this dev build any 6 digits work. Production uses Firebase phone auth.</Body>
      <TextInput
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        accessibilityLabel="One-time code"
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
          fontSize: 22,
          letterSpacing: 8,
        }}
      />
      <View style={{ marginTop: 24 }}>
        <Button label="Continue" disabled={code.length < 6} onPress={() => router.push('/(onboarding)/age')} />
      </View>
      <FooterNote />
    </Screen>
  );
}
