import { Body, Button, Screen, Title } from '@/components/ui';
import { useSession } from '@/lib/session';
import { Switch, View } from 'react-native';
import { theme } from '@/theme';

export default function Settings() {
  const lowData = useSession((s) => s.lowData);
  const setLowData = useSession((s) => s.setLowData);
  const user = useSession((s) => s.user);

  return (
    <Screen>
      <Title style={{ fontSize: 22 }}>Settings</Title>
      <Body style={{ marginTop: 8 }}>
        Bookies: {user?.favouriteBookies?.length ? user.favouriteBookies.join(', ') : (user?.mainBookie ?? '—')}
      </Body>
      <Body>Unit size: ₦{user?.unitNaira ?? 1000}</Body>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20 }}>
        <Body style={{ flex: 1 }}>Low-data mode (text-only cards)</Body>
        <Switch value={lowData} onValueChange={setLowData} thumbColor={theme.accent} />
      </View>
      <Body muted style={{ marginTop: 24 }}>Language: English. Pidgin is planned.</Body>
    </Screen>
  );
}
