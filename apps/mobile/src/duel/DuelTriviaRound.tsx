import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TriviaRoundView } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { playSfx } from '../sound/engine';
import { colors, fonts } from '../theme/colors';
import { TEXT_RIGHT } from '../theme/direction';

const t = fa.duel.triviaRound;
const CHOICE_TONES = ['#8FDCFA', '#B8F08F', '#FFD86A', '#FF9DBF'] as const;

/** One finished question: the right choice, and what each side picked. */
function RevealedRow({ r }: { r: TriviaRoundView['revealed'][number] }) {
  const mine = r.yourPick === r.correctIndex;
  const name = (i: number | null) => (i === null ? t.noAnswer : r.options[i] ?? '');
  return (
    <View style={[styles.reveal, mine ? styles.revealWon : null]}>
      <Text style={styles.revealQ}>{r.textFa}</Text>
      <Text style={styles.revealLine}>{t.right}: {r.options[r.correctIndex]}</Text>
      <Text style={styles.revealLine}>{t.yourPick}: {name(r.yourPick)} · {t.opponentPick}: {name(r.opponentPick)}</Text>
      {r.explanationFa ? <Text style={styles.revealLine}>{r.explanationFa}</Text> : null}
    </View>
  );
}

/** The duel's general-question round: a hidden four-choice answer against the clock; finished questions stay revealed underneath. */
export function DuelTriviaRound({ round, now, onAnswer }: { round: TriviaRoundView; now: number; /** Resolves to an error text, or null when the server took the answer. */ onAnswer: (index: number) => Promise<string | null> }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const secs = Math.max(0, Math.ceil((round.endsAt - now) / 1000));
  const current = round.current;
  const send = async (index: number) => {
    setBusy(true);
    setNote(await onAnswer(index));
    setBusy(false);
  };
  return (
    <View style={styles.column}>
      <Text style={styles.title}>{t.title}</Text>
      <Text style={styles.sub}>{t.round(round.roundIndex + 1, round.totalRounds)}{current ? ` · ${t.secondsLeft(secs)}` : ''}</Text>
      {current ? (
        <View style={styles.card}>
          <Text style={styles.question}>{current.textFa}</Text>
          {round.youAnswered ? (
            <Text style={styles.wait}>{t.lockedIn}</Text>
          ) : (
            <>
              {current.options.map((o, i) => (
                <Pressable key={i} accessibilityRole="button" accessibilityLabel={o} disabled={busy} onPress={() => (playSfx('confirm'), void send(i))} style={({ pressed }) => [styles.choice, { backgroundColor: CHOICE_TONES[i % 4] }, pressed ? styles.pressed : null]}>
                  <Text style={styles.choiceText}>{o}</Text>
                </Pressable>
              ))}
              {round.opponentAnswered ? <Text style={styles.hint}>{t.opponentLocked}</Text> : null}
            </>
          )}
          {note ? <Text style={styles.error}>{note}</Text> : null}
        </View>
      ) : null}
      {round.revealed.length === 0 ? <Text style={styles.intro}>{t.intro}</Text> : null}
      {[...round.revealed].reverse().map((r) => <RevealedRow key={r.index} r={r} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 10, paddingTop: 8, alignItems: 'stretch' },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.candy.yellow, textAlign: 'center' },
  sub: { fontFamily: fonts.bold, fontSize: 14, color: colors.cream, textAlign: 'center' },
  intro: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 22, color: colors.cream, textAlign: 'center', opacity: 0.85 },
  card: { gap: 8, padding: 14, borderRadius: 20, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'stretch' },
  question: { fontFamily: fonts.display, fontSize: 21, lineHeight: 32, color: colors.ink, textAlign: 'center', paddingBottom: 4 },
  choice: { minHeight: 54, borderRadius: 16, borderWidth: 2.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  pressed: { transform: [{ translateY: 2 }] },
  choiceText: { fontFamily: fonts.display, fontSize: 18, lineHeight: 28, color: colors.ink, textAlign: 'center' },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: '#7E46D6', textAlign: 'center' },
  wait: { fontFamily: fonts.bold, fontSize: 15, color: '#7E46D6', textAlign: 'center' },
  error: { fontFamily: fonts.bold, fontSize: 13, color: '#B3261E', textAlign: 'center' },
  reveal: { gap: 2, padding: 10, borderRadius: 16, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#E8E0F5' },
  revealWon: { backgroundColor: '#E1F7C9' },
  revealQ: { fontFamily: fonts.display, fontSize: 16, color: colors.ink, textAlign: TEXT_RIGHT },
  revealLine: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink, textAlign: TEXT_RIGHT },
});
