import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/colors';
import { Icon } from './Icon';

/** toast of the kit: ink pill with a lime outline and a check («آفرین، درست بود!»). */
export function Toast({ text, tone = colors.candy.lime }: { text: string; tone?: string }) {
  return (
    <View style={[styles.toast, { borderColor: tone }]} accessibilityLiveRegion="polite">
      <Icon name="check" size={18} color={tone} strokeWidth={3} />
      <Text style={[styles.text, { color: tone }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: colors.ink,
    borderWidth: 2,
  },
  text: { fontFamily: fonts.display, fontSize: 17 },
});
