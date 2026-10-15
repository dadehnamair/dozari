import { Animated, StyleSheet, Text } from 'react-native';
import { toPersianDigits } from '@dozari/shared';
import { colors, fonts } from '../theme/colors';

/** «+۵۰» / «−۲۰» chip that rises from the coin counter and fades out. Green for a gain, red for a loss. */
export function CoinDeltaFx({ delta, progress }: { delta: number; progress: Animated.Value }) {
  const gain = delta > 0;
  const opacity = progress.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 1, 0] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, gain ? -26 : 26] });
  const scale = progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.6, 1.25, 1] });
  const text = `${gain ? '+' : '−'}${toPersianDigits(String(Math.abs(delta)))}`;
  return (
    <Animated.View pointerEvents="none" style={[styles.chip, { backgroundColor: gain ? colors.candy.lime : colors.candy.pink, opacity, transform: [{ translateY }, { scale }] }]} accessibilityLiveRegion="polite" accessibilityLabel={text}>
      <Text style={styles.text}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: { position: 'absolute', top: 34, alignSelf: 'center', paddingHorizontal: 10, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  text: { fontFamily: fonts.display, fontSize: 15, lineHeight: 20, color: colors.ink },
});
