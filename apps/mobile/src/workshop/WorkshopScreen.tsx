import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { WORKSHOP_TITLE_POINTS, formatPersianNumber } from '@dozari/shared';
import type { WorkshopCard, WorkshopInfo, WorkshopMineRow } from '@dozari/shared';
import { Confetti } from '../components/Confetti';
import { SlabButton } from '../components/SlabButton';
import { GameTopBar } from '../game/GameTopBar';
import { MatchBackground } from '../game/MatchBackground';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { buzz, playSfx } from '../sound/engine';
import { colors, fonts } from '../theme/colors';
import { adultSkin } from '../theme/skin';
import { RTL_INPUT } from '../theme/direction';
import { nativeTopInset } from '../theme/safeArea';
import { fetchMine, fetchReviewFeed, fetchTop, fetchWorkshop, fetchWorkshopTopics, sendReview, submitQuestion } from './api';
import type { ReviewFeed, WorkshopTopic } from './api';
import { distinctOptions, draftToSubmit, emptyDraft } from './form';
import type { Draft } from './form';

const t = fa.workshop;
const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const TABS = ['make', 'review', 'mine', 'top'] as const;
type Tab = (typeof TABS)[number];
const N = (n: number) => formatPersianNumber(n);
const errorCode = (e: unknown): string => (e instanceof ApiError ? (e.code ?? 'generic') : 'generic');

/** The reward ribbon: pulses, and says so loudly during a campaign. */
function Ribbon({ info }: { info: WorkshopInfo }) {
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(glow, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(glow, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [glow]);
  const next = info.nextTitleAt;
  const base = WORKSHOP_TITLE_POINTS[info.title] ?? 0;
  const progress = next === null ? 1 : Math.min(1, Math.max(0, (info.points - base) / Math.max(1, next - base)));
  return (
    <View style={styles.ribbonWrap}>
      <Animated.View style={[styles.ribbon, info.boostPercent > 0 ? styles.ribbonBoost : null, { transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) }] }]}>
        <Text style={styles.ribbonText}>{t.reward(N(info.rewardCoins))}</Text>
        {info.boostPercent > 0 ? <Text style={styles.ribbonBoostText}>{t.boost(N(info.boostPercent))}</Text> : null}
      </Animated.View>
      <View style={styles.rank}>
        <Text style={styles.rankTitle}>{t.titles[info.title]} · {t.points(N(info.points))}</Text>
        <View style={styles.bar}><View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} /></View>
        <Text style={styles.rankHint}>{next === null ? t.maxTitle : t.toNext(N(next - info.points), t.titles[info.title + 1] ?? '')}</Text>
      </View>
    </View>
  );
}

// ---- make ------------------------------------------------------------------------------------------------------

function MakeTab({ info, onChanged }: { info: WorkshopInfo; onChanged: () => void }) {
  const [topics, setTopics] = useState<WorkshopTopic[]>([]);
  const [d, setD] = useState<Draft>(emptyDraft());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => void fetchWorkshopTopics().then(setTopics, () => undefined), []);
  const submit = draftToSubmit(d);
  const send = async () => {
    if (!submit || busy) return setNote(t.needAll);
    setBusy(true);
    setNote(null);
    try {
      await submitQuestion(submit);
      playSfx('coin');
      buzz([0, 30, 50, 30, 50, 60]);
      setDone(true);
      setD(emptyDraft());
      onChanged();
    } catch (e) {
      buzz(80);
      setNote(t.errors[errorCode(e)] ?? t.errors.generic ?? '');
    } finally {
      setBusy(false);
    }
  };
  if (done) {
    return (
      <View style={styles.card}>
        <Confetti distance={400} />
        <Text style={styles.big}>🎉</Text>
        <Text style={styles.title}>{t.sent}</Text>
        <Text style={styles.sub}>{t.sentReward(N(info.rewardCoins))}</Text>
        <SlabButton label={t.send} sfx="confirm" color={colors.candy.lime} height={54} fontSize={18} disabled={info.submitsLeftToday <= 1} onPress={() => setDone(false)} />
        {info.submitsLeftToday <= 1 ? <Text style={styles.sub}>{t.noneLeft}</Text> : null}
      </View>
    );
  }
  if (info.submitsLeftToday <= 0) return <View style={styles.card}><Text style={styles.sub}>{t.noneLeft}</Text></View>;
  const setOption = (i: number, v: string) => setD((x) => ({ ...x, options: x.options.map((o, j) => (j === i ? v : o)) as Draft['options'] }));
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{t.pickTopic}</Text>
      <View style={styles.chips}>
        {topics.map((x) => (
          <Pressable key={x.id} accessibilityRole="button" onPress={() => (buzz(10), setD((v) => ({ ...v, topicId: x.id })))} style={[styles.chip, d.topicId === x.id ? styles.chipOn : null, x.thin ? styles.chipThin : null]}>
            <Text style={styles.chipText}>{x.nameFa}</Text>
            <Text style={styles.chipSub}>{x.thin ? t.thin(N(x.bonus)) : t.topicCount(N(x.questions))}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>{t.question}</Text>
      <TextInput {...RTL_INPUT.props} value={d.text} onChangeText={(v) => setD((x) => ({ ...x, text: v }))} multiline maxLength={300} placeholder={t.questionPlaceholder} placeholderTextColor="#9A8A7A" style={[styles.input, RTL_INPUT.style, styles.multiline]} accessibilityLabel={t.question} />
      {d.options.map((o, i) => (
        <View key={i} style={styles.optionRow}>
          <Pressable accessibilityRole="radio" accessibilityState={{ selected: d.correct === i }} accessibilityLabel={t.markRight} onPress={() => (buzz(12), setD((x) => ({ ...x, correct: i })))} style={[styles.radio, d.correct === i ? styles.radioOn : null]}>
            <Text style={styles.radioText}>{d.correct === i ? '✓' : ''}</Text>
          </Pressable>
          <TextInput {...RTL_INPUT.props} value={o} onChangeText={(v) => setOption(i, v)} maxLength={80} placeholder={t.option(N(i + 1))} placeholderTextColor="#9A8A7A" style={[styles.input, RTL_INPUT.style, { flex: 1 }]} accessibilityLabel={t.option(N(i + 1))} />
        </View>
      ))}
      {distinctOptions(d.options) < 4 && d.options.some(Boolean) ? <Text style={styles.hint}>{t.needAll}</Text> : null}
      <Text style={styles.label}>{t.difficulty}</Text>
      <View style={styles.chips}>
        {t.difficulties.map((name, i) => (
          <Pressable key={name} accessibilityRole="button" onPress={() => (buzz(10), setD((x) => ({ ...x, difficulty: (i + 1) as 1 | 2 | 3 })))} style={[styles.chip, d.difficulty === i + 1 ? styles.chipOn : null]}>
            <Text style={styles.chipText}>{name}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput {...RTL_INPUT.props} value={d.explanation} onChangeText={(v) => setD((x) => ({ ...x, explanation: v }))} maxLength={300} placeholder={t.explanation} placeholderTextColor="#9A8A7A" style={[styles.input, RTL_INPUT.style]} accessibilityLabel={t.explanation} />
      {note ? <Text style={styles.error}>{note}</Text> : null}
      <SlabButton label={t.send} sfx="confirm" color={colors.candy.lime} height={58} fontSize={20} disabled={!submit || busy} onPress={() => void send()} />
      <Text style={styles.sub}>{t.leftToday(N(info.submitsLeftToday))}</Text>
    </View>
  );
}

// ---- review ----------------------------------------------------------------------------------------------------

function ReviewTab({ info, onChanged }: { info: WorkshopInfo; onChanged: () => void }) {
  const [feed, setFeed] = useState<ReviewFeed | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [gain, setGain] = useState(false);
  const load = useCallback(() => {
    setPick(null);
    setNote(null);
    fetchReviewFeed().then(setFeed, () => setNote(t.reviewErrors.generic ?? ''));
  }, []);
  useEffect(load, [load]);
  const rate = async (quality: 1 | -1) => {
    if (!feed || feed.locked || !feed.card || pick === null || busy) return;
    setBusy(true);
    try {
      await sendReview(feed.card.id, pick, quality);
      playSfx('correct');
      buzz([0, 25, 45, 25]);
      setGain(true);
      onChanged();
      setTimeout(() => (setGain(false), load()), 900);
    } catch (e) {
      buzz(80);
      setNote(t.reviewErrors[errorCode(e)] ?? t.reviewErrors.generic ?? '');
      if (errorCode(e) === 'closed' || errorCode(e) === 'reviewed') setTimeout(load, 900);
    } finally {
      setBusy(false);
    }
  };
  if (!feed) return <View style={styles.card}>{note ? <Text style={styles.error}>{note}</Text> : <ActivityIndicator color={colors.ink} />}</View>;
  if (feed.locked) return <View style={styles.card}><Text style={styles.sub}>{t.reviewLocked(N(feed.need))}</Text></View>;
  if (feed.capped) return <View style={styles.card}><Text style={styles.sub}>{t.reviewCapped}</Text></View>;
  if (!feed.card) return <View style={styles.card}><Text style={styles.big}>👏</Text><Text style={styles.sub}>{t.reviewEmpty}</Text></View>;
  const c: WorkshopCard = feed.card;
  return (
    <View style={styles.card}>
      <Text style={styles.sub}>{t.reviewIntro}</Text>
      <Text style={styles.chipSub}>{c.topicNameFa} · {t.difficulties[c.difficulty - 1]}</Text>
      <Text style={styles.question}>{c.textFa}</Text>
      <Text style={styles.label}>{t.pickAnswer}</Text>
      {c.options.map((o, i) => (
        <Pressable key={i} accessibilityRole="button" onPress={() => (buzz(10), playSfx('select'), setPick(i))} style={[styles.choice, pick === i ? styles.choiceOn : null]}>
          <Text style={styles.choiceText}>{o}</Text>
        </Pressable>
      ))}
      {pick !== null ? <Text style={styles.label}>{t.rate}</Text> : null}
      {pick !== null ? (
        <View style={styles.actions}>
          <SlabButton label={t.bad} sfx="back" color={colors.candy.orange} height={54} fontSize={18} disabled={busy} onPress={() => void rate(-1)} />
          <SlabButton label={t.good} sfx="confirm" color={colors.candy.lime} height={54} fontSize={18} disabled={busy} onPress={() => void rate(1)} />
        </View>
      ) : null}
      {gain ? <Text style={styles.gain}>{t.gotPoint}</Text> : null}
      {note ? <Text style={styles.error}>{note}</Text> : null}
      <Text style={styles.sub}>{t.reviewsLeft(N(info.reviewsLeftToday))}</Text>
    </View>
  );
}

// ---- mine ------------------------------------------------------------------------------------------------------

const RECENT_MS = 3 * 24 * 60 * 60 * 1000;

function MineTab() {
  const [rows, setRows] = useState<WorkshopMineRow[] | null>(null);
  useEffect(() => void fetchMine().then(setRows, () => setRows([])), []);
  if (!rows) return <View style={styles.card}><ActivityIndicator color={colors.ink} /></View>;
  if (rows.length === 0) return <View style={styles.card}><Text style={styles.sub}>{t.mineEmpty}</Text></View>;
  const fresh = rows.find((r) => r.status === 'approved' && r.decidedAt !== null && Date.now() - r.decidedAt < RECENT_MS && r.rewardCoins > 0);
  return (
    <View style={{ gap: 10 }}>
      {fresh ? (
        <View style={[styles.card, styles.celebrate]}>
          <Confetti distance={400} />
          <Text style={styles.big}>🎉</Text>
          <Text style={styles.title}>{t.celebrate(N(fresh.rewardCoins))}</Text>
        </View>
      ) : null}
      {rows.map((r) => (
        <View key={r.id} style={[styles.card, r.status === 'approved' ? styles.cardGood : null]}>
          <Text style={styles.chipSub}>{r.topicNameFa} · {t.status[r.status]}</Text>
          <Text style={styles.question}>{r.textFa}</Text>
          {r.options.map((o, i) => <Text key={i} style={[styles.mineOption, i === r.correctIndex ? styles.mineRight : null]}>{i === r.correctIndex ? '✓ ' : ''}{o}</Text>)}
          <Text style={styles.sub}>
            {t.reviewsOf(N(r.reviews))}
            {r.status === 'approved' ? ` · ${t.played(N(r.plays))} · ${t.paid(N(r.rewardCoins))}` : ''}
            {r.status === 'rejected' && r.rejectReason ? ` · ${t.reasons[r.rejectReason] ?? ''}` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ---- top -------------------------------------------------------------------------------------------------------

function TopTab() {
  const [period, setPeriod] = useState<'week' | 'all'>('week');
  const [top, setTop] = useState<Awaited<ReturnType<typeof fetchTop>> | null>(null);
  useEffect(() => {
    setTop(null);
    void fetchTop(period).then(setTop, () => undefined);
  }, [period]);
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.chips}>
        {(['week', 'all'] as const).map((p) => (
          <Pressable key={p} accessibilityRole="button" onPress={() => setPeriod(p)} style={[styles.chip, period === p ? styles.chipOn : null]}><Text style={styles.chipText}>{p === 'week' ? t.week : t.all}</Text></Pressable>
        ))}
      </View>
      {!top ? <ActivityIndicator color={colors.cream} /> : (
        <>
          <View style={styles.card}>
            <Text style={styles.title}>{t.topAuthors}</Text>
            {top.authors.length === 0 ? <Text style={styles.sub}>{t.topEmpty}</Text> : top.authors.map((a, i) => <Text key={i} style={[styles.rowText, a.you ? styles.rowYou : null]}>{N(i + 1)}. {a.nickname} {a.you ? t.you : ''} — {t.approvedCount(N(a.approved))}</Text>)}
          </View>
          <View style={styles.card}>
            <Text style={styles.title}>{t.topReviewers}</Text>
            {top.reviewers.length === 0 ? <Text style={styles.sub}>{t.topEmpty}</Text> : top.reviewers.map((a, i) => <Text key={i} style={[styles.rowText, a.you ? styles.rowYou : null]}>{N(i + 1)}. {a.nickname} {a.you ? t.you : ''} — {t.titles[a.title]} · {t.points(N(a.points))}</Text>)}
          </View>
        </>
      )}
    </View>
  );
}

// ---- screen ----------------------------------------------------------------------------------------------------

/** «کارگاه سؤال»: design a question, review other players' questions, see yours and the best (docs/logic/question-workshop.md). */
export function WorkshopScreen({ onBack, initialTab = 'make' }: { onBack: () => void; initialTab?: Tab }) {
  const [info, setInfo] = useState<WorkshopInfo | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => void fetchWorkshop().then(setInfo, () => setFailed(true)), []);
  useEffect(load, [load]);
  return (
    <MatchBackground>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <GameTopBar title={t.title} backLabel={fa.solo.back} onBack={onBack} />
          {failed ? <Text style={styles.error}>{t.errors.generic}</Text> : null}
          {!info ? (!failed ? <ActivityIndicator color={colors.candy.yellow} /> : null) : (
            <>
              <Ribbon info={info} />
              <View style={styles.tabs}>
                {TABS.map((k) => (
                  <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => (buzz(10), playSfx('tap'), setTab(k))} style={[styles.tab, tab === k ? styles.tabOn : null]}>
                    <Text style={styles.tabText}>{t.tabs[k]}</Text>
                    {k === 'review' && info.waiting > 0 ? <Text style={styles.badge}>{N(info.waiting)}</Text> : null}
                  </Pressable>
                ))}
              </View>
              {tab === 'make' ? <MakeTab info={info} onChanged={load} /> : null}
              {tab === 'review' ? <ReviewTab info={info} onChanged={load} /> : null}
              {tab === 'mine' ? <MineTab /> : null}
              {tab === 'top' ? <TopTab /> : null}
            </>
          )}
        </View>
      </ScrollView>
    </MatchBackground>
  );
}

const styles = StyleSheet.create(adultSkin({
  screen: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 12, paddingTop: 20 + nativeTopInset(), paddingBottom: 40 },
  column: { width: '100%', maxWidth: 480, gap: 12 },
  ribbonWrap: { gap: 8 },
  ribbon: { alignItems: 'center', gap: 2, padding: 12, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.candy.yellow },
  ribbonBoost: { backgroundColor: '#FF8A3D' },
  ribbonText: { fontFamily: fonts.display, fontSize: 19, color: colors.ink, textAlign: 'center' },
  ribbonBoostText: { fontFamily: fonts.display, fontSize: 16, color: '#fff', textAlign: 'center' },
  rank: { gap: 4, padding: 10, borderRadius: 16, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.paper },
  rankTitle: { fontFamily: fonts.display, fontSize: 16, color: colors.ink, textAlign: 'center' },
  rankHint: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink, opacity: 0.7, textAlign: 'center' },
  bar: { height: 10, borderRadius: 99, borderWidth: 2, borderColor: colors.ink, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.12)' },
  barFill: { height: '100%', backgroundColor: '#8BDB4B' },
  tabs: { flexDirection: ROW, gap: 6 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 14, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'center', flexDirection: ROW, justifyContent: 'center', gap: 4 },
  tabOn: { backgroundColor: colors.candy.yellow },
  tabText: { fontFamily: fonts.display, fontSize: 14, color: colors.ink },
  badge: { fontFamily: fonts.display, fontSize: 12, color: '#fff', backgroundColor: '#E53935', borderRadius: 99, paddingHorizontal: 6, overflow: 'hidden' },
  card: { gap: 8, padding: 14, borderRadius: 20, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'stretch' },
  cardGood: { backgroundColor: '#E8F9D8' },
  celebrate: { backgroundColor: '#FFF3C4', alignItems: 'center' },
  big: { fontSize: 40, textAlign: 'center' },
  title: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 21, color: colors.ink, opacity: 0.8, textAlign: 'center' },
  label: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, textAlign: 'center' },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: '#B3261E', textAlign: 'center' },
  error: { fontFamily: fonts.bold, fontSize: 13, color: '#B3261E', textAlign: 'center' },
  gain: { fontFamily: fonts.display, fontSize: 20, color: '#2E7D32', textAlign: 'center' },
  chips: { flexDirection: ROW, flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.cream, alignItems: 'center' },
  chipOn: { backgroundColor: colors.candy.yellow },
  chipThin: { borderColor: '#FF8A3D' },
  chipText: { fontFamily: fonts.display, fontSize: 14, color: colors.ink },
  chipSub: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink, opacity: 0.75, textAlign: 'center' },
  input: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.card },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  optionRow: { flexDirection: ROW, alignItems: 'center', gap: 8 },
  radio: { width: 34, height: 34, borderRadius: 17, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: '#8BDB4B' },
  radioText: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  question: { fontFamily: fonts.display, fontSize: 19, lineHeight: 30, color: colors.ink, textAlign: 'center' },
  choice: { minHeight: 50, borderRadius: 14, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#8FDCFA', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  choiceOn: { backgroundColor: '#FFE48A', borderColor: '#B8860B' },
  choiceText: { fontFamily: fonts.display, fontSize: 17, color: colors.ink, textAlign: 'center' },
  actions: { flexDirection: ROW, gap: 10 },
  mineOption: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, textAlign: 'center', opacity: 0.8 },
  mineRight: { color: '#2E7D32', opacity: 1 },
  rowText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, textAlign: 'center' },
  rowYou: { fontFamily: fonts.display, color: '#7E46D6' },
}));
