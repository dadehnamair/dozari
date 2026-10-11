import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

/** How long the city's slogan stays before it fades away (it is a greeting, not a fixture of the screen). */
export const SLOGAN_SHOW_MS = 6000;
const FADE_MS = 700;

/** The city's slogan under the greeting: shown for a few seconds, then fades out and leaves the layout. */
export function FadingSlogan({ text, style }: { text: string; style: StyleProp<TextStyle> }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [gone, setGone] = useState(false);
  useEffect(() => {
    opacity.setValue(1);
    setGone(false);
    const id = setTimeout(() => Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => setGone(true)), SLOGAN_SHOW_MS);
    return () => clearTimeout(id);
  }, [text, opacity]);
  if (gone) return null;
  return <Animated.Text style={[style, { opacity }]} numberOfLines={2}>{text}</Animated.Text>;
}
