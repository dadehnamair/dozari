import { StyleSheet, Text, View } from 'react-native';
import { fa } from '../i18n/fa';
import type { EmptySpec } from '../kit/data';
import { candyTone, colors, fonts } from '../theme/colors';
import { CandyButton } from './CandyButton';
import { Mascot } from './Mascot';

/** Empty / error card: one mascot pose, a short title, a line of help and (usually) one clear action. */
export function EmptyState({ spec, onAction }: { spec: EmptySpec; onAction?: () => void }) {
  const text = fa.kit.empty[spec.kind];
  return (
    <View style={styles.card}>
      <View style={styles.mascot}>
        <Mascot pose={spec.pose} skin={spec.skin} />
      </View>
      <Text style={styles.title}>{text.title}</Text>
      <Text style={styles.sub}>{text.sub}</Text>
      {spec.hasAction && onAction ? <CandyButton label={text.action} color={candyTone[spec.tone].base} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: 236, padding: 20, borderRadius: 28, backgroundColor: colors.cream, borderWidth: 4, borderColor: colors.ink, borderBottomWidth: 8, alignItems: 'center', gap: 8 },
  mascot: { width: 130, height: 142 },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.body, fontSize: 13.5, color: colors.ink, opacity: 0.8, textAlign: 'center', lineHeight: 22 },
});
