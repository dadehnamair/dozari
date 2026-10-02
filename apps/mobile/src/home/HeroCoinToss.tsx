import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/colors';
import { handPosition } from './heroToss';

const LOOP_GAP_MS = 5200;
const UP_MS = 520;
const DOWN_MS = 460;

/**
 * Dozari flips his two-toman coin: it leaves the raised hand, spins on its edge in the air, a sparkle winks at the top,
 * and he catches it again. Plays on its own every few seconds and right away when `tossKey` changes (a tap on the hero).
 * Native-driver transforms only; renders nothing when motion is reduced.
 */
export function HeroCoinToss({ width, height, tossKey, enabled }: { width: number; height: number; tossKey: number; enabled: boolean }) {
  const rise = useRef(new Animated.Value(0)).current; // 0 in the hand, 1 at the top
  const spin = useRef(new Animated.Value(0)).current; // one unit = half a turn
  const shown = useRef(new Animated.Value(0)).current;
  const twinkle = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef<Animated.CompositeAnimation | null>(null);

  const toss = useRef(() => undefined as void);
  toss.current = () => {
    running.current?.stop();
    rise.setValue(0);
    spin.setValue(0);
    twinkle.setValue(0);
    running.current = Animated.parallel([
      Animated.sequence([
        Animated.timing(shown, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.delay(UP_MS + DOWN_MS - 120),
        Animated.timing(shown, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(rise, { toValue: 1, duration: UP_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(rise, { toValue: 0, duration: DOWN_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.timing(spin, { toValue: 6, duration: UP_MS + DOWN_MS, easing: Easing.linear, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(UP_MS - 140),
        Animated.timing(twinkle, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(twinkle, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]),
    ]);
    running.current.start();
  };

  useEffect(() => {
    if (!enabled) return;
    const next = () => {
      toss.current();
      timer.current = setTimeout(next, LOOP_GAP_MS + UP_MS + DOWN_MS);
    };
    timer.current = setTimeout(next, 1800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      running.current?.stop();
    };
  }, [enabled]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) return void (first.current = false);
    if (enabled) toss.current();
  }, [tossKey, enabled]);

  if (!enabled) return null;
  const hand = handPosition(width, height);
  const size = Math.max(18, 30 * hand.scale * 1.15);
  const lift = height * 0.4;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.coin,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            left: hand.x - size / 2,
            top: hand.y - size - 2,
            opacity: shown,
            transform: [
              { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, -lift] }) },
              { scaleX: spin.interpolate({ inputRange: [0, 1, 2, 3, 4, 5, 6], outputRange: [1, -1, 1, -1, 1, -1, 1] }) },
            ],
          },
        ]}
      >
        <Text style={[styles.digit, { fontSize: size * 0.62 }]}>۲</Text>
      </Animated.View>
      <Animated.Text
        style={[
          styles.spark,
          {
            left: hand.x - 8,
            top: hand.y - size - lift - 12,
            opacity: twinkle,
            transform: [{ scale: twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.3] }) }, { rotate: twinkle.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) }],
          },
        ]}
      >
        ✦
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  coin: { position: 'absolute', backgroundColor: '#FFC93C', borderWidth: 2.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  digit: { fontFamily: fonts.display, color: '#7A4A00' },
  spark: { position: 'absolute', fontSize: 22, color: '#FFE48A', textShadowColor: colors.ink, textShadowRadius: 2 },
});
