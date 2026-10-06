import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { fa } from '../i18n/fa';
import { usePrefs } from '../prefs/store';
import { colors, fonts } from '../theme/colors';
import { Item } from './Item';

/**
 * The animated logo of `docs/design/Dozari - 23 Logo Animation` / `Logo.dc.html`: a coin spins down and lands (squash, small bounce),
 * the wordmark pops in with a squash-stretch, six candy sparks burst out and the wordmark keeps breathing. (The design's shine sweep is left out:
 * animating an SVG gradient needs `setNativeProps` on a node that has no native view in the new architecture, which broke the other animations on phones.)
 * Reduced motion shows the finished logo. The sizes are fractions of `width`, as in the design (700 x 220 box).
 */

const AR = 220 / 700;

/** [colour, round?, size (fraction of width), x, y (in sizes), delay s]: the design's six sparks. */
const SPARKS = [
  [colors.candy.pink, true, 0.05, -260, -420, 0.55],
  [colors.candy.sky, false, 0.04, 900, -380, 0.6],
  [colors.candy.lime, true, 0.05, 1100, 250, 0.58],
  [colors.candy.yellow, false, 0.04, -1200, 200, 0.62],
  [colors.candy.grape, true, 0.04, 300, 500, 0.57],
  [colors.candy.orange, false, 0.05, -700, -600, 0.6],
] as const;

function Spark({ spec, width, on }: { spec: (typeof SPARKS)[number]; width: number; on: boolean }) {
  const [color, round, frac, x, y, delay] = spec;
  const size = frac * width;
  const p = useRef(new Animated.Value(on ? 0 : 1)).current;
  useEffect(() => {
    if (!on) return;
    Animated.timing(p, { toValue: 1, duration: 900, delay: delay * 1000, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [on, p, delay]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: width / 2 - size / 2, top: (width * AR) / 2 - size / 2, width: size, height: size, borderRadius: round ? size / 2 : 4,
        backgroundColor: color, borderWidth: 2, borderColor: colors.ink,
        opacity: on ? p.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }) : 0,
        transform: [
          { translateX: p.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, (x / 100) * size * 0.4, (x / 100) * size] }) },
          { translateY: p.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, (y / 100) * size * 0.4, (y / 100) * size] }) },
          { scale: p.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1.2, 0.3] }) },
        ],
      }}
    />
  );
}

/** Outline offsets (unit circle); the wordmark is plain RN <Text> layers because stroked SVG text draws streaks through Persian glyph joins. */
const RING = [0, 45, 90, 135, 180, 225, 270, 315].map((d) => [Math.cos((d * Math.PI) / 180), Math.sin((d * Math.PI) / 180)] as const);

function WordmarkText({ width }: { width: number }) {
  const fs = width * 0.24;
  const r = width * 0.02;
  const line = fs * 1.55;
  const box = { position: 'absolute' as const, left: width * 0.04, width, top: (width * AR - line) / 2 - width * 0.01, height: line };
  const base = { fontFamily: fonts.display, fontSize: fs, lineHeight: line, textAlign: 'center' as const };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Text style={[box, base, { color: colors.ink, top: box.top + r * 0.9 }]}>{fa.home.title}</Text>
      {RING.map(([dx, dy], i) => (
        <Text key={i} style={[box, base, { color: colors.ink, left: box.left + dx * r, top: box.top + dy * r }]}>{fa.home.title}</Text>
      ))}
      <Text style={[box, base, { color: '#FFC93C' }]}>{fa.home.title}</Text>
    </View>
  );
}

export function AnimatedLogo({ width = 270, onDone }: { width?: number; onDone?: () => void }) {
  const reduce = usePrefs().reduceMotion;
  const on = !reduce;
  const drop = useRef(new Animated.Value(on ? 0 : 1)).current;
  const pop = useRef(new Animated.Value(on ? 0 : 1)).current;
  const wobble = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!on) return undefined;
    const intro = Animated.parallel([
      Animated.timing(drop, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(pop, { toValue: 1, duration: 700, delay: 450, easing: Easing.linear, useNativeDriver: true }),
    ]);
    intro.start(({ finished }) => finished && onDone?.());
    const breathe = Animated.sequence([
      Animated.delay(1300),
      Animated.loop(Animated.sequence([
        Animated.timing(wobble, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(wobble, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])),
    ]);
    breathe.start();
    return () => {
      intro.stop();
      breathe.stop();
    };
  }, [on, drop, pop, wobble, onDone]);

  const coin = width * 0.17;
  const popScaleX = pop.interpolate({ inputRange: [0, 0.6, 0.8, 1], outputRange: [0, 1.12, 0.96, 1] });
  const popScaleY = pop.interpolate({ inputRange: [0, 0.6, 0.8, 1], outputRange: [0, 0.9, 1.05, 1] });
  const popRotate = pop.interpolate({ inputRange: [0, 0.6, 1], outputRange: ['-10deg', '2deg', '0deg'] });
  const wobRotate = wobble.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-1.5deg'] });
  const wobScale = wobble.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });
  // The coin: falls from above spinning, squashes on landing, rebounds once, settles (keyframes 0 / .15 / .55 / .7 / .85 / 1 of the design).
  const dropY = drop.interpolate({ inputRange: [0, 0.55, 0.7, 0.85, 1], outputRange: [-2.6 * coin, 0, -0.35 * coin, 0, 0] });
  const dropRot = drop.interpolate({ inputRange: [0, 0.55, 1], outputRange: ['-540deg', '0deg', '0deg'] });
  const dropSX = drop.interpolate({ inputRange: [0, 0.55, 0.7, 0.85, 1], outputRange: [1, 1.15, 0.95, 1.05, 1] });
  const dropSY = drop.interpolate({ inputRange: [0, 0.55, 0.7, 0.85, 1], outputRange: [1, 0.8, 1.08, 0.95, 1] });
  const dropOpacity = drop.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] });

  return (
    <View style={{ width, height: width * AR, alignSelf: 'center', direction: 'ltr' }} accessibilityLabel={fa.home.title}>
      {SPARKS.map((s, i) => <Spark key={i} spec={s} width={width} on={on} />)}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scaleX: popScaleX }, { scaleY: popScaleY }, { rotate: popRotate }] }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: wobRotate }, { scale: wobScale }] }]}>
          <WordmarkText width={width} />
        </Animated.View>
      </Animated.View>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0.01 * width, top: 0.02 * width * AR, width: coin, height: coin, opacity: dropOpacity, transform: [{ translateY: dropY }, { rotate: dropRot }, { scaleX: dropSX }, { scaleY: dropSY }] }}>
        <Item icon="coin" />
      </Animated.View>
    </View>
  );
}
