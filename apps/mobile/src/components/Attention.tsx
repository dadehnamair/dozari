import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { usePrefs } from '../prefs/store';

/**
 * «Come and play me»: while `on`, the child breathes (a soft scale pulse) and a golden halo beats behind it.
 * Used for the daily puzzle, so a player who has not played today sees where to tap. Still (halo only) when motion is reduced.
 */
export function Attention({ on, children, style, halo = '#FFC93C', scale = 1.07, radius = 18 }: { on: boolean; children: React.ReactNode; style?: StyleProp<ViewStyle>; halo?: string; scale?: number; radius?: number }) {
  const reduce = usePrefs().reduceMotion;
  const beat = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on || reduce) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(beat, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => (loop.stop(), beat.setValue(0));
  }, [on, reduce, beat]);
  if (!on) return <Animated.View style={style}>{children}</Animated.View>;
  return (
    <Animated.View style={[style, reduce ? null : { transform: [{ scale: beat.interpolate({ inputRange: [0, 1], outputRange: [1, scale] }) }] }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.halo, { borderRadius: radius, backgroundColor: halo, opacity: reduce ? 0.35 : beat.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.5] }), transform: [{ scale: reduce ? 1.06 : beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) }] }]}
      />
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ halo: { ...StyleSheet.absoluteFill } });
