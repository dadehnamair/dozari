import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TRIVIA_DUEL_INTRO_MS, formatPersianNumber } from '@dozari/shared';
import type { TriviaTopics } from '@dozari/shared';
import { ErrorCard } from '../components/EmptyState';
import { SlabButton } from '../components/SlabButton';
import { Confetti } from '../components/Confetti';
import { Rain } from '../components/Rain';
import { DuelTriviaRound } from '../duel/DuelTriviaRound';
import { Versus } from '../duel/Versus';
import { myCharacter } from '../duel/arena';
import { GameTopBar } from '../game/GameTopBar';
import { MatchBackground } from '../game/MatchBackground';
import { fa } from '../i18n/fa';
import { BASE_URL } from '../net/http';
import { SearchScreen } from '../search/SearchScreen';
import { describeError, errorKind } from '../solo/errors';
import { colors, fonts } from '../theme/colors';
import { getLookGender } from '../theme/look';
import { nativeTopInset } from '../theme/safeArea';
import { fetchTriviaTopics } from './api';
import { initialTduel, tduelOutcome, tduelReducer } from './duelModel';
import { connectTriviaDuel } from './duelSocket';
import type { TriviaDuelConnection } from './duelSocket';

type Topics = { kind: 'loading' } | { kind: 'error'; message: string; detail: string; card: 'noInternet' | 'noPuzzles' | 'error' } | { kind: 'ready'; topics: TriviaTopics['topics'] };

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const t = fa.triviaDuel;

/**
 * «دوئل پرسشی»: pick a topic (or random), wait on the same search screen as the board duel, meet a rival, then both answer the same
 * four-choice questions blind and at the same time (docs/logic/trivia.md §Question duel). The server owns the clock and the scoring.
 */
export function TriviaDuelScreen({ onBack }: { onBack: () => void }) {
  const [topics, setTopics] = useState<Topics>({ kind: 'loading' });
  const [m, dispatch] = useReducer(tduelReducer, initialTduel);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
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
  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [live]);
  useEffect(() => {
    if (m.phase === 'found') foundAt.current = Date.now();
  }, [m.phase]);

  const start = async (topicId?: string) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      conn.current ??= await connectTriviaDuel(dispatch);
      dispatch({ t: 'queued' });
      const ack = await conn.current.join(topicId);
      if (!ack.ok) {
        dispatch({ t: 'reset' });
        setNote(fa.duel.errors[ack.error] ?? fa.duel.errors.generic ?? '');
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
  const again = () => {
    dispatch({ t: 'reset' });
    void loadTopics();
  };

  if (m.phase === 'queued') return <SearchScreen waitedSec={m.waitedSec} note={m.error ? fa.duel.errors.generic : undefined} onCancel={cancel} />;

  if (m.phase === 'found' && m.found) {
    const you = m.found.you;
    const mine = m.found.players[you]!;
    const rival = m.found.players[(1 - you) as 0 | 1] ?? null;
    const left = Math.max(1, Math.ceil((foundAt.current + TRIVIA_DUEL_INTRO_MS - now) / 1000));
    return <Versus me={{ nickname: mine.nickname, level: mine.level, who: myCharacter(mine.avatarKey, getLookGender()) }} rival={rival} waitedSec={m.waitedSec} countdown={left} onCancel={cancel} />;
  }

  if (m.phase === 'playing' && m.state) {
    return (
      <MatchBackground>
        <ScrollView contentContainerStyle={styles.screen}>
          <View style={styles.column}>
            {m.found?.topicNameFa ? <Text style={styles.topicLine}>{t.topic(m.found.topicNameFa)}</Text> : null}
            <DuelTriviaRound
              round={m.state.round}
              now={now}
              title={t.title}
              intro={null}
              onAnswer={async (index) => {
                const ack = await conn.current?.answer(index);
                return !ack || ack.ok ? null : (fa.duel.errors[ack.error] ?? fa.duel.errors.generic ?? '');
              }}
            />
          </View>
        </ScrollView>
      </MatchBackground>
    );
  }

  if (m.phase === 'ended' && m.ended) {
    const e = m.ended;
    const you = m.found?.you ?? m.state?.you ?? 0;
    const outcome = tduelOutcome(e, you);
    const rivalName = m.found?.players[(1 - you) as 0 | 1]?.nickname ?? '';
    const headline = e.reason === 'forfeit' ? (outcome === 'won' ? t.forfeitWon : t.forfeitLost) : outcome === 'won' ? t.won : outcome === 'draw' ? t.draw : t.lost;
    return (
      <MatchBackground>
        <ScrollView contentContainerStyle={styles.screen}>
          <View style={styles.column}>
            <View style={styles.card}>
              <Text style={styles.headline}>{headline}</Text>
              <Text style={styles.sub}>{rivalName ? `${rivalName} · ` : ''}{t.score(formatPersianNumber(e.scores[you]), formatPersianNumber(e.scores[(1 - you) as 0 | 1]))}</Text>
              {m.found?.topicNameFa ? <Text style={styles.sub}>{t.topic(m.found.topicNameFa)}</Text> : null}
            </View>
            {e.round.revealed.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>{t.review}</Text>
                {e.round.revealed.map((r) => (
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
            <View style={styles.actions}>
              <SlabButton label={t.back} sfx="back" color={colors.candy.sky} height={58} fontSize={20} onPress={onBack} />
              <SlabButton label={t.again} sfx="confirm" color={colors.candy.lime} height={58} fontSize={22} grow={1.4} onPress={again} />
            </View>
          </View>
        </ScrollView>
        {outcome === 'won' ? <Confetti distance={500} /> : outcome === 'lost' ? <Rain distance={800} /> : null}
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
  return (
    <MatchBackground>
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.column}>
          <GameTopBar title={t.title} backLabel={fa.solo.back} onBack={onBack} />
          <Text style={styles.intro}>{t.intro}</Text>
          {note ? <Text style={styles.error}>{note}</Text> : null}
          {topics.topics.length === 0 ? <Text style={styles.intro}>{t.noQuestions}</Text> : null}
          {topics.topics.length > 0 ? <SlabButton label={t.random} sfx="confirm" color={colors.candy.yellow} height={58} fontSize={22} onPress={() => void start()} /> : null}
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

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  screen: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 12, paddingTop: 20 + nativeTopInset(), paddingBottom: 28 },
  column: { width: '100%', maxWidth: 480, gap: 12 },
  intro: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 23, color: colors.cream, textAlign: 'center' },
  error: { fontFamily: fonts.bold, fontSize: 13, color: '#FFB4AB', textAlign: 'center' },
  topicLine: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream, textAlign: 'center', opacity: 0.85 },
  grid: { flexDirection: ROW, flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  topic: { minWidth: 140, flexGrow: 1, flexBasis: 140, padding: 14, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.candy.sky, alignItems: 'center', gap: 2 },
  topicName: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  topicCount: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink, opacity: 0.7 },
  pressed: { transform: [{ translateY: 2 }] },
  card: { gap: 8, padding: 14, borderRadius: 20, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper },
  headline: { fontFamily: fonts.display, fontSize: 30, color: colors.ink, textAlign: 'center' },
  sectionTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: colors.ink, textAlign: 'center', opacity: 0.85 },
  review: { gap: 2, paddingTop: 8, borderTopWidth: 2, borderTopColor: colors.ink },
  question: { fontFamily: fonts.display, fontSize: 17, lineHeight: 27, color: colors.ink, textAlign: 'center' },
  right: { fontFamily: fonts.bold, fontSize: 13, color: '#2E7D32', textAlign: 'center' },
  pick: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, textAlign: 'center' },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: '#7E46D6', textAlign: 'center' },
  actions: { flexDirection: ROW, gap: 10 },
});
