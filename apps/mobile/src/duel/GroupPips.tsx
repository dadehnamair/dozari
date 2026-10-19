import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { usePrefs } from '../prefs/store';

/**
 * One of the four pips under a player's name. A found pip breathes softly (on/off, barely); the one that has just
 * lit blinks a few times so the rival's progress catches the eye. Reduced motion: no animation.
 */
export function GroupPip({ lit, style }: { lit: boolean; style: React.ComponentProps<typeof Animated.View>['style'] }) {
  const reduce = usePrefs().reduceMotion;
  const v = useRef(new Animated.Value(1)).current;
  const was = useRef(lit);
  useEffect(() => {
    if (!lit || reduce) return v.setValue(1);
    const fresh = !was.current;
    was.current = lit;
    const breathe = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 0.55, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    if (!fresh) {
      breathe.start();
      return () => breathe.stop();
    }
    const blink = Animated.sequence(Array.from({ length: 3 }, () => Animated.sequence([
      Animated.timing(v, { toValue: 0.15, duration: 140, useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 140, useNativeDriver: true }),
    ])));
    blink.start(({ finished }) => finished && breathe.start());
    return () => {
      blink.stop();
      breathe.stop();
    };
  }, [lit, reduce, v]);
  was.current = lit;
  return <Animated.View style={[style, { opacity: v }]} />;
}
