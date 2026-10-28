import { Body, Card, ErrorState, Loading, Mono, Screen, Title } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';

export default function Proof() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({
    queryKey: ['proof', id],
    queryFn: () =>
      apiGet<{ commitHash: string; merkleRoot: string | null; merkleProof: string[]; anchorTx: string | null }>(`/picks/${id}/proof`),
  });
  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />;
  return (
    <Screen>
      <Title style={{ fontSize: 22 }}>Commit proof</Title>
      <Body style={{ marginTop: 8 }}>Anyone can re-hash the revealed pick with the salt and check this hash.</Body>
      <Card style={{ marginTop: 16 }}>
        <Body muted>Hash</Body>
        <Mono style={{ fontSize: 12 }}>{q.data?.commitHash}</Mono>
        <Body muted style={{ marginTop: 8 }}>Root</Body>
        <Mono style={{ fontSize: 12 }}>{q.data?.merkleRoot ?? 'Not anchored yet'}</Mono>
        <Body muted style={{ marginTop: 8 }}>Tx</Body>
        <Mono style={{ fontSize: 12 }}>{q.data?.anchorTx ?? '—'}</Mono>
      </Card>
    </Screen>
  );
}
