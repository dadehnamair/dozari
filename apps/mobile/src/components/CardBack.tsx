import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Text as SvgText } from 'react-native-svg';
import { usePrefs } from '../prefs/store';
import { colors } from '../theme/colors';

/** The back of a card (screen-match of `13 Match Screens v2`): a candy colour with a dashed inner frame and one small animated motif. */
const PAL = ['#FF4D8D', '#3FC1F0', '#FFC93C', '#A66BF0', '#7ED957', '#FF7A3D'] as const;
const INK = colors.ink;
const CREAM = '#FFF6E8';
const STROKE = { stroke: INK, strokeWidth: 2.6, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;

/** Stable small number out of a card id, so a card keeps its colour and motif while the grid changes. */
export function backSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export const BACK_TONES = PAL;
export const BACK_MOTIFS = 9;

function star(n: number, ro: number, ri: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push(`${(32 + r * Math.cos(a)).toFixed(1)},${(32 + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

const wave = (y: number) => `M10 ${y}q5.5-6 11 0t11 0t11 0t11 0`;

type Kind = 'spin' | 'spinSlow' | 'bob' | 'blink' | 'sway' | 'beat' | 'twinkle' | 'coin';
const KINDS: readonly Kind[] = ['spin', 'spinSlow', 'bob', 'blink', 'sway', 'beat', 'twinkle', 'coin', 'bob'];

function motif(i: number, f: string, a: string) {
  switch (i % BACK_MOTIFS) {
    case 0:
      return (
        <>
          <Polygon points={star(8, 20, 12)} fill={f} {...STROKE} />
          <Circle cx={32} cy={32} r={6} fill={a} {...STROKE} />
        </>
      );
    case 1:
      return (
        <>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => <Line key={d} x1={32} y1={7} x2={32} y2={14} transform={`rotate(${d} 32 32)`} {...STROKE} />)}
          <Circle cx={32} cy={32} r={13} fill={f} {...STROKE} />
          <Circle cx={27.5} cy={30} r={1.8} fill={INK} />
          <Circle cx={36.5} cy={30} r={1.8} fill={INK} />
          <Path d="M27 36q5 4 10 0" fill="none" {...STROKE} />
          <Circle cx={24} cy={35} r={2} fill="#FF8FB6" />
          <Circle cx={40} cy={35} r={2} fill="#FF8FB6" />
        </>
      );
    case 2:
      return (
        <>
          <Path d="M34 12a20 20 0 1 0 18 30a15 15 0 1 1-18-30z" fill={f} {...STROKE} />
          <Polygon points="48,11 49.6,16.4 55,18 49.6,19.6 48,25 46.4,19.6 41,18 46.4,16.4" fill={a} {...STROKE} />
        </>
      );
    case 3:
      return (
        <>
          <Path d="M8 32Q32 11 56 32Q32 53 8 32z" fill={f} {...STROKE} />
          <Circle cx={32} cy={32} r={9} fill={a} {...STROKE} />
          <Circle cx={32} cy={32} r={3.6} fill={INK} />
          <Circle cx={35} cy={29} r={1.6} fill="#fff" />
        </>
      );
    case 4:
      return (
        <>
          <Path d="M30 54C15 53 10 40 15 30 21 18 36 14 44 21c6 6 3 15-4 15-4 0-6-4-3-6" fill={f} {...STROKE} />
          <Circle cx={25} cy={40} r={4.5} fill={a} {...STROKE} />
        </>
      );
    case 5:
      return (
        <>
          <Circle cx={32} cy={32} r={19} fill={f} {...STROKE} />
          <Circle cx={32} cy={32} r={12.5} fill={a} {...STROKE} />
          <Circle cx={32} cy={32} r={5.5} fill={f} {...STROKE} />
        </>
      );
    case 6:
      return (
        <>
          {([[32, 15, f], [15, 32, a], [49, 32, a], [32, 49, f], [32, 32, f]] as const).map(([x, y, c]) => (
            <Path key={`${x}-${y}`} d={`M${x} ${y - 7}l7 7-7 7-7-7z`} fill={c} {...STROKE} />
          ))}
        </>
      );
    case 7:
      return (
        <>
          <Circle cx={32} cy={32} r={19} fill="#FFC93C" {...STROKE} />
          <Circle cx={32} cy={32} r={13.5} fill="none" stroke="#C48A0E" strokeWidth={2} strokeDasharray="3 3" />
          <SvgText x={32} y={41} textAnchor="middle" fontFamily="Lalezar_400Regular" fontSize={24} fill={INK}>۲</SvgText>
          <Path d="M22 24q4-5 9-6" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" />
        </>
      );
    default:
      return (
        <>
          {[20, 32, 44].map((y) => (
            <G key={y}>
              <Path d={wave(y)} fill="none" stroke={INK} strokeWidth={6.5} strokeLinecap="round" />
              <Path d={wave(y)} fill="none" stroke={CREAM} strokeWidth={2.6} strokeLinecap="round" />
            </G>
          ))}
        </>
      );
  }
}

/** One loop per kind, on the native driver: spin / bob / sway / beat / blink / twinkle / coin turn, as the design's keyframes. */
function Loop({ kind, run, children }: { kind: Kind; run: boolean; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!run) return;
    const step = (to: number, ms: number, easing = Easing.inOut(Easing.quad)) => Animated.timing(v, { toValue: to, duration: ms, easing, useNativeDriver: true });
    const spin = kind === 'spin' || kind === 'spinSlow';
    const loop = Animated.loop(
      spin
        ? Animated.timing(v, { toValue: 1, duration: kind === 'spin' ? 10000 : 8000, easing: Easing.linear, useNativeDriver: true })
        : Animated.sequence([step(1, kind === 'blink' ? 3000 : kind === 'coin' ? 1200 : 1300), step(0, kind === 'blink' ? 400 : kind === 'coin' ? 1200 : 1300)]),
    );
    v.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [kind, run, v]);
  const style =
    kind === 'spin' || kind === 'spinSlow'
      ? { transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: [kind === 'spin' ? '0deg' : '360deg', kind === 'spin' ? '360deg' : '0deg'] }) }] }
      : kind === 'bob'
        ? { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [2, -3] }) }] }
        : kind === 'sway'
          ? { transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['-10deg', '10deg'] }) }] }
          : kind === 'beat'
            ? { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.08] }) }] }
            : kind === 'blink'
              ? { transform: [{ scaleY: v.interpolate({ inputRange: [0, 0.9, 1], outputRange: [1, 1, 0.1] }) }] }
              : kind === 'coin'
                ? { transform: [{ scaleX: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.15] }) }] }
                : { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) };
  return <Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}

/** Fills the back face of one card: `seed` picks its colour and motif; `size` is the motif's side in px. */
export function CardBack({ seed, size, run }: { seed: number; size: number; run: boolean }) {
  const { reduceMotion } = usePrefs();
  const f = CREAM;
  const a = PAL[(seed + 2) % PAL.length]!;
  return (
    <View style={styles.fill} pointerEvents="none">
      <View style={styles.frame} />
      <View style={{ width: size, height: size }}>
        <Loop kind={KINDS[seed % BACK_MOTIFS]!} run={run && !reduceMotion}>
          <Svg width={size} height={size} viewBox="0 0 64 64" style={{ overflow: 'visible' }}>{motif(seed, f, a)}</Svg>
        </Loop>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  frame: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderRadius: 9, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,246,232,0.75)' },
});
