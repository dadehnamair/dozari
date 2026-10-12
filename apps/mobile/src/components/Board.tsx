import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { GROUP_SIZE } from '@dozari/shared';
import type { SoloCard, SoloSolvedGroup } from '@dozari/shared';
import { colors, groupShelf, tile } from '../theme/colors';
import { fa } from '../i18n/fa';
import { NAME_FLOOR, cardMetrics, cellWidth } from './boardLayout';
import { playSfx } from '../sound/engine';
import { Item } from './Item';
import { usePrefs } from '../prefs/store';
import { useTheme } from '../theme/themeStore';

const GAP = 8;

/** The result of a four-card guess, drawn on those cards: wrong = red + shake, correct = green + pop. `n` makes each guess a new event. */
export interface BoardVerdict {
  kind: 'wrong' | 'correct';
  ids: readonly string[];
  n: number;
}

/** How long a wrong guess shakes before the screen puts the cards back. */
export const WRONG_SHAKE_MS = 700;
/** How long the cards of a correct guess glow green before they turn into a row. */
export const CORRECT_GLOW_MS = 480;

interface BoardProps {
  solved: readonly SoloSolvedGroup[];
  cards: readonly SoloCard[];
  names: Readonly<Record<string, string>>;
  selected: readonly string[];
  onToggle: (id: string) => void;
  disabled: boolean;
  /** Cards a paid hint pointed at; drawn with a gold frame. */
  hinted?: readonly string[];
  /** Cards softly lit by the idle nudge (a gentle pulse, not the hard frame of a paid hint). */
  nudged?: readonly string[];
  /** Opponent's turn: cards are drawn desaturated so the turn reads at a glance. */
  muted?: boolean;
  /** The last guess' verdict; the cards it names shake red (wrong) or glow green (correct). */
  verdict?: BoardVerdict | null;
}

/** Solved rows stack on top (in the order found), the remaining cards fill a 4-wide grid below. */
export function Board({ solved, cards, names, selected, onToggle, disabled, hinted = [], nudged = [], muted = false, verdict = null }: BoardProps) {
  const [width, setWidth] = useState(0);
  const w = cellWidth(width, GAP, GROUP_SIZE);
  const adult = useTheme() === 'adult';
  /** Rows already there when the board first showed (a result screen) stay still; rows found afterwards pop in. */
  const initial = useRef<Set<number> | null>(null);
  const first = (initial.current ??= new Set(solved.map((g) => g.level)));
  return (
    <View style={styles.board} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {solved.map((g) => {
        // A found group takes exactly the height of a row of cards, so the board never grows when rows turn into groups.
        const why = `${g.revealed ? `${fa.solo.revealed} · ` : ''}${g.explanationFa === g.titleFa ? '' : g.explanationFa}`.trim();
        return (
          <SolvedRow key={g.level} fresh={!first.has(g.level)} style={[styles.row, w > 0 && { height: cardMetrics(w).height }, { backgroundColor: colors.group[g.level], borderBottomColor: groupShelf[g.level] }]} label={g.titleFa}>
            <Text style={styles.rowTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{g.titleFa}</Text>
            <Text style={styles.rowItems} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{g.productIds.map((id) => names[id] ?? id).join('، ')}</Text>
            {why ? <Text style={styles.rowWhy} numberOfLines={2}>{why}</Text> : null}
          </SolvedRow>
        );
      })}
      <View style={styles.grid}>
        {cards.map((c) => {
          const on = selected.includes(c.id);
          const m = cardMetrics(w);
          const idx = verdict ? verdict.ids.indexOf(c.id) : -1;
          return (
            <CardCell
              key={c.id}
              card={c}
              m={m}
              on={on}
              adult={adult}
              disabled={disabled}
              verdict={idx >= 0 ? verdict : null}
              order={Math.max(0, idx)}
              style={[styles.cell, w > 0 && { width: w, height: m.height }, on && (adult ? styles.cellOnAdult : styles.cellOn), hinted.includes(c.id) && styles.cellHint, nudged.includes(c.id) && !on && styles.cellNudge, muted && (on ? styles.cellMutedOn : styles.cellMuted)]}
              onPress={() => (playSfx(on ? 'deselect' : 'select'), onToggle(c.id))}
            />
          );
        })}
      </View>
    </View>
  );
}

type Metrics = ReturnType<typeof cardMetrics>;

/** One card of the grid. Owns the verdict animation so each card can shake / glow on its own clock. */
function CardCell({ card: c, m, on, adult, disabled, verdict, order, style, onPress }: { card: SoloCard; m: Metrics; on: boolean; adult: boolean; disabled: boolean; verdict: BoardVerdict | null; order: number; style: React.ComponentProps<typeof Pressable>['style']; onPress: () => void }) {
  const { reduceMotion } = usePrefs();
  const shake = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  /** 0 = resting on its shelf, 1 = pressed in and glowing: springs so a tap feels physical. */
  const press = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return press.setValue(on ? 1 : 0);
    const run = Animated.spring(press, { toValue: on ? 1 : 0, friction: on ? 5 : 7, tension: on ? 260 : 180, useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [on, reduceMotion, press]);
  const n = verdict?.n;
  useEffect(() => {
    if (!verdict || reduceMotion) return;
    const delay = order * 45;
    if (verdict.kind === 'wrong') {
      const hop = (to: number) => Animated.timing(shake, { toValue: to, duration: 55, easing: Easing.linear, useNativeDriver: true });
      const run = Animated.parallel([
        Animated.sequence([Animated.delay(delay), hop(-9), hop(9), hop(-8), hop(8), hop(-5), hop(5), hop(0)]),
        Animated.sequence([Animated.delay(delay), Animated.timing(glow, { toValue: 1, duration: 90, useNativeDriver: true }), Animated.delay(360), Animated.timing(glow, { toValue: 0, duration: 220, useNativeDriver: true })]),
      ]);
      run.start();
      return () => run.stop();
    }
    const run = Animated.parallel([
      Animated.sequence([Animated.delay(delay), Animated.timing(glow, { toValue: 1, duration: 110, useNativeDriver: true }), Animated.delay(300), Animated.timing(glow, { toValue: 0, duration: 200, useNativeDriver: true })]),
      Animated.sequence([Animated.delay(delay), Animated.spring(pop, { toValue: 1.09, friction: 4, tension: 220, useNativeDriver: true }), Animated.timing(pop, { toValue: 1, duration: 160, useNativeDriver: true })]),
    ]);
    run.start();
    return () => run.stop();
  }, [n]);
  return (
    <Animated.View style={[on && (adult ? styles.glowAdult : styles.glow), { transform: [{ translateX: shake }, { scale: pop }, { translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, 2] }) }, { scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] }) }] }]}>
      <Pressable disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={style}>
        {/* Glossy face: a soft top highlight, a bright rim line and a shade toward the shelf (no gradient dependency). */}
        <View pointerEvents="none" style={[styles.shade, adult ? (on ? styles.shadeOnAdult : styles.shadeIdleAdult) : on ? styles.shadeOn : styles.shadeIdle]} />
        <View pointerEvents="none" style={[styles.gloss, adult ? (on ? styles.glossOnAdult : styles.glossIdleAdult) : on ? styles.glossOn : styles.glossIdle]} />
        <View pointerEvents="none" style={[styles.rim, adult ? (on ? styles.rimOnAdult : styles.rimIdleAdult) : on ? styles.rimOn : styles.rimIdle]} />
        {/* Adult: an engraved inner line, like the plate of a vault box (bright gold when chosen). */}
        {adult ? <View pointerEvents="none" style={[styles.plate, on ? styles.plateOn : styles.plateIdle]} /> : null}
        {c.iconKey ? (
          <View style={{ width: m.icon, height: m.icon }}>
            <Item icon={c.iconKey} />
          </View>
        ) : null}
        <Text style={[styles.name, { fontSize: m.nameSize }, on && styles.nameOn]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={NAME_FLOOR / m.nameSize}>{c.nameFa}</Text>
        {c.unitFa ? <Text style={[styles.unit, { fontSize: m.unitSize }, on && styles.nameOn]} numberOfLines={1}>{c.unitFa}</Text> : null}
        {verdict ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: verdict.kind === 'wrong' ? '#E5384F' : '#34C759', opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.82] }) }]} /> : null}
      </Pressable>
    </Animated.View>
  );
}

/** A found group's row. A row found during play pops in with a green flash; one already there on first render stays still. */
function SolvedRow({ fresh, style, label, children }: { fresh: boolean; style: React.ComponentProps<typeof View>['style']; label: string; children: React.ReactNode }) {
  const { reduceMotion } = usePrefs();
  const animate = fresh && !reduceMotion;
  const scale = useRef(new Animated.Value(animate ? 0.86 : 1)).current;
  const flash = useRef(new Animated.Value(animate ? 1 : 0)).current;
  useEffect(() => {
    if (!animate) return;
    const run = Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 650, useNativeDriver: true }),
    ]);
    run.start();
    return () => run.stop();
  }, [animate, scale, flash]);
  return (
    <Animated.View style={[style, { transform: [{ scale }] }]} accessibilityLabel={label}>
      {children}
      {animate ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#7DFF9C', opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.75] }) }]} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /** A selection shown while it is the other side's turn keeps its purple face and white text (the grey look would put white on grey). */
  cellMutedOn: { opacity: 0.85 },
  cellMuted: { backgroundColor: '#D9D9DE', borderBottomColor: '#B5B5BC', opacity: 0.7 },
  cellNudge: { backgroundColor: '#FFF3C4', borderColor: 'rgba(255,201,60,0.8)', borderWidth: 3 },
  cellHint: { borderColor: '#FFC93C', borderWidth: 4 },
  board: { gap: GAP, width: '100%', maxWidth: 520, alignSelf: 'center' },
  row: { borderRadius: 16, borderWidth: 3, borderColor: colors.ink, borderBottomWidth: 6, paddingVertical: 4, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', gap: 1, overflow: 'hidden' },
  rowTitle: { fontFamily: 'Vazirmatn_700Bold', fontSize: 15, lineHeight: 21, color: colors.ink, maxWidth: '100%' },
  rowItems: { fontFamily: 'Vazirmatn_400Regular', fontSize: 13, lineHeight: 18, color: colors.ink, textAlign: 'center', maxWidth: '100%' },
  rowWhy: { fontFamily: 'Vazirmatn_400Regular', fontSize: 11, lineHeight: 15, color: colors.ink, opacity: 0.75, textAlign: 'center', maxWidth: '100%' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  /** Purple halo around a chosen card. */
  glow: { borderRadius: 18, shadowColor: '#A66BF0', shadowOpacity: 0.75, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  /** Adult (vault look): brass plate when idle; dark bronze lit from within by a gold frame and glow when chosen. */
  glowAdult: { borderRadius: 18, shadowColor: '#FFC93C', shadowOpacity: 0.85, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  cellOnAdult: { backgroundColor: tile.selected.face, borderColor: '#FFD76A', borderBottomColor: '#FFD76A', borderBottomWidth: 4, borderWidth: 2 },
  shadeIdleAdult: { backgroundColor: 'rgba(138,90,22,0.24)' },
  shadeOnAdult: { backgroundColor: 'rgba(0,0,0,0.4)' },
  glossIdleAdult: { backgroundColor: 'rgba(255,250,225,0.6)' },
  glossOnAdult: { backgroundColor: 'rgba(255,215,106,0.14)' },
  rimIdleAdult: { backgroundColor: 'rgba(255,255,240,0.95)' },
  rimOnAdult: { backgroundColor: 'rgba(255,225,140,0.8)' },
  plate: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderRadius: 13, borderWidth: 1 },
  plateIdle: { borderColor: 'rgba(138,90,22,0.45)' },
  plateOn: { borderColor: 'rgba(255,215,106,0.55)' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '32%' },
  shadeIdle: { backgroundColor: 'rgba(184,147,106,0.16)' },
  shadeOn: { backgroundColor: 'rgba(20,6,50,0.22)' },
  gloss: { position: 'absolute', top: 4, left: 6, right: 6, height: '36%', borderRadius: 12 },
  glossIdle: { backgroundColor: 'rgba(255,255,255,0.55)' },
  glossOn: { backgroundColor: 'rgba(255,255,255,0.2)' },
  rim: { position: 'absolute', top: 0, left: 8, right: 8, height: 3, borderRadius: 2 },
  rimIdle: { backgroundColor: 'rgba(255,255,255,0.9)' },
  rimOn: { backgroundColor: 'rgba(255,255,255,0.55)' },
  cell: {
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.ink,
    borderBottomWidth: 7,
    borderBottomColor: tile.idle.shelf,
    backgroundColor: tile.idle.face,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    overflow: 'hidden',
  },
  cellOn: { backgroundColor: tile.selected.face, borderColor: tile.selected.shelf, borderBottomColor: tile.selected.shelf, borderBottomWidth: 5 },
  name: { fontFamily: 'Vazirmatn_700Bold', fontSize: 14, color: tile.idle.text, textAlign: 'center' },
  unit: { fontFamily: 'Vazirmatn_400Regular', fontSize: 11, color: colors.ink, opacity: 0.7, textAlign: 'center' },
  nameOn: { color: tile.selected.text },
});
