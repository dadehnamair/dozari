import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fa } from '../i18n/fa';
import { leaverUntilText } from './leaver';
import { colors, fonts } from '../theme/colors';

/** The badge of a player who left too many games lately; a tap shows when it comes off (leave-penalty.md). */
export function LeaverBadge({ untilMs }: { untilMs: number }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      <Pressable accessibilityRole="button" accessibilityLabel={fa.leave.badge} onPress={() => setOpen((v) => !v)} style={styles.chip}>
        <Text style={styles.text}>{fa.leave.badge}</Text>
      </Pressable>
      {open ? <Text style={styles.note}>{leaverUntilText(untilMs)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 2 },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, borderWidth: 2, borderColor: colors.ink, backgroundColor: '#FFC2B8' },
  text: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink },
  note: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink, opacity: 0.8 },
});
