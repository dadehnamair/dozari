import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { CandyButton } from '../components/CandyButton';
import { GradientBackground } from '../components/GradientBackground';
import { Mascot } from '../components/Mascot';
import { Wordmark } from '../components/Wordmark';
import { solarMonthOf } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';

/** Home: wordmark, the waving mascot (floating, as on the kit's splash) and the way into a solo game. */
export function HomeScreen({ onSolo, onGallery }: { onSolo: () => void; onGallery?: () => void }) {
  const month = useMemo(() => solarMonthOf(Date.now()), []);
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -10, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  return (
    <GradientBackground>
      <View style={styles.content}>
        <Wordmark />
        <Text style={styles.tagline}>{fa.home.tagline}</Text>
        <Animated.View style={[styles.mascot, { transform: [{ translateY: float }] }]}>
          <Mascot pose="wave" month={month} />
        </Animated.View>
        <Text style={styles.mood}>{fa.months[month - 1]?.name} · {fa.months[month - 1]?.mood}</Text>
        <CandyButton label={fa.home.soloButton} color={colors.candy.yellow} onPress={onSolo} />
        {onGallery ? <CandyButton label={fa.kit.gallery} color={colors.candy.sky} onPress={onGallery} /> : null}
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  tagline: { fontFamily: fonts.bold, fontSize: 16, color: colors.cream, textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 },
  mood: { fontFamily: fonts.body, fontSize: 14, color: colors.cream, textAlign: 'center' },
  mascot: { width: 220, height: 240, marginVertical: 8 },
});
