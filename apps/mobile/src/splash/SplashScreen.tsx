import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { GradientBackground } from '../components/GradientBackground';
import { Mascot } from '../components/Mascot';
import { Wordmark } from '../components/Wordmark';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';

const RAYS = 12;
const SIZE = 900;

/** Sunburst wedges (every other 15° slice) around the centre, like the kit's rotating conic gradient. */
const rayPath = Array.from({ length: RAYS }, (_, i) => {
  const a0 = ((i * 360) / RAYS) * (Math.PI / 180);
  const a1 = a0 + (Math.PI / 180) * (360 / RAYS / 2);
  const r = SIZE;
  return `M0 0 L${(Math.cos(a0) * r).toFixed(1)} ${(Math.sin(a0) * r).toFixed(1)} L${(Math.cos(a1) * r).toFixed(1)} ${(Math.sin(a1) * r).toFixed(1)} Z`;
}).join(' ');

function FlippingCoin({ top, side, size, duration }: { top: number; side: { left?: number; right?: number }; size: number; duration: number }) {
  const flip = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flip, { toValue: 0.08, duration: (duration * 1000) / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(flip, { toValue: 1, duration: (duration * 1000) / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
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

/** Splash: rotating rays, flipping coins, wordmark, floating mascot and the green loading bar. */
export function SplashScreen() {
  const spin = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0.06)).current;

  useEffect(() => {
    const loops = [
      Animated.loop(Animated.timing(spin, { toValue: 1, duration: 40000, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(
        Animated.sequence([
          Animated.timing(float, { toValue: -10, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(float, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, { toValue: 0.94, duration: 3200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(bar, { toValue: 0.06, duration: 3200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ]),
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [spin, float, bar]);

  return (
    <GradientBackground>
      <Animated.View style={[styles.rays, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]} pointerEvents="none">
        <Svg width={SIZE} height={SIZE} viewBox={`${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`}>
          <G>
            <Path d={rayPath} fill="rgba(255,255,255,0.14)" />
          </G>
        </Svg>
      </Animated.View>
      <FlippingCoin top={120} side={{ right: 36 }} size={38} duration={1.6} />
      <FlippingCoin top={210} side={{ left: 28 }} size={28} duration={2.1} />
      <FlippingCoin top={470} side={{ right: 22 }} size={24} duration={1.3} />
      <View style={styles.center}>
        <Wordmark />
        <Text style={styles.tagline}>{fa.kit.splash.tagline}</Text>
        <Animated.View style={[styles.mascot, { transform: [{ translateY: float }] }]}>
          <Mascot pose="wave" />
        </Animated.View>
      </View>
      <View style={styles.footer}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
        </View>
        <Text style={styles.loading}>{fa.kit.splash.loading}</Text>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  rays: { position: 'absolute', top: '38%', left: '50%', width: SIZE, height: SIZE, marginTop: -SIZE / 2, marginLeft: -SIZE / 2 },
  coin: { position: 'absolute', backgroundColor: colors.candy.yellow, borderWidth: 3, borderColor: colors.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 90 },
  tagline: { fontFamily: fonts.bold, fontSize: 15, color: colors.cream, textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 },
  mascot: { width: 220, height: 240 },
  footer: { position: 'absolute', bottom: 48, left: 34, right: 34, alignItems: 'center', gap: 10 },
  track: { width: '100%', height: 26, borderRadius: 99, backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 99, backgroundColor: colors.candy.lime, borderTopWidth: 3, borderTopColor: 'rgba(255,255,255,0.55)', borderBottomWidth: 3, borderBottomColor: '#3F8F1F' },
  loading: { fontFamily: fonts.display, fontSize: 20, color: colors.cream, textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 },
});
