import { StyleSheet, Text, View } from 'react-native';
import { coinsForDay, toPersianDigits } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { CandyButton } from './CandyButton';
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

/** Daily reward card (panel-glass of the kit): the last days of the streak ending in today. */
export function DailyRewardCard({ steps, day, canClaim, onClaim, waitText }: Props) {
  const first = Math.max(1, day - 2);
  const days = [first, first + 1, first + 2];
  return (
    <GlassPanel>
      <Text style={styles.title}>{fa.daily.title}</Text>
      <View style={styles.row}>
        {days.map((d) => {
          const today = d === day;
          return (
            <View
              key={d}
              style={[
                styles.cell,
                today ? styles.today : styles.other,
                d > day ? styles.later : null,
              ]}
            >
              {today ? <GradientFill from="#FFE48A" to="#FFC93C" /> : null}
              <Text style={[styles.amount, { color: today ? colors.ink : colors.candy.yellow }]}>
                {toPersianDigits(String(coinsForDay([...steps], d)))}
              </Text>
              <Text style={[styles.dayLabel, { color: today ? colors.ink : colors.cream }]}>
                {today ? fa.daily.today : `${fa.daily.day} ${toPersianDigits(String(d))}`}
              </Text>
            </View>
          );
        })}
      </View>
      {canClaim ? (
        <CandyButton label={fa.daily.claim} color={colors.candy.lime} onPress={onClaim} />
      ) : waitText ? (
        <Text style={styles.wait}>{waitText}</Text>
      ) : null}
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.cream },
  row: { flexDirection: 'row', gap: 8 },
  cell: {
    flex: 1,
    height: 70,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  other: { backgroundColor: 'rgba(43,18,64,0.45)' },
  later: { opacity: 0.75 },
  today: { borderWidth: 3, borderColor: colors.ink },
  amount: { fontFamily: fonts.display, fontSize: 22 },
  dayLabel: { fontFamily: fonts.display, fontSize: 16 },
  wait: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream, textAlign: 'center' },
});
