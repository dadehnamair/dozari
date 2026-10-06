import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { NUDGE_IDLE_SECONDS, isLastLife, localGuess, localShuffle, localView, mulberry32, solarMonthOf, startLocalSolo, trackRules as rulesOfTrack } from '@dozari/shared';
import type { HintPayload, LocalSoloSession, SoloView } from '@dozari/shared';
import { Board } from '../components/Board';
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
import { ComboRing } from '../game/ComboRing';
import { NearMissPill } from '../game/NearMissPill';
import { useCombo } from '../game/useCombo';
import { useHeartbeat } from '../game/useHeartbeat';
import { Rain } from '../components/Rain';
import { PriceRoundPanel } from '../components/PriceRoundPanel';
import { LessonPanel } from '../agetrack/LessonPanel';
import { useTrackRules } from '../agetrack/useTrackRules';
import { useConfirm } from '../components/useConfirm';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { BASE_URL, guessSolo, shuffleSolo } from './api';
import { beginDaily, beginSolo } from './begin';
import { describeError, errorKind } from './errors';
import { ErrorCard } from '../components/EmptyState';
import { canSubmit, feedbackFor, pruneSelection, toggleSelection } from './selection';
import { recordGameFinished } from '../review/state';
import { refillPack, takeOfflinePuzzle } from '../offline/pack';
import { HintSheet } from '../shop/HintSheet';
import { takeNudge } from '../shop/api';
import { hintedCardIds, hintedTitles } from '../shop/hintView';
import type { FeedbackKey } from './selection';
import { nativeTopInset } from '../theme/safeArea';
import { TEXT_RIGHT } from '../theme/direction';

type Phase = { kind: 'loading' } | { kind: 'error'; message: string; detail: string; card: 'noInternet' | 'noPuzzles' | 'error' } | { kind: 'ready'; view: SoloView };

const FEEDBACK_MS = 1600;
/** Right-to-left rows on web too (react-native-web does not flip rows; native does under forced RTL). */
const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

export function SoloScreen({ onBack, hintsEnabled = true, daily = false, ageTracksOn = false, previewTrack }: { onBack: () => void; /** A guardian previews this track's space: its rules apply, nothing is saved, no offline fallback. */ previewTrack?: 'kid' | 'teen'; hintsEnabled?: boolean; /** Today's daily puzzle: one attempt, no "new game". */ daily?: boolean; /** The server's age-track switch: a kid then gets the word lesson instead of the price round. */ ageTracksOn?: boolean }) {
  const prefs = usePrefs();
  const fetchedRules = useTrackRules(ageTracksOn);
  const trackRules = previewTrack ? rulesOfTrack(previewTrack) : fetchedRules;
  const lessonMode = trackRules?.wordLesson === true;
  const { ask, dialog } = useConfirm();
  /** Short screens get a smaller character and chart so the end scene still fits without scrolling. */
  const compact = useWindowDimensions().height <= 700;
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [selected, setSelected] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<FeedbackKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [priceDone, setPriceDone] = useState(false);
  /** After the puzzle: look at the board and answers first, then choose to play the price round or skip to the chart. */
  const [priceReady, setPriceReady] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [given, setGiven] = useState<HintPayload[]>([]);
  /** Cards the free level-1 nudge lit up, and whether the server said this player is past that stage (then we stop asking). */
  const [nudged, setNudged] = useState<string[]>([]);
  const nudgeOff = useRef(false);
  /** Playing a saved puzzle without internet: a practice game (no XP, coins, hints or price round). */
  const [offline, setOffline] = useState(false);
  const local = useRef<LocalSoloSession | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const combo = useCombo();
  const lastLife = phase.kind === 'ready' && isLastLife(phase.view.mistakes, phase.view.maxMistakes, phase.view.status === 'playing');
  useHeartbeat(lastLife);

  const adopt = useCallback((view: SoloView) => {
    setNames((prev) => ({ ...prev, ...Object.fromEntries(view.cards.map((c) => [c.id, c.nameFa])) }));
    setSelected((prev) => pruneSelection(prev, view.cards));
    setPhase({ kind: 'ready', view });
  }, []);

  // A brand-new player who stands still for a while gets two cards of one group softly lit (the server decides who may: level 1 only).
  const idleKey = phase.kind === 'ready' ? `${phase.view.sessionId}:${phase.view.solved.length}:${phase.view.mistakes}:${phase.view.status}:${selected.join(',')}:${busy}` : '';
  useEffect(() => {
    if (phase.kind !== 'ready' || phase.view.status !== 'playing' || busy || nudgeOff.current) return undefined;
    const sessionId = phase.view.sessionId;
    const ids = phase.view.cards.map((c) => c.id);
    const timer = setTimeout(() => {
      takeNudge(sessionId).then(
        (h) => setNudged(h.kind === 'pair' ? h.productIds.filter((id) => ids.includes(id)) : []),
        (err) => {
          const code = (err as { code?: string; status?: number } | null)?.status;
          if (code === 403 || code === 409) nudgeOff.current = true; // past level 1, or the per-game limit was reached
        },
      );
    }, NUDGE_IDLE_SECONDS * 1000);
    return () => clearTimeout(timer);
    // idleKey carries every input that counts as "the player did something".
  }, [idleKey]);
  useEffect(() => setNudged([]), [idleKey]);

  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);
  /** The last four cards: instead of jumping to the result, they light up one by one, then the final row opens (reduced motion skips this). */
  const playFinale = async (prev: SoloView, final: SoloView, picked: readonly string[]) => {
    const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const rest = prev.cards.filter((c) => !picked.includes(c.id));
    adopt({ ...final, status: 'playing', solved: final.solved.slice(0, 3), cards: rest });
    setSelected([]);
    await pause(450);
    for (const c of rest) {
      if (!alive.current) return;
      setSelected((cur) => [...cur, c.id]);
      playSfx('select');
      await pause(280);
    }
    await pause(420);
    if (!alive.current) return;
    playSfx('correct');
    adopt({ ...final, status: 'playing', cards: [] });
    setSelected([]);
    await pause(1500);
  };

  const flash = useCallback((key: FeedbackKey | null) => {
    clearTimeout(feedbackTimer.current);
    setFeedback(key);
    if (key) feedbackTimer.current = setTimeout(() => setFeedback(null), FEEDBACK_MS);
  }, []);

  const fail = useCallback((err: unknown) => {
    console.warn('[solo] request failed', err);
    const { message, detail } = describeError(err, BASE_URL);
    setPhase({ kind: 'error', message, detail, card: errorKind(err) });
  }, []);

  const begin = useCallback(async () => {
    setPhase({ kind: 'loading' });
    setSelected([]);
    setNames({});
    setPriceDone(false);
    setPriceReady(false);
    nudgeOff.current = false;
    setGiven([]);
    setHintOpen(false);
    combo.reset();
    flash(null);
    setOffline(false);
    local.current = null;
    try {
      adopt(await (daily ? beginDaily() : beginSolo(previewTrack)));
      void refillPack(); // online: keep the saved puzzles topped up for next time
    } catch (err) {
      // No internet: a saved puzzle keeps the player busy (not for the daily one, which is one shared online attempt).
      const saved = !daily && !previewTrack && errorKind(err) === 'noInternet' ? await takeOfflinePuzzle() : null;
      if (!saved) return fail(err);
      local.current = startLocalSolo(saved, mulberry32(Math.floor(Math.random() * 2 ** 31)), `offline-${saved.id}`);
      setOffline(true);
      nudgeOff.current = true;
      adopt(localView(local.current));
    }
  }, [adopt, combo.reset, daily, fail, flash, previewTrack]);

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
        <ErrorCard kind={phase.card} sub={phase.message} detail={phase.detail} onRetry={() => void begin()} retryLabel={fa.solo.errors.retry} onBack={onBack} backLabel={fa.solo.back} />
      </View>
    );
  }

  const { view } = phase;
  const playing = view.status === 'playing';

  const submit = async () => {
    if (!canSubmit(selected) || busy) return;
    setBusy(true);
    try {
      const result = local.current
        ? (() => {
            const out = localGuess(local.current, selected);
            local.current = out.session;
            return out.result;
          })()
        : await guessSolo(view.sessionId, selected);
      const fb = feedbackFor(result.outcome);
      flash(fb);
      if (fb === 'correct' || fb === 'oneAway' || fb === 'wrong') playSfx(fb);
      if (fb === 'wrong') buzz(60);
      if (combo.record(result.outcome) >= 2) playSfx('combo');
      const finale = result.outcome === 'correct' && view.solved.length === 2 && result.view.solved.length === 4 && !prefs.reduceMotion;
      if (result.view.status === 'won' && !finale) playSfx('win');
      else if (result.view.status === 'lost') playSfx('lose');
      if (finale) {
        await playFinale(view, result.view, selected);
        playSfx('win');
      }
      adopt(result.view);
      if (result.outcome === 'correct' || result.view.status !== 'playing') setSelected([]);
      if (result.view.status !== 'playing' && !local.current) void recordGameFinished();
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
      if (local.current) {
        local.current = localShuffle(local.current, mulberry32(Math.floor(Math.random() * 2 ** 31)));
        adopt(localView(local.current));
      } else adopt(await shuffleSolo(view.sessionId));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const pose = feedback === 'correct' ? 'cheer' : feedback === 'wrong' ? 'shocked' : feedback === 'oneAway' ? 'thinking' : 'idle';
  const bubble = feedback ? fa.solo.feedback[feedback] : hintedTitles(given).length > 0 ? `${fa.hints.revealedTitle}: ${hintedTitles(given).join('، ')}` : offline ? fa.offline.banner : fa.solo.subtitle;

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
          <ScrollView style={styles.stage} contentContainerStyle={styles.stageContent} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            {offline ? (
              <View style={styles.review}>
                <Board solved={view.solved} cards={view.cards} names={names} selected={[]} onToggle={() => undefined} disabled hinted={[]} />
                <View style={styles.askCard}>
                  <Text style={styles.askTitle}>{fa.offline.endTitle}</Text>
                  <Text style={styles.askSub}>{fa.offline.endSub}</Text>
                </View>
              </View>
            ) : lessonMode ? (
              priceDone ? (
                <View style={styles.review}>
                  <Board solved={view.solved} cards={view.cards} names={names} selected={[]} onToggle={() => undefined} disabled hinted={[]} />
                  <View style={styles.askCard}><Text style={styles.askTitle}>{won ? fa.lesson.kidWon : fa.lesson.kidLost}</Text></View>
                </View>
              ) : (
                <LessonPanel productIds={Object.keys(names)} onDone={() => setPriceDone(true)} />
              )
            ) : priceDone ? (
              <ChartPanel sessionId={view.sessionId} height={chartH} />
            ) : priceReady ? (
              <PriceRoundPanel sessionId={view.sessionId} onDone={() => setPriceDone(true)} />
            ) : (
              <View style={styles.review}>
                <Board solved={view.solved} cards={view.cards} names={names} selected={[]} onToggle={() => undefined} disabled hinted={[]} />
                <View style={styles.askCard}>
                  <Text style={styles.askTitle}>{fa.solo.price.readyTitle}</Text>
                  <Text style={styles.askSub}>{fa.solo.price.readySub}</Text>
                  <View style={styles.actions}>
                    <SlabButton label={fa.solo.price.skip} color={colors.candy.sky} height={50} fontSize={18} onPress={() => setPriceDone(true)} />
                    <SlabButton label={fa.solo.price.go} sfx="confirm" color={colors.candy.lime} height={50} fontSize={20} grow={1.4} onPress={() => setPriceReady(true)} />
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
          {priceDone || offline ? (
            <View style={styles.actions}>
              <SlabButton label={fa.solo.back} sfx="back" color={colors.candy.sky} height={58} fontSize={20} onPress={onBack} />
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
        {previewTrack ? <Text style={styles.previewBanner}>{fa.guardian.previewBanner}</Text> : null}
        <GameTopBar title={daily ? fa.solo.dailyTitle : fa.solo.title} backLabel={fa.solo.back} onBack={() => ask({ title: daily ? fa.confirm.leaveDaily.title : fa.confirm.leaveSolo.title, message: daily ? fa.confirm.leaveDaily.message : fa.confirm.leaveSolo.message, confirmLabel: fa.confirm.leaveSolo.yes, onConfirm: onBack })}>
          <ComboRing streak={combo.streak} left={combo.left} showLabel={false} />
          {hintsEnabled && playing && !offline ? (
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

        <View>
          <Board solved={view.solved} cards={view.cards} names={names} selected={selected} onToggle={(id) => setSelected((s) => toggleSelection(s, id))} disabled={!playing || busy} hinted={hintedCardIds(given)} nudged={nudged} />
          {feedback === 'oneAway' ? <View style={styles.nearMiss} pointerEvents="none"><NearMissPill /></View> : null}
        </View>
        {hintedCardIds(given).length > 0 && playing ? <Text style={styles.hintLine}>{fa.hints.framed}</Text> : null}

        {playing ? (
          <>
            <Lives mistakes={view.mistakes} max={view.maxMistakes} last={lastLife} />
            <View style={styles.actions}>
              <SlabButton label={fa.solo.shuffle} color={colors.candy.sky} height={58} fontSize={20} onPress={() => void shuffle()} disabled={busy} />
              <SlabButton label={fa.solo.deselect} color={colors.candy.orange} height={58} fontSize={20} onPress={() => setSelected([])} disabled={selected.length === 0} />
              <SlabButton label={fa.solo.submit} sfx="confirm" color={colors.candy.lime} height={58} fontSize={24} grow={1.4} onPress={() => void submit()} disabled={!canSubmit(selected) || busy} />
            </View>
          </>
        ) : null}
      </View>
    </ScrollView>
    {hintOpen && playing ? <HintSheet sessionId={view.sessionId} onGiven={setGiven} onClose={() => setHintOpen(false)} /> : null}
    {dialog}
    </MatchBackground>
  );
}

const styles = StyleSheet.create({
  previewBanner: { alignSelf: 'center', fontFamily: fonts.bold, fontSize: 13, color: colors.ink, backgroundColor: '#FFE48A', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5, overflow: 'hidden', textAlign: 'center' },
  review: { gap: 10, width: '100%' },
  askCard: { padding: 12, gap: 6, borderRadius: 20, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper },
  askTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, textAlign: 'center' },
  askSub: { fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 20, color: '#5A3A7A', textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: colors.deeper },
  screen: { flexGrow: 1, paddingHorizontal: 12, paddingTop: 14 + nativeTopInset(), paddingBottom: 24, alignItems: 'center' },
  column: { width: '100%', maxWidth: 520, gap: 12 },
  hintBtn: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.candy.orange, alignItems: 'center', justifyContent: 'center', marginBottom: 4, shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  pressed: { transform: [{ translateY: 3 }] },
  talk: { flexDirection: ROW, alignItems: 'center', gap: 6, minHeight: 110 },
  talker: { width: 104, height: 114 },
  bubble: { flex: 1, backgroundColor: colors.cream, borderWidth: 3, borderColor: colors.ink, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12, shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  bubbleTail: { position: 'absolute', top: 24, right: -11, width: 16, height: 16, backgroundColor: colors.cream, borderRightWidth: 3, borderBottomWidth: 3, borderColor: colors.ink, transform: [{ rotate: '-45deg' }] },
  bubbleText: { fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 22, color: colors.ink, textAlign: TEXT_RIGHT },
  actions: { flexDirection: ROW, gap: 9 },
  endScene: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 12, paddingTop: 14 + nativeTopInset(), paddingBottom: 20, gap: 10 },
  endSceneCompact: { paddingTop: 8, paddingBottom: 12, gap: 6 },
  talkerSmall: { width: 72, height: 80 },
  bubbleTitle: { fontFamily: fonts.display, fontSize: 18, lineHeight: 28, color: colors.ink, textAlign: TEXT_RIGHT },
  /** The result frame keeps its size; whatever is taller than it (chart, tabs, share) scrolls inside it instead of spilling. */
  stage: { flex: 1, minHeight: 0, borderRadius: 22, borderWidth: 3, borderColor: colors.ink, backgroundColor: 'rgba(26,8,44,0.55)', overflow: 'hidden' },
  stageContent: { flexGrow: 1, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 14, alignItems: 'center', justifyContent: 'center' },
  endActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 8 },
  detail: { fontFamily: 'Vazirmatn_400Regular', fontSize: 12, color: colors.cream, opacity: 0.7, textAlign: 'center', writingDirection: 'ltr' },
  nearMiss: { position: 'absolute', top: '38%', left: 0, right: 0, alignItems: 'center' },
  hintLine: { fontFamily: 'Vazirmatn_700Bold', fontSize: 13, color: colors.candy.yellow, textAlign: 'center' },
  msg: { fontFamily: 'Vazirmatn_700Bold', fontSize: 18, color: colors.cream, textAlign: 'center' },
});
