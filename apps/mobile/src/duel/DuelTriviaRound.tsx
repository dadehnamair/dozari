import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TriviaRoundView } from '@dozari/shared';
import { VERDICT_TONES, choiceVerdict } from '../components/choiceVerdict';
import { fa } from '../i18n/fa';
import { playSfx } from '../sound/engine';
import { colors, fonts } from '../theme/colors';

const t = fa.duel.triviaRound;
const CHOICE_TONES = ['#8FDCFA', '#B8F08F', '#FFD86A', '#FF9DBF'] as const;

/** How long a finished question stays on screen, coloured, before the next one takes its place. */
const HOLD_MS = 2300;

/** One question's four choices: the picked one lit while waiting, or coloured green / red / purple once revealed. */
function Choices({ options, picked, correct, onPick, disabled }: { options: readonly string[]; picked: number | null; correct?: number; onPick?: (i: number) => void; disabled?: boolean }) {
  return (
    <>
      {options.map((o, i) => {
        const v = correct === undefined ? null : choiceVerdict(i, picked, correct);
        const lit = v === null && picked === i;
        const bg = v && v !== 'dim' ? VERDICT_TONES[v].to : lit ? '#FFE48A' : CHOICE_TONES[i % 4];
        return (
          <Pressable key={i} accessibilityRole="button" accessibilityLabel={o} disabled={disabled || correct !== undefined || picked !== null} onPress={() => onPick?.(i)} style={({ pressed }) => [styles.choice, { backgroundColor: bg }, v === 'dim' || (v === null && picked !== null && !lit) ? styles.dim : null, pressed ? styles.pressed : null]}>
            <Text style={styles.choiceText}>{o}</Text>
          </Pressable>
        );
      })}
    </>
  );
}

/** The duel's general-question round: a hidden four-choice answer against the clock; a finished question is coloured in place for a moment (right green, wrong red, the right one purple) with its point. */
export function DuelTriviaRound({ round, now, onAnswer }: { round: TriviaRoundView; now: number; /** Resolves to an error text, or null when the server took the answer. */ onAnswer: (index: number) => Promise<string | null> }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [mine, setMine] = useState<number | null>(null);
  const [hold, setHold] = useState<TriviaRoundView['revealed'][number] | null>(null);
  const seen = useRef(0);
  useEffect(() => {
    setMine(null);
    setNote(null);
  }, [round.roundIndex]);
  // A question the server just revealed stays on screen with its verdict before the next one shows.
  useEffect(() => {
    const n = round.revealed.length;
    if (n > seen.current) {
      const row = round.revealed[n - 1] ?? null;
      setHold(row);
      if (row) playSfx(row.yourPick === row.correctIndex ? 'correct' : 'wrong');
      const id = setTimeout(() => setHold(null), HOLD_MS);
      seen.current = n;
      return () => clearTimeout(id);
    }
    seen.current = n;
    return undefined;
  }, [round.revealed.length]);
  const secs = Math.max(0, Math.ceil((round.endsAt - now) / 1000));
  const current = round.current;
  const send = async (index: number) => {
    playSfx('confirm');
    setBusy(true);
    setMine(index);
    const err = await onAnswer(index);
    if (err) setMine(null);
    setNote(err);
    setBusy(false);
  };
  const answered = round.youAnswered || mine !== null;
  return (
    <View style={styles.column}>
      <Text style={styles.title}>{t.title}</Text>
      <Text style={styles.sub}>{t.round(Math.min(round.totalRounds, (hold ? hold.index : round.roundIndex) + 1), round.totalRounds)}{current && !hold ? ` · ${t.secondsLeft(secs)}` : ''}</Text>
      {hold ? (
        <View style={styles.card}>
          <Text style={styles.question}>{hold.textFa}</Text>
          <Choices options={hold.options} picked={hold.yourPick} correct={hold.correctIndex} />
          {hold.yourPick === hold.correctIndex ? <Text style={styles.point}>{t.point}</Text> : null}
          {hold.explanationFa ? <Text style={styles.hint}>{hold.explanationFa}</Text> : null}
        </View>
      ) : current ? (
        <View style={styles.card}>
          <Text style={styles.question}>{current.textFa}</Text>
          <Choices options={current.options} picked={answered ? mine ?? -1 : null} onPick={(i) => void send(i)} disabled={busy} />
          {answered ? <Text style={styles.wait}>{t.lockedIn}</Text> : round.opponentAnswered ? <Text style={styles.hint}>{t.opponentLocked}</Text> : null}
          {note ? <Text style={styles.error}>{note}</Text> : null}
        </View>
      ) : null}
      {round.revealed.length === 0 && !hold ? <Text style={styles.intro}>{t.intro}</Text> : null}
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
  dim: { opacity: 0.45 },
  point: { fontFamily: fonts.display, fontSize: 20, color: '#2E7D32', textAlign: 'center' },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: '#7E46D6', textAlign: 'center' },
  wait: { fontFamily: fonts.bold, fontSize: 15, color: '#7E46D6', textAlign: 'center' },
  error: { fontFamily: fonts.bold, fontSize: 13, color: '#B3261E', textAlign: 'center' },
});
