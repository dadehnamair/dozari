import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { fa } from '../i18n/fa';
import { EMPTY_STATES } from '../kit/data';
import type { EmptyKind, EmptySpec } from '../kit/data';
import { candyTone, colors, fonts } from '../theme/colors';
import { CandyButton } from './CandyButton';
import type { CharacterPose } from '../theme/character';
import { Character } from './Character';

/** Empty / error card: one mascot pose, a short title, a line of help and (usually) one clear action. */
export function EmptyState({ spec, onAction }: { spec: EmptySpec; onAction?: () => void }) {
  const text = fa.kit.empty[spec.kind];
  return (
    <View style={styles.card}>
      <View style={styles.mascot}>
        <Character pose={spec.pose} skin={spec.skin} />
      </View>
      <Text style={styles.title}>{text.title}</Text>
      <Text style={styles.sub}>{text.sub}</Text>
      {spec.hasAction && onAction ? <CandyButton label={text.action} color={candyTone[spec.tone].base} onPress={onAction} /> : null}
    </View>
  );
}

export interface ErrorCardProps {
  /** Which design-10 card: the shocked mascot (`error`), the sleepy one (`noInternet`) or the sad one (`noPuzzles`). */
  kind: Extract<EmptyKind, 'error' | 'noInternet' | 'noPuzzles'>;
  /** Replaces the card's default line, e.g. a specific reason. */
  sub?: string;
  /** Small technical line (server address, status code) for whoever debugs. */
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
  onBack?: () => void;
  backLabel?: string;
}

/** The friendly failure card (docs/design/Dozari - 10): used wherever a screen could not reach the server or has nothing to show. */
export function ErrorCard({ kind, sub, detail, onRetry, retryLabel, onBack, backLabel }: ErrorCardProps) {
  const spec = EMPTY_STATES.find((e) => e.kind === kind) as EmptySpec;
  const text = fa.kit.empty[kind];
  return (
    <View style={styles.card}>
      <View style={styles.mascot}>
        <Character pose={spec.pose} skin={spec.skin} />
      </View>
      <Text style={styles.title}>{text.title}</Text>
      <Text style={styles.sub}>{sub ?? text.sub}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      {onRetry ? <CandyButton label={retryLabel ?? text.action} color={candyTone[spec.tone].base} onPress={onRetry} /> : null}
      {onBack ? <CandyButton label={backLabel ?? fa.duel.back} sfx="back" color={candyTone.sky.base} onPress={onBack} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  detail: { fontFamily: fonts.body, fontSize: 11, color: colors.ink, opacity: 0.5, textAlign: 'center', writingDirection: 'ltr' },
  card: { width: 236, padding: 20, borderRadius: 28, backgroundColor: colors.cream, borderWidth: 4, borderColor: colors.ink, borderBottomWidth: 8, alignItems: 'center', gap: 8 },
  mascot: { width: 130, height: 142 },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.body, fontSize: 13.5, color: colors.ink, opacity: 0.8, textAlign: 'center', lineHeight: 22 },
});

/** A short empty line with a character in a fitting pose (docs/design/Dozari - 10): for lists that are simply empty. */
export function EmptyNote({ text, pose = 'sleeping', skin = 4 }: { text: string; pose?: CharacterPose; skin?: number }) {
  const small = useWindowDimensions().height < 700; // nothing scrolls: a shorter screen gets a smaller character
  return (
    <View style={noteStyles.box}>
      <View style={small ? noteStyles.artSmall : noteStyles.art}><Character pose={pose} skin={skin} /></View>
      <Text style={noteStyles.text}>{text}</Text>
    </View>
  );
}

const noteStyles = StyleSheet.create({
  box: { alignItems: 'center', gap: 2, paddingVertical: 4 },
  art: { width: 84, height: 92 },
  artSmall: { width: 52, height: 58 },
  text: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, textAlign: 'center' },
});
