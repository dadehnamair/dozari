import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, toneOf } from '../theme/colors';
import { GradientFill } from './GradientFill';
import { Icon } from './Icon';
import type { IconName } from '../theme/icons';

const SHELF = 6;

const OFF = { light: '#B8AFC4', base: '#8E83A0', dark: '#6B5F80' };

/**
 * Big candy slab button of the screen designs: the two bottom buttons of screen-home (68px, Lalezar 28) and the
 * action row of screen-match (58px, Lalezar 20). Fills its row share (`grow`; 0 = natural size, e.g. full width in a column), optional pink corner badge.
 */
export function SlabButton({ label, color, badge, onPress, height = 68, fontSize = 28, grow = 1, disabled = false, icon }: { label: string; color: string; badge?: string; onPress: () => void; height?: number; fontSize?: number; grow?: number; disabled?: boolean; /** Line icon shown before the label. */ icon?: IconName }) {
  const tone = disabled ? OFF : toneOf(color);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.wrap, grow > 0 ? { flex: grow } : null]}>
      {({ pressed }) => (
        <>
          <View style={styles.shelf} />
          <View style={[styles.face, { height, borderRadius: height > 60 ? 20 : 18, transform: [{ translateY: pressed ? SHELF - 2 : 0 }] }]}>
            <GradientFill from={tone.light} to={tone.dark} mid={{ at: 0.55, color: tone.base }} />
            <View style={styles.topLight} />
            <View style={styles.content}>
              {icon ? <Icon name={icon} size={Math.round(fontSize * 1.05)} color="#fff" strokeWidth={2.8} /> : null}
              <Text style={[styles.label, { fontSize }, disabled ? styles.labelOff : null]} numberOfLines={1}>{label}</Text>
            </View>
          </View>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: SHELF },
  shelf: { position: 'absolute', left: 0, right: 0, top: SHELF, bottom: 0, borderRadius: 20, backgroundColor: colors.ink },
  face: { borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  topLight: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.55)' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, maxWidth: '100%' },
  labelOff: { opacity: 0.85 },
  label: { fontFamily: fonts.display, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  badge: { position: 'absolute', top: -12, left: -8, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.candy.pink, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.display, fontSize: 16, lineHeight: 22, color: '#fff' },
});
