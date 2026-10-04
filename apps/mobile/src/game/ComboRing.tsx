import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { toPersianDigits } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const SIZE = 46;
const STROKE = 6;
const R = (SIZE - STROKE) / 2;
const LEN = 2 * Math.PI * R;

/** «کمبو ×۲» with a ring that empties as the window to the next group runs out (D178). Shows from the second group on. */
export function ComboRing({ streak, left, showLabel = true }: { streak: number; left: number; showLabel?: boolean }) {
  if (streak < 2) return null;
  const n = toPersianDigits(String(streak));
  return (
    <View style={styles.row} accessibilityLabel={`${fa.solo.combo} ${n}`} accessibilityLiveRegion="polite">
      <View style={styles.ring}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={styles.svg}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="rgba(255,255,255,0.22)" strokeWidth={STROKE} fill="none" />
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={left > 0.3 ? colors.candy.yellow : colors.candy.pink} strokeWidth={STROKE} fill="none" strokeLinecap="round" strokeDasharray={`${LEN * left} ${LEN}`} transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`} />
        </Svg>
        <Text style={styles.n}>×{n}</Text>
      </View>
      {showLabel ? <Text style={styles.label}>{fa.solo.combo}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: ROW, alignItems: 'center', justifyContent: 'center', gap: 8 },
  ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  svg: { position: 'absolute' },
  n: { fontFamily: fonts.display, fontSize: 15, color: colors.cream },
  label: { fontFamily: fonts.display, fontSize: 18, color: colors.candy.yellow },
});
