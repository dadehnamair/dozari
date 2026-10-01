import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}

/** Chunky "shelf" button (docs/brand-visual.md). Placeholder styling until the designed 9-slice art lands. */
export function CandyButton({ label, onPress, color = colors.candy.pink, disabled = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: color, borderBottomWidth: pressed ? 2 : 6, marginTop: pressed ? 4 : 0, opacity: disabled ? 0.45 : 1 },
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
    borderBottomColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
  },
  label: { fontFamily: 'Vazirmatn_700Bold', fontSize: 16, color: colors.ink },
});
