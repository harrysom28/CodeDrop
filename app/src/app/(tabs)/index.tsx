import { PickCard, SpottedCard } from '@/components/PickCard';
import { WinnersStrip } from '@/components/WinnersStrip';
import { Body, Empty, ErrorState, IconButton, Loading } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { theme } from '@/theme';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

const TABS = ['all', 'consistent', 'following', 'trending', 'spotted'] as const;
const TAB_LABELS: Record<(typeof TABS)[number], string> = {
  all: 'All',
  consistent: 'Consistent',
  following: 'Following',
  trending: 'Trending',
  spotted: 'Spotted',
};

export default function FeedScreen() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('all');
  const lowData = useSession((s) => s.lowData);
  const q = useQuery({
    queryKey: ['feed', tab],
    queryFn: () => apiGet<{ items: Record<string, unknown>[]; relaxed?: boolean }>(`/feed?tab=${tab}`),
    retry: 1,
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 }}>
        <Text style={{ flex: 1, fontFamily: theme.font.title, fontSize: 22, color: theme.text }}>CodeDrop</Text>
        <IconButton label="Notifications" onPress={() => router.push('/notifications')}>
          <Text style={{ color: theme.text, fontSize: 16 }}>Bell</Text>
        </IconButton>
        <Pressable
          accessibilityLabel="Post a pick"
          onPress={() => router.push('/post')}
          style={{
            minWidth: 44,
            minHeight: 44,
            borderRadius: 22,
            backgroundColor: theme.accent,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 4,
          }}
        >
          <Text style={{ color: theme.accentOn, fontFamily: theme.font.uiSemi, fontSize: 22 }}>+</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}
      >
        {TABS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{
              minHeight: 44,
              paddingHorizontal: 14,
              borderRadius: 999,
              backgroundColor: tab === t ? theme.accent : theme.surface,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: tab === t ? theme.accentOn : theme.text, fontFamily: theme.font.uiMed }}>{TAB_LABELS[t]}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {q.isError && (q.error as ApiError).status === 0 ? (
        <View style={{ backgroundColor: theme.warnSurface, padding: 12, marginHorizontal: 16, borderRadius: 12 }}>
          <Body style={{ color: theme.warn }}>No connection. Showing odds from cache. Retry.</Body>
        </View>
      ) : null}
      {q.isLoading ? (
        <Loading />
      ) : q.isError && !q.data ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />
      ) : !q.data?.items.length ? (
        <Empty
          title="Nothing here yet"
          body={
            tab === 'following'
              ? 'Follow tipsters or switch to All / Spotted for public codes.'
              : tab === 'spotted'
                ? 'No public codes spotted yet.'
                : tab === 'consistent'
                  ? 'No upcoming slips yet. Check back before kickoff.'
                : 'No slips yet. Post a pick or check Spotted for public codes.'
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} tintColor={theme.accent} />}
        >
          {tab === 'all' ? <WinnersStrip /> : null}
          {tab === 'consistent' ? (
            <View style={{ backgroundColor: theme.accentSurface, borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <Body style={{ color: theme.textSecondary, fontSize: 13 }}>
                {q.data.relaxed
                  ? 'Few short slips today, so this also shows the next most likely ones. Wins often, pays small.'
                  : 'Short, low-odds slips. Wins often, pays small.'}
              </Body>
            </View>
          ) : null}
          {q.data.items.map((item, i) =>
            item.kind === 'spotted' || item.verification === 'unverified' ? (
              <SpottedCard key={String(item._id ?? i)} item={item} lowData={lowData} />
            ) : (
              <PickCard key={String(item._id ?? i)} pick={item} lowData={lowData} />
            ),
          )}
        </ScrollView>
      )}
    </View>
  );
}
