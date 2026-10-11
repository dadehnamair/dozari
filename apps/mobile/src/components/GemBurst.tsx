import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { rnd } from './fx';
import { usePrefs } from '../prefs/store';

const SPARKS = 10;
/** How long the burst stays on screen. */
export const GEM_BURST_MS = 2200;

/**
 * A gem found behind a card: a big 💎 pops in the middle of the screen, sparkles fly out and a «+N الماس» label rises.
 * Covers its parent without catching touches; `onDone` fires once it has faded (so the screen can drop it).
 */
export function GemBurst({ amount, onDone }: { amount: number; onDone: () => void }) {
  const { reduceMotion } = usePrefs();
  const t = useRef(new Animated.Value(0)).current;
  const sparks = useMemo(() => Array.from({ length: SPARKS }, (_, i) => ({ angle: (i / SPARKS) * Math.PI * 2 + rnd(-0.3, 0.3, i), dist: rnd(70, 130, i + 3), size: rnd(10, 18, i + 7) })), []);
  useEffect(() => {
    const run = Animated.timing(t, { toValue: 1, duration: reduceMotion ? 900 : GEM_BURST_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    run.start(({ finished }) => finished && onDone());
    return () => run.stop();
  }, [t, onDone, reduceMotion]);
  const pop = t.interpolate({ inputRange: [0, 0.12, 0.25, 1], outputRange: [0.2, 1.35, 1, 1] });
  const fade = t.interpolate({ inputRange: [0, 0.06, 0.8, 1], outputRange: [0, 1, 1, 0] });
  const rise = t.interpolate({ inputRange: [0, 1], outputRange: [0, -46] });
  return (
    <View pointerEvents="none" style={styles.layer} accessibilityLiveRegion="polite" accessibilityLabel={fa.gemCard.found(amount)}>
      <Animated.View style={[styles.center, { opacity: fade, transform: [{ translateY: rise }] }]}>
        {!reduceMotion
          ? sparks.map((s, i) => (
              <Animated.Text
                key={i}
                style={[styles.spark, { fontSize: s.size, transform: [{ translateX: t.interpolate({ inputRange: [0, 0.6], outputRange: [0, Math.cos(s.angle) * s.dist], extrapolate: 'clamp' }) }, { translateY: t.interpolate({ inputRange: [0, 0.6], outputRange: [0, Math.sin(s.angle) * s.dist], extrapolate: 'clamp' }) }], opacity: t.interpolate({ inputRange: [0, 0.1, 0.65], outputRange: [0, 1, 0], extrapolate: 'clamp' }) }]}
              >
                ✨
              </Animated.Text>
            ))
          : null}
        <Animated.Text style={[styles.gem, { transform: [{ scale: pop }] }]}>💎</Animated.Text>
        <Text style={styles.label}>{fa.gemCard.found(amount)}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 60, elevation: 60 },
  center: { alignItems: 'center', justifyContent: 'center' },
  spark: { position: 'absolute' },
  gem: { fontSize: 84, textShadowColor: 'rgba(126,229,255,0.9)', textShadowRadius: 22 },
  label: { marginTop: 4, fontFamily: fonts.display, fontSize: 26, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 1, paddingHorizontal: 18, paddingVertical: 4, borderRadius: 18, overflow: 'hidden', backgroundColor: 'rgba(43,18,64,0.78)' },
});
