import { solarMonthOf } from '@dozari/shared';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SceneBackground } from '../components/SceneBackground';
import { Character } from '../components/Character';
import { AnimatedLogo } from '../components/AnimatedLogo';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { SCENE_TEXT } from '../theme/skin';
import { useTheme } from '../theme/themeStore';
import { GradientFill } from '../components/GradientFill';

function FlippingCoin({
  top,
  side,
  size,
  duration,
}: {
  top: number;
  side: { left?: number; right?: number };
  size: number;
  duration: number;
}) {
  const flip = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flip, {
          toValue: 0.08,
          duration: (duration * 1000) / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(flip, {
          toValue: 1,
          duration: (duration * 1000) / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flip, duration]);
  return (
    <Animated.View
      style={[
        styles.coin,
        { top, width: size, height: size, borderRadius: size / 2, transform: [{ scaleX: flip }] },
        side,
      ]}
    />
  );
}

/** Adult loading bar: a gold ingot-bar that fills, with a band of light sweeping across it and a breathing gold rim. */
function GoldBar({ bar }: { bar: Animated.Value }) {
  const sweep = useRef(new Animated.Value(0)).current;
  const rim = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  useEffect(() => {
    const loops = [
      Animated.loop(
        Animated.timing(sweep, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(rim, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(rim, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [sweep, rim]);
  return (
    <View style={gold.track} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Animated.View style={[gold.fill, { width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}>
        <GradientFill from="#FFF1B8" to="#B8822A" mid={{ at: 0.45, color: '#E8B64A' }} />
      </Animated.View>
      {/* the travelling light */}
      <Animated.View
        pointerEvents="none"
        style={[gold.shine, { transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-90, w + 30] }) }, { skewX: '-20deg' }] }]}
      />
      {/* breathing gold rim */}
      <Animated.View pointerEvents="none" style={[gold.rim, { opacity: rim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }) }]} />
    </View>
  );
}

/** Splash: painted alley, flipping coins, wordmark, floating mascot and the green loading bar. */
export function SplashScreen() {
  const adult = useTheme() === 'adult';
  const float = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0.06)).current;

  useEffect(() => {
    const loops = [
      Animated.loop(
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
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, {
            toValue: 0.94,
            duration: 3200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(bar, {
            toValue: 0.06,
            duration: 3200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [float, bar]);

  return (
    <SceneBackground scene="alley">
      <FlippingCoin top={120} side={{ right: 36 }} size={38} duration={1.6} />
      <FlippingCoin top={210} side={{ left: 28 }} size={28} duration={2.1} />
      <FlippingCoin top={470} side={{ right: 22 }} size={24} duration={1.3} />
      <View style={styles.center}>
        <AnimatedLogo width={270} />
        <Text style={styles.tagline}>{fa.kit.splash.tagline}</Text>
        <Animated.View style={[styles.mascot, { transform: [{ translateY: float }] }]}>
          <Character pose="wave" month={solarMonthOf(Date.now())} />
        </Animated.View>
      </View>
      <View style={styles.footer}>
        {adult ? (
          <GoldBar bar={bar} />
        ) : (
          <View style={styles.track}>
            <Animated.View
              style={[
                styles.fill,
                { width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
              ]}
            />
          </View>
        )}
        <Text style={[styles.loading, adult ? gold.text : null]}>{fa.kit.splash.loading}</Text>
      </View>
    </SceneBackground>
  );
}

const styles = StyleSheet.create({
  coin: {
    position: 'absolute',
    backgroundColor: colors.candy.yellow,
    borderWidth: 3,
    borderColor: colors.ink,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 90 },
  tagline: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: '#3A2418',
    textShadowColor: '#FFF6E8',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
    ...SCENE_TEXT,
  },
  mascot: { width: 220, height: 240 },
  footer: { position: 'absolute', bottom: 48, left: 34, right: 34, alignItems: 'center', gap: 10 },
  track: {
    width: '100%',
    height: 26,
    borderRadius: 99,
    backgroundColor: colors.ink,
    borderWidth: 3,
    borderColor: colors.ink,
    overflow: 'hidden',
    direction: 'ltr', // the bar fills from the left, as in the web design
  },
  fill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: colors.candy.lime,
    borderTopWidth: 3,
    borderTopColor: 'rgba(255,255,255,0.55)',
    borderBottomWidth: 3,
    borderBottomColor: '#3F8F1F',
  },
  loading: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: '#3A2418',
    textShadowColor: '#FFF6E8',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
    ...SCENE_TEXT,
  },
});

const gold = StyleSheet.create({
  track: {
    width: '100%',
    height: 22,
    borderRadius: 99,
    backgroundColor: '#1E130D',
    borderWidth: 2,
    borderColor: '#6A4210',
    overflow: 'hidden',
    direction: 'ltr',
  },
  fill: { height: '100%', borderRadius: 99, overflow: 'hidden' },
  shine: { position: 'absolute', top: 0, bottom: 0, width: 36, backgroundColor: 'rgba(255,248,214,0.6)' },
  rim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 99, borderWidth: 2, borderColor: '#FFE48A' },
  text: { color: '#E8B64A', textShadowColor: '#120B07' },
});
