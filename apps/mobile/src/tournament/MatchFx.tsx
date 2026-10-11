import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { fa } from '../i18n/fa';
import { fonts } from '../theme/colors';
import { usePrefs } from '../prefs/store';

/** A beating green frame and a «● زنده» tag over a match that is being played right now. Still (frame only) when motion is reduced. */
export function LivePulse() {
  const reduce = usePrefs().reduceMotion;
  const beat = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(beat, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => (loop.stop(), beat.setValue(0));
  }, [reduce, beat]);
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.frame, { opacity: reduce ? 0.8 : beat.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }) }]} />
      <View pointerEvents="none" style={styles.tag}>
        <Animated.View style={[styles.dot, reduce ? null : { transform: [{ scale: beat.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.3] }) }] }]} />
        <Text style={styles.tagText}>{fa.tournament.live}</Text>
      </View>
    </>
  );
}

/** The winner's face hops twice when it appears; `on` false = just a plain wrapper. */
export function WinnerHop({ on, children }: { on: boolean; children: React.ReactNode }) {
  const reduce = usePrefs().reduceMotion;
  const hop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on || reduce) return undefined;
    const run = Animated.sequence([
      Animated.delay(150),
      Animated.loop(
        Animated.sequence([
          Animated.timing(hop, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(hop, { toValue: 0, duration: 260, easing: Easing.bounce, useNativeDriver: true }),
        ]),
        { iterations: 2 },
      ),
    ]);
    run.start();
    return () => (run.stop(), hop.setValue(0));
  }, [on, reduce, hop]);
  return (
    <Animated.View style={on && !reduce ? { transform: [{ translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }, { scale: hop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] } : null}>
      {children}
    </Animated.View>
  );
}

/** The ✓ stamp slams in: it starts big and see-through, then settles with a spring. */
export function StampIn({ children }: { children: React.ReactNode }) {
  const reduce = usePrefs().reduceMotion;
  const t = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    Animated.spring(t, { toValue: 1, friction: 4, tension: 120, delay: 200, useNativeDriver: true } as Animated.SpringAnimationConfig).start();
  }, [reduce, t]);
  return <Animated.View style={{ opacity: t.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }), transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [2.4, 1] }) }, { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-25deg', '0deg'] }) }] }}>{children}</Animated.View>;
}

/** The loser's row fades down to its greyed-out look. */
export function LoserFade({ children }: { children: React.ReactNode }) {
  const reduce = usePrefs().reduceMotion;
  const t = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    Animated.timing(t, { toValue: 1, duration: 600, delay: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [reduce, t]);
  return <Animated.View style={{ opacity: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }), transform: [{ translateX: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -3, 0] }) }] }}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  frame: { position: 'absolute', top: -2.5, left: -2.5, right: -2.5, bottom: -2.5, borderRadius: 12, borderWidth: 3, borderColor: '#7ED957' },
  tag: { position: 'absolute', top: -9, alignSelf: 'center', left: '50%', marginLeft: -26, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, height: 17, borderRadius: 9, backgroundColor: '#E5384F', zIndex: 3 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  tagText: { fontFamily: fonts.display, fontSize: 10, lineHeight: 14, color: '#fff' },
});
