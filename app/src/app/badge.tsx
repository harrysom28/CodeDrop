import { Badge } from '@/components/Badge';
import { Body, Screen, Title } from '@/components/ui';
import { View } from 'react-native';

export default function BadgeExplainer() {
  return (
    <Screen>
      <Title style={{ fontSize: 22 }}>What the badges mean</Title>
      <View style={{ gap: 16, marginTop: 20 }}>
        <View>
          <Badge kind="stake" />
          <Body style={{ marginTop: 8 }}>The tipster's stake on this pick was independently verified. Rare on day one.</Body>
        </View>
        <View>
          <Badge kind="receipt" />
          <Body style={{ marginTop: 8 }}>A bookie receipt matched the locked slip.</Body>
        </View>
        <View>
          <Badge kind="pick" />
          <Body style={{ marginTop: 8 }}>The pick was hashed and timestamped before kickoff. That's the default CodeDrop record.</Body>
        </View>
        <View>
          <Badge kind="unverified" />
          <Body style={{ marginTop: 8 }}>
            Spotted in a public Telegram channel. Not a locked pick. Not ranked. Timing can be faked there.
          </Body>
        </View>
      </View>
    </Screen>
  );
}
