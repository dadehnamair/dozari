import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { coinsForDay, toPersianDigits } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { usePrefs } from '../prefs/store';
import { CandyButton } from './CandyButton';
import { Item } from './Item';
import { GlassPanel } from './GlassPanel';
import { GradientFill } from './GradientFill';

interface Props {
  /** Coins per streak day, from the server (`GET /daily-reward`). */
  steps: readonly number[];
  /** The streak day that the next claim pays. */
  day: number;
  canClaim: boolean;
  onClaim: () => void;
  /** Text under the card while waiting, e.g. «۰۵:۱۲:۰۰ تا جایزه بعدی». */
  waitText?: string;
}

/** A heartbeat: two quick beats then a rest, so a reward waiting to be taken calls for a tap. Still when motion is reduced. */
function useHeartbeat(on: boolean): Animated.Value {
  const beat = useRef(new Animated.Value(1)).current;
  const calm = usePrefs().reduceMotion;
  useEffect(() => {
    if (!on || calm) return;
    const up = (v: number, ms: number) => Animated.timing(beat, { toValue: v, duration: ms, easing: Easing.out(Easing.quad), useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([up(1.09, 140), up(1, 160), up(1.06, 130), up(1, 200), Animated.delay(700)]));
    loop.start();
    return () => (loop.stop(), beat.setValue(1));
  }, [on, calm, beat]);
  return beat;
}

/** Daily reward card (panel-glass of the kit): the last days of the streak ending in today. A reward not yet taken beats like a heart; tap it to take it. */
export function DailyRewardCard({ steps, day, canClaim, onClaim, waitText }: Props) {
  const first = Math.max(1, day - 2);
  const days = [first, first + 1, first + 2];
  const beat = useHeartbeat(canClaim);
  return (
    <GlassPanel>
      <Text style={styles.title}>{fa.daily.title}</Text>
      <View style={styles.row}>
        {days.map((d) => {
          const today = d === day;
          const cell = (
            <View key={d} style={[styles.cell, today ? styles.today : styles.other, d > day ? styles.later : null, today ? styles.cellToday : null]}>
              {today ? <GradientFill from="#FFE48A" to="#FFC93C" /> : null}
              <Text style={[styles.dayLabel, { color: today ? colors.ink : colors.cream }]} numberOfLines={1}>
                {today ? fa.daily.today : `${fa.daily.day} ${toPersianDigits(String(d))}`}
              </Text>
              <View style={styles.coin}><Item icon="coin" /></View>
              <Text style={[styles.amount, { color: today ? colors.ink : colors.candy.yellow }]} numberOfLines={1}>
                {toPersianDigits(String(coinsForDay([...steps], d)))}
              </Text>
            </View>
          );
          if (!today) return <View key={d} style={styles.slot}>{cell}</View>;
          return (
            <Animated.View key={d} style={[styles.slotToday, canClaim ? { transform: [{ scale: beat }] } : null]}>
              {canClaim ? <Pressable onPress={onClaim} accessibilityRole="button" accessibilityLabel={fa.daily.claim} style={styles.fill}>{cell}</Pressable> : cell}
            </Animated.View>
          );
        })}
      </View>
      {canClaim ? (
        <Animated.View style={{ alignSelf: 'stretch', transform: [{ scale: beat }] }}><CandyButton label={fa.daily.claim} color={colors.candy.lime} onPress={onClaim} /></Animated.View>
      ) : waitText ? (
        <Text style={styles.wait}>{waitText}</Text>
      ) : null}
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.cream, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'stretch', alignSelf: 'stretch' },
  slot: { flex: 1 },
  slotToday: { flex: 1.25 },
  fill: { flex: 1 },
  cell: { height: 112, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 4 },
  cellToday: { height: 124 },
  other: { backgroundColor: 'rgba(43,18,64,0.45)' },
  later: { opacity: 0.8 },
  today: { borderWidth: 3, borderColor: colors.ink },
  coin: { width: 34, height: 34 },
  amount: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30 },
  dayLabel: { fontFamily: fonts.display, fontSize: 15, lineHeight: 22 },
  wait: { fontFamily: fonts.bold, fontSize: 14, color: colors.cream, textAlign: 'center' },
});
