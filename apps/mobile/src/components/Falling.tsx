import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';

interface FallingProps {
  /** Seconds per fall. */
  duration: number;
  /** Start offset as a fraction of one fall. */
  phase: number;
  /** Distance fallen, in px. */
  distance: number;
  /** Extra rotation over one fall, in degrees. */
  spin?: number;
  style: ViewStyle;
}

/** One looping falling particle. `phase` desynchronises particles without per-particle delays. */
export function Falling({ duration, phase, distance, spin = 0, style }: FallingProps) {
  const t = useRef(new Animated.Value(phase)).current;
  useEffect(() => {
    const run = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: duration * 1000 * (1 - phase), easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.timing(t, { toValue: phase, duration: duration * 1000 * phase, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    run.start();
    return () => run.stop();
  }, [t, duration, phase]);
  return (
    <Animated.View
      style={[
        style,
        {
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-30, distance] }) },
            { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${spin}deg`] }) },
          ],
        },
      ]}
    />
  );
}

export const fill = StyleSheet.absoluteFill;
export const Layer = ({ children }: { children: React.ReactNode }) => (
  <View pointerEvents="none" style={[fill, { overflow: "hidden" }]}>
    {children}
  </View>
);
