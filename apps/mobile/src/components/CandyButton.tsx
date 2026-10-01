import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, shelfOf } from '../theme/colors';

interface Props {
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}

/** Chunky "shelf" button (docs/brand-visual.md): candy face over a darker bottom edge, as in the design kit. */
export function CandyButton({ label, onPress, color = colors.candy.pink, disabled = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: color, borderBottomColor: shelfOf(color), borderBottomWidth: pressed ? 2 : 6, marginTop: pressed ? 4 : 0, opacity: disabled ? 0.45 : 1 },
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: 96,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
  },
  label: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
});
