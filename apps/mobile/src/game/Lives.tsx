import { Platform, StyleSheet, Text, View } from 'react-native';
import { toPersianDigits } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

/** «فرصت‌ها» row of screen-match: one pink dot per chance left, used chances dimmed. */
export function Lives({ mistakes, max }: { mistakes: number; max: number }) {
  const left = Math.max(0, max - mistakes);
  return (
    <View style={styles.row} accessibilityLabel={`${fa.solo.lives}: ${toPersianDigits(String(left))}/${toPersianDigits(String(max))}`}>
      <Text style={styles.label}>{fa.solo.lives}</Text>
      {Array.from({ length: max }, (_, i) => (
        <View key={i} style={[styles.dot, i < left ? styles.on : styles.off]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: ROW, alignItems: 'center', justifyContent: 'center', gap: 10 },
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: colors.ink },
  on: { backgroundColor: colors.candy.pink },
  off: { backgroundColor: 'rgba(255,255,255,0.18)' },
});
