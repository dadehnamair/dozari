import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { groupTypedNumber, parseTomanInput } from '@dozari/shared';
import type { PriceRoundView } from '@dozari/shared';
import { Item } from '../components/Item';
import { PriceChoices } from '../components/PriceChoices';
import { fa } from '../i18n/fa';
import { priceText, questionText } from '../solo/priceRound';
import { fonts } from '../theme/colors';
import { BrassButton, Plate } from './adultKit';

const p = fa.duel.price;
/** Silver = price-guess metal (docs/design/CLAUDE.md). */
const SILVER = '#C9D1D9';

function RevealedRow({ r }: { r: PriceRoundView['revealed'][number] }) {
  const won = r.winner === 'you';
  const lost = r.winner === 'opponent';
  const verdict = won ? p.youWon : lost ? p.theyWon : p.draw;
  return (
    <Plate radius={14} border={won ? '#9FE870' : lost ? '#E0533F' : SILVER} from={won ? '#22480F' : lost ? '#3A0E0A' : '#2A2F36'} to={won ? '#143008' : lost ? '#240805' : '#14171B'} ledge={3} style={styles.reveal}>
      <Text style={styles.revealName} numberOfLines={1}>{r.nameFa}</Text>
      <Text style={styles.revealLine}>{p.actual}: {priceText(r.actualRials)} {fa.solo.price.unit}</Text>
      <Text style={styles.revealLine}>{p.yourGuess}: {r.yourGuess ? priceText(r.yourGuess) : p.noGuess} · {p.opponentGuess}: {r.opponentGuess ? priceText(r.opponentGuess) : p.noGuess}</Text>
      <Text style={[styles.verdict, { color: won ? '#9FE870' : lost ? '#FF9A8A' : SILVER }]}>{verdict}</Text>
    </Plate>
  );
}

/** Adult look of the duel's price-guess round: a silver plate with the product, the guess field (or the choices) and the rounds already revealed. */
export function DuelPriceRoundAdult({ round, now, onGuess }: { round: PriceRoundView; now: number; onGuess: (rials: bigint) => Promise<string | null> }) {
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setText('');
    setNote(null);
  }, [round.roundIndex]);
  const secs = Math.max(0, Math.ceil((round.endsAt - now) / 1000));
  const current = round.current;
  const send = async (picked?: bigint) => {
    const rials = picked ?? parseTomanInput(text);
    if (rials === null) return setNote(fa.solo.price.invalid);
    setBusy(true);
    setNote(await onGuess(rials));
    setBusy(false);
  };
  return (
    <View style={styles.column}>
      <View style={styles.head}>
        <Text style={styles.title}>{p.title}</Text>
        <Text style={styles.count}>{p.round(round.roundIndex + 1, round.totalRounds)}{current ? ` · ${p.secondsLeft(secs)}` : ''}</Text>
      </View>
      {current ? (
        <Plate radius={20} border={SILVER} from="#2A2F36" to="#14171B" ledge={5} style={styles.card}>
          <View style={styles.iconRing}><View style={styles.icon}><Item icon={current.iconKey ?? 'coin'} /></View></View>
          <Text style={styles.name}>{current.nameFa}{current.unitFa ? ` (${current.unitFa})` : ''}</Text>
          <Text style={styles.question}>{questionText(fa.solo.price.question, current.year)}</Text>
          {round.wager ? <Text style={styles.hint}>{round.youIn === false ? p.sitOut : p.wager(round.wager)}</Text> : null}
          {round.youSubmitted || round.youIn === false ? (
            <Text style={styles.wait}>{round.youSubmitted ? p.lockedIn : p.waitRound}</Text>
          ) : current.options && current.options.length > 0 ? (
            <>
              <PriceChoices options={current.options} onPick={(rials) => void send(rials)} disabled={busy} />
              {round.opponentSubmitted ? <Text style={styles.hint}>{p.opponentLocked}</Text> : null}
            </>
          ) : (
            <>
              <View style={styles.inputRow}>
                <TextInput
                  value={groupTypedNumber(text)}
                  onChangeText={(v) => setText(groupTypedNumber(v))}
                  keyboardType="numeric"
                  placeholder={fa.solo.price.placeholder}
                  placeholderTextColor="rgba(255,233,168,0.35)"
                  style={styles.input}
                  accessibilityLabel={fa.solo.price.question}
                  onSubmitEditing={() => void send()}
                />
                <Text style={styles.unit}>{fa.solo.price.unit}</Text>
              </View>
              {round.opponentSubmitted ? <Text style={styles.hint}>{p.opponentLocked}</Text> : null}
              <View style={styles.full}><BrassButton label={fa.solo.price.submit} tone="gold" height={52} disabled={busy} onPress={() => void send()} /></View>
            </>
          )}
          {note ? <Text style={styles.error}>{note}</Text> : null}
        </Plate>
      ) : null}
      {round.revealed.length === 0 ? <Text style={styles.intro}>{p.intro}</Text> : null}
      {[...round.revealed].reverse().map((r) => <RevealedRow key={r.index} r={r} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { direction: 'rtl', width: '100%', maxWidth: 520, alignSelf: 'center', gap: 10, paddingTop: 8, alignItems: 'stretch' },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 34, color: '#FFE9A8' },
  count: { fontFamily: fonts.bold, fontSize: 12, color: 'rgba(255,233,168,0.65)' },
  intro: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 22, color: 'rgba(255,233,168,0.8)', textAlign: 'center' },
  card: { gap: 8, padding: 14, alignItems: 'center' },
  iconRing: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#0E0A08', borderWidth: 2, borderColor: SILVER, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 52, height: 52 },
  name: { fontFamily: fonts.display, fontSize: 24, lineHeight: 36, color: '#FFE9A8', textAlign: 'center' },
  question: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: 'rgba(255,233,168,0.85)', textAlign: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { minWidth: 170, borderWidth: 2, borderColor: SILVER, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#0E0A08', color: '#FFE9A8', fontFamily: fonts.display, fontSize: 22, textAlign: 'center' },
  unit: { fontFamily: fonts.bold, fontSize: 15, color: 'rgba(255,233,168,0.8)' },
  full: { alignSelf: 'stretch' },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: SILVER },
  wait: { fontFamily: fonts.bold, fontSize: 15, color: SILVER, textAlign: 'center' },
  error: { fontFamily: fonts.bold, fontSize: 13, color: '#FF9A8A', textAlign: 'center' },
  reveal: { gap: 2, padding: 10 },
  revealName: { fontFamily: fonts.display, fontSize: 17, lineHeight: 26, color: '#FFE9A8', textAlign: 'right' },
  revealLine: { fontFamily: fonts.bold, fontSize: 12, color: 'rgba(255,233,168,0.85)', textAlign: 'right' },
  verdict: { fontFamily: fonts.display, fontSize: 15, lineHeight: 24, textAlign: 'right' },
});
