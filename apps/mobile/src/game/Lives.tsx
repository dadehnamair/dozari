import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { LAST_LIFE_HEARTBEAT_MS, toPersianDigits } from '@dozari/shared';
import { usePrefs } from '../prefs/store';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

/** «فرصت‌ها» row of screen-match: one pink dot per chance left, used chances dimmed. On the last chance the dot beats and the label warns (D178). */
export function Lives({ mistakes, max, last = false }: { mistakes: number; max: number; last?: boolean }) {
  const left = Math.max(0, max - mistakes);
  const reduce = usePrefs().reduceMotion;
  const beat = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!last || reduce) {
      beat.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(beat, { toValue: 0, duration: 140, useNativeDriver: true }),
        Animated.timing(beat, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(beat, { toValue: 0, duration: Math.max(200, LAST_LIFE_HEARTBEAT_MS - 380), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [last, reduce, beat]);
  const scale = beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  return (
    <View style={styles.row} accessibilityLabel={`${fa.solo.lives}: ${toPersianDigits(String(left))}/${toPersianDigits(String(max))}`}>
      <Text style={[styles.label, last ? styles.warn : null]}>{last ? fa.solo.lastLife : fa.solo.lives}</Text>
      {Array.from({ length: max }, (_, i) => {
        const on = i < left;
        return on && last ? <Animated.View key={i} style={[styles.dot, styles.on, styles.hot, { transform: [{ scale }] }]} /> : <View key={i} style={[styles.dot, on ? styles.on : styles.off]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: ROW, alignItems: 'center', justifyContent: 'center', gap: 10 },
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream },
  warn: { fontFamily: fonts.display, fontSize: 16, color: colors.candy.pink },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: colors.ink },
  on: { backgroundColor: colors.candy.pink },
  hot: { backgroundColor: '#FF2E5F' },
  off: { backgroundColor: 'rgba(255,255,255,0.18)' },
});
