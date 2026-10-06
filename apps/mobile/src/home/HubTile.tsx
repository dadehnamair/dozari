import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useEffect, useId, useRef } from 'react';
import { usePrefs } from '../prefs/store';
import { playSfx } from '../sound/engine';
import { ICON_PATHS } from '../theme/icons';
import type { IconName } from '../theme/icons';
import { colors, fonts, toneOf } from '../theme/colors';
import { useTheme } from '../theme/themeStore';

const SIZE = 54;

/**
 * Hub corner tile of `docs/design/Dozari - 01 Screens` (screen-home): 54px rounded candy square with a radial
 * gloss, an ink-outlined white icon, the label under it and an optional corner badge.
 */
export function HubTile({ icon, label, color, badge, badgeColor = colors.candy.pink, onPress, onLight = false, glow = false }: { icon: IconName; label: string; color: string; badge?: string; badgeColor?: string; onPress: () => void; onLight?: boolean; /** Pulsing halo: something is waiting here (e.g. the unclaimed daily reward). */ glow?: boolean }) {
  const adult = useTheme() === 'adult';
  const tone = adult ? { light: '#5A3A1C', base: '#2A1A0E', dark: '#140C06' } : toneOf(color);
  const gid = `ht${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const reduce = usePrefs().reduceMotion;
  const beat = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!glow || reduce) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(beat, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(beat, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [glow, reduce, beat]);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => (playSfx('press'), onPress())} style={styles.wrap}>
      {({ pressed }) => (
        <>
          {glow ? (
            <Animated.View pointerEvents="none" style={[styles.halo, { opacity: reduce ? 0.8 : beat.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.95] }), transform: [{ scale: reduce ? 1.1 : beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] }) }] }]} />
          ) : null}
          <Animated.View style={glow && !reduce ? { transform: [{ scale: beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) }] } : undefined}>
          <View style={[styles.tile, adult ? (glow ? styles.tileAdultLit : styles.tileAdult) : null, pressed ? styles.pressed : null]}>
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
              <Defs>
                <RadialGradient id={gid} cx="0.3" cy="0.22" r="0.9">
                  <Stop offset="0" stopColor={tone.light} />
                  <Stop offset="0.58" stopColor={tone.base} />
                  <Stop offset="1" stopColor={tone.dark} />
                </RadialGradient>
              </Defs>
              <Rect x={0} y={0} width={1} height={1} fill={`url(#${gid})`} />
            </Svg>
            <View style={styles.gloss} />
            <View style={styles.shade} />
            <View style={styles.icon}>
              <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                <Path d={ICON_PATHS[icon]} stroke={adult ? '#000' : colors.ink} strokeWidth={4.6} strokeLinecap="round" strokeLinejoin="round" />
                <Path d={ICON_PATHS[icon]} stroke={adult ? '#FFE9A8' : '#fff'} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
          </View>
          </Animated.View>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: badgeColor }]}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
          <Text style={[styles.label, adult ? styles.labelAdult : null, onLight ? styles.labelOnLight : null]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** For cream sheets (profile): the white-on-scene label would vanish. */
  labelOnLight: { color: colors.ink, textShadowColor: 'transparent', textShadowRadius: 0 },
  tileAdult: { borderColor: '#B8822A', shadowColor: '#000' },
  tileAdultLit: { borderColor: '#FFF1B8', shadowColor: '#000' },
  labelAdult: { color: '#FFE9A8', textShadowColor: '#000' },
  wrap: { alignItems: 'center', gap: 3, width: 72 },
  tile: {
    width: SIZE,
    height: SIZE,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.ink,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  halo: { position: 'absolute', top: -3, width: SIZE + 6, height: SIZE + 6, borderRadius: 22, backgroundColor: colors.candy.yellow },
  pressed: { transform: [{ scale: 0.92 }] },
  // Positioned so it paints above the absolute gradient and gloss layers (web paints positioned boxes last).
  icon: { position: 'relative', zIndex: 1 },
  gloss: { position: 'absolute', top: 3, left: 6, right: 6, height: '40%', borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, backgroundColor: 'rgba(255,255,255,0.32)' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, backgroundColor: 'rgba(0,0,0,0.18)' },
  badge: { position: 'absolute', top: -9, left: 0, minWidth: 24, height: 24, paddingHorizontal: 4, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.display, fontSize: 13, lineHeight: 19, color: '#fff' },
  label: { fontFamily: fonts.display, fontSize: 13, lineHeight: 20, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
});
