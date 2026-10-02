import { StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../theme/colors';

/** chip of the kit: cream pill with an ink outline («دهه ۶۰»). */
export function Chip({ label }: { label: string }) {
  return <Text style={styles.chip}>{label}</Text>;
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: colors.cream,
    borderWidth: 3,
    borderColor: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
});
