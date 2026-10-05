import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { DimensionValue, ViewStyle } from 'react-native';
import { usePrefs } from '../prefs/store';

/** A grey placeholder block that breathes softly (still when motion is reduced); the shape of the content that is about to appear. */
export function SkeletonBlock({ width = '100%', height = 16, radius = 10, style }: { width?: DimensionValue; height?: number; radius?: number; style?: ViewStyle }) {
  const reduce = usePrefs().reduceMotion;
  const beat = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(beat, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, beat]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: 'rgba(58,36,24,0.14)', opacity: reduce ? 0.7 : beat.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] }) }, style]}
    />
  );
}

/** A list of `rows` placeholder rows: round avatar, a name bar and a short number bar, like most lists in the app. */
export function SkeletonRows({ rows = 6, avatar = true, gap = 10 }: { rows?: number; avatar?: boolean; gap?: number }) {
  return (
    <View style={[styles.col, { gap }]} accessibilityLabel="…" accessibilityLiveRegion="polite">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          {avatar ? <SkeletonBlock width={34} height={34} radius={17} /> : null}
          <SkeletonBlock width={`${48 + ((i * 17) % 30)}%`} height={14} />
          <View style={styles.grow} />
          <SkeletonBlock width={44} height={14} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  col: { width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 8 },
  grow: { flex: 1 },
});
