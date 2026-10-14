import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Circle, Stop } from 'react-native-svg';
import { useId } from 'react';
import { Item } from '../components/Item';
import { colors, fonts, toneOf } from '../theme/colors';
import { useTheme } from '../theme/themeStore';

/** Top-bar counter of screen-home: translucent ink pill, a glossy candy ball with a glyph, then the value. */
export function StatPill({ color, glyph, icon, glyphColor = '#fff', value, label, onPress, badge, plate }: { color: string; glyph?: string; /** An icon of the item pack instead of a text glyph. */ icon?: string; glyphColor?: string; value: string; label: string; onPress?: () => void; /** A small pink count in the corner (something waits behind this counter). */ badge?: string; /** Adult theme: keep the round gold plate behind the icon (the level pill); other counters show the bare icon. */ plate?: boolean }) {
  const adult = useTheme() === 'adult';
  const tone = toneOf(color);
  const gid = `sp${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const body = (
    <View style={[styles.pill, adult ? styles.pillAdult : null]} accessibilityLabel={label}>
      <View style={[styles.ball, adult ? (plate ? styles.ballAdult : styles.ballBare) : null]}>
        {adult && !plate ? null : <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 1 1">
          <Defs>
            <RadialGradient id={gid} cx="0.35" cy="0.3" r="0.75">
              <Stop offset="0" stopColor={tone.light} />
              <Stop offset="0.55" stopColor={tone.base} />
              <Stop offset="1" stopColor={tone.dark} />
            </RadialGradient>
          </Defs>
          <Circle cx={0.5} cy={0.5} r={0.5} fill={`url(#${gid})`} />
        </Svg>}
        {icon ? <View style={[styles.ballIcon, adult && !plate ? styles.ballIconBare : null]}><Item icon={icon} /></View> : <Text style={[styles.glyph, adult && !plate ? styles.glyphBare : null, { color: glyphColor }]}>{glyph}</Text>}
      </View>
      <Text style={[styles.value, adult ? styles.valueAdult : null]} numberOfLines={1} {...(adult ? null : { adjustsFontSizeToFit: true, minimumFontScale: 0.6 })}>{value}</Text>
      {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
    </View>
  );
  // The wrapper must be shrinkable too, or the pill's own flex/minWidth never reaches the row and the last pill overflows narrow screens.
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.press}>{body}</Pressable> : body;
}

const styles = StyleSheet.create({
  press: { flexShrink: 1, minWidth: 0 },
  pill: { flex: 1, minWidth: 0, height: 40, borderRadius: 99, backgroundColor: 'rgba(43,18,64,0.6)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', flexDirection: Platform.OS === 'web' ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, paddingHorizontal: 5 },
  ball: { width: 30, height: 30, borderRadius: 15, borderWidth: 2.5, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  /** Adult: a compact fixed-width pill (as in the design) so the whole value always shows. */
  pillAdult: { flex: 0, flexShrink: 0, height: 30, gap: 3, paddingLeft: 3, paddingRight: 7, backgroundColor: 'rgba(14,10,8,0.85)', borderColor: '#8A5A16' },
  ballBare: { width: 22, height: 22, borderWidth: 0, borderRadius: 0, overflow: 'visible' },
  ballIconBare: { width: 22, height: 22 },
  glyphBare: { fontSize: 16 },
  ballAdult: { width: 22, height: 22, borderRadius: 11, borderColor: '#000' },
  valueAdult: { color: '#FFE9A8', fontSize: 14, paddingHorizontal: 0, flexShrink: 0 },
  ballIcon: { width: 18, height: 18 },
  /** Emoji glyphs (💎 🔥) take the system emoji font: the display font's line metrics sat them high in the ball. */
  glyph: { fontSize: 15, lineHeight: 18, height: 18, textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false },
  badge: { position: 'absolute', top: -6, left: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.candy.pink, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.display, fontSize: 12, lineHeight: 16, color: '#fff' },
  value: { flexShrink: 1, fontFamily: fonts.display, fontSize: 17, color: '#fff', paddingHorizontal: 6 },
});
