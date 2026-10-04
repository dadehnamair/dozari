import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { groupTypedNumber, parseTomanInput } from '@dozari/shared';
import type { PriceRoundView } from '@dozari/shared';
import { Item } from '../components/Item';
import { SlabButton } from '../components/SlabButton';
import { fa } from '../i18n/fa';
import { priceText, questionText } from '../solo/priceRound';
import { colors, fonts } from '../theme/colors';
import { TEXT_RIGHT } from '../theme/direction';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const p = fa.duel.price;

/** One finished round: both guesses, the real price and who was closer. */
function RevealedRow({ r }: { r: PriceRoundView['revealed'][number] }) {
  const verdict = r.winner === 'you' ? p.youWon : r.winner === 'opponent' ? p.theyWon : p.draw;
  return (
    <View style={[styles.reveal, r.winner === 'you' ? styles.revealWon : null]}>
      <Text style={styles.revealName} numberOfLines={1}>{r.nameFa}</Text>
      <Text style={styles.revealLine}>{p.actual}: {priceText(r.actualRials)} {fa.solo.price.unit}</Text>
      <Text style={styles.revealLine}>{p.yourGuess}: {r.yourGuess ? priceText(r.yourGuess) : p.noGuess} · {p.opponentGuess}: {r.opponentGuess ? priceText(r.opponentGuess) : p.noGuess}</Text>
      <Text style={styles.verdict}>{verdict}</Text>
    </View>
  );
}

/** The duel's price-guess round: a hidden numeric guess against the clock; the previous rounds stay revealed underneath. */
export function DuelPriceRound({ round, now, onGuess }: { round: PriceRoundView; now: number; /** Resolves to an error text, or null when the server took the guess. */ onGuess: (rials: bigint) => Promise<string | null> }) {
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setText('');
    setNote(null);
  }, [round.roundIndex]);
  const secs = Math.max(0, Math.ceil((round.endsAt - now) / 1000));
  const current = round.current;
  const send = async () => {
    const rials = parseTomanInput(text);
    if (rials === null) return setNote(fa.solo.price.invalid);
    setBusy(true);
    setNote(await onGuess(rials));
    setBusy(false);
  };
  return (
    <View style={styles.column}>
      <Text style={styles.title}>{p.title}</Text>
      <Text style={styles.sub}>{p.round(round.roundIndex + 1, round.totalRounds)}{current ? ` · ${p.secondsLeft(secs)}` : ''}</Text>
      {current ? (
        <View style={styles.card}>
          <View style={styles.icon}><Item icon={current.iconKey ?? 'coin'} /></View>
          <Text style={styles.name}>{current.nameFa}{current.unitFa ? ` (${current.unitFa})` : ''}</Text>
          <Text style={styles.question}>{questionText(fa.solo.price.question, current.year)}</Text>
          {round.youSubmitted ? (
            <Text style={styles.wait}>{p.lockedIn}</Text>
          ) : (
            <>
              <View style={styles.inputRow}>
                <TextInput
                  value={groupTypedNumber(text)}
                  onChangeText={(v) => setText(groupTypedNumber(v))}
                  keyboardType="numeric"
                  placeholder={fa.solo.price.placeholder}
                  placeholderTextColor="rgba(43,18,64,0.4)"
                  style={styles.input}
                  accessibilityLabel={fa.solo.price.question}
                  onSubmitEditing={() => void send()}
                />
                <Text style={styles.unit}>{fa.solo.price.unit}</Text>
              </View>
              {round.opponentSubmitted ? <Text style={styles.hint}>{p.opponentLocked}</Text> : null}
              <SlabButton label={fa.solo.price.submit} color={colors.candy.lime} height={54} fontSize={22} onPress={() => void send()} disabled={busy} />
            </>
          )}
          {note ? <Text style={styles.error}>{note}</Text> : null}
        </View>
      ) : null}
      {round.revealed.length === 0 ? <Text style={styles.intro}>{p.intro}</Text> : null}
      {[...round.revealed].reverse().map((r) => <RevealedRow key={r.index} r={r} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 10, paddingTop: 8, alignItems: 'stretch' },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.candy.yellow, textAlign: 'center' },
  sub: { fontFamily: fonts.bold, fontSize: 14, color: colors.cream, textAlign: 'center' },
  intro: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 22, color: colors.cream, textAlign: 'center', opacity: 0.85 },
  card: { gap: 8, padding: 14, borderRadius: 20, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#FBF1DE', alignItems: 'center' },
  icon: { width: 64, height: 64 },
  name: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, textAlign: 'center' },
  question: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, textAlign: 'center' },
  inputRow: { flexDirection: ROW, alignItems: 'center', gap: 8 },
  input: { minWidth: 170, borderWidth: 3, borderColor: colors.ink, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', color: colors.ink, fontFamily: fonts.display, fontSize: 22, textAlign: 'center' },
  unit: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: '#7E46D6' },
  wait: { fontFamily: fonts.bold, fontSize: 15, color: '#7E46D6', textAlign: 'center' },
  error: { fontFamily: fonts.bold, fontSize: 13, color: '#B3261E', textAlign: 'center' },
  reveal: { gap: 2, padding: 10, borderRadius: 16, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#E8E0F5' },
  revealWon: { backgroundColor: '#E1F7C9' },
  revealName: { fontFamily: fonts.display, fontSize: 17, color: colors.ink, textAlign: TEXT_RIGHT },
  revealLine: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink, textAlign: TEXT_RIGHT },
  verdict: { fontFamily: fonts.display, fontSize: 15, color: '#7E46D6', textAlign: TEXT_RIGHT },
});
