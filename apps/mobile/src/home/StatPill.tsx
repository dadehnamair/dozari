import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Circle, Stop } from 'react-native-svg';
import { useId } from 'react';
import { Item } from '../components/Item';
import { colors, fonts, toneOf } from '../theme/colors';
import { useTheme } from '../theme/themeStore';

/** Top-bar counter of screen-home: translucent ink pill, a glossy candy ball with a glyph, then the value. */
export function StatPill({ color, glyph, icon, glyphColor = '#fff', value, label, onPress }: { color: string; glyph?: string; /** An icon of the item pack instead of a text glyph. */ icon?: string; glyphColor?: string; value: string; label: string; onPress?: () => void }) {
  const adult = useTheme() === 'adult';
  const tone = toneOf(color);
  const gid = `sp${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const body = (
    <View style={[styles.pill, adult ? styles.pillAdult : null]} accessibilityLabel={label}>
      <View style={[styles.ball, adult ? styles.ballAdult : null]}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 1 1">
          <Defs>
            <RadialGradient id={gid} cx="0.35" cy="0.3" r="0.75">
              <Stop offset="0" stopColor={tone.light} />
              <Stop offset="0.55" stopColor={tone.base} />
              <Stop offset="1" stopColor={tone.dark} />
            </RadialGradient>
          </Defs>
          <Circle cx={0.5} cy={0.5} r={0.5} fill={`url(#${gid})`} />
        </Svg>
        {icon ? <View style={styles.ballIcon}><Item icon={icon} /></View> : <Text style={[styles.glyph, { color: glyphColor }]}>{glyph}</Text>}
      </View>
      <Text style={[styles.value, adult ? styles.valueAdult : null]} numberOfLines={1}>{value}</Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>{body}</Pressable> : body;
}

const styles = StyleSheet.create({
  pill: { flex: 1, height: 40, borderRadius: 99, backgroundColor: 'rgba(43,18,64,0.6)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', flexDirection: Platform.OS === 'web' ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, paddingHorizontal: 5 },
  ball: { width: 30, height: 30, borderRadius: 15, borderWidth: 2.5, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pillAdult: { backgroundColor: 'rgba(14,10,8,0.85)', borderColor: '#8A5A16' },
  ballAdult: { borderColor: '#000' },
  valueAdult: { color: '#FFE9A8' },
  ballIcon: { width: 18, height: 18 },
  glyph: { fontFamily: fonts.display, fontSize: 15, lineHeight: 22 },
  value: { flexShrink: 1, fontFamily: fonts.display, fontSize: 17, color: '#fff', paddingHorizontal: 6 },
});
