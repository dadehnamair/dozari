import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import type { WheelStatus } from '@dozari/shared';
import { toPersianDigits } from '@dozari/shared';
import { GradientFill } from '../components/GradientFill';
import { Icon } from '../components/Icon';
import { Item } from '../components/Item';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { fetchWheel, spinWheel } from './api';
import { spinAngle } from './geometry';
import { pageTop } from '../theme/safeArea';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const SIZE = 290;
const R = SIZE / 2 - 6;
const SLICE_COLORS = ['#FF8FB6', '#FFE48A', '#8FDCFA', '#B8F08F'];
const SPIN_MS = 4200;
const n = (v: number) => toPersianDigits(String(v));
const t = fa.wheel;

const wedge = (i: number, count: number): string => {
  const a0 = ((i - 0.5) * 2 * Math.PI) / count - Math.PI / 2;
  const a1 = ((i + 0.5) * 2 * Math.PI) / count - Math.PI / 2;
  const c = SIZE / 2;
  const p = (a: number) => `${c + R * Math.cos(a)} ${c + R * Math.sin(a)}`;
  return `M${c} ${c} L${p(a0)} A${R} ${R} 0 0 1 ${p(a1)} Z`;
};

/**
 * The lucky wheel (D116): a chance only a won duel earns. The server rolls the prize and pays it; the wheel is drawn from
 * the real slices of `GET /wheel` and, once `POST /wheel/spin` answers, turns to stop on the slice the server chose.
 */
export function WheelPage({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<WheelStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [prize, setPrize] = useState<number | null>(null);
  const turn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchWheel().then(setStatus, () => setFailed(true));
  }, []);

  const go = async () => {
    if (!status || spinning || status.pending < 1) return;
    setSpinning(true);
    try {
      const out = await spinWheel();
      if (!out) {
        setStatus(await fetchWheel());
        setSpinning(false);
        return;
      }
      turn.setValue(0);
      Animated.timing(turn, { toValue: spinAngle(out.slice, status.slices.length), duration: SPIN_MS, easing: Easing.bezier(0.12, 0.7, 0.15, 1), useNativeDriver: Platform.OS !== 'web' }).start(() => {
        setSpinning(false);
        setPrize(out.coins);
        setStatus({ ...status, pending: out.pending, balance: out.balance });
      });
    } catch {
      setFailed(true);
      setSpinning(false);
    }
  };

  if (!status) {
    return (
      <View style={styles.root}>
        <View style={styles.column}>
          <View style={styles.head}><Close onClose={onClose} /></View>
          <Text style={styles.note}>{failed ? t.error : ''}</Text>
        </View>
      </View>
    );
  }
  const count = status.slices.length;
  const can = status.enabled && status.pending > 0 && !spinning;
  const rotate = turn.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });
  const note = spinning ? t.spinning : status.pending > 1 ? t.more(status.pending - 1) : status.pending === 1 ? t.ready : t.none;

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

        <View style={styles.wheelWrap}>
          <View style={styles.rim} />
          <Animated.View style={[styles.wheel, { transform: [{ rotate }] }]}>
            <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <Circle cx={SIZE / 2} cy={SIZE / 2} r={R + 2} fill={colors.ink} />
              {status.slices.map((coins, i) => (
                <G key={i}>
                  <Path d={wedge(i, count)} fill={SLICE_COLORS[i % SLICE_COLORS.length]} stroke={colors.ink} strokeWidth={2.5} strokeOpacity={0.55} />
                  <G rotation={(i * 360) / count} origin={`${SIZE / 2}, ${SIZE / 2}`}>
                    <SvgText x={SIZE / 2} y={SIZE / 2 - R + 44} fontSize={24} fontWeight="bold" fill={colors.ink} textAnchor="middle">{n(coins)}</SvgText>
                  </G>
                </G>
              ))}
            </Svg>
          </Animated.View>
          <View style={styles.hub}><Item icon="coin" /></View>
          <View style={styles.pointer}>
            <Svg width={40} height={50} viewBox="0 0 40 50">
              <Path d="M20 46 L4 12 Q4 2 20 2 Q36 2 36 12Z" fill="#FF4D8D" stroke={colors.ink} strokeWidth={3.4} strokeLinejoin="round" />
              <Circle cx={20} cy={13} r={5} fill="#fff" stroke={colors.ink} strokeWidth={2} />
            </Svg>
          </View>
        </View>

        <View style={styles.bottom}>
          <Text style={styles.noteLight}>{note}</Text>
          <Pressable onPress={() => void go()} disabled={!can} accessibilityRole="button" accessibilityLabel={t.spin} style={({ pressed }) => [styles.spin, !can ? styles.spinOff : null, pressed ? styles.pressed : null]}>
            <GradientFill from={can ? '#B8F08F' : '#C9BBD9'} to={can ? '#5DBB3C' : '#9C8DB5'} />
            <Text style={styles.spinText}>{t.spin}</Text>
          </Pressable>
        </View>
      </View>

      {prize !== null ? (
        <Pressable style={styles.prize} onPress={() => setPrize(null)} accessibilityLabel={t.close}>
          <View style={styles.prizeIcon}><Item icon="coinStack" /></View>
          <View style={styles.prizePlate}>
            <GradientFill from="#FFE48A" to={colors.candy.yellow} />
            <Text style={styles.prizeText}>{n(prize)} {fa.daily.coins}</Text>
          </View>
          <Text style={styles.noteLight}>{t.won}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Close({ onClose }: { onClose: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={onClose}>
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
  column: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 12, paddingTop: pageTop(), alignItems: 'center' },
  head: { alignSelf: 'stretch', flexDirection: ROW, alignItems: 'center', gap: 8 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  pressed: { transform: [{ translateY: 3 }] },
  plate: { flex: 1, height: 46, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  plateText: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  note: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream, textAlign: 'center', marginTop: 80 },
  wheelWrap: { width: SIZE, height: SIZE, marginTop: 70 },
  rim: { position: 'absolute', top: -12, left: -12, right: -12, bottom: -12, borderRadius: 999, backgroundColor: colors.ink },
  wheel: { width: SIZE, height: SIZE },
  hub: { position: 'absolute', left: SIZE / 2 - 32, top: SIZE / 2 - 32, width: 64, height: 64, borderRadius: 32, borderWidth: 4, borderColor: colors.ink, backgroundColor: colors.candy.yellow, alignItems: 'center', justifyContent: 'center', padding: 10, ...lift(4) },
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
