import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { sendErrorReport } from '../errors/report';
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

/**
 * «Send this problem to us»: a real error card reports itself once (message, trail and a screenshot go to the admin panel), and any card of a failure that is not
 * just «no internet» lets the player send it by hand. Shows what happened to the report.
 */
function ReportLine({ message, detail, auto }: { message: string; detail?: string; auto: boolean }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const busy = useRef(false);
  const send = () => {
    if (busy.current) return;
    busy.current = true;
    setState('sending');
    void sendErrorReport({ kind: 'screen', message, detail }).then((ok) => (setState(ok ? 'sent' : 'failed'), (busy.current = false)));
  };
  useEffect(() => {
    if (!auto) return;
    // A beat for the card to paint, so the screenshot shows it.
    const id = setTimeout(send, 500);
    return () => clearTimeout(id);
  }, []);
  const t = fa.errorReport;
  if (state === 'sent') return <Text style={styles.reported}>{t.sent}</Text>;
  if (state === 'sending') return <Text style={styles.reported}>{t.sending}</Text>;
  return (
    <Pressable onPress={send} accessibilityRole="button" hitSlop={8}>
      <Text style={styles.reportLink}>{state === 'failed' ? t.failed : t.send}</Text>
    </Pressable>
  );
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
      {kind !== 'noInternet' ? <ReportLine message={`${kind}: ${sub ?? text.sub}`} detail={detail} auto={kind === 'error'} /> : null}
      {onRetry ? <CandyButton label={retryLabel ?? text.action} color={candyTone[spec.tone].base} onPress={onRetry} /> : null}
      {onBack ? <CandyButton label={backLabel ?? fa.duel.back} sfx="back" color={candyTone.sky.base} onPress={onBack} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  reported: { fontFamily: fonts.bold, fontSize: 12, color: '#7E46D6', textAlign: 'center' },
  reportLink: { fontFamily: fonts.bold, fontSize: 12.5, color: '#7E46D6', textDecorationLine: 'underline', textAlign: 'center' },
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
