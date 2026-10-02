import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useId } from 'react';
import { ICON_PATHS } from '../theme/icons';
import type { IconName } from '../theme/icons';
import { colors, fonts, toneOf } from '../theme/colors';

const SIZE = 54;

/**
 * Hub corner tile of `docs/design/Dozari - 01 Screens` (screen-home): 54px rounded candy square with a radial
 * gloss, an ink-outlined white icon, the label under it and an optional corner badge.
 */
export function HubTile({ icon, label, color, badge, badgeColor = colors.candy.pink, onPress }: { icon: IconName; label: string; color: string; badge?: string; badgeColor?: string; onPress: () => void }) {
  const tone = toneOf(color);
  const gid = `ht${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.wrap}>
      {({ pressed }) => (
        <>
          <View style={[styles.tile, pressed ? styles.pressed : null]}>
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
                <Path d={ICON_PATHS[icon]} stroke={colors.ink} strokeWidth={4.6} strokeLinecap="round" strokeLinejoin="round" />
                <Path d={ICON_PATHS[icon]} stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
          </View>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: badgeColor }]}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  pressed: { transform: [{ scale: 0.92 }] },
  // Positioned so it paints above the absolute gradient and gloss layers (web paints positioned boxes last).
  icon: { position: 'relative', zIndex: 1 },
  gloss: { position: 'absolute', top: 3, left: 6, right: 6, height: '40%', borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, backgroundColor: 'rgba(255,255,255,0.32)' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, backgroundColor: 'rgba(0,0,0,0.18)' },
  badge: { position: 'absolute', top: -9, left: 0, minWidth: 24, height: 24, paddingHorizontal: 4, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.display, fontSize: 13, lineHeight: 19, color: '#fff' },
  label: { fontFamily: fonts.display, fontSize: 13, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
});
