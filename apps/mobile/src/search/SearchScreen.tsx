import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { TextStyle } from 'react-native';
import { formatPersianNumber, toPersianDigits } from '@dozari/shared';
import { CandyButton } from '../components/CandyButton';
import { DiamondBackground } from '../components/DiamondBackground';
import { Character } from '../components/Character';
import { fa } from '../i18n/fa';
import { candyTone, colors, fonts } from '../theme/colors';
import { characterFor } from '../duel/arena';
import { fetchCandidates } from '../duel/api';
import { facesFor, nextScan, searchClock, waitClock } from './scan';
import type { Face } from './scan';
import { safeTop } from '../theme/safeArea';

// `direction` is not accepted inside StyleSheet.create by react-native-web's dev validation.
const LTR: TextStyle = { direction: 'ltr' };
const TICK_MS = 450;
const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const ROW_TONES = ['pink', 'grape', 'sky', 'orange'] as const;
const CELL_TONES = ['pink', 'orange', 'yellow', 'sky', 'grape', 'lime'] as const;
const toneOfCell = (i: number) =>
  candyTone[CELL_TONES[(i * 7 + 1) % CELL_TONES.length] as (typeof CELL_TONES)[number]];

// Plain RN <Text> layers instead of <SvgText>: SVG text does not shape/join Persian letters correctly on phones.
const OUTLINE: ReadonlyArray<readonly [number, number]> = [[-5, 0], [5, 0], [0, -5], [0, 5], [-4, -4], [4, -4], [-4, 4], [4, 4]];
function Title({ small = false, text }: { small?: boolean; text: string }) {
  const fontSize = small ? 40 : 52;
  const base = { fontFamily: fonts.display, fontSize, lineHeight: fontSize * 1.5, textAlign: 'center' as const };
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={text} style={{ paddingVertical: 6, paddingHorizontal: 8 }}>
      {OUTLINE.map(([dx, dy], i) => (
        <Text key={i} importantForAccessibility="no" style={[base, { position: 'absolute', left: 8 + dx, right: 8 - dx, top: 6 + dy, color: '#2B1240' }]}>{text}</Text>
      ))}
      <Text style={[base, { color: '#FF8FD0' }]}>{text}</Text>
    </View>
  );
}

function PlayerCard({ index, active, face, compact }: { index: number; active: boolean; face: Face; compact: boolean }) {
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
          height: compact ? 54 : 68,
          transform: [{ scale }, { rotate: active ? '-3deg' : '0deg' }],
        },
        active && styles.cardOn,
      ]}
    >
      <View style={styles.face}>
        <Character
          who={face.avatarKey ? characterFor(face.avatarKey) : undefined}
          pose={
            (['idle', 'wave', 'cheer', 'thinking', 'shocked', 'blink', 'win', 'sleeping'] as const)[
              index % 8
            ]
          }
          skin={face.avatarKey ? undefined : index % 7}
          crop="face"
          wobble={false}
        />
      </View>
      <Text style={styles.level}>{formatPersianNumber(face.level)}</Text>
      <Text style={styles.name} numberOfLines={1}>
        {face.name}
      </Text>
      {active ? <View style={styles.shine} /> : null}
    </Animated.View>
  );
}

/**
 * Opponent search screen ("screen-search" in the design kit): a grid of candidate players being scanned, you vs «؟», cancel.
 * `waitedSec` (the real queue time) replaces the demo clock; the duel shows this while searching (D104).
 */
export function SearchScreen({ onCancel, waitedSec, team = false, note }: { onCancel: () => void; waitedSec?: number; /** 2v2: looks for a teammate and two rivals (three players), not one opponent. */ team?: boolean; /** Why the search is going nowhere (the server says so), shown above the cancel button. */ note?: string }) {
  const compact = useWindowDimensions().height < 800;
  const [scan, setScan] = useState(0);
  const [ticks, setTicks] = useState(0);
  const [faces, setFaces] = useState<Face[]>(() => facesFor([], fa.kit.search.players));
  // Real online players (and bots when few) take the grid's places; refreshed now and then while waiting.
  useEffect(() => {
    let alive = true;
    const load = () => void fetchCandidates().then((c) => alive && c.length > 0 && setFaces(facesFor(c, fa.kit.search.players)));
    load();
    const id = setInterval(load, 12_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
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

  const s = fa.kit.search;
  /** A scanning «؟» disc showing one of the faces going by; `offset` keeps the several discs of a 2v2 on different faces. */
  const mystery = (offset: number, size: number) => (
    <View style={styles.side}>
      <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2, backgroundColor: toneOfCell(scan + offset).base }]}>
        <Animated.View style={[styles.sweep, { borderRadius: size / 2 + 6, borderTopWidth: size / 2, borderRightWidth: size / 2, transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]} />
        <Text style={[styles.unknown, size < 60 ? styles.unknownSmall : null]}>{s.unknown}</Text>
      </View>
      <Text style={[styles.sideName, size < 60 ? styles.sideNameSmall : null]} numberOfLines={1}>{faces[(scan + offset) % faces.length]?.name}</Text>
    </View>
  );
  const you = (size: number) => (
    <View style={styles.side}>
      <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2, backgroundColor: candyTone.lime.base }]}>
        <View style={{ width: size * 0.76, height: size * 0.76 }}><Character pose="idle" skin={0} crop="face" /></View>
      </View>
      <Text style={[styles.sideName, size < 60 ? styles.sideNameSmall : null]}>{s.you}</Text>
    </View>
  );
  return (
    <DiamondBackground>
      <View style={styles.screen}>
        <View style={styles.title}>
          <Title small={compact} text={team ? fa.kit.search.titleTeam : fa.kit.search.title} />
          {team ? <Text style={styles.teamNote}>{fa.kit.search.teamNote}</Text> : null}
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
                <PlayerCard key={k} index={r * 4 + k} active={r * 4 + k === scan} face={faces[r * 4 + k] as Face} compact={compact} />
              ))}
            </View>
          ))}
        </View>
        <View style={styles.versusSlot}>
        <View style={styles.versus}>
          {team ? (
            <View style={styles.pair}>
              {you(46)}
              {mystery(3, 46)}
            </View>
          ) : (
            you(68)
          )}
          <View style={styles.middle}>
            <Animated.Text style={[styles.vs, { transform: [{ scale: pulse }] }]}>
              {s.versus}
            </Animated.Text>
            {/* «در حال جستجو…» and the seconds share one line (they used to stack and the second line fell onto the panel's border). */}
            <View style={styles.statusRow}>
              <Text style={styles.clock} numberOfLines={1}>{s.searching}</Text>
              <Text style={[styles.clock, styles.clockTime, LTR]}>{toPersianDigits(waitedSec === undefined ? searchClock(ticks, TICK_MS) : waitClock(waitedSec))}</Text>
            </View>
          </View>
          {team ? (
            <View style={styles.pair}>
              {mystery(0, 46)}
              {mystery(7, 46)}
            </View>
          ) : (
            mystery(0, 68)
          )}
        </View>
        </View>
        {note ? <Text style={styles.note}>{note}</Text> : null}
        <View style={styles.cancel}>
          <CandyButton label={s.cancel} sfx="back" color={candyTone.orange.base} onPress={onCancel} />
        </View>
      </View>
    </DiamondBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 10, paddingTop: safeTop(Platform.OS === 'web' ? 18 : 34) },
  title: { alignItems: 'center', marginBottom: 6 },
  teamNote: { fontFamily: fonts.bold, fontSize: 12, color: colors.cream, opacity: 0.85, marginTop: -4 },
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
  versusSlot: { flex: 1, justifyContent: 'center', paddingHorizontal: 6 },
  versus: {
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
  sideName: { fontFamily: fonts.display, fontSize: 15, color: colors.cream, maxWidth: 80 },
  sideNameSmall: { fontSize: 12, maxWidth: 60 },
  pair: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  unknownSmall: { fontSize: 28 },
  middle: { alignItems: 'center', gap: 0 },
  vs: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 52,
    color: colors.candy.yellow,
    textShadowColor: colors.ink,
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 0,
  },
  statusRow: { flexDirection: ROW, alignItems: 'center', gap: 6 },
  clock: { fontFamily: fonts.bold, fontSize: 12, color: colors.cream },
  clockTime: { fontFamily: fonts.display, fontSize: 14, color: colors.candy.yellow, minWidth: 34, textAlign: 'center' },
  note: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream, textAlign: 'center', paddingHorizontal: 20, lineHeight: 22 },
  cancel: { alignItems: 'center', paddingBottom: 26, paddingTop: 6 },
});
