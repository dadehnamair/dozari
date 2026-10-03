import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, colors } from '../theme/colors';
import type { CharacterId } from '../theme/character';
import { Character } from './Character';
import { TEXT_RIGHT } from '../theme/direction';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

/** A character of the bazaar (baqal, ajan, mirza …) speaking in a bubble. Used for menu tips on Home and for «why is this locked». */
export function GuideBubble({ text, who = 'dozari', onPress }: { text: string; who?: CharacterId; onPress?: () => void }) {
  const body = (
    <View style={styles.root} accessibilityRole={onPress ? undefined : 'text'} accessibilityLabel={onPress ? undefined : text}>
      <View style={styles.mascot}><Character who={who} pose="idle" crop="face" /></View>
      <View style={styles.bubble}><Text style={styles.text}>{text}</Text></View>
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={text}>{body}</Pressable> : body;
}

const styles = StyleSheet.create({
  root: { flexDirection: ROW, alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#FFF6E8' },
  mascot: { width: 54, height: 54 },
  bubble: { flex: 1, minWidth: 0 },
  text: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 20, color: colors.ink, textAlign: TEXT_RIGHT },
});
