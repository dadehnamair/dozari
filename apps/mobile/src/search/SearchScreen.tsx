import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { TextStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { formatPersianNumber, toPersianDigits } from '@dozari/shared';
import { CandyButton } from '../components/CandyButton';
import { DiamondBackground } from '../components/DiamondBackground';
import { Mascot } from '../components/Mascot';
import { fa } from '../i18n/fa';
import { candyTone, colors, fonts } from '../theme/colors';
import { cellLevel, nextScan, searchClock, waitClock } from './scan';
import { safeTop } from '../theme/safeArea';

// `direction` is not accepted inside StyleSheet.create by react-native-web's dev validation.
const LTR: TextStyle = { direction: 'ltr' };
const TICK_MS = 450;
const ROW_TONES = ['pink', 'grape', 'sky', 'orange'] as const;
const CELL_TONES = ['pink', 'orange', 'yellow', 'sky', 'grape', 'lime'] as const;
const toneOfCell = (i: number) =>
  candyTone[CELL_TONES[(i * 7 + 1) % CELL_TONES.length] as (typeof CELL_TONES)[number]];

function Title() {
  return (
    <Svg
      width={296}
      height={296 * (160 / 760)}
      viewBox="-120 0 760 160"
      style={{ overflow: 'visible' }}
      accessibilityLabel={fa.kit.search.title}
    >
      <Defs>
        <LinearGradient id="srT" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE0F0" />
          <Stop offset="0.45" stopColor="#FF8FD0" />
          <Stop offset="1" stopColor="#D43FB0" />
        </LinearGradient>
      </Defs>
      <SvgText
        x={260}
        y={104}
        textAnchor="middle"
        fontFamily={fonts.display}
        fontSize={104}
        fill="#2B1240"
        stroke="#2B1240"
        strokeWidth={22}
        strokeLinejoin="round"
      >
        {fa.kit.search.title}
      </SvgText>
      <SvgText
        x={260}
        y={96}
        textAnchor="middle"
        fontFamily={fonts.display}
        fontSize={104}
        fill="#5A1460"
        stroke="#5A1460"
        strokeWidth={10}
        strokeLinejoin="round"
      >
        {fa.kit.search.title}
      </SvgText>
      <SvgText
        x={260}
        y={96}
        textAnchor="middle"
        fontFamily={fonts.display}
        fontSize={104}
        fill="url(#srT)"
      >
        {fa.kit.search.title}
      </SvgText>
    </Svg>
  );
}

function PlayerCard({ index, active }: { index: number; active: boolean }) {
  const tone = toneOfCell(index);
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(scale, {
      toValue: active ? 1.12 : 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [active, scale]);
  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: tone.base,
          borderColor: active ? colors.candy.yellow : colors.ink,
          zIndex: active ? 2 : 1,
          transform: [{ scale }, { rotate: active ? '-3deg' : '0deg' }],
        },
        active && styles.cardOn,
      ]}
    >
      <View style={styles.face}>
        <Mascot
          pose={
            (['idle', 'wave', 'cheer', 'thinking', 'shocked', 'blink', 'win', 'sleeping'] as const)[
              index % 8
            ]
          }
          skin={index % 7}
          crop="face"
        />
      </View>
      <Text style={styles.level}>{formatPersianNumber(cellLevel(index))}</Text>
      <Text style={styles.name} numberOfLines={1}>
        {fa.kit.search.players[index]}
      </Text>
      {active ? <View style={styles.shine} /> : null}
    </Animated.View>
  );
}

/**
 * Opponent search screen ("screen-search" in the design kit): a grid of candidate players being scanned, you vs «؟», cancel.
 * `waitedSec` (the real queue time) replaces the demo clock; the duel shows this while searching (D104).
 */
export function SearchScreen({ onCancel, waitedSec }: { onCancel: () => void; waitedSec?: number }) {
  const [scan, setScan] = useState(0);
  const [ticks, setTicks] = useState(0);
  const pulse = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      setScan((s) => nextScan(s, Math.random()));
      setTicks((t) => t + 1);
    }, TICK_MS);
    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.18,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
      Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    ];
    loops.forEach((l) => l.start());
    return () => {
      clearInterval(timer);
      loops.forEach((l) => l.stop());
    };
  }, [pulse, spin]);

  const scanTone = toneOfCell(scan);
  const s = fa.kit.search;
  return (
    <DiamondBackground>
      <View style={styles.screen}>
        <View style={styles.title}>
          <Title />
        </View>
        <View style={styles.rows}>
          {ROW_TONES.map((rt, r) => (
            <View
              key={rt}
              style={[
                styles.row,
                { backgroundColor: candyTone[rt].base, borderTopColor: candyTone[rt].light },
              ]}
            >
              {[0, 1, 2, 3].map((k) => (
                <PlayerCard key={k} index={r * 4 + k} active={r * 4 + k === scan} />
              ))}
            </View>
          ))}
        </View>
        <View style={styles.versus}>
          <View style={styles.side}>
            <View style={[styles.disc, { backgroundColor: candyTone.lime.base }]}>
              <View style={styles.discFace}>
                <Mascot pose="idle" skin={0} crop="face" />
              </View>
            </View>
            <Text style={styles.sideName}>{s.you}</Text>
          </View>
          <View style={styles.middle}>
            <Animated.Text style={[styles.vs, { transform: [{ scale: pulse }] }]}>
              {s.versus}
            </Animated.Text>
            <Text style={[styles.clock, LTR]}>{toPersianDigits(waitedSec === undefined ? searchClock(ticks, TICK_MS) : waitClock(waitedSec))}</Text>
            <Text style={styles.clock}>{s.searching}</Text>
          </View>
          <View style={styles.side}>
            <View style={[styles.disc, { backgroundColor: scanTone.base }]}>
              <Animated.View
                style={[
                  styles.sweep,
                  {
                    transform: [
                      {
                        rotate: spin.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Text style={styles.unknown}>{s.unknown}</Text>
            </View>
            <Text style={styles.sideName}>{s.players[scan]}</Text>
          </View>
        </View>
        <View style={styles.cancel}>
          <CandyButton label={s.cancel} color={candyTone.orange.base} onPress={onCancel} />
        </View>
      </View>
    </DiamondBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 10, paddingTop: safeTop(34) },
  title: { alignItems: 'center', marginBottom: 6 },
  rows: { gap: 5 },
  row: {
    flexDirection: 'row',
    gap: 6,
    padding: 7,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.ink,
    borderTopWidth: 5,
    borderBottomWidth: 6,
  },
  card: {
    flex: 1,
    height: 68,
    borderRadius: 12,
    borderWidth: 3,
    borderBottomWidth: 5,
    overflow: 'hidden',
    alignItems: 'center',
  },
  cardOn: {
    shadowColor: colors.candy.yellow,
    shadowOpacity: 0.85,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  face: { position: 'absolute', top: 2, left: 4, right: 4, bottom: 20 },
  level: {
    position: 'absolute',
    top: 3,
    right: 3,
    minWidth: 20,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 6,
    backgroundColor: colors.ink,
    color: colors.candy.yellow,
    fontFamily: fonts.display,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  name: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    backgroundColor: 'rgba(43,18,64,0.85)',
    color: '#fff',
    fontFamily: fonts.display,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  versus: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    height: 108,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  side: { alignItems: 'center', gap: 4 },
  disc: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: colors.cream,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discFace: { width: 52, height: 52 },
  sweep: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 40,
    borderTopWidth: 34,
    borderTopColor: 'rgba(255,255,255,0.45)',
    borderRightWidth: 34,
    borderRightColor: 'transparent',
  },
  unknown: {
    fontFamily: fonts.display,
    fontSize: 38,
    color: '#fff',
    textShadowColor: colors.ink,
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 0,
  },
  sideName: { fontFamily: fonts.display, fontSize: 15, color: colors.cream },
  middle: { alignItems: 'center', gap: 2 },
  vs: {
    fontFamily: fonts.display,
    fontSize: 44,
    color: colors.candy.yellow,
    textShadowColor: colors.ink,
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 0,
  },
  clock: { fontFamily: fonts.bold, fontSize: 12, color: colors.cream },
  cancel: { position: 'absolute', bottom: 30, left: 0, right: 0, alignItems: 'center' },
});
