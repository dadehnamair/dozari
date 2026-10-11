import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/colors';
import { EDGE_LEFT, EDGE_RIGHT } from '../theme/direction';

/**
 * A taunt floating under a player's card (`13 Match Screens v2`): pops in with a tail pointing up at the speaker and bobs gently.
 * Yours is cream on ink, the rival's is ink with a pink rim.
 */
export function SpeechBubble({ text, mine }: { text: string; mine: boolean }) {
  const pop = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    pop.setValue(0);
    Animated.timing(pop, { toValue: 1, duration: 450, easing: Easing.out(Easing.back(2)), useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [text, pop, bob]);
  const face = mine ? styles.mine : styles.rival;
  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }, { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }]}>
      <View style={[styles.tail, mine ? styles.tailMine : styles.tailRival]} />
      <View style={[styles.body, face]}>
        <Text style={[styles.text, mine ? null : styles.textRival]}>{text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { maxWidth: 190 },
  body: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, borderWidth: 3, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  mine: { backgroundColor: colors.cream, borderColor: colors.ink },
  rival: { backgroundColor: colors.ink, borderColor: '#FF8FB6' },
  text: { fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 21, color: colors.ink },
  textRival: { color: colors.cream },
  tail: { position: 'absolute', top: -8, width: 14, height: 14, borderWidth: 3, borderRadius: 3, transform: [{ rotate: '45deg' }], zIndex: 1 },
  tailMine: { [EDGE_RIGHT]: 24, backgroundColor: colors.cream, borderColor: colors.ink, borderRightWidth: 0, borderBottomWidth: 0 },
  tailRival: { [EDGE_LEFT]: 24, backgroundColor: colors.ink, borderColor: '#FF8FB6', borderRightWidth: 0, borderBottomWidth: 0 },
});
