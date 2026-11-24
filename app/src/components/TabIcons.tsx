import { theme } from '@/theme';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const SIZE = 24;

export function TabIcon({
  name,
  focused,
}: {
  name: 'feed' | 'rooms' | 'leaders' | 'convert' | 'me';
  focused: boolean;
}) {
  const c = focused ? theme.accent : theme.textMuted;
  const props = { width: SIZE, height: SIZE, viewBox: '0 0 24 24', fill: 'none' as const };
  const stroke = { stroke: c, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  if (name === 'feed') {
    return (
      <Svg {...props} accessibilityLabel="Feed">
        <Rect x="4" y="4" width="16" height="16" rx="2.5" {...stroke} />
        <Path d="M8 9h8M8 12.5h8M8 16h5" {...stroke} />
      </Svg>
    );
  }
  if (name === 'rooms') {
    return (
      <Svg {...props} accessibilityLabel="Rooms">
        <Path d="M5 16.5V8.5A2.5 2.5 0 0 1 7.5 6h9A2.5 2.5 0 0 1 19 8.5v5A2.5 2.5 0 0 1 16.5 16H9l-4 3v-2.5Z" {...stroke} />
      </Svg>
    );
  }
  if (name === 'leaders') {
    return (
      <Svg {...props} accessibilityLabel="Leaders">
        <Path d="M7 9h10l-.8 8.2A2 2 0 0 1 14.2 19H9.8a2 2 0 0 1-2-1.8L7 9Z" {...stroke} />
        <Path d="M7 9 5 6h4l3 3 3-3h4l-2 3" {...stroke} />
        <Path d="M10 16h4" {...stroke} />
      </Svg>
    );
  }
  if (name === 'convert') {
    return (
      <Svg {...props} accessibilityLabel="Convert">
        <Path d="M7 8h11l-3-3M17 16H6l3 3" {...stroke} />
      </Svg>
    );
  }
  return (
    <Svg {...props} accessibilityLabel="Me">
      <Circle cx="12" cy="9" r="3.2" {...stroke} />
      <Path d="M6.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5" {...stroke} />
    </Svg>
  );
}
