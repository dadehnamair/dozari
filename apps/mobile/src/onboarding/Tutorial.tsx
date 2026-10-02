import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CandyButton } from '../components/CandyButton';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';

/** Four skippable slides before the first Home screen; also reachable again from the profile. */
export function Tutorial({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const slides = fa.tutorial.slides;
  const slide = slides[i]!;
  const last = i === slides.length - 1;
  return (
    <View style={styles.root}>
      <Pressable onPress={onDone} style={styles.skip} accessibilityRole="button"><Text style={styles.skipText}>{fa.tutorial.skip}</Text></Pressable>
      <View style={styles.body}>
        <Text style={styles.emoji}>{slide.emoji}</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.text}>{slide.text}</Text>
      </View>
      <View style={styles.dots}>
        {slides.map((s, k) => <View key={s.title} style={[styles.dot, k === i && styles.dotOn]} />)}
      </View>
      <CandyButton label={last ? fa.tutorial.start : fa.tutorial.next} color={colors.candy.lime} onPress={() => (last ? onDone() : setI(i + 1))} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 },
  skip: { position: 'absolute', top: 40, left: 20, padding: 8 },
  skipText: { fontFamily: fonts.bold, fontSize: 14, color: colors.cream, opacity: 0.8 },
  body: { alignItems: 'center', gap: 12, maxWidth: 360 },
  emoji: { fontSize: 64 },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.cream, textAlign: 'center' },
  text: { fontFamily: fonts.bold, fontSize: 16, color: colors.cream, textAlign: 'center', opacity: 0.9, lineHeight: 26 },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.cream, opacity: 0.35 },
  dotOn: { opacity: 1, backgroundColor: colors.candy.yellow },
});
