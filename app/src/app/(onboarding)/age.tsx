import { Body, Button, FooterNote, Screen, Title } from '@/components/ui';
import { theme } from '@/theme';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

const CLUBS = ['Enyimba', 'Rivers United', 'Kano Pillars', 'Remo Stars', 'Chelsea', 'Arsenal'];

export default function AgeScreen() {
  const [over18, setOver18] = useState(false);
  const [clubs, setClubs] = useState<string[]>([]);

  function toggle(c: string) {
    setClubs((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  return (
    <Screen>
      <Title style={{ marginTop: 24 }}>You're 18 or over</Title>
      <Body style={{ marginTop: 8 }}>CodeDrop is for adults. Confirm, then pick clubs you follow.</Body>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: over18 }}
        onPress={() => setOver18((v) => !v)}
        style={{
          marginTop: 24,
          minHeight: 44,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: over18 ? theme.accentBorder : theme.border,
          backgroundColor: over18 ? theme.accentSurface : theme.surface,
          padding: 12,
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontFamily: theme.font.uiMed, color: theme.text }}>I confirm I am 18 or older</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        {CLUBS.map((c) => {
          const on = clubs.includes(c);
          return (
            <Pressable
              key={c}
              onPress={() => toggle(c)}
              style={{
                minHeight: 44,
                paddingHorizontal: 14,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: on ? theme.accentBorder : theme.border,
                backgroundColor: on ? theme.accentSurface : theme.surface,
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: on ? theme.accent : theme.text, fontFamily: theme.font.uiMed }}>{c}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ marginTop: 24 }}>
        <Button
          label="Continue"
          disabled={!over18}
          onPress={() => router.push({ pathname: '/(onboarding)/bookie', params: { clubs: clubs.join(',') } })}
        />
      </View>
      <FooterNote />
    </Screen>
  );
}
