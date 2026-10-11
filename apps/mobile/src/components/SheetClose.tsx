import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';
import { playSfx } from '../sound/engine';
import { Icon } from './Icon';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

/** The close button of an opened dialog: a small round ✕ on the first line of the card, at the start side (never a wide button at the bottom). */
export function SheetClose({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={() => (playSfx('back'), onPress())}>
        {({ pressed }) => (
          <View style={[styles.btn, pressed ? styles.pressed : null]}>
            <Icon name="close" size={18} color="#fff" strokeWidth={3.2} />
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignSelf: 'stretch', flexDirection: ROW, marginBottom: 2 },
  btn: { width: 34, height: 34, borderRadius: 12, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#A66BF0', alignItems: 'center', justifyContent: 'center', shadowColor: colors.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 },
  pressed: { transform: [{ translateY: 2 }] },
});
