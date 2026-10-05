import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { usePrefs } from '../prefs/store';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';

/** «یکی مونده!»: a pill that pops and wobbles over the board after a guess with three right (D178). Still when motion is reduced. */
export function NearMissPill() {
  const reduce = usePrefs().reduceMotion;
  const pop = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    Animated.sequence([
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
      Animated.timing(pop, { toValue: 1.04, duration: 160, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pop, { toValue: 1, duration: 160, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]).start();
  }, [pop, reduce]);
  return (
    <Animated.View pointerEvents="none" accessibilityLiveRegion="assertive" style={[styles.pill, { opacity: pop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }), transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }, { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '-3deg'] }) }] }]}>
      <Text style={styles.text}>{fa.solo.feedback.oneAway}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 6, maxWidth: '92%', borderRadius: 99, borderWidth: 4, borderColor: colors.ink, backgroundColor: colors.candy.orange, shadowColor: colors.ink, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6 },
  text: { fontFamily: fonts.display, fontSize: 18, lineHeight: 28, color: '#fff', textAlign: 'center' },
});
