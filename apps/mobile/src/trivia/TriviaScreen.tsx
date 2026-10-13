import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatPersianNumber, solarMonthOf } from '@dozari/shared';
import type { TriviaTopics, TriviaView } from '@dozari/shared';
import { Character } from '../components/Character';
import { ErrorCard } from '../components/EmptyState';
import { VERDICT_TONES, choiceVerdict } from '../components/choiceVerdict';
import { SlabButton } from '../components/SlabButton';
import { GameTopBar } from '../game/GameTopBar';
import { MatchBackground } from '../game/MatchBackground';
import { fa } from '../i18n/fa';
import { ApiError, BASE_URL } from '../net/http';
import { describeError, errorKind } from '../solo/errors';
import { playSfx } from '../sound/engine';
import { colors, fonts } from '../theme/colors';
import { nativeTopInset } from '../theme/safeArea';
import { answerTrivia, beginTrivia, fetchTriviaTopics } from './api';

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; detail: string; card: 'noInternet' | 'noPuzzles' | 'error' }
  | { kind: 'topics'; topics: TriviaTopics['topics'] }
  | { kind: 'playing'; view: TriviaView };

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const t = fa.trivia;

/** «پرسش‌های عمومی»: pick a topic, then answer a few four-choice questions that are not about prices (docs/logic/trivia.md). */
export function TriviaScreen({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  /** The choice just tapped, kept on screen with its verdict until «بعدی». */
  const [shown, setShown] = useState<{ picked: number; correct: number; explanationFa: string | null } | null>(null);

  const fail = (err: unknown) => {
    const { message, detail } = describeError(err, BASE_URL);
    setPhase({ kind: 'error', message: err instanceof ApiError && err.code === 'no_questions' ? t.noQuestions : message, detail, card: errorKind(err) });
  };
  const loadTopics = useCallback(async () => {
    setPhase({ kind: 'loading' });
    setShown(null);
    try {
      setPhase({ kind: 'topics', topics: (await fetchTriviaTopics()).topics });
    } catch (err) {
      const { message, detail } = describeError(err, BASE_URL);
      setPhase({ kind: 'error', message, detail, card: errorKind(err) });
    }
  }, []);
  useEffect(() => void loadTopics(), [loadTopics]);

  const start = async (topicId?: string) => {
    setPhase({ kind: 'loading' });
    setShown(null);
    try {
      setPhase({ kind: 'playing', view: await beginTrivia(topicId) });
    } catch (err) {
      fail(err);
    }
  };

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
          <ErrorCard kind={phase.card} sub={phase.message} detail={phase.detail} onRetry={() => void loadTopics()} retryLabel={fa.solo.errors.retry} onBack={onBack} backLabel={fa.solo.back} />
        </View>
      </MatchBackground>
    );
  }

  if (phase.kind === 'topics') {
    return (
      <MatchBackground>
        <ScrollView contentContainerStyle={styles.screen}>
          <View style={styles.column}>
            <GameTopBar title={t.title} backLabel={fa.solo.back} onBack={onBack} />
            <Text style={styles.intro}>{t.intro}</Text>
            {phase.topics.length === 0 ? <Text style={styles.intro}>{t.noQuestions}</Text> : null}
            <View style={styles.grid}>
              {phase.topics.map((x) => (
                <Pressable key={x.id} accessibilityRole="button" onPress={() => void start(x.id)} style={({ pressed }) => [styles.topic, pressed ? styles.pressed : null]}>
                  <Text style={styles.topicName}>{x.nameFa}</Text>
                  <Text style={styles.topicCount}>{t.questionsCount(formatPersianNumber(x.questions))}</Text>
                </Pressable>
              ))}
            </View>
            {phase.topics.length > 0 ? <SlabButton label={t.mix} sfx="confirm" color={colors.candy.yellow} height={58} fontSize={22} onPress={() => void start()} /> : null}
          </View>
        </ScrollView>
      </MatchBackground>
    );
  }

  const view = phase.view;
  const total = view.rounds.length;
  const answered = view.results.length;
  const index = shown ? answered - 1 : answered;
  const round = view.rounds[index];
  const finished = view.done && !shown;

  const pick = async (choice: number) => {
    if (!round || busy || shown) return;
    setBusy(true);
    try {
      const out = await answerTrivia(view.sessionId, round.index, choice);
      playSfx(out.result.correct ? 'correct' : 'wrong');
      setPhase({ kind: 'playing', view: out.view });
      setShown({ picked: out.result.pickedIndex, correct: out.result.correctIndex, explanationFa: out.result.explanationFa });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <MatchBackground>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <GameTopBar title={view.topicNameFa ?? t.title} backLabel={fa.solo.back} onBack={onBack} />
          <View style={styles.talk}>
            <View style={styles.talker}><Character pose={finished ? 'win' : 'thinking'} month={solarMonthOf(Date.now())} /></View>
            <View style={styles.bubble}><Text style={styles.bubbleText}>{finished ? t.finished(formatPersianNumber(view.score), formatPersianNumber(total)) : t.score(formatPersianNumber(view.score))}</Text></View>
          </View>
          {finished ? (
            <View style={styles.card}>
              <Text style={styles.title}>{t.summary}</Text>
              <View style={styles.actions}>
                <SlabButton label={fa.solo.back} sfx="back" color={colors.candy.sky} height={58} fontSize={20} onPress={onBack} />
                <SlabButton label={t.again} sfx="confirm" color={colors.candy.lime} height={58} fontSize={22} grow={1.4} onPress={() => void loadTopics()} />
              </View>
            </View>
          ) : round ? (
            <View style={styles.card}>
              <Text style={styles.sub}>{t.question(formatPersianNumber(index + 1), formatPersianNumber(total))}{round.topicNameFa ? ` · ${round.topicNameFa}` : ''}</Text>
              <Text style={styles.question}>{round.textFa}</Text>
              {round.options.map((o, i) => {
                const v = shown ? choiceVerdict(i, shown.picked, shown.correct) : null;
                const tone = v && v !== 'dim' ? { backgroundColor: VERDICT_TONES[v].to, borderBottomColor: VERDICT_TONES[v].shelf } : null;
                return (
                  <Pressable key={i} accessibilityRole="button" accessibilityState={{ disabled: !!shown }} disabled={busy || !!shown} onPress={() => void pick(i)} style={({ pressed }) => [styles.option, tone, v === 'dim' ? styles.dim : null, pressed && !shown ? styles.pressed : null]}>
                    <Text style={styles.optionText}>{o}</Text>
                  </Pressable>
                );
              })}
              {shown ? (
                <>
                  {shown.picked === shown.correct ? <Text style={styles.good}>{t.point}</Text> : null}
                  {shown.explanationFa ? <Text style={styles.sub}>{shown.explanationFa}</Text> : null}
                  <SlabButton label={view.done ? t.seeResult : t.next} sfx="confirm" color={colors.candy.lime} height={54} fontSize={20} onPress={() => setShown(null)} />
                </>
              ) : null}
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
  intro: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 23, color: colors.cream, textAlign: 'center' },
  grid: { flexDirection: ROW, flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  topic: { minWidth: 140, flexGrow: 1, flexBasis: 140, padding: 14, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.candy.sky, alignItems: 'center', gap: 2 },
  topicName: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  topicCount: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink, opacity: 0.7 },
  pressed: { transform: [{ translateY: 2 }] },
  talk: { flexDirection: ROW, alignItems: 'flex-end', gap: 8 },
  talker: { width: 110, height: 128 },
  bubble: { flex: 1, padding: 12, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper },
  bubbleText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: colors.ink, textAlign: 'center' },
  card: { gap: 10, padding: 14, borderRadius: 20, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 21, color: colors.ink, textAlign: 'center', opacity: 0.8 },
  question: { fontFamily: fonts.display, fontSize: 22, lineHeight: 34, color: colors.ink, textAlign: 'center' },
  option: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.card },
  optionText: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, textAlign: 'center' },
  dim: { opacity: 0.5 },
  good: { fontFamily: fonts.display, fontSize: 18, color: '#2E7D32', textAlign: 'center' },
  actions: { flexDirection: ROW, gap: 10 },
});
