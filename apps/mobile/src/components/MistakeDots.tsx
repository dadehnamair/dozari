import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fa } from '../i18n/fa';

export function MistakeDots({ mistakes, max }: { mistakes: number; max: number }) {
  return (
    <View style={styles.wrap} accessibilityLabel={`${fa.solo.mistakes}: ${mistakes}/${max}`}>
      <Text style={styles.label}>{fa.solo.mistakes}</Text>
      {Array.from({ length: max }, (_, i) => (
        <View key={i} style={[styles.dot, i < mistakes ? styles.dotUsed : styles.dotFree]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontFamily: 'Vazirmatn_400Regular', fontSize: 13, color: colors.cream },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: colors.ink },
  dotFree: { backgroundColor: 'rgba(255,255,255,0.3)' },
  dotUsed: { backgroundColor: colors.candy.pink },
});
