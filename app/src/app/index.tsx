import { useSession } from '@/lib/session';
import { Redirect } from 'expo-router';

export default function Index() {
  const user = useSession((s) => s.user);
  const userId = useSession((s) => s.userId);
  if (!userId) return <Redirect href="/(onboarding)/phone" />;
  if (!user?.over18Confirmed) return <Redirect href="/(onboarding)/age" />;
  return <Redirect href="/(tabs)" />;
}
