import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { playSfx } from '../sound/engine';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { useId } from 'react';
import { colors, fonts, toneOf } from '../theme/colors';
import { ON_YELLOW } from '../theme/skin';
import { GradientFill } from './GradientFill';
import { Icon } from './Icon';
import { pageTop, safeTop } from '../theme/safeArea';
import { useHardwareBack } from '../nav/useHardwareBack';
import { TEXT_RIGHT } from '../theme/direction';
import { useTheme } from '../theme/themeStore';
import { BrassSquare } from '../duel/adultKit';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

/**
 * Full-screen list page of the designs (screen-notifications / screen-friends of `19 Social Daily Onboarding`):
 * dotted sand background, a coloured header band, a yellow back square, the white title and an optional action.
 * Rendered over whatever is underneath (absolute fill), like the sheets it replaces.
 */
export function PageShell({ title, color, backLabel, onBack, action, bandHeight = 100, rule = true, children }: { title: string; color: string; backLabel: string; onBack: () => void; action?: React.ReactNode; bandHeight?: number; /** Adult look only: a bronze line under the header (the cups and notifications pages have it, the chat does not). */ rule?: boolean; children: React.ReactNode }) {
  useHardwareBack(onBack);
  const adult = useTheme() === 'adult';
  const tone = toneOf(color);
  const pid = `ps${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (adult) {
    // «صرافی و گاوصندوق» page (docs/design/adult/Dozari Adult - App Screens): dark vault gradient, brass back square, big cream title, an optional action at the end.
    return (
      <View style={styles.root}>
        <GradientFill from="#2A1A0E" to="#0E0A08" mid={{ at: 0.7, color: '#0E0A08' }} />
        <View style={styles.column}>
          <View style={[styles.headAdult, rule ? styles.headRule : null]}>
            <BrassSquare label={backLabel} onPress={onBack} glyph="back" />
            <Text style={styles.titleAdult} numberOfLines={1}>{title}</Text>
            {action}
          </View>
          {children}
        </View>
      </View>
    );
  }
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
      <View style={[styles.band, adult ? { borderColor: '#E8B64A' } : null, { height: safeTop(bandHeight - 36) }]}>
        <GradientFill from={adult ? '#24160A' : tone.dark} to={adult ? '#5A3A1C' : color} />
      </View>
      <View style={styles.column}>
        <View style={styles.head}>
          <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={() => (playSfx('back'), onBack())}>
            {({ pressed }) => (
              <View style={[styles.back, pressed ? styles.pressed : null]}>
                <GradientFill from="#FFE48A" to={colors.candy.yellow} />
                <Icon name="back" size={22} color={ON_YELLOW} strokeWidth={3} />
              </View>
            )}
          </Pressable>
          <Text style={[styles.title, adult ? { color: '#FFE9A8', textShadowColor: '#000' } : null]} numberOfLines={1}>{title}</Text>
          {action}
        </View>
        {children}
      </View>
    </View>
  );
}

/** Small cream pill for the header action slot («همه خوانده شد»). */
export function HeaderPill({ label, onPress }: { label: string; onPress: () => void }) {
  const adult = useTheme() === 'adult';
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.pill, adult ? styles.pillAdult : null]}>
      <Text style={[styles.pillText, adult ? styles.pillTextAdult : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.sand, zIndex: 20 },
  band: { position: 'absolute', top: 0, left: 0, right: 0, borderBottomWidth: 4, borderColor: colors.ink, overflow: 'hidden' },
  column: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 10, paddingTop: pageTop() },
  head: { flexDirection: ROW, alignItems: 'center', gap: 8, paddingHorizontal: 2, marginBottom: 16 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  pressed: { transform: [{ translateY: 3 }] },
  headAdult: { flexDirection: ROW, alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingBottom: 12, marginBottom: 12 },
  headRule: { borderBottomWidth: 2, borderColor: '#8A5A16' },
  titleAdult: { flex: 1, fontFamily: fonts.display, fontSize: 32, lineHeight: 48, color: '#FFE9A8', textAlign: TEXT_RIGHT },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 24, color: '#fff', textAlign: TEXT_RIGHT, textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  pill: { height: 34, paddingHorizontal: 12, borderRadius: 99, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.cream, justifyContent: 'center' },
  pillAdult: { backgroundColor: '#0E0A08', borderColor: '#8A5A16' },
  pillTextAdult: { color: '#E8B64A' },
  pillText: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink },
});
