import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GradientFill } from '../components/GradientFill';
import { Icon } from '../components/Icon';
import { colors, fonts } from '../theme/colors';

/** Right-to-left on web too (react-native-web does not flip rows; native does under forced RTL). */
const ROW = ('row-reverse' as const);

/** Top bar of screen-match: square violet back button, yellow title plate, and a slot for counters on the far side. */
export function GameTopBar({ title, backLabel, onBack, children }: { title: string; backLabel: string; onBack: () => void; children?: React.ReactNode }) {
  return (
    <View style={styles.bar}>
      <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack}>
        {({ pressed }) => (
          <View style={[styles.back, pressed ? styles.pressed : null]}>
            <GradientFill from="#C9A3FF" to={colors.candy.grape} />
            <View style={styles.icon}><Icon name="back" size={22} color="#fff" strokeWidth={3} /></View>
          </View>
        )}
      </Pressable>
      <View style={styles.title}>
        <GradientFill from="#FFE48A" to={colors.candy.yellow} />
        <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: ROW, alignItems: 'center', gap: 8 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 4, shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  pressed: { transform: [{ translateY: 3 }] },
  icon: { position: 'relative' },
  title: { flex: 1, height: 46, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 4, shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  titleText: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, paddingHorizontal: 8 },
});
