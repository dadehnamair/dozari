import { Platform, StyleSheet, Text, View } from 'react-native';
import { fonts, colors } from '../theme/colors';
import { Mascot } from './Mascot';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

/** The guide: the mascot pointing at a speech bubble. Used for menu tips on Home and for «why is this locked». */
export function GuideBubble({ text }: { text: string }) {
  return (
    <View style={styles.root} accessibilityRole="text" accessibilityLabel={text}>
      <View style={styles.mascot}><Mascot pose="pointing" crop="face" width="100%" height="100%" /></View>
      <View style={styles.bubble}><Text style={styles.text}>{text}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: ROW, alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#FFF6E8' },
  mascot: { width: 54, height: 54 },
  bubble: { flex: 1, minWidth: 0 },
  text: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 20, color: colors.ink, textAlign: 'right' },
});
