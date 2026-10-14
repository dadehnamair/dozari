import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatPersianNumber, revealKind, revealScores, yourStreak } from '@dozari/shared';
import type { RevealKind, TriviaRoundView } from '@dozari/shared';
import { VERDICT_TONES, choiceVerdict } from '../components/choiceVerdict';
import { fa } from '../i18n/fa';
import { buzz, playSfx } from '../sound/engine';
import { colors, fonts } from '../theme/colors';

const t = fa.duel.triviaRound;
const CHOICE_TONES = ['#8FDCFA', '#B8F08F', '#FFD86A', '#FF9DBF'] as const;

/** How long a finished question stays on screen, coloured, with both picks, before the next one takes its place. */
const HOLD_MS = 2900;
/** Under this many seconds the clock turns red and ticks. */
const HURRY_SECONDS = 5;

type Revealed = TriviaRoundView['revealed'][number];

const KIND_TEXT: Record<RevealKind, string> = { both: t.kindBoth, you: t.kindYou, rival: t.kindRival, none: t.kindNone };
const KIND_TONE: Record<RevealKind, string> = { both: '#B8F08F', you: '#FFE48A', rival: '#FFB4AB', none: '#E0E0E0' };

/** The buzz of a revealed question: a double tap for a point, a short one when only the rival got it. */
function revealBuzz(kind: RevealKind): void {
  if (kind === 'both' || kind === 'you') buzz([0, 28, 50, 28]);
  else if (kind === 'rival') buzz([0, 70]);
  else buzz(30);
}

/** One choice: lit while waiting, then coloured with the verdict; both players' picks are tagged on it. A right pick pops, a wrong one shakes. */
function Choice({ label, tone, tag, dim, lit, onPress, disabled, verdict }: { label: string; tone: string; tag: { you: boolean; rival: boolean }; dim: boolean; lit: boolean; onPress?: () => void; disabled?: boolean; verdict: ReturnType<typeof choiceVerdict> | null }) {
  const scale = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (verdict === 'right' || verdict === 'answer') {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.06, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
    } else if (verdict === 'wrong') {
      Animated.sequence([6, -6, 4, -4, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 55, useNativeDriver: true }))).start();
    }
  }, [verdict, scale, shake]);
  return (
    <Animated.View style={{ transform: [{ scale }, { translateX: shake }], opacity: dim ? 0.45 : 1 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.choice, { backgroundColor: tone }, lit ? styles.lit : null, pressed && !disabled ? styles.pressedChoice : null]}>
        <Text style={styles.choiceText}>{label}</Text>
        {tag.you || tag.rival ? (
          <View style={styles.tags} pointerEvents="none">
            {tag.you ? <Text style={[styles.tag, styles.tagYou]}>{t.you}</Text> : null}
            {tag.rival ? <Text style={[styles.tag, styles.tagRival]}>{t.rival}</Text> : null}
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/** The question clock: a bar that drains toward red, ticking (a small buzz) in the last seconds. */
function Clock({ endsAt, now, questionKey }: { endsAt: number; now: number; questionKey: number }) {
  const fill = useRef(new Animated.Value(1)).current;
  const secs = Math.max(0, Math.ceil((endsAt - now) / 1000));
  useEffect(() => {
    fill.setValue(1);
    const run = Animated.timing(fill, { toValue: 0, duration: Math.max(1000, endsAt - Date.now()), easing: Easing.linear, useNativeDriver: false });
    run.start();
    return () => run.stop();
    // The bar restarts per question only; the server's clock (endsAt) of that question is fixed.
  }, [questionKey]);
  const hurry = secs > 0 && secs <= HURRY_SECONDS;
  useEffect(() => {
    if (hurry) {
      buzz(12);
      playSfx(secs <= 2 ? 'tickLast' : 'tick');
    }
  }, [secs, hurry]);
  const color = fill.interpolate({ inputRange: [0, 0.25, 0.5, 1], outputRange: ['#FF5A6E', '#FF8A3D', '#FFD23C', '#8BDB4B'] });
  const width = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={styles.clock} accessibilityRole="progressbar" accessibilityLabel={t.secondsLeft(secs)}>
      <Animated.View style={[styles.clockFill, { width, backgroundColor: color }]} />
    </View>
  );
}

/** «+۱» rising from the card when you scored. */
function PointPop() {
  const y = useRef(new Animated.Value(0)).current;
  const o = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(y, { toValue: -46, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(o, { toValue: 0, duration: 900, delay: 300, useNativeDriver: true }),
    ]).start();
  }, [y, o]);
  return <Animated.Text pointerEvents="none" style={[styles.pop, { opacity: o, transform: [{ translateY: y }] }]}>{t.point}</Animated.Text>;
}

/** The score line of the round so far: yours bumps when it grows. */
function ScoreLine({ you, rival }: { you: number; rival: number }) {
  const bump = useRef(new Animated.Value(1)).current;
  const before = useRef(you);
  useEffect(() => {
    if (you > before.current) {
      Animated.sequence([
        Animated.timing(bump, { toValue: 1.25, duration: 120, useNativeDriver: true }),
        Animated.spring(bump, { toValue: 1, friction: 3, useNativeDriver: true }),
      ]).start();
    }
    before.current = you;
  }, [you, bump]);
  return (
    <Animated.View style={[styles.scoreLine, { transform: [{ scale: bump }] }]}>
      <Text style={styles.scoreText}>{t.scoreLine(formatPersianNumber(you), formatPersianNumber(rival))}</Text>
    </Animated.View>
  );
}

/**
 * The general-question round (a duel's last round, and the whole question duel): a hidden four-choice answer against a draining clock.
 * When both have answered, the question is coloured in place for a moment with BOTH picks tagged on the choices («تو» / «حریف»), who got it,
 * a point pop, a streak flame, and a buzz — so the rival's answer is seen at once, not only at the end.
 */
export function DuelTriviaRound({ round, now, onAnswer, title, intro }: { round: TriviaRoundView; now: number; /** Heading and first-question hint; the defaults speak of a round after the boards, the question duel passes its own (intro null = none). */ title?: string; intro?: string | null; /** Resolves to an error text, or null when the server took the answer. */ onAnswer: (index: number) => Promise<string | null> }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [mine, setMine] = useState<number | null>(null);
  const [hold, setHold] = useState<Revealed | null>(null);
  const seen = useRef(0);
  const reveal = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    setMine(null);
    setNote(null);
  }, [round.roundIndex]);
  // A question the server just revealed stays on screen with its verdict and both picks before the next one shows.
  useEffect(() => {
    const n = round.revealed.length;
    if (n > seen.current) {
      const row = round.revealed[n - 1] ?? null;
      setHold(row);
      let streakBuzz: ReturnType<typeof setTimeout> | undefined;
      if (row) {
        playSfx(row.yourPick === row.correctIndex ? 'correct' : 'wrong');
        revealBuzz(revealKind(row));
        if (yourStreak(round.revealed) >= 3) {
          playSfx('combo');
          streakBuzz = setTimeout(() => buzz([0, 25, 40, 25, 40, 25]), 350);
        }
        reveal.setValue(0);
        Animated.spring(reveal, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
      }
      const id = setTimeout(() => setHold(null), HOLD_MS);
      seen.current = n;
      return () => {
        clearTimeout(id);
        if (streakBuzz) clearTimeout(streakBuzz);
      };
    }
    seen.current = n;
    return undefined;
  }, [round.revealed, reveal]);
  const current = round.current;
  const [youPts, rivalPts] = revealScores(round.revealed);
  const streak = yourStreak(round.revealed);
  const send = async (index: number) => {
    playSfx('confirm');
    buzz(18);
    setBusy(true);
    setMine(index);
    const err = await onAnswer(index);
    if (err) setMine(null);
    setNote(err);
    setBusy(false);
  };
  const answered = round.youAnswered || mine !== null;
  const shownIndex = hold ? hold.index : round.roundIndex;
  const kind = hold ? revealKind(hold) : null;
  return (
    <View style={styles.column}>
      <Text style={styles.title}>{title ?? t.title}</Text>
      <Text style={styles.sub}>{t.round(Math.min(round.totalRounds, shownIndex + 1), round.totalRounds)}</Text>
      <ScoreLine you={youPts} rival={rivalPts} />
      {streak >= 2 && hold ? <Text style={styles.streak}>{t.streak(formatPersianNumber(streak))}</Text> : null}
      {current && !hold ? <Clock endsAt={round.endsAt} now={now} questionKey={round.roundIndex} /> : null}
      {hold ? (
        <Animated.View style={[styles.card, { transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>
          <Text style={styles.question}>{hold.textFa}</Text>
          {hold.options.map((o, i) => {
            const v = choiceVerdict(i, hold.yourPick, hold.correctIndex);
            const rivalHere = hold.opponentPick === i;
            const bg = v !== 'dim' ? VERDICT_TONES[v].to : rivalHere ? '#FFD0D6' : CHOICE_TONES[i % 4]!;
            return <Choice key={i} label={o} tone={bg} verdict={v} dim={v === 'dim' && !rivalHere} lit={false} tag={{ you: hold.yourPick === i, rival: rivalHere }} disabled />;
          })}
          {kind ? <Text style={[styles.kind, { backgroundColor: KIND_TONE[kind] }]}>{KIND_TEXT[kind]}</Text> : null}
          {kind === 'you' || kind === 'both' ? <PointPop key={hold.index} /> : null}
          {hold.explanationFa ? <Text style={styles.hint}>{hold.explanationFa}</Text> : null}
          {hold.authorFa ? <Text style={styles.author}>{fa.workshop.byAuthor(hold.authorFa)}</Text> : null}
        </Animated.View>
      ) : current ? (
        <View style={styles.card}>
          <Text style={styles.question}>{current.textFa}</Text>
          {current.options.map((o, i) => (
            <Choice key={i} label={o} tone={CHOICE_TONES[i % 4]!} verdict={null} dim={answered && mine !== i} lit={answered && mine === i} tag={{ you: false, rival: false }} onPress={() => void send(i)} disabled={busy || answered} />
          ))}
          {answered ? <Text style={styles.wait}>{t.lockedIn}</Text> : null}
          {round.opponentAnswered ? <Text style={styles.rivalLocked}>{t.opponentLocked}</Text> : null}
          {note ? <Text style={styles.error}>{note}</Text> : null}
        </View>
      ) : null}
      {round.revealed.length === 0 && !hold && intro !== null ? <Text style={styles.intro}>{intro ?? t.intro}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 10, paddingTop: 8, alignItems: 'stretch' },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.candy.yellow, textAlign: 'center' },
  sub: { fontFamily: fonts.bold, fontSize: 14, color: colors.cream, textAlign: 'center' },
  scoreLine: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 4, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.paper },
  scoreText: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  streak: { fontFamily: fonts.display, fontSize: 18, color: '#FF8A3D', textAlign: 'center' },
  clock: { height: 12, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: 'rgba(0,0,0,0.35)', overflow: 'hidden' },
  clockFill: { height: '100%', borderRadius: 99 },
  intro: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 22, color: colors.cream, textAlign: 'center', opacity: 0.85 },
  card: { gap: 8, padding: 14, borderRadius: 20, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'stretch' },
  question: { fontFamily: fonts.display, fontSize: 21, lineHeight: 32, color: colors.ink, textAlign: 'center', paddingBottom: 4 },
  choice: { minHeight: 54, borderRadius: 16, borderWidth: 2.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  lit: { backgroundColor: '#FFE48A', borderColor: '#B8860B' },
  pressedChoice: { transform: [{ translateY: 2 }] },
  choiceText: { fontFamily: fonts.display, fontSize: 18, lineHeight: 28, color: colors.ink, textAlign: 'center' },
  tags: { position: 'absolute', top: -9, left: 8, flexDirection: 'row', gap: 4 },
  tag: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink, paddingHorizontal: 8, paddingVertical: 1, borderRadius: 99, borderWidth: 2, borderColor: colors.ink, overflow: 'hidden' },
  tagYou: { backgroundColor: '#FFE48A' },
  tagRival: { backgroundColor: '#8FDCFA' },
  kind: { fontFamily: fonts.display, fontSize: 17, color: colors.ink, textAlign: 'center', paddingVertical: 6, borderRadius: 14, borderWidth: 2.5, borderColor: colors.ink, overflow: 'hidden' },
  pop: { position: 'absolute', alignSelf: 'center', top: '40%', fontFamily: fonts.display, fontSize: 30, color: '#2E7D32', textShadowColor: '#fff', textShadowRadius: 6 },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: '#7E46D6', textAlign: 'center' },
  author: { fontFamily: fonts.bold, fontSize: 12, color: '#7E46D6', textAlign: 'center' },
  wait: { fontFamily: fonts.bold, fontSize: 15, color: '#7E46D6', textAlign: 'center' },
  rivalLocked: { fontFamily: fonts.bold, fontSize: 13, color: '#1F78A8', textAlign: 'center' },
  error: { fontFamily: fonts.bold, fontSize: 13, color: '#B3261E', textAlign: 'center' },
});
