import { Body, Button, FooterNote, Screen, Title } from '@/components/ui';
import { LEAGUES, MAX_FAVOURITE_CLUBS, POPULAR_CLUBS } from '@/lib/clubs';
import { theme } from '@/theme';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

function Chip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        minHeight: theme.tap,
        paddingHorizontal: 14,
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        borderColor: on ? theme.accentBorder : theme.border,
        backgroundColor: on ? theme.accentSurface : theme.surface,
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: on ? theme.accent : theme.text, fontFamily: theme.font.uiMed }}>{label}</Text>
    </Pressable>
  );
}

export default function AgeScreen() {
  const [over18, setOver18] = useState(false);
  const [clubs, setClubs] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({ epl: true, npfl: true });

  function toggle(c: string) {
    setClubs((prev) => {
      if (prev.includes(c)) return prev.filter((x) => x !== c);
      if (prev.length >= MAX_FAVOURITE_CLUBS) return prev;
      return [...prev, c];
    });
  }

  function goNext(selected: string[]) {
    router.push({ pathname: '/(onboarding)/bookie', params: { clubs: selected.join(',') } });
  }

  const q = query.trim().toLowerCase();
  const filteredLeagues = useMemo(() => {
    if (!q) return LEAGUES;
    return LEAGUES.map((league) => ({
      ...league,
      clubs: league.clubs.filter((c) => c.toLowerCase().includes(q) || league.name.toLowerCase().includes(q)),
    })).filter((league) => league.clubs.length > 0);
  }, [q]);

  const searching = q.length > 0;

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <Stack.Screen
        options={{
          title: 'Age',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip club selection"
              disabled={!over18}
              onPress={() => goNext([])}
              style={{ minHeight: theme.tap, justifyContent: 'center', paddingHorizontal: 4, opacity: over18 ? 1 : 0.35 }}
            >
              <Text style={{ color: theme.accent, fontFamily: theme.font.uiSemi, fontSize: 16 }}>Skip</Text>
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: theme.gutter, paddingBottom: 32 }}
        >
          <Title style={{ marginTop: 8 }}>You're 18 or over</Title>
          <Body style={{ marginTop: 8 }}>CodeDrop is for adults. Confirm, then pick clubs you follow.</Body>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: over18 }}
            onPress={() => setOver18((v) => !v)}
            style={{
              marginTop: 24,
              minHeight: theme.tap,
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

          <Text style={{ marginTop: 28, fontFamily: theme.font.uiSemi, color: theme.text, fontSize: 16 }}>
            Clubs you follow
          </Text>
          <Body muted style={{ marginTop: 4 }}>
            Optional · {clubs.length}/{MAX_FAVOURITE_CLUBS} selected. Used to personalise the feed.
          </Body>

          {clubs.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {clubs.map((c) => (
                <Chip key={`sel-${c}`} label={`${c} ×`} on onPress={() => toggle(c)} />
              ))}
            </View>
          ) : null}

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search clubs or leagues"
            placeholderTextColor={theme.textMuted}
            accessibilityLabel="Search clubs or leagues"
            autoCorrect={false}
            autoCapitalize="none"
            style={{
              marginTop: 16,
              minHeight: theme.tap,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.borderStrong,
              backgroundColor: theme.surfaceSunken,
              color: theme.text,
              paddingHorizontal: 16,
              fontFamily: theme.font.ui,
              fontSize: 16,
            }}
          />

          {!searching ? (
            <>
              <Text style={{ marginTop: 20, marginBottom: 8, fontFamily: theme.font.uiMed, color: theme.textMuted }}>
                Popular
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {POPULAR_CLUBS.map((c) => (
                  <Chip key={c} label={c} on={clubs.includes(c)} onPress={() => toggle(c)} />
                ))}
              </View>
            </>
          ) : null}

          {filteredLeagues.map((league) => {
            const expanded = searching || Boolean(open[league.id]);
            return (
              <View key={league.id} style={{ marginTop: 12 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => setOpen((prev) => ({ ...prev, [league.id]: !prev[league.id] }))}
                  style={{
                    minHeight: theme.tap,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.border,
                    backgroundColor: theme.surface,
                    paddingHorizontal: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={{ fontFamily: theme.font.uiSemi, color: theme.text }}>{league.name}</Text>
                  <Text style={{ color: theme.textMuted, fontFamily: theme.font.mono }}>
                    {expanded ? '▾' : '▸'} {league.clubs.length}
                  </Text>
                </Pressable>
                {expanded ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, paddingHorizontal: 2 }}>
                    {league.clubs.map((c) => (
                      <Chip key={`${league.id}-${c}`} label={c} on={clubs.includes(c)} onPress={() => toggle(c)} />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}

          {searching && filteredLeagues.length === 0 ? (
            <Body muted style={{ marginTop: 16 }}>
              No clubs match “{query.trim()}”.
            </Body>
          ) : null}

          <View style={{ marginTop: 24 }}>
            <Button
              label="Continue"
              disabled={!over18}
              onPress={() => goNext(clubs)}
            />
          </View>
          <FooterNote />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
