import { useEffect, useId, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
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

export function AnimatedLogo({ width = 270, onDone }: { width?: number; onDone?: () => void }) {
  const reduce = usePrefs().reduceMotion;
  const on = !reduce;
  const gid = `al${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
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
          <Svg width={width} height={width * AR} viewBox="-90 0 700 220" style={{ overflow: 'visible' }}>
            <Defs>
              <LinearGradient id={`${gid}g`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FFF6A8" />
                <Stop offset="0.5" stopColor="#FFC93C" />
                <Stop offset="1" stopColor="#FF7A3D" />
              </LinearGradient>
            </Defs>
            <SvgText x={260} y={168} textAnchor="middle" fontFamily={fonts.display} fontSize={168} fill="#2B1240" stroke="#2B1240" strokeWidth={26} strokeLinejoin="round">{fa.home.title}</SvgText>
            <SvgText x={260} y={156} textAnchor="middle" fontFamily={fonts.display} fontSize={168} fill="#2B1240" stroke="#2B1240" strokeWidth={14} strokeLinejoin="round">{fa.home.title}</SvgText>
            <SvgText x={260} y={156} textAnchor="middle" fontFamily={fonts.display} fontSize={168} fill={`url(#${gid}g)`}>{fa.home.title}</SvgText>
          </Svg>
        </Animated.View>
      </Animated.View>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -0.03 * width, top: 0.02 * width * AR, width: coin, height: coin, opacity: dropOpacity, transform: [{ translateY: dropY }, { rotate: dropRot }, { scaleX: dropSX }, { scaleY: dropSY }] }}>
        <Item icon="coin" />
      </Animated.View>
    </View>
  );
}
