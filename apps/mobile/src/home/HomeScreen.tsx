import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { CandyButton } from '../components/CandyButton';
import { SceneBackground } from '../components/SceneBackground';
import { Character } from '../components/Character';
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
        Animated.timing(float, {
          toValue: -10,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  return (
    <SceneBackground scene="bazaar">
      <View style={styles.content}>
        <View style={styles.top}>
          <Wordmark />
          <Text style={styles.tagline}>{fa.home.tagline}</Text>
        </View>
        <View style={styles.bottom}>
          <Animated.View style={[styles.mascot, { transform: [{ translateY: float }] }]}>
            <Character pose="wave" month={month} />
          </Animated.View>
          <Text style={styles.mood}>
            {fa.months[month - 1]?.name} · {fa.months[month - 1]?.mood}
          </Text>
          <CandyButton label={fa.home.soloButton} color={colors.candy.yellow} onPress={onSolo} />
          {onGallery ? (
            <CandyButton label={fa.kit.gallery} color={colors.candy.sky} onPress={onGallery} />
          ) : null}
        </View>
      </View>
    </SceneBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  top: { alignItems: 'center', gap: 6 },
  bottom: { alignItems: 'center', gap: 10 },
  tagline: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#3A2418',
    textShadowColor: '#FFF6E8',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  mood: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#3A2418',
    textAlign: 'center',
    backgroundColor: 'rgba(251,241,222,0.92)',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#3A2418',
    paddingHorizontal: 12,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  mascot: { width: 190, height: 215 },
});
