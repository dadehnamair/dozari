import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { usePrefs } from '../prefs/store';

/** The hero floats up and down; a tap makes it hop (squash, spring up, land) and flip its coin. */
export function useHeroMotion() {
  const prefs = usePrefs();
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -10, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  // A tap makes Dozari hop (squash, spring up, land) and flip his coin right away.
  const jump = useRef(new Animated.Value(0)).current;
  const squash = useRef(new Animated.Value(0)).current;
  const [tossKey, setTossKey] = useState(0);
  const hop = () => {
    setTossKey((k) => k + 1);
    if (prefs.reduceMotion) return;
    Animated.sequence([
      Animated.timing(squash, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(squash, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(jump, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.timing(jump, { toValue: 0, duration: 190, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(squash, { toValue: 0.6, duration: 70, useNativeDriver: true }),
      Animated.spring(squash, { toValue: 0, friction: 4, tension: 160, useNativeDriver: true }),
    ]).start();
  };
  const transform = [
    { translateY: Animated.add(float, jump.interpolate({ inputRange: [0, 1], outputRange: [0, -30] })) },
    { scaleX: squash.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
    { scaleY: squash.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] }) },
  ];
  return { transform, tossKey, hop, reduceMotion: prefs.reduceMotion };
}
