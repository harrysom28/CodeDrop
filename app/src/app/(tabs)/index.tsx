import { PickCard, SpottedCard } from '@/components/PickCard';
import { Body, Empty, ErrorState, IconButton, Loading } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { theme } from '@/theme';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

const TABS = ['following', 'trending', 'spotted'] as const;

export default function FeedScreen() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('trending');
  const lowData = useSession((s) => s.lowData);
  const q = useQuery({
    queryKey: ['feed', tab],
    queryFn: () => apiGet<{ items: Record<string, unknown>[] }>(`/feed?tab=${tab}`),
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
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
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
            <Text style={{ color: tab === t ? theme.accentOn : theme.text, fontFamily: theme.font.uiMed, textTransform: 'capitalize' }}>
              {t}
            </Text>
          </Pressable>
        ))}
      </View>
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
        <Empty title="Nothing here yet" body="Follow tipsters or switch to Spotted for public codes." />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} tintColor={theme.accent} />}
        >
          {q.data.items.map((item, i) =>
            tab === 'spotted' || item.verification === 'unverified' ? (
              <SpottedCard key={String(item._id ?? i)} item={item} />
            ) : (
              <PickCard key={String(item._id ?? i)} pick={item} lowData={lowData} />
            ),
          )}
        </ScrollView>
      )}
    </View>
  );
}
