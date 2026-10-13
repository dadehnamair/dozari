import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { solarMonthOf } from '@dozari/shared';
import { Character } from '../components/Character';
import { Item } from '../components/Item';
import { fa } from '../i18n/fa';
import { buzz } from '../sound/engine';
import { colors, fonts } from '../theme/colors';
import type { CharacterId } from '../theme/character';

type Outcome = 'won' | 'lost' | 'draw';
type Who = { who: CharacterId; name: string };

/** How long the splash holds before it fades out; a tap skips it. */
export const END_SPLASH_MS = 2300;
const RAYS = 14;
const TITLE: Record<Outcome, string> = { won: fa.duel.won, lost: fa.duel.lost, draw: fa.duel.draw };
const GLOW: Record<Outcome, string> = { won: '#FFC93C', lost: '#7C8FD8', draw: '#C9A3FF' };

/**
 * The finish of a match, before the result page: a spinning sunburst, the two portraits (the winner big and crowned, the other small and dimmed),
 * and the verdict stamped on with a bounce. Lasts about two seconds; tapping skips it. Not shown when motion is reduced.
 */
export function EndSplash({ outcome, me, rival, onDone }: { outcome: Outcome; me: Who; rival: Who; onDone: () => void }) {
  const pop = useRef(new Animated.Value(0)).current;
  const stamp = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const spinLoop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true }));
    spinLoop.start();
    const run = Animated.sequence([
      Animated.spring(pop, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
      Animated.spring(stamp, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
    ]);
    run.start();
    const buzzId = setTimeout(() => buzz(outcome === 'won' ? 90 : 50), 520);
    const fadeId = setTimeout(() => Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => done.current()), END_SPLASH_MS);
    return () => {
      spinLoop.stop();
      run.stop();
      clearTimeout(buzzId);
      clearTimeout(fadeId);
    };
  }, [outcome, pop, stamp, spin, fade]);

  const portrait = (who: Who, big: boolean) => (
    <Animated.View style={[styles.portrait, big ? styles.big : styles.small, { opacity: big ? 1 : outcome === 'draw' ? 1 : 0.6, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }] }]}>
      <View style={[styles.faceIn, { borderColor: big ? GLOW[outcome] : colors.cream }]}>
        <Character who={who.who} pose={big && outcome === 'won' ? 'win' : 'idle'} crop="face" month={who.who === 'dozari' ? solarMonthOf(Date.now()) : undefined} />
      </View>
      {big && outcome !== 'draw' ? <View style={styles.crown}><Item icon="crown" /></View> : null}
    </Animated.View>
  );
  // Winner first on the left/right of the pair; a draw shows both the same size.
  const mineBig = outcome !== 'lost';
  const rivalBig = outcome !== 'won';

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => done.current()} accessibilityRole="button" accessibilityLabel={TITLE[outcome]}>
        <Animated.View style={[styles.rays, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]} pointerEvents="none">
          {Array.from({ length: RAYS }, (_, i) => <View key={i} style={[styles.ray, { backgroundColor: GLOW[outcome], transform: [{ rotate: `${(360 / RAYS) * i}deg` }, { translateY: -150 }] }]} />)}
        </Animated.View>
        <View style={styles.center} pointerEvents="none">
          <View style={styles.pair}>
            {portrait(me, mineBig)}
            {portrait(rival, rivalBig)}
          </View>
          <Animated.View style={[styles.stamp, { backgroundColor: GLOW[outcome], opacity: stamp, transform: [{ scale: stamp.interpolate({ inputRange: [0, 1], outputRange: [2.6, 1] }) }, { rotate: '-4deg' }] }]}>
            <Text style={styles.stampText}>{TITLE[outcome]}</Text>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 60, elevation: 60, backgroundColor: 'rgba(20,8,34,0.9)', alignItems: 'center', justifyContent: 'center' },
  rays: { position: 'absolute', top: '50%', left: '50%', width: 0, height: 0, opacity: 0.28 },
  ray: { position: 'absolute', width: 26, height: 320, marginLeft: -13, marginTop: -160, borderRadius: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 26 },
  pair: { flexDirection: 'row', alignItems: 'flex-end', gap: 18 },
  portrait: { alignItems: 'center' },
  big: { width: 128, height: 128 },
  small: { width: 82, height: 82 },
  faceIn: { width: '100%', height: '100%', borderRadius: 26, borderWidth: 4, backgroundColor: colors.cream, overflow: 'hidden' },
  crown: { position: 'absolute', top: -30, width: 46, height: 46 },
  stamp: { paddingHorizontal: 38, paddingVertical: 6, borderRadius: 20, borderWidth: 4, borderColor: colors.ink, shadowColor: colors.ink, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6 },
  stampText: { fontFamily: fonts.display, fontSize: 44, lineHeight: 62, color: colors.ink },
});
