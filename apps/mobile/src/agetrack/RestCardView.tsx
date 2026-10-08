import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { ChildLimits } from '@dozari/shared';
import { CandyButton } from '../components/CandyButton';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { restCardFor, snoozeUntil } from './restCard';

const INK = '#3A2418';
const CHECK_MS = 10_000;

/** The soft «rest» card of a child's guardian settings: quiet hours or a long day of play (the larger of this session and the minutes today the server counted). One tap on «باشه» hides it for ten minutes; nothing is locked. */
export function RestCardView({ limits }: { limits: ChildLimits | null }) {
  const [started] = useState(() => Date.now());
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), CHECK_MS);
    return () => clearInterval(timer);
  }, []);
  const d = new Date(tick);
  const card = restCardFor(limits, { minuteOfDay: d.getHours() * 60 + d.getMinutes(), sessionMinutes: Math.max(Math.floor((tick - started) / 60_000), limits?.playedToday ?? 0), now: tick, snoozedUntil });
  if (!card) return null;
  const close = () => setSnoozedUntil(snoozeUntil(Date.now()));
  return (
    <Pressable style={styles.overlay} onPress={close} accessibilityLabel={fa.guardian.rest.ok}>
      <Pressable style={styles.card} onPress={() => undefined}>
        <Text style={styles.title}>{card === 'quiet' ? fa.guardian.rest.quietTitle : fa.guardian.rest.reminderTitle}</Text>
        <Text style={styles.text}>{card === 'quiet' ? fa.guardian.rest.quietText : fa.guardian.rest.reminderText}</Text>
        <CandyButton label={fa.guardian.rest.ok} color={colors.candy.lime} onPress={close} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 35, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 340, backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 18, gap: 10, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 22, color: INK, textAlign: 'center' },
  text: { fontFamily: fonts.bold, fontSize: 14, color: INK, textAlign: 'center' },
});
