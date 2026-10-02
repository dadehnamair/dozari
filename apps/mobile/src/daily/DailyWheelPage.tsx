import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { toPersianDigits } from '@dozari/shared';
import { GradientFill } from '../components/GradientFill';
import { Icon } from '../components/Icon';
import { Item } from '../components/Item';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import type { DailyRewardState } from './useDailyReward';
import { WHEEL_SLICES, spinTarget, streakStrip, wheelAmounts } from './wheel';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const SIZE = 290;
const R = SIZE / 2 - 6;
const SLICE_COLORS = ['#FF8FB6', '#FFE48A', '#8FDCFA', '#B8F08F'];
const SPIN_MS = 4200;
const n = (v: number) => toPersianDigits(String(v));

const wedge = (i: number): string => {
  const a0 = ((i - 0.5) * 2 * Math.PI) / WHEEL_SLICES - Math.PI / 2;
  const a1 = ((i + 0.5) * 2 * Math.PI) / WHEEL_SLICES - Math.PI / 2;
  const c = SIZE / 2;
  const p = (a: number) => `${c + R * Math.cos(a)} ${c + R * Math.sin(a)}`;
  return `M${c} ${c} L${p(a0)} A${R} ${R} 0 0 1 ${p(a1)} Z`;
};

/**
 * screen-daily of `19 Social Daily Onboarding` (D111): the seven-day streak strip over a lamp-lit wheel with a pink
 * pointer; the big button spins it and the prize card closes the loop. The reward itself is the server's (the
 * streak ladder of `GET /daily-reward`): slice 0 is always today's amount and the wheel lands on it, so the wheel is
 * the ceremony, never a second source of coins.
 */
export function DailyWheelPage({ daily, onClose }: { daily: DailyRewardState; onClose: () => void }) {
  const status = daily.status;
  const spin = useRef(new Animated.Value(0)).current;
  const [spinning, setSpinning] = useState(false);
  const [prize, setPrize] = useState<number | null>(null);
  /** The faces at the moment of the spin: the claim advances the streak, but the wheel must keep the slice it lands on. */
  const [frozen, setFrozen] = useState<{ amounts: number[]; day: number } | null>(null);
  const t = fa.dailyWheel;

  // The prize card appears once the wheel has stopped and the server has paid.
  useEffect(() => {
    if (!spinning && daily.won !== null) setPrize(daily.won);
  }, [spinning, daily.won]);

  if (!status) {
    return (
      <View style={styles.root}>
        <Text style={styles.note}>{daily.failed ? t.error : ''}</Text>
        <Close onClose={onClose} />
      </View>
    );
  }
  const faceDay = frozen?.day ?? status.day;
  const amounts = frozen?.amounts ?? wheelAmounts(status.steps, status.day);
  const strip = streakStrip(status.steps, faceDay);
  const can = status.canClaim && !spinning && !daily.claiming;
  const rotate = spin.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });

  const go = () => {
    if (!can) return;
    setFrozen({ amounts, day: status.day });
    setSpinning(true);
    daily.claim();
    spin.setValue(0);
    Animated.timing(spin, { toValue: spinTarget(), duration: SPIN_MS, easing: Easing.bezier(0.12, 0.7, 0.15, 1), useNativeDriver: Platform.OS !== 'web' }).start(() => setSpinning(false));
  };
  const note = spinning ? t.spinning : status.canClaim ? t.ready : daily.countdown ? t.wait(daily.countdown) : t.done;

  return (
    <View style={styles.root}>
      <View style={styles.glow} pointerEvents="none"><GradientFill from="#7A2C9E" to="#2B1240" /></View>
      <View style={styles.column}>
        <View style={styles.head}>
          <Close onClose={onClose} />
          <View style={styles.plate}>
            <GradientFill from="#FFE48A" to={colors.candy.yellow} />
            <Text style={styles.plateText}>{t.title}</Text>
          </View>
        </View>

        <View style={styles.strip}>
          {strip.map((d) => (
            <View key={d.day} style={[styles.day, d.state === 'today' ? styles.dayToday : d.state === 'done' ? styles.dayDone : null]}>
              <Text style={styles.dayLabel}>{d.state === 'today' ? t.today : t.day(d.day)}</Text>
              <View style={styles.dayIcon}><Item icon={d.state === 'done' ? 'check' : 'coin'} /></View>
              <Text style={styles.dayCoins}>{n(d.coins)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.wheelWrap}>
          <View style={styles.rim} />
          <Animated.View style={[styles.wheel, { transform: [{ rotate }] }]}>
            <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <Circle cx={SIZE / 2} cy={SIZE / 2} r={R + 2} fill={colors.ink} />
              {amounts.map((amount, i) => (
                <G key={i}>
                  <Path d={wedge(i)} fill={SLICE_COLORS[i % SLICE_COLORS.length]} stroke={colors.ink} strokeWidth={2.5} strokeOpacity={0.55} />
                  <G rotation={(i * 360) / WHEEL_SLICES} origin={`${SIZE / 2}, ${SIZE / 2}`}>
                    <SvgText x={SIZE / 2} y={SIZE / 2 - R + 44} fontSize={24} fontWeight="bold" fill={colors.ink} textAnchor="middle">{n(amount)}</SvgText>
                  </G>
                </G>
              ))}
            </Svg>
          </Animated.View>
          <View style={styles.hub}><Text style={styles.hubText}>{n(faceDay)}</Text></View>
          <View style={styles.pointer}>
            <Svg width={40} height={50} viewBox="0 0 40 50">
              <Path d="M20 46 L4 12 Q4 2 20 2 Q36 2 36 12Z" fill="#FF4D8D" stroke={colors.ink} strokeWidth={3.4} strokeLinejoin="round" />
              <Circle cx={20} cy={13} r={5} fill="#fff" stroke={colors.ink} strokeWidth={2} />
            </Svg>
          </View>
        </View>

        <View style={styles.bottom}>
          <Text style={styles.noteLight}>{note}</Text>
          <Pressable onPress={go} disabled={!can} accessibilityRole="button" accessibilityLabel={t.spin} style={({ pressed }) => [styles.spin, !can ? styles.spinOff : null, pressed ? styles.pressed : null]}>
            <GradientFill from={can ? '#B8F08F' : '#C9BBD9'} to={can ? '#5DBB3C' : '#9C8DB5'} />
            <Text style={styles.spinText}>{t.spin}</Text>
          </Pressable>
        </View>
      </View>

      {prize !== null ? (
        <Pressable style={styles.prize} onPress={() => (setPrize(null), setFrozen(null), daily.dismissWon())} accessibilityLabel={fa.dailyWheel.close}>
          <View style={styles.prizeIcon}><Item icon="coinStack" /></View>
          <View style={styles.prizePlate}>
            <GradientFill from="#FFE48A" to={colors.candy.yellow} />
            <Text style={styles.prizeText}>{n(prize)} {fa.daily.coins}</Text>
          </View>
          <Text style={styles.noteLight}>{t.tomorrow}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Close({ onClose }: { onClose: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={fa.dailyWheel.close} onPress={onClose}>
      {({ pressed }) => (
        <View style={[styles.back, pressed ? styles.pressed : null]}>
          <GradientFill from="#C9A3FF" to="#A66BF0" />
          <Icon name="back" size={22} color="#fff" strokeWidth={3} />
        </View>
      )}
    </Pressable>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: '#40166A' },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  column: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 12, paddingTop: 30, alignItems: 'center' },
  head: { alignSelf: 'stretch', flexDirection: ROW, alignItems: 'center', gap: 8 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  pressed: { transform: [{ translateY: 3 }] },
  plate: { flex: 1, height: 46, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  plateText: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  note: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream, textAlign: 'center', marginTop: 80 },
  strip: { alignSelf: 'stretch', flexDirection: ROW, gap: 4, marginTop: 14 },
  day: { flex: 1, height: 62, borderRadius: 12, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#F6E2C2', alignItems: 'center', justifyContent: 'center', opacity: 0.7, ...lift(3) },
  dayToday: { backgroundColor: colors.candy.yellow, opacity: 1 },
  dayDone: { backgroundColor: '#B8F08F', opacity: 0.9 },
  dayLabel: { fontFamily: fonts.display, fontSize: 10, color: colors.ink },
  dayIcon: { width: 22, height: 22 },
  dayCoins: { fontFamily: fonts.bold, fontSize: 9.5, color: colors.ink },
  wheelWrap: { width: SIZE, height: SIZE, marginTop: 44 },
  rim: { position: 'absolute', top: -12, left: -12, right: -12, bottom: -12, borderRadius: 999, backgroundColor: colors.ink },
  wheel: { width: SIZE, height: SIZE },
  hub: { position: 'absolute', left: SIZE / 2 - 32, top: SIZE / 2 - 32, width: 64, height: 64, borderRadius: 32, borderWidth: 4, borderColor: colors.ink, backgroundColor: colors.candy.yellow, alignItems: 'center', justifyContent: 'center', ...lift(4) },
  hubText: { fontFamily: fonts.display, fontSize: 22, color: '#7A4A00' },
  pointer: { position: 'absolute', left: SIZE / 2 - 20, top: -34, width: 40, height: 50 },
  bottom: { position: 'absolute', left: 14, right: 14, bottom: 30, gap: 8, alignItems: 'center' },
  noteLight: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.cream, textAlign: 'center' },
  spin: { width: '100%', height: 64, borderRadius: 20, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(6) },
  spinOff: { opacity: 0.8 },
  spinText: { fontFamily: fonts.display, fontSize: 28, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  prize: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9, backgroundColor: 'rgba(26,8,44,0.86)', alignItems: 'center', justifyContent: 'center', gap: 12 },
  prizeIcon: { width: 130, height: 130 },
  prizePlate: { paddingHorizontal: 26, paddingVertical: 8, borderRadius: 16, borderWidth: 4, borderColor: colors.ink, overflow: 'hidden', ...lift(6) },
  prizeText: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
});
