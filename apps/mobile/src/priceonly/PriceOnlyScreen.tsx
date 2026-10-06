import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatPersianNumber, groupTypedNumber, parseTomanInput, solarMonthOf } from '@dozari/shared';
import type { PriceOnlyView } from '@dozari/shared';
import { Character } from '../components/Character';
import { CandyButton } from '../components/CandyButton';
import { ErrorCard } from '../components/EmptyState';
import { Item } from '../components/Item';
import { SlabButton } from '../components/SlabButton';
import { GameTopBar } from '../game/GameTopBar';
import { MatchBackground } from '../game/MatchBackground';
import { fa } from '../i18n/fa';
import { PriceFeedbackLink } from '../feedback/SuggestDialog';
import { ApiError, BASE_URL } from '../net/http';
import { describeError, errorKind } from '../solo/errors';
import { priceText, questionText } from '../solo/priceRound';
import { playSfx } from '../sound/engine';
import { colors, fonts } from '../theme/colors';
import { TEXT_RIGHT } from '../theme/direction';
import { nativeTopInset } from '../theme/safeArea';
import { beginPriceOnly, guessPriceOnly } from './api';

type Phase = { kind: 'loading' } | { kind: 'error'; message: string; detail: string; card: 'noInternet' | 'noPuzzles' | 'error' } | { kind: 'ready'; view: PriceOnlyView };

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const p = fa.priceOnly;

/** «فقط حدس قیمت»: a short game of price questions only (docs/logic/price-guess-round.md §Price-only mode). */
export function PriceOnlyScreen({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Showing the real price after a guess, before the next question. */
  const [reviewing, setReviewing] = useState(false);

  const begin = useCallback(async () => {
    setPhase({ kind: 'loading' });
    setText('');
    setReviewing(false);
    try {
      setPhase({ kind: 'ready', view: await beginPriceOnly() });
    } catch (err) {
      const { message, detail } = describeError(err, BASE_URL);
      setPhase({ kind: 'error', message: err instanceof ApiError && err.code === 'no_products' ? p.noProducts : message, detail, card: errorKind(err) });
    }
  }, []);
  useEffect(() => void begin(), [begin]);

  if (phase.kind === 'loading') {
    return (
      <MatchBackground>
        <View style={styles.center}><ActivityIndicator color={colors.candy.yellow} /></View>
      </MatchBackground>
    );
  }
  if (phase.kind === 'error') {
    return (
      <MatchBackground>
        <View style={styles.center}>
          <ErrorCard kind={phase.card} sub={phase.message} detail={phase.detail} onRetry={() => void begin()} retryLabel={fa.solo.errors.retry} onBack={onBack} backLabel={fa.solo.back} />
        </View>
      </MatchBackground>
    );
  }

  const { view } = phase;
  const total = view.rounds.length;
  const answered = view.results.length;
  const index = reviewing ? answered - 1 : answered;
  const round = view.rounds[index];
  const result = reviewing ? view.results[answered - 1] : undefined;
  const sum = view.results.reduce((s, r) => s + r.points, 0);

  const submit = async () => {
    if (!round || busy) return;
    const rials = parseTomanInput(text);
    if (rials === null) return setInvalid(true);
    setInvalid(false);
    setBusy(true);
    try {
      const out = await guessPriceOnly(view.sessionId, round.index, rials);
      playSfx(out.result.points >= 4 ? 'correct' : out.result.points >= 2 ? 'oneAway' : 'wrong');
      setPhase({ kind: 'ready', view: out.view });
      setReviewing(true);
      setText('');
    } catch (err) {
      const { message, detail } = describeError(err, BASE_URL);
      setPhase({ kind: 'error', message, detail, card: errorKind(err) });
    } finally {
      setBusy(false);
    }
  };

  const finished = view.done && !reviewing;
  return (
    <MatchBackground>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <GameTopBar title={p.title} backLabel={fa.solo.back} onBack={onBack} />
          <View style={styles.talk}>
            <View style={styles.talker}><Character pose={finished ? 'win' : 'thinking'} month={solarMonthOf(Date.now())} /></View>
            <View style={styles.bubble}>
              <Text style={styles.bubbleText}>{finished ? p.finished(formatPersianNumber(sum), formatPersianNumber(view.maxPoints)) : p.intro}</Text>
            </View>
          </View>

          {finished ? (
            <View style={styles.card}>
              <Text style={styles.title}>{p.summary}</Text>
              {view.results.map((r) => {
                const q = view.rounds[r.index];
                return (
                  <Text key={r.index} style={styles.row}>
                    {q?.nameFa} ({formatPersianNumber(q?.year ?? 0)}) — {p.yourGuess}: {priceText(r.guessRials)} · {p.actual}: {priceText(r.actualRials)} · +{formatPersianNumber(r.points)}
                  </Text>
                );
              })}
              <View style={styles.actions}>
                <SlabButton label={fa.solo.back} sfx="back" color={colors.candy.sky} height={58} fontSize={20} onPress={onBack} />
                <SlabButton label={p.again} sfx="confirm" color={colors.candy.lime} height={58} fontSize={22} grow={1.4} onPress={() => void begin()} />
              </View>
            </View>
          ) : round ? (
            <View style={styles.card}>
              <Text style={styles.sub}>{fa.solo.price.round} {formatPersianNumber(index + 1)} / {formatPersianNumber(total)} · {p.score(formatPersianNumber(sum))}</Text>
              <View style={styles.icon}>{round.iconKey ? <Item icon={round.iconKey} /> : null}</View>
              <Text style={styles.name}>{round.nameFa}{round.unitFa ? ` (${round.unitFa})` : ''}</Text>
              <Text style={styles.msg}>{questionText(fa.solo.price.question, round.year)}</Text>
              {result ? (
                <>
                  <Text style={styles.row}>{p.yourGuess}: {priceText(result.guessRials)}</Text>
                  <Text style={styles.total}>{p.actual}: {priceText(result.actualRials)}</Text>
                  <Text style={styles.gain}>+{formatPersianNumber(result.points)} {p.points}</Text>
                  <PriceFeedbackLink product={{ id: round.productId, nameFa: round.nameFa, year: round.year }} />
                  <CandyButton label={view.done ? p.seeResult : fa.solo.price.next} sfx="confirm" color={colors.candy.lime} onPress={() => setReviewing(false)} />
                </>
              ) : (
                <>
                  <View style={styles.inputRow}>
                    <TextInput
                      value={groupTypedNumber(text)}
                      onChangeText={(v) => setText(groupTypedNumber(v))}
                      keyboardType="numeric"
                      placeholder={fa.solo.price.placeholder}
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      style={styles.input}
                      accessibilityLabel={fa.solo.price.question}
                      onSubmitEditing={() => void submit()}
                    />
                    <Text style={styles.msg}>{fa.solo.price.unit}</Text>
                  </View>
                  {invalid ? <Text style={styles.error}>{fa.solo.price.invalid}</Text> : null}
                  <CandyButton label={fa.solo.price.submit} sfx="confirm" color={colors.candy.yellow} onPress={() => void submit()} disabled={busy} />
                </>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </MatchBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  screen: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 12, paddingTop: 20 + nativeTopInset(), paddingBottom: 28 },
  column: { width: '100%', maxWidth: 480, gap: 12 },
  talk: { flexDirection: ROW, alignItems: 'flex-end', gap: 8 },
  talker: { width: 110, height: 128 },
  bubble: { flex: 1, padding: 12, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.card },
  bubbleText: { fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 22, color: colors.ink, textAlign: TEXT_RIGHT },
  card: { padding: 14, gap: 10, alignItems: 'center', borderRadius: 22, borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(43,18,64,0.72)' },
  title: { fontFamily: fonts.display, fontSize: 20, color: colors.candy.yellow },
  sub: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.cream, opacity: 0.85 },
  icon: { width: 84, height: 84 },
  name: { fontFamily: fonts.display, fontSize: 22, color: colors.cream, textAlign: 'center' },
  msg: { fontFamily: fonts.bold, fontSize: 15, color: colors.cream, textAlign: 'center' },
  total: { fontFamily: fonts.display, fontSize: 18, color: colors.candy.yellow },
  gain: { fontFamily: fonts.display, fontSize: 20, color: colors.candy.lime },
  row: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 21, color: colors.cream, textAlign: 'center' },
  error: { fontFamily: fonts.bold, fontSize: 13, color: colors.candy.pink },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { minWidth: 160, borderWidth: 2, borderColor: colors.cream, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, color: colors.cream, fontFamily: fonts.bold, fontSize: 18, textAlign: 'center' },
  actions: { flexDirection: ROW, gap: 10, alignSelf: 'stretch', marginTop: 6 },
});
