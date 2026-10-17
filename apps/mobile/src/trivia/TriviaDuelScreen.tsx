import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TRIVIA_DUEL_INTRO_MS, formatPersianNumber } from '@dozari/shared';
import type { TduelEnded, TriviaTopics } from '@dozari/shared';
import { ErrorCard } from '../components/EmptyState';
import { SlabButton } from '../components/SlabButton';
import { Confetti } from '../components/Confetti';
import { WorkshopPromo } from '../workshop/WorkshopCards';
import { Rain } from '../components/Rain';
import { DuelTriviaRound } from '../duel/DuelTriviaRound';
import { DuelTriviaRoundAdult } from '../duel/DuelTriviaRoundAdult';
import { Versus } from '../duel/Versus';
import { characterFor, myCharacter } from '../duel/arena';
import { bootTheme } from '../theme/bootTheme';
import { AdultBackdrop } from '../duel/adultKit';
import { GameTopBar } from '../game/GameTopBar';
import { MatchBackground } from '../game/MatchBackground';
import { fa } from '../i18n/fa';
import { BASE_URL } from '../net/http';
import { useHardwareBack } from '../nav/useHardwareBack';
import { SearchScreen } from '../search/SearchScreen';
import { describeError, errorKind } from '../solo/errors';
import { buzz, playSfx } from '../sound/engine';
import { colors, fonts } from '../theme/colors';
import { getLookGender } from '../theme/look';
import { nativeTopInset } from '../theme/safeArea';
import { fetchTriviaTopics } from './api';
import { TopicPickAdult } from './TopicPickAdult';
import { LeaveDialogAdult, TriviaDuelResultAdult } from './TriviaDuelResultAdult';
import { initialTduel, tduelOutcome, tduelReducer } from './duelModel';
import { connectTriviaDuel } from './duelSocket';
import type { TriviaDuelConnection } from './duelSocket';

type Topics = { kind: 'loading' } | { kind: 'error'; message: string; detail: string; card: 'noInternet' | 'noPuzzles' | 'error' } | { kind: 'ready'; topics: TriviaTopics['topics'] };

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const t = fa.triviaDuel;

/** «+۹ سکه» / «−۱۲ سکه» of a finished game; a free game says nothing moved. */
function coinsText(coins: number): string {
  const n = formatPersianNumber(Math.abs(coins));
  return coins > 0 ? t.coinsWon(n) : coins < 0 ? t.coinsLost(n) : t.coinsZero;
}

/** The coin result pops in on the result card. */
function CoinsBadge({ coins }: { coins: number }) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }).start();
    if (coins > 0) playSfx('coin');
  }, [pop, coins]);
  return (
    <Animated.View style={[styles.coins, coins > 0 ? styles.coinsWon : coins < 0 ? styles.coinsLost : null, { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }], opacity: pop }]}>
      <Text style={styles.coinsText}>{coinsText(coins)}</Text>
    </Animated.View>
  );
}

/**
 * «دوئل پرسشی»: pick a topic (or random), wait on the same search screen as the board duel, meet a rival, then both answer the same
 * four-choice questions blind and at the same time (docs/logic/trivia.md §Question duel). The server owns the clock, the scoring and the coins.
 * Leaving a running game forfeits it (the fee goes to the rival and the leave is logged), so it asks first.
 */
export function TriviaDuelScreen({ onBack, fee, mixMultiplier = 2, workshop, onWorkshop }: { onBack: () => void; /** How many times the fee a «ترکیبی» game costs and pays (setting `trivia.duel_mix_multiplier`). */ mixMultiplier?: number; /** The workshop call-to-action on the result card: the reward on offer; absent = not shown. */ workshop?: { reward: number; boost: number }; onWorkshop?: () => void; /** Entry fee of a game (setting `trivia.duel_fee`), to show before searching. */ fee: number }) {
  const [topics, setTopics] = useState<Topics>({ kind: 'loading' });
  const [m, dispatch] = useReducer(tduelReducer, initialTduel);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [confirmLeave, setConfirmLeave] = useState(false);
  const conn = useRef<TriviaDuelConnection | null>(null);
  const foundAt = useRef(0);

  const loadTopics = useCallback(async () => {
    setTopics({ kind: 'loading' });
    try {
      setTopics({ kind: 'ready', topics: (await fetchTriviaTopics()).topics });
    } catch (err) {
      const { message, detail } = describeError(err, BASE_URL);
      setTopics({ kind: 'error', message, detail, card: errorKind(err) });
    }
  }, []);
  useEffect(() => void loadTopics(), [loadTopics]);

  // Leaving the screen gives up whatever is on (the search, or the running game, which the rival then wins).
  useEffect(
    () => () => {
      const c = conn.current;
      conn.current = null;
      if (c) void c.leave().finally(() => c.close());
    },
    [],
  );

  const live = m.phase === 'queued' || m.phase === 'found' || m.phase === 'playing';
  const inGame = m.phase === 'found' || m.phase === 'playing';
  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [live]);
  useEffect(() => {
    if (m.phase === 'found') foundAt.current = Date.now();
  }, [m.phase]);
  // The phone's back button asks before it abandons a running game.
  useHardwareBack(inGame ? () => setConfirmLeave(true) : null);
  // A finished game: a win cheers, a loss is felt.
  const endedId = m.ended?.matchId;
  useEffect(() => {
    if (!m.ended) return;
    const outcome = tduelOutcome(m.ended, m.found?.you ?? m.state?.you ?? 0);
    playSfx(outcome === 'won' ? 'win' : outcome === 'lost' ? 'lose' : 'confirm');
    buzz(outcome === 'won' ? [0, 40, 60, 40, 60, 90] : outcome === 'lost' ? 220 : 60);
  }, [endedId]);
  // The server turned a search or rematch down (no coins for the fee).
  useEffect(() => {
    if (m.refused) setNote(fa.duel.errors[m.refused] ?? t.refused);
  }, [m.refused]);

  const start = async (topicId?: string, mix = false) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      conn.current ??= await connectTriviaDuel(dispatch);
      dispatch({ t: 'queued' });
      const ack = await conn.current.join(topicId, mix);
      if (!ack.ok) {
        dispatch({ t: 'reset' });
        setNote(ack.error === 'INSUFFICIENT_COINS' ? t.insufficient : (fa.duel.errors[ack.error] ?? fa.duel.errors.generic ?? ''));
      }
    } catch {
      dispatch({ t: 'reset' });
      setNote(fa.duel.errors.generic ?? '');
    } finally {
      setBusy(false);
    }
  };
  const cancel = () => {
    void conn.current?.leave();
    dispatch({ t: 'reset' });
  };
  const leaveGame = () => {
    setConfirmLeave(false);
    buzz(80);
    void conn.current?.leave();
    onBack();
  };
  const backToPicker = () => {
    dispatch({ t: 'reset' });
    void loadTopics();
  };
  const askRematch = async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    buzz(20);
    const ack = await conn.current?.rematch();
    if (ack && !ack.ok) setNote(ack.error === 'INSUFFICIENT_COINS' ? t.insufficient : (fa.duel.errors[ack.error] ?? fa.duel.errors.generic ?? ''));
    else dispatch({ t: 'rematchSent' });
    setBusy(false);
  };

  if (m.phase === 'queued') return <SearchScreen waitedSec={m.waitedSec} note={m.error ? fa.duel.errors.generic : undefined} onCancel={cancel} />;

  if (m.phase === 'found' && m.found) {
    const you = m.found.you;
    const mine = m.found.players[you]!;
    const rival = m.found.players[(1 - you) as 0 | 1] ?? null;
    const left = Math.max(1, Math.ceil((foundAt.current + TRIVIA_DUEL_INTRO_MS - now) / 1000));
    return (
      <>
        <Versus me={{ nickname: mine.nickname, level: mine.level, who: myCharacter(mine.avatarKey, getLookGender()) }} rival={rival} waitedSec={m.waitedSec} countdown={left} onCancel={() => setConfirmLeave(true)} />
        {confirmLeave ? <LeaveDialog onStay={() => setConfirmLeave(false)} onLeave={leaveGame} /> : null}
      </>
    );
  }

  if (m.phase === 'playing' && m.state) {
    const rivalNick = m.found?.players[(1 - m.found.you) as 0 | 1]?.nickname ?? '';
    const onAnswer = async (index: number) => {
      const ack = await conn.current?.answer(index);
      return !ack || ack.ok ? null : (fa.duel.errors[ack.error] ?? fa.duel.errors.generic ?? '');
    };
    if (bootTheme() === 'adult') {
      return (
        <AdultBackdrop>
          <ScrollView contentContainerStyle={styles.screen}>
            {m.error ? <Text style={styles.error}>{t.connectionLost}</Text> : null}
            <DuelTriviaRoundAdult
              round={m.state.round}
              now={now}
              title={t.title}
              topic={m.found?.topicNameFa}
              onExit={() => setConfirmLeave(true)}
              me={{ name: m.found?.players[m.found.you]?.nickname || fa.duel.triviaRound.adult.you, who: myCharacter(m.found?.players[m.found.you]?.avatarKey, getLookGender()) }}
              rival={{ name: rivalNick || fa.duel.triviaRound.adult.rival, who: characterFor(m.found?.players[(1 - m.found.you) as 0 | 1]?.avatarKey || rivalNick) }}
              onAnswer={onAnswer}
            />
          </ScrollView>
          {confirmLeave ? <LeaveDialog onStay={() => setConfirmLeave(false)} onLeave={leaveGame} /> : null}
        </AdultBackdrop>
      );
    }
    return (
      <MatchBackground>
        <ScrollView contentContainerStyle={styles.screen}>
          <View style={styles.column}>
            <View style={styles.topRow}>
              <Pressable accessibilityRole="button" accessibilityLabel={fa.solo.back} hitSlop={8} onPress={() => setConfirmLeave(true)} style={styles.exit}>
                <Text style={styles.exitText}>✕</Text>
              </Pressable>
              {m.found?.topicNameFa ? <Text style={styles.topicLine}>{fa.triviaDuel.topic(m.found.topicNameFa)}</Text> : <View />}
            </View>
            {m.error ? <Text style={styles.error}>{t.connectionLost}</Text> : null}
            <DuelTriviaRound round={m.state.round} now={now} title={t.title} intro={null} onAnswer={onAnswer} />
          </View>
        </ScrollView>
        {confirmLeave ? <LeaveDialog onStay={() => setConfirmLeave(false)} onLeave={leaveGame} /> : null}
      </MatchBackground>
    );
  }

  if (m.phase === 'ended' && m.ended) {
    return (
      <MatchBackground>
        <ScrollView contentContainerStyle={styles.screen}>
          <ResultView
            ended={m.ended}
            you={m.found?.you ?? m.state?.you ?? 0}
            rivalName={m.found?.players[(1 - (m.found?.you ?? 0)) as 0 | 1]?.nickname ?? ''}
            topicNameFa={m.found?.topicNameFa ?? null}
            fee={m.found?.fee ?? 0}
            rematch={m.rematch}
            busy={busy}
            note={note}
            onRematch={() => void askRematch()}
            onBack={onBack}
            onAgain={backToPicker}
            promo={workshop && onWorkshop ? <WorkshopPromo reward={workshop.reward} boost={workshop.boost} onOpen={onWorkshop} /> : null}
          />
        </ScrollView>
        {tduelOutcome(m.ended, m.found?.you ?? m.state?.you ?? 0) === 'won' ? <Confetti distance={500} /> : tduelOutcome(m.ended, m.found?.you ?? m.state?.you ?? 0) === 'lost' ? <Rain distance={800} /> : null}
      </MatchBackground>
    );
  }

  // The topic picker.
  if (topics.kind === 'loading') {
    return (
      <MatchBackground>
        <View style={styles.center}><ActivityIndicator color={colors.candy.yellow} /></View>
      </MatchBackground>
    );
  }
  if (topics.kind === 'error') {
    return (
      <MatchBackground>
        <View style={styles.center}>
          <ErrorCard kind={topics.card} sub={topics.message} detail={topics.detail} onRetry={() => void loadTopics()} retryLabel={fa.solo.errors.retry} onBack={onBack} backLabel={fa.solo.back} />
        </View>
      </MatchBackground>
    );
  }
  if (bootTheme() === 'adult') return <TopicPickAdult topics={topics.topics} fee={fee} busy={busy} note={note} texts={{ title: t.title, sub: t.adult.pickSub, feeTitle: fee > 0 ? t.adult.feeTitle(formatPersianNumber(fee)) : t.adult.freeTitle, feeSub: t.adult.feeSub }} offers={[{ kind: 'random', label: t.randomAdult }, { kind: 'mix', label: t.adult.mix, badge: mixMultiplier > 1 ? t.adult.mixBadge(formatPersianNumber(mixMultiplier)) : undefined }]} mixTimes={mixMultiplier} onBack={onBack} onStart={(id, mix) => void start(id, mix)} />;
  return (
    <MatchBackground>
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.column}>
          <GameTopBar title={t.title} backLabel={fa.solo.back} onBack={onBack} />
          <Text style={styles.intro}>{t.intro}</Text>
          <View style={styles.feeChip}>
            <Text style={styles.feeText}>{fee > 0 ? t.fee(formatPersianNumber(fee)) : t.free}</Text>
            {fee > 0 ? <Text style={styles.feeHint}>{t.feeHint}</Text> : null}
          </View>
          {note ? <Text style={styles.error}>{note}</Text> : null}
          {topics.topics.length === 0 ? <Text style={styles.intro}>{t.noQuestions}</Text> : null}
          {topics.topics.length > 0 ? <SlabButton label={t.random} sfx="confirm" color={colors.candy.yellow} height={58} fontSize={22} onPress={() => void start()} /> : null}
          {topics.topics.length > 0 ? <SlabButton label={t.mix(formatPersianNumber(mixMultiplier))} sfx="confirm" color={colors.candy.orange} height={58} fontSize={22} onPress={() => void start(undefined, true)} /> : null}
          <View style={styles.grid}>
            {topics.topics.map((x) => (
              <Pressable key={x.id} accessibilityRole="button" disabled={busy} onPress={() => void start(x.id)} style={({ pressed }) => [styles.topic, pressed ? styles.pressed : null]}>
                <Text style={styles.topicName}>{x.nameFa}</Text>
                <Text style={styles.topicCount}>{fa.trivia.questionsCount(formatPersianNumber(x.questions))}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </MatchBackground>
  );
}

/** «Leave the game?»: a second tap, saying what it costs. */
function LeaveDialog({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  if (bootTheme() === 'adult') return <LeaveDialogAdult onStay={onStay} onLeave={onLeave} />;
  return (
    <View style={styles.overlay}>
      <View style={styles.dialog}>
        <Text style={styles.dialogTitle}>{t.leaveTitle}</Text>
        <Text style={styles.dialogBody}>{t.leaveBody}</Text>
        <View style={styles.actions}>
          <SlabButton label={t.leaveStay} sfx="confirm" color={colors.candy.lime} height={54} fontSize={20} grow={1.4} onPress={onStay} />
          <SlabButton label={t.leaveConfirm} sfx="back" color={colors.candy.orange} height={54} fontSize={18} onPress={onLeave} />
        </View>
      </View>
    </View>
  );
}

/** The finished game: outcome, score, the coins it moved, a review of every question with both picks, and the rematch. */
function ResultView({ ended, you, rivalName, topicNameFa, fee, rematch, busy, note, onRematch, onBack, onAgain, promo }: { promo: React.ReactNode; ended: TduelEnded; you: 0 | 1; rivalName: string; topicNameFa: string | null; fee: number; rematch: 'none' | 'asked' | 'sent' | 'expired'; busy: boolean; note: string | null; onRematch: () => void; onBack: () => void; onAgain: () => void }) {
  if (bootTheme() === 'adult') {
    return <TriviaDuelResultAdult ended={ended} you={you} rivalName={rivalName} topicNameFa={topicNameFa} fee={fee} rematch={rematch} busy={busy} note={note} coinsLabel={coinsText(ended.coins)} onRematch={onRematch} onBack={onBack} onAgain={onAgain} promo={promo} />;
  }
  const outcome = tduelOutcome(ended, you);
  const headline = ended.reason === 'forfeit' ? (outcome === 'won' ? t.forfeitWon : t.forfeitLost) : outcome === 'won' ? t.won : outcome === 'draw' ? t.draw : t.lost;
  return (
    <View style={styles.column}>
      <View style={styles.card}>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.sub}>{rivalName ? `${rivalName} · ` : ''}{t.score(formatPersianNumber(ended.scores[you]), formatPersianNumber(ended.scores[(1 - you) as 0 | 1]))}</Text>
        {topicNameFa ? <Text style={styles.sub}>{t.topic(topicNameFa)}</Text> : null}
        {fee > 0 || ended.coins !== 0 ? <CoinsBadge coins={ended.coins} /> : null}
      </View>
      {ended.round.revealed.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t.review}</Text>
          {ended.round.revealed.map((r) => (
            <View key={r.index} style={styles.review}>
              <Text style={styles.question}>{r.textFa}</Text>
              <Text style={styles.right}>{t.rightAnswer}: {r.options[r.correctIndex]}</Text>
              <Text style={styles.pick}>{t.yourPick}: {r.yourPick === null ? t.noAnswer : r.options[r.yourPick]}{r.yourPick === r.correctIndex ? ' ✓' : ''}</Text>
              <Text style={styles.pick}>{t.rivalPick}: {r.opponentPick === null ? t.noAnswer : r.options[r.opponentPick]}{r.opponentPick === r.correctIndex ? ' ✓' : ''}</Text>
              {r.explanationFa ? <Text style={styles.hint}>{r.explanationFa}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
      {ended.canRematch && rematch !== 'expired' ? (
        rematch === 'sent' ? (
          <Text style={styles.wait}>{t.rematchAsked}</Text>
        ) : (
          <>
            {rematch === 'asked' ? <Text style={styles.offer}>{t.rematchOffered}</Text> : null}
            <SlabButton label={rematch === 'asked' ? t.rematchAccept : t.rematch} sfx="confirm" color={colors.candy.pink} height={58} fontSize={20} onPress={onRematch} />
          </>
        )
      ) : (
        <Text style={styles.sub}>{ended.reason === 'forfeit' ? t.rematchLeft : t.rematchExpired}</Text>
      )}
      {note ? <Text style={styles.error}>{note}</Text> : null}
      {promo}
      <View style={styles.actions}>
        <SlabButton label={t.back} sfx="back" color={colors.candy.sky} height={58} fontSize={20} onPress={onBack} />
        <SlabButton label={t.again} sfx="confirm" color={colors.candy.lime} height={58} fontSize={22} grow={1.4} onPress={onAgain} />
      </View>
      {busy ? <ActivityIndicator color={colors.candy.yellow} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  screen: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 12, paddingTop: 20 + nativeTopInset(), paddingBottom: 28 },
  column: { width: '100%', maxWidth: 480, gap: 12 },
  intro: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 23, color: colors.cream, textAlign: 'center' },
  error: { fontFamily: fonts.bold, fontSize: 13, color: '#FFB4AB', textAlign: 'center' },
  feeChip: { alignSelf: 'center', alignItems: 'center', gap: 2, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.paper },
  feeText: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  feeHint: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink, opacity: 0.7, textAlign: 'center' },
  topRow: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between' },
  exit: { width: 36, height: 36, borderRadius: 18, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  exitText: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  topicLine: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream, textAlign: 'center', opacity: 0.85 },
  grid: { flexDirection: ROW, flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  topic: { minWidth: 140, flexGrow: 1, flexBasis: 140, padding: 14, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.candy.sky, alignItems: 'center', gap: 2 },
  topicName: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  topicCount: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink, opacity: 0.7 },
  pressed: { transform: [{ translateY: 2 }] },
  card: { gap: 8, padding: 14, borderRadius: 20, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'stretch' },
  headline: { fontFamily: fonts.display, fontSize: 30, color: colors.ink, textAlign: 'center' },
  sectionTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: colors.cream, textAlign: 'center', opacity: 0.9 },
  coins: { alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 6, borderRadius: 99, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#E0E0E0' },
  coinsWon: { backgroundColor: '#8BDB4B' },
  coinsLost: { backgroundColor: '#FF7E8E' },
  coinsText: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  review: { gap: 2, paddingTop: 8, borderTopWidth: 2, borderTopColor: colors.ink },
  question: { fontFamily: fonts.display, fontSize: 17, lineHeight: 27, color: colors.ink, textAlign: 'center' },
  right: { fontFamily: fonts.bold, fontSize: 13, color: '#2E7D32', textAlign: 'center' },
  pick: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, textAlign: 'center' },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: '#7E46D6', textAlign: 'center' },
  wait: { fontFamily: fonts.bold, fontSize: 15, color: colors.candy.yellow, textAlign: 'center' },
  offer: { fontFamily: fonts.display, fontSize: 18, color: colors.candy.yellow, textAlign: 'center' },
  actions: { flexDirection: ROW, gap: 10 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,32,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 380, maxHeight: '90%', gap: 12, padding: 18, borderRadius: 22, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper },
  dialogTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, textAlign: 'center' },
  dialogBody: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 23, color: colors.ink, textAlign: 'center' },
});
