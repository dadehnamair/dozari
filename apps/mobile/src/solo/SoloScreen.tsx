import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { solarMonthOf } from '@dozari/shared';
import type { HintPayload, SoloView } from '@dozari/shared';
import { Board } from '../components/Board';
import { CandyButton } from '../components/CandyButton';
import { ChartPanel } from '../components/ChartPanel';
import { Banner } from '../components/Banner';
import { Confetti } from '../components/Confetti';
import { Character } from '../components/Character';
import { MistakeDots } from '../components/MistakeDots';
import { Rain } from '../components/Rain';
import { PriceRoundPanel } from '../components/PriceRoundPanel';
import { BANNERS } from '../kit/data';
import { fa } from '../i18n/fa';
import { colors } from '../theme/colors';
import { BASE_URL, guessSolo, shuffleSolo } from './api';
import { beginDaily, beginSolo } from './begin';
import { describeError } from './errors';
import { canSubmit, feedbackFor, pruneSelection, toggleSelection } from './selection';
import { recordGameFinished } from '../review/state';
import { HintSheet } from '../shop/HintSheet';
import { hintedCardIds, hintedTitles } from '../shop/hintView';
import type { FeedbackKey } from './selection';

type Phase = { kind: 'loading' } | { kind: 'error'; message: string; detail: string } | { kind: 'ready'; view: SoloView };

const FEEDBACK_MS = 1600;

export function SoloScreen({ onBack, hintsEnabled = true, daily = false }: { onBack: () => void; hintsEnabled?: boolean; /** Today's daily puzzle: one attempt, no "new game". */ daily?: boolean }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [selected, setSelected] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<FeedbackKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [priceDone, setPriceDone] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [given, setGiven] = useState<HintPayload[]>([]);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const adopt = useCallback((view: SoloView) => {
    setNames((prev) => ({ ...prev, ...Object.fromEntries(view.cards.map((c) => [c.id, c.nameFa])) }));
    setSelected((prev) => pruneSelection(prev, view.cards));
    setPhase({ kind: 'ready', view });
  }, []);

  const flash = useCallback((key: FeedbackKey | null) => {
    clearTimeout(feedbackTimer.current);
    setFeedback(key);
    if (key) feedbackTimer.current = setTimeout(() => setFeedback(null), FEEDBACK_MS);
  }, []);

  const fail = useCallback((err: unknown) => {
    console.warn('[solo] request failed', err);
    const { message, detail } = describeError(err, BASE_URL);
    setPhase({ kind: 'error', message, detail });
  }, []);

  const begin = useCallback(async () => {
    setPhase({ kind: 'loading' });
    setSelected([]);
    setNames({});
    setPriceDone(false);
    setGiven([]);
    setHintOpen(false);
    flash(null);
    try {
      adopt(await (daily ? beginDaily() : beginSolo()));
    } catch (err) {
      fail(err);
    }
  }, [adopt, daily, fail, flash]);

  useEffect(() => {
    void begin();
    return () => clearTimeout(feedbackTimer.current);
  }, [begin]);

  if (phase.kind === 'loading') {
    return <View style={styles.center}><ActivityIndicator color={colors.candy.yellow} /></View>;
  }
  if (phase.kind === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>{phase.message}</Text>
        {phase.detail ? <Text style={styles.detail}>{phase.detail}</Text> : null}
        <View style={styles.actions}>
          <CandyButton label={fa.solo.errors.retry} color={colors.candy.yellow} onPress={() => void begin()} />
          <CandyButton label={fa.solo.back} color={colors.candy.sky} onPress={onBack} />
        </View>
      </View>
    );
  }

  const { view } = phase;
  const playing = view.status === 'playing';

  const submit = async () => {
    if (!canSubmit(selected) || busy) return;
    setBusy(true);
    try {
      const result = await guessSolo(view.sessionId, selected);
      flash(feedbackFor(result.outcome));
      adopt(result.view);
      if (result.outcome === 'correct' || result.view.status !== 'playing') setSelected([]);
      if (result.view.status !== 'playing') void recordGameFinished();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const shuffle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      adopt(await shuffleSolo(view.sessionId));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>{fa.solo.title}</Text>
        <MistakeDots mistakes={view.mistakes} max={view.maxMistakes} />
      </View>
      <Text style={styles.subtitle}>{fa.solo.subtitle}</Text>
      <View style={styles.feedbackSlot}>
        {feedback ? <Text style={styles.feedback}>{fa.solo.feedback[feedback]}</Text> : null}
      </View>
      {hintedTitles(given).length > 0 ? <Text style={styles.hintLine}>{fa.hints.revealedTitle}: {hintedTitles(given).join('، ')}</Text> : null}
      <Board solved={view.solved} cards={view.cards} names={names} selected={selected} onToggle={(id) => setSelected((s) => toggleSelection(s, id))} disabled={!playing || busy} hinted={hintedCardIds(given)} />
      {hintedCardIds(given).length > 0 ? <Text style={styles.hintLine}>{fa.hints.framed}</Text> : null}
      {playing ? (
        <View style={styles.actions}>
          <CandyButton label={fa.solo.shuffle} color={colors.candy.sky} onPress={() => void shuffle()} disabled={busy} />
          <CandyButton label={fa.solo.deselect} color={colors.candy.grape} onPress={() => setSelected([])} disabled={selected.length === 0} />
          {hintsEnabled ? <CandyButton label={fa.hints.open} color={colors.candy.orange} onPress={() => setHintOpen(true)} disabled={busy} /> : null}
          <CandyButton label={fa.solo.submit} color={colors.candy.lime} onPress={() => void submit()} disabled={!canSubmit(selected) || busy} />
        </View>
      ) : (
        <View style={styles.end}>
          {view.status === 'won' ? <Banner banner={BANNERS[0]!} /> : <Banner banner={BANNERS[1]!} />}
          <View style={styles.endMascot}><Character pose={view.status === 'won' ? 'win' : 'sad'} month={solarMonthOf(Date.now())} /></View>
          <Text style={styles.msg}>{view.status === 'won' ? fa.solo.won : fa.solo.lost}</Text>
          {priceDone ? (
            <>
              <ChartPanel sessionId={view.sessionId} />
              <View style={styles.actions}>
                {daily ? null : <CandyButton label={fa.solo.newGame} color={colors.candy.yellow} onPress={() => void begin()} />}
                <CandyButton label={fa.solo.back} color={colors.candy.sky} onPress={onBack} />
              </View>
            </>
          ) : (
            <PriceRoundPanel sessionId={view.sessionId} onDone={() => setPriceDone(true)} />
          )}
        </View>
      )}
    </ScrollView>
    {hintOpen && playing ? <HintSheet sessionId={view.sessionId} onGiven={setGiven} onClose={() => setHintOpen(false)} /> : null}
    {!playing ? (view.status === 'won' ? <Confetti distance={500} /> : <Rain distance={800} />) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  screen: { padding: 16, gap: 12, alignItems: 'center' },
  header: { width: '100%', maxWidth: 520, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: 'Vazirmatn_700Bold', fontSize: 24, color: colors.cream },
  subtitle: { fontFamily: 'Vazirmatn_400Regular', fontSize: 14, color: colors.cream, opacity: 0.85 },
  feedbackSlot: { height: 28, justifyContent: 'center' },
  feedback: { fontFamily: 'Vazirmatn_700Bold', fontSize: 18, color: colors.candy.yellow },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 8 },
  endMascot: { width: 140, height: 154 },
  end: { alignItems: 'center', gap: 8, marginTop: 8 },
  detail: { fontFamily: 'Vazirmatn_400Regular', fontSize: 12, color: colors.cream, opacity: 0.7, textAlign: 'center', writingDirection: 'ltr' },
  hintLine: { fontFamily: 'Vazirmatn_700Bold', fontSize: 13, color: colors.candy.yellow, textAlign: 'center' },
  msg: { fontFamily: 'Vazirmatn_700Bold', fontSize: 18, color: colors.cream, textAlign: 'center' },
});
