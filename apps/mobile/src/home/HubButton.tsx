import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, toneOf } from '../theme/colors';
import { GradientFill } from '../components/GradientFill';

const SHELF = 6;

/** The two big bottom buttons of screen-home: 68px candy slabs, Lalezar 28, optional pink corner badge. */
export function HubButton({ label, color, badge, onPress }: { label: string; color: string; badge?: string; onPress: () => void }) {
  const tone = toneOf(color);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.wrap}>
      {({ pressed }) => (
        <>
          <View style={styles.shelf} />
          <View style={[styles.face, { transform: [{ translateY: pressed ? SHELF - 2 : 0 }] }]}>
            <GradientFill from={tone.light} to={tone.dark} mid={{ at: 0.55, color: tone.base }} />
            <View style={styles.topLight} />
            <Text style={styles.label} numberOfLines={1}>{label}</Text>
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
  wrap: { flex: 1, paddingBottom: SHELF },
  shelf: { position: 'absolute', left: 0, right: 0, top: SHELF, bottom: 0, borderRadius: 20, backgroundColor: colors.ink },
  face: { height: 68, borderRadius: 20, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  topLight: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.55)' },
  label: { fontFamily: fonts.display, fontSize: 28, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  badge: { position: 'absolute', top: -12, left: -8, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.candy.pink, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.display, fontSize: 16, lineHeight: 22, color: '#fff' },
});
