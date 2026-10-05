import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatPersianNumber, groupTypedNumber, parseTomanInput } from '@dozari/shared';
import type { SoloPriceResult, SoloPriceRounds } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { fetchPriceRounds, guessPrice } from '../solo/api';
import { priceText, questionText, totalPoints } from '../solo/priceRound';
import { colors } from '../theme/colors';
import { PriceFeedbackLink } from '../feedback/SuggestDialog';
import { CandyButton } from './CandyButton';

/** Bonus round after the puzzle: one hidden price per group, scored on the 5-tier staircase. */
export function PriceRoundPanel({ sessionId, onDone }: { sessionId: string; onDone: () => void }) {
  const [data, setData] = useState<SoloPriceRounds | 'failed' | null>(null);
  const [results, setResults] = useState<SoloPriceResult[]>([]);
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Showing the real price after a guess, before moving to the next round. */
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchPriceRounds(sessionId)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setResults(d.results);
      })
      .catch(() => alive && setData('failed'));
    return () => { alive = false; };
  }, [sessionId]);

  if (data === null) return <ActivityIndicator color={colors.candy.yellow} />;
  if (data === 'failed') return <Text style={styles.msg}>{fa.solo.price.loadFailed}</Text>;
  if (data.rounds.length === 0) return null;

  const p = fa.solo.price;
  const total = data.rounds.length;
  // Rounds are answered in order, so the next question is the one after the answered ones.
  const index = reviewing ? results.length - 1 : results.length;
  const round = data.rounds[index];
  const finished = results.length >= total && !reviewing;

  const submit = async () => {
    if (!round || busy) return;
    const rials = parseTomanInput(text);
    if (rials === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setBusy(true);
    try {
      const r = await guessPrice(sessionId, round.level, rials);
      setResults((prev) => [...prev, r]);
      setReviewing(true);
      setText('');
    } catch {
      setData('failed');
    } finally {
      setBusy(false);
    }
  };

  if (finished) {
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>{p.title}</Text>
        <Text style={styles.total}>{p.total}: {formatPersianNumber(totalPoints(results))} / {formatPersianNumber(total * 5)}</Text>
        {results.map((r) => (
          <Text key={r.level} style={styles.row}>
            {data.rounds.find((x) => x.level === r.level)?.nameFa} — {p.yourGuess}: {priceText(r.guessRials)} · {p.actual}: {priceText(r.actualRials)} · {formatPersianNumber(r.points)}
          </Text>
        ))}
        <CandyButton label={p.finish} color={colors.candy.lime} onPress={onDone} />
      </View>
    );
  }
  if (!round) return null;

  const result = reviewing ? results[results.length - 1] : undefined;
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{p.title}</Text>
      <Text style={styles.sub}>{p.round} {formatPersianNumber(index + 1)} / {formatPersianNumber(total)}</Text>
      <Text style={[styles.name, { color: colors.group[round.level] }]}>{round.nameFa}{round.unitFa ? ` (${round.unitFa})` : ''}</Text>
      <Text style={styles.msg}>{questionText(p.question, round.year)}</Text>
      {result ? (
        <>
          <Text style={styles.row}>{p.yourGuess}: {priceText(result.guessRials)}</Text>
          <Text style={styles.total}>{p.actual}: {priceText(result.actualRials)}</Text>
          <Text style={styles.row}>{p.points}: {formatPersianNumber(result.points)}</Text>
          {round ? <PriceFeedbackLink product={{ id: round.productId, nameFa: round.nameFa, year: round.year }} /> : null}
          <CandyButton label={results.length >= total ? p.finish : p.next} color={colors.candy.lime} onPress={() => setReviewing(false)} />
        </>
      ) : (
        <>
          <View style={styles.inputRow}>
            <TextInput
              value={groupTypedNumber(text)}
              onChangeText={(v) => setText(groupTypedNumber(v))}
              keyboardType="numeric"
              placeholder={p.placeholder}
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
              accessibilityLabel={p.question}
              onSubmitEditing={() => void submit()}
            />
            <Text style={styles.msg}>{p.unit}</Text>
          </View>
          {invalid ? <Text style={styles.error}>{p.invalid}</Text> : null}
          <CandyButton label={p.submit} sfx="confirm" color={colors.candy.yellow} onPress={() => void submit()} disabled={busy} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: '100%', maxWidth: 520, gap: 10, alignItems: 'center', marginTop: 12 },
  title: { fontFamily: 'Vazirmatn_700Bold', fontSize: 18, color: colors.cream },
  sub: { fontFamily: 'Vazirmatn_400Regular', fontSize: 13, color: colors.cream, opacity: 0.8 },
  name: { fontFamily: 'Vazirmatn_700Bold', fontSize: 20, textAlign: 'center' },
  msg: { fontFamily: 'Vazirmatn_400Regular', fontSize: 15, color: colors.cream, textAlign: 'center' },
  total: { fontFamily: 'Vazirmatn_700Bold', fontSize: 16, color: colors.candy.yellow },
  row: { fontFamily: 'Vazirmatn_400Regular', fontSize: 13, color: colors.cream, textAlign: 'center' },
  error: { fontFamily: 'Vazirmatn_400Regular', fontSize: 13, color: colors.candy.pink },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { minWidth: 160, borderWidth: 2, borderColor: colors.cream, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, color: colors.cream, fontFamily: 'Vazirmatn_700Bold', fontSize: 18, textAlign: 'center' },
});
