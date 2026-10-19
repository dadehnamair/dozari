import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { toPersianDigits } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { bootTheme } from '../theme/bootTheme';

const r = fa.duel.arena.roundIntro;

/**
 * Big banner over the board while the next board of a multi-board match is about to start: «دور ۲ از ۴», a 3-2-1 count and,
 * when the last board was decided, who found all four groups. The board is locked underneath for the same seconds.
 */
export function RoundIntro({ board, of, seconds, note, still = false }: { board: number; of: number; seconds: number; note?: string | null; /** Reduced motion: no pop on each tick. */ still?: boolean }) {
  const [left, setLeft] = useState(seconds);
  const pop = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  useEffect(() => {
    if (still) return;
    pop.setValue(1.5);
    Animated.timing(pop, { toValue: 1, duration: 420, easing: Easing.out(Easing.back(2)), useNativeDriver: true }).start();
  }, [left, still, pop]);
  const adult = bootTheme() === 'adult';
  const accent = adult ? '#E8B64A' : colors.candy.yellow;
  return (
    <View style={styles.scrim} accessibilityViewIsModal accessibilityLiveRegion="polite" accessibilityLabel={`${r.title(board, of)} ${r.startsIn(left)}`}>
      <Text style={[styles.title, { color: accent }]}>{r.title(board, of)}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <Animated.Text style={[styles.count, { color: adult ? '#FFE9A8' : '#fff', transform: [{ scale: pop }] }]}>{toPersianDigits(String(Math.max(left, 1)))}</Animated.Text>
      <Text style={styles.sub}>{r.startsLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, elevation: 30, backgroundColor: 'rgba(10,6,4,0.84)', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  title: { fontFamily: fonts.display, fontSize: 38, lineHeight: 56, textAlign: 'center' },
  note: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 26, color: 'rgba(255,246,232,0.9)', textAlign: 'center', marginBottom: 6 },
  count: { fontFamily: fonts.display, fontSize: 110, lineHeight: 140, textAlign: 'center' },
  sub: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 24, color: 'rgba(255,246,232,0.75)', textAlign: 'center' },
});
