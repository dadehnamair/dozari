import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { colors, fonts } from '../theme/colors';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

/** A card over a dimmed page for forms that are longer than a confirm dialog; the dim area closes it. */
export function FormDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} importantForAccessibility="no" />
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        {/* The bar stays visible so a long form shows that it scrolls (D184). */}
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator persistentScrollbar indicatorStyle="black" style={styles.scroll}>{children}</ScrollView>
      </View>
    </View>
  );
}

/** A row of choices; the picked one is filled. */
export function Chips<T extends string>({ options, value, onPick }: { options: readonly (readonly [T, string])[]; value: T | null; onPick: (v: T) => void }) {
  return (
    <View style={styles.chips}>
      {options.map(([k, label]) => (
        <Pressable key={k} onPress={() => onPick(k)} accessibilityRole="button" accessibilityState={{ selected: value === k }} style={[styles.chip, value === k ? styles.chipOn : null]}>
          <Text style={styles.chipText}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const formStyles = StyleSheet.create({
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, textAlign: 'right' },
  input: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink, borderWidth: 3, borderColor: colors.ink, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', textAlign: 'right' },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  error: { fontFamily: fonts.bold, fontSize: 13, color: '#B3261E', textAlign: 'center' },
  ok: { fontFamily: fonts.bold, fontSize: 14, color: '#2E7D32', textAlign: 'center' },
  buttons: { flexDirection: ROW, gap: 10, marginTop: 4 },
  btn: { flex: 1, height: 44, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  go: { backgroundColor: colors.candy.lime },
  cancel: { backgroundColor: '#fff' },
  off: { opacity: 0.5 },
  btnText: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
});

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, backgroundColor: 'rgba(26,8,44,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 400, maxHeight: '92%', padding: 16, borderRadius: 22, borderWidth: 4, borderColor: colors.ink, backgroundColor: colors.cream, gap: 8 },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, textAlign: 'center' },
  scroll: { flexGrow: 0 },
  body: { gap: 10, paddingRight: 6 },
  chips: { flexDirection: ROW, flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, height: 34, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#fff', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.candy.yellow },
  chipText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
});
