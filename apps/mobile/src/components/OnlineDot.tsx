import { StyleSheet, View } from 'react-native';
import { fa } from '../i18n/fa';
import { colors } from '../theme/colors';

/** Presence mark beside a player: green when they have the app open now, grey otherwise. */
export function OnlineDot({ online, size = 12 }: { online: boolean; size?: number }) {
  return <View accessibilityLabel={online ? fa.chat.online : fa.chat.offline} style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: online ? colors.candy.lime : '#B9AFC6' }]} />;
}

const styles = StyleSheet.create({ dot: { borderWidth: 2, borderColor: colors.ink } });
