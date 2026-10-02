import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { solarMonthOf } from '@dozari/shared';
import type { HintPayload, SoloView } from '@dozari/shared';
import { Board } from '../components/Board';
import { CandyButton } from '../components/CandyButton';
import { ChartPanel } from '../components/ChartPanel';
import { Confetti } from '../components/Confetti';
import { usePrefs } from '../prefs/store';
import { buzz, playSfx } from '../sound/engine';
import { Character } from '../components/Character';
import { SlabButton } from '../components/SlabButton';
import { Icon } from '../components/Icon';
import { MatchBackground } from '../game/MatchBackground';
import { GameTopBar } from '../game/GameTopBar';
import { Lives } from '../game/Lives';
import { Rain } from '../components/Rain';
import { PriceRoundPanel } from '../components/PriceRoundPanel';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
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
/** Right-to-left rows on web too (react-native-web does not flip rows; native does under forced RTL). */
const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

export function SoloScreen({ onBack, hintsEnabled = true, daily = false }: { onBack: () => void; hintsEnabled?: boolean; /** Today's daily puzzle: one attempt, no "new game". */ daily?: boolean }) {
  const prefs = usePrefs();
  /** Short screens get a smaller character and chart so the end scene still fits without scrolling. */
  const compact = useWindowDimensions().height <= 700;
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
        <View style={styles.endActions}>
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
      const fb = feedbackFor(result.outcome);
      flash(fb);
      if (fb === 'correct' || fb === 'oneAway' || fb === 'wrong') playSfx(fb);
      if (fb === 'wrong') buzz(60);
      if (result.view.status === 'won') playSfx('win');
      else if (result.view.status === 'lost') playSfx('lose');
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

  const pose = feedback === 'correct' ? 'cheer' : feedback === 'wrong' ? 'shocked' : feedback === 'oneAway' ? 'thinking' : 'idle';
  const bubble = feedback ? fa.solo.feedback[feedback] : hintedTitles(given).length > 0 ? `${fa.hints.revealedTitle}: ${hintedTitles(given).join('، ')}` : fa.solo.subtitle;

  if (!playing) {
    const won = view.status === 'won';
    const chartH = compact ? 150 : 210;
    return (
      <MatchBackground>
        {/* One fixed scene, no page scroll (D54): the board gives way to the price round, then the chart. */}
        <View style={[styles.endScene, compact ? styles.endSceneCompact : null]}>
          <GameTopBar title={daily ? fa.solo.dailyTitle : fa.solo.title} backLabel={fa.solo.back} onBack={onBack} />
          <View style={styles.talk}>
            <View style={compact ? styles.talkerSmall : styles.talker}><Character pose={won ? 'win' : 'sad'} month={solarMonthOf(Date.now())} /></View>
            <View style={styles.bubble}>
              <View style={styles.bubbleTail} />
              <Text style={styles.bubbleTitle}>{won ? fa.solo.won : fa.solo.lost}</Text>
            </View>
          </View>
          <View style={styles.stage}>
            {priceDone ? <ChartPanel sessionId={view.sessionId} height={chartH} /> : <PriceRoundPanel sessionId={view.sessionId} onDone={() => setPriceDone(true)} />}
          </View>
          {priceDone ? (
            <View style={styles.actions}>
              <SlabButton label={fa.solo.back} color={colors.candy.sky} height={58} fontSize={20} onPress={onBack} />
              {daily ? null : <SlabButton label={fa.solo.newGame} color={colors.candy.lime} height={58} fontSize={22} grow={1.4} onPress={() => void begin()} />}
            </View>
          ) : null}
        </View>
        {!prefs.reduceMotion ? (won ? <Confetti distance={500} /> : <Rain distance={800} />) : null}
      </MatchBackground>
    );
  }

  return (
    <MatchBackground>
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.column}>
        <GameTopBar title={daily ? fa.solo.dailyTitle : fa.solo.title} backLabel={fa.solo.back} onBack={onBack}>
          {hintsEnabled && playing ? (
            <Pressable accessibilityRole="button" accessibilityLabel={fa.hints.open} onPress={() => setHintOpen(true)} disabled={busy}>
              {({ pressed }) => (
                <View style={[styles.hintBtn, pressed ? styles.pressed : null]}>
                  <Icon name="hint" size={22} color="#fff" strokeWidth={2.8} />
                </View>
              )}
            </Pressable>
          ) : null}
        </GameTopBar>

        {playing ? (
          <View style={styles.talk}>
            <View style={styles.talker}><Character pose={pose} month={solarMonthOf(Date.now())} /></View>
            <View style={styles.bubble}>
              <View style={styles.bubbleTail} />
              <Text style={styles.bubbleText}>{bubble}</Text>
            </View>
          </View>
        ) : null}

        <Board solved={view.solved} cards={view.cards} names={names} selected={selected} onToggle={(id) => (playSfx('tap'), setSelected((s) => toggleSelection(s, id)))} disabled={!playing || busy} hinted={hintedCardIds(given)} />
        {hintedCardIds(given).length > 0 && playing ? <Text style={styles.hintLine}>{fa.hints.framed}</Text> : null}

        {playing ? (
          <>
            <Lives mistakes={view.mistakes} max={view.maxMistakes} />
            <View style={styles.actions}>
              <SlabButton label={fa.solo.shuffle} color={colors.candy.sky} height={58} fontSize={20} onPress={() => void shuffle()} disabled={busy} />
              <SlabButton label={fa.solo.deselect} color={colors.candy.orange} height={58} fontSize={20} onPress={() => setSelected([])} disabled={selected.length === 0} />
              <SlabButton label={fa.solo.submit} color={colors.candy.lime} height={58} fontSize={24} grow={1.4} onPress={() => void submit()} disabled={!canSubmit(selected) || busy} />
            </View>
          </>
        ) : null}
      </View>
    </ScrollView>
    {hintOpen && playing ? <HintSheet sessionId={view.sessionId} onGiven={setGiven} onClose={() => setHintOpen(false)} /> : null}
    </MatchBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: '#4E2585' },
  screen: { flexGrow: 1, paddingHorizontal: 12, paddingTop: 14, paddingBottom: 24, alignItems: 'center' },
  column: { width: '100%', maxWidth: 520, gap: 12 },
  hintBtn: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.candy.orange, alignItems: 'center', justifyContent: 'center', marginBottom: 4, shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  pressed: { transform: [{ translateY: 3 }] },
  talk: { flexDirection: ROW, alignItems: 'center', gap: 6, minHeight: 110 },
  talker: { width: 104, height: 114 },
  bubble: { flex: 1, backgroundColor: colors.cream, borderWidth: 3, borderColor: colors.ink, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12, shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  bubbleTail: { position: 'absolute', top: 24, [Platform.OS === 'web' ? 'right' : 'left']: -11, width: 16, height: 16, backgroundColor: colors.cream, borderRightWidth: 3, borderBottomWidth: 3, borderColor: colors.ink, transform: [{ rotate: Platform.OS === 'web' ? '-45deg' : '135deg' }] },
  bubbleText: { fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 22, color: colors.ink, textAlign: 'right' },
  actions: { flexDirection: ROW, gap: 9 },
  endScene: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 20, gap: 10 },
  endSceneCompact: { paddingTop: 8, paddingBottom: 12, gap: 6 },
  talkerSmall: { width: 72, height: 80 },
  bubbleTitle: { fontFamily: fonts.display, fontSize: 18, lineHeight: 28, color: colors.ink, textAlign: 'right' },
  stage: { flex: 1, minHeight: 0, borderRadius: 22, borderWidth: 3, borderColor: colors.ink, backgroundColor: 'rgba(26,8,44,0.55)', paddingHorizontal: 12, paddingBottom: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  endActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 8 },
  detail: { fontFamily: 'Vazirmatn_400Regular', fontSize: 12, color: colors.cream, opacity: 0.7, textAlign: 'center', writingDirection: 'ltr' },
  hintLine: { fontFamily: 'Vazirmatn_700Bold', fontSize: 13, color: colors.candy.yellow, textAlign: 'center' },
  msg: { fontFamily: 'Vazirmatn_700Bold', fontSize: 18, color: colors.cream, textAlign: 'center' },
});
