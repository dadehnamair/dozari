import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { useId } from 'react';
import { colors, fonts, toneOf } from '../theme/colors';
import { GradientFill } from './GradientFill';
import { Icon } from './Icon';
import { PAGE_TOP_EXTRA, pageTop, safeTop } from '../theme/safeArea';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

/**
 * Full-screen list page of the designs (screen-notifications / screen-friends of `19 Social Daily Onboarding`):
 * dotted sand background, a coloured header band, a yellow back square, the white title and an optional action.
 * Rendered over whatever is underneath (absolute fill), like the sheets it replaces.
 */
export function PageShell({ title, color, backLabel, onBack, action, bandHeight = 100, children }: { title: string; color: string; backLabel: string; onBack: () => void; action?: React.ReactNode; bandHeight?: number; children: React.ReactNode }) {
  const tone = toneOf(color);
  const pid = `ps${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <Pattern id={pid} width={22} height={22} patternUnits="userSpaceOnUse">
            <Circle cx={11} cy={11} r={2} fill={color} fillOpacity={0.14} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${pid})`} />
      </Svg>
      {/* The band grows with the device's top inset, so the title row never slips onto the sand below it (white text on sand). */}
      <View style={[styles.band, { height: safeTop(bandHeight - (30 - PAGE_TOP_EXTRA)) }]}>
        <GradientFill from={tone.dark} to={color} />
      </View>
      <View style={styles.column}>
        <View style={styles.head}>
          <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack}>
            {({ pressed }) => (
              <View style={[styles.back, pressed ? styles.pressed : null]}>
                <GradientFill from="#FFE48A" to={colors.candy.yellow} />
                <Icon name="back" size={22} color={colors.ink} strokeWidth={3} />
              </View>
            )}
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {action}
        </View>
        {children}
      </View>
    </View>
  );
}

/** Small cream pill for the header action slot («همه خوانده شد»). */
export function HeaderPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F6E2C2', zIndex: 20 },
  band: { position: 'absolute', top: 0, left: 0, right: 0, borderBottomWidth: 4, borderColor: colors.ink, overflow: 'hidden' },
  column: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 10, paddingTop: pageTop() },
  head: { flexDirection: ROW, alignItems: 'center', gap: 8, paddingHorizontal: 2, marginBottom: 30 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  pressed: { transform: [{ translateY: 3 }] },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 24, color: '#fff', textAlign: 'right', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  pill: { height: 34, paddingHorizontal: 12, borderRadius: 99, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.cream, justifyContent: 'center' },
  pillText: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink },
});
