import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { toPersianDigits } from '@dozari/shared';
import type { TriviaRoundView } from '@dozari/shared';
import { Character } from '../components/Character';
import { fa } from '../i18n/fa';
import { playSfx } from '../sound/engine';
import { fonts } from '../theme/colors';
import { BrassSquare, Plate } from './adultKit';
import type { CharacterId } from '../theme/character';

const t = fa.duel.triviaRound;
const a = t.adult;
const LETTERS = ['الف', 'ب', 'ج', 'د'] as const;
const RING = 138.2;
const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const ROW_REV = Platform.OS === 'web' ? ('row' as const) : ('row-reverse' as const);
/** How long a finished question's «شرح» card stays before the next question takes over (the player can skip it). */
const HOLD_MS = 8000;

type Row = TriviaRoundView['revealed'][number];
type Side = { name: string; who: CharacterId };

/** Verdict banner of a finished question: who got the point (docs/design/adult/Dozari Adult - Quiz Duel). */
function bannerOf(row: Row): { title: string; pill: string; bg: string; bd: string; fg: string } {
  const m = row.yourPick === row.correctIndex;
  const o = row.opponentPick === row.correctIndex;
  if (m && o) return { title: a.bothRight, pill: a.pointBoth, bg: '#1C3A12', bd: '#7ED957', fg: '#D9FFC4' };
  if (m) return { title: a.mineRight, pill: a.pointMine, bg: '#3A2A0A', bd: '#E8B64A', fg: '#FFE9A8' };
  if (o) return { title: row.yourPick === null ? a.timeUpRivalOnly : a.rivalOnly, pill: a.pointRival, bg: '#3A0E0A', bd: '#E0533F', fg: '#FFC9BF' };
  return { title: a.noneRight, pill: a.pointNone, bg: '#2A1E16', bd: '#8A5A16', fg: '#FFE9A8' };
}

function Avatar({ who, border }: { who: CharacterId; border: string }) {
  return (
    <View style={[styles.avatar, { borderColor: border }]}>
      <Character who={who} crop="face" width="100%" height="100%" />
    </View>
  );
}

/**
 * Adult look of the duel's general-question round («صرافی و گاوصندوق», copper = duel): header with progress pips, score strip with the
 * clock ring, the question, then either the four answer rows (asking) or the shrunk rows plus the «شرح» card (a finished question).
 */
export function DuelTriviaRoundAdult({ round, now, onAnswer, me, rival, topic, title, onExit }: { round: TriviaRoundView; now: number; /** Heading (default: the board duel's «دور سؤال عمومی»). */ title?: string; /** Shows the brass ✕ in the header; it should ask before leaving. */ onExit?: () => void; /** Topic name shown as a chip on the question card (the standalone question duel); absent = no chip. */ topic?: string | null; /** Resolves to an error text, or null when the server took the answer. */ onAnswer: (index: number) => Promise<string | null>; me: Side; rival: Side }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [mine, setMine] = useState<number | null>(null);
  const [hold, setHold] = useState<Row | null>(null);
  const [holdLeft, setHoldLeft] = useState(0);
  const seen = useRef(0);
  const total = useRef(1);
  useEffect(() => {
    setMine(null);
    setNote(null);
    total.current = Math.max(1, Math.ceil((round.endsAt - Date.now()) / 1000));
  }, [round.roundIndex, round.endsAt]);
  useEffect(() => {
    const n = round.revealed.length;
    if (n > seen.current) {
      const row = round.revealed[n - 1] ?? null;
      setHold(row);
      setHoldLeft(HOLD_MS);
      if (row) playSfx(row.yourPick === row.correctIndex ? 'correct' : 'wrong');
    }
    seen.current = n;
  }, [round.revealed.length]);
  useEffect(() => {
    if (!hold) return undefined;
    const id = setInterval(() => setHoldLeft((x) => x - 250), 250);
    return () => clearInterval(id);
  }, [hold]);
  useEffect(() => {
    if (hold && holdLeft <= 0) setHold(null);
  }, [hold, holdLeft]);

  const liveSecs = Math.max(0, Math.ceil((round.endsAt - now) / 1000));
  const frozen = useRef({ secs: liveSecs, total: 1 });
  if (!hold) frozen.current = { secs: liveSecs, total: total.current };
  const secs = hold ? frozen.current.secs : liveSecs;
  const current = round.current;
  const answered = round.youAnswered || mine !== null;
  const rows = round.revealed;
  const myScore = rows.filter((r) => r.yourPick === r.correctIndex).length;
  const rivalScore = rows.filter((r) => r.opponentPick === r.correctIndex).length;
  let streak = 0;
  for (let i = rows.length - 1; i >= 0 && rows[i]?.yourPick === rows[i]?.correctIndex; i--) streak++;
  const shownIndex = hold ? hold.index : round.roundIndex;
  const send = async (index: number) => {
    playSfx('confirm');
    setBusy(true);
    setMine(index);
    const err = await onAnswer(index);
    if (err) setMine(null);
    setNote(err);
    setBusy(false);
  };

  const text = hold ? hold.textFa : current?.textFa ?? '';
  const options = hold ? hold.options : current?.options ?? [];
  const banner = hold ? bannerOf(hold) : null;
  const ringColor = hold ? '#5A4A3A' : secs <= 5 ? '#FF6B55' : '#E8B64A';
  const frac = Math.min(1, secs / (hold ? frozen.current.total : total.current));
  const rivalState = hold
    ? hold.opponentPick === null
      ? { t: a.rivalNone, c: '#FF9A8A' }
      : hold.opponentPick === hold.correctIndex
        ? { t: a.rivalRight, c: '#9FE870' }
        : { t: a.rivalWrong, c: '#FF9A8A' }
    : round.opponentAnswered
      ? { t: a.rivalAnswered, c: '#9FE870' }
      : { t: a.rivalThinking, c: 'rgba(255,233,168,0.55)' };

  return (
    <View style={styles.column}>
      <View style={styles.head}>
        <View style={styles.headMain}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title ?? t.title}</Text>
            <Text style={styles.count}>{t.round(Math.min(round.totalRounds, shownIndex + 1), round.totalRounds)}</Text>
          </View>
          <View style={styles.pips}>
            {Array.from({ length: round.totalRounds }, (_, i) => {
              const r = rows[i];
              const c = r ? (r.yourPick === r.correctIndex ? '#7ED957' : '#E0533F') : i === shownIndex ? '#E8B64A' : '#2A1E16';
              return <View key={i} style={[styles.pip, { backgroundColor: c }]} />;
            })}
          </View>
        </View>
        {onExit ? <BrassSquare glyph="close" label={fa.solo.back} onPress={onExit} /> : null}
      </View>

      <Plate radius={18} border="#E0895A" height={80} style={styles.score}>
        <View style={styles.side}>
          <Avatar who={me.who} border="#E8B64A" />
          <View style={styles.sideText}>
            <Text style={styles.sideName} numberOfLines={1}>{a.you}</Text>
            <Text style={styles.num}>{toPersianDigits(String(myScore))}</Text>
            {streak >= 2 ? <Text style={styles.streak}>🔥 {a.streak(toPersianDigits(String(streak)))}</Text> : null}
          </View>
        </View>
        <View style={styles.ring}>
          <Svg width={56} height={56} viewBox="0 0 56 56" style={styles.ringSvg}>
            <Circle cx={28} cy={28} r={22} fill="#0E0A08" stroke="#3A2A1C" strokeWidth={5} />
            <Circle cx={28} cy={28} r={22} fill="none" stroke={ringColor} strokeWidth={5} strokeLinecap="round" strokeDasharray={RING} strokeDashoffset={RING * (1 - frac)} />
          </Svg>
          <Text style={[styles.ringText, { color: ringColor }]}>{toPersianDigits(String(secs))}</Text>
        </View>
        <View style={[styles.side, styles.sideRival]}>
          <Avatar who={rival.who} border="#E0895A" />
          <View style={[styles.sideText, styles.sideTextRival]}>
            <Text style={styles.sideName} numberOfLines={1}>{rival.name}</Text>
            <Text style={[styles.num, { color: '#FFD2B0' }]}>{toPersianDigits(String(rivalScore))}</Text>
            <Text style={[styles.rivalState, { color: rivalState.c }]}>{rivalState.t}</Text>
          </View>
        </View>
      </Plate>

      <Plate radius={20} border="#E8B64A" ledge={5} style={[styles.card, hold ? styles.cardTight : null]}>
        {topic && !hold ? <View style={styles.chip}><Text style={styles.chipText}>{topic}</Text></View> : null}
        <Text style={[styles.question, hold ? styles.questionSmall : null]}>{text}</Text>
      </Plate>

      {hold ? null : <Text style={styles.hint}>{answered ? a.waitRival : a.pickOne}</Text>}

      <View style={[styles.rows, hold ? styles.rowsTight : null]}>
        {options.map((o, i) => {
          const picked = hold ? hold.yourPick : answered ? mine : null;
          const theirs = hold ? hold.opponentPick === i : false;
          const isMine = picked === i;
          const right = hold ? i === hold.correctIndex : false;
          const wrong = hold ? !right && (isMine || theirs) : false;
          const faded = hold ? !right && !wrong : answered && !isMine;
          const lit = !hold && isMine;
          const bd = right ? '#9FE870' : wrong ? '#E0533F' : lit ? '#FFD2B0' : hold ? '#3A2A1C' : '#8A5A16';
          const from = right ? '#3E7A22' : wrong ? '#6A1E16' : lit ? '#5A2E18' : hold ? '#17100C' : '#3A2A1C';
          const to = right ? '#22480F' : wrong ? '#3A0E0A' : lit ? '#2A140A' : hold ? '#17100C' : '#1E1610';
          const fg = right ? '#F1FFE6' : wrong ? '#FFD9D2' : hold ? 'rgba(255,233,168,0.4)' : '#FFE9A8';
          const tagBg = right ? '#9FE870' : wrong ? '#C4302B' : lit ? '#E0895A' : hold ? '#2A1E16' : '#E8B64A';
          const glow = right ? '#7ED957' : lit ? '#E0895A' : undefined;
          return (
            <Pressable key={i} accessibilityRole="button" accessibilityLabel={o} disabled={busy || answered || hold !== null} onPress={() => void send(i)} style={{ opacity: faded && !hold ? 0.55 : hold && faded ? 0.75 : 1 }}>
              <Plate radius={14} border={bd} from={from} to={to} ledge={hold && faded ? 0 : lit || right ? 0 : 3} glow={glow} height={hold ? 34 : 60} style={styles.row}>
                <View style={[styles.tag, { backgroundColor: tagBg }]}>
                  <Text style={[styles.tagText, { color: right ? '#0E2A06' : wrong ? '#fff' : '#2A1606' }]}>{right ? '✓' : wrong ? '✕' : LETTERS[i]}</Text>
                </View>
                <Text style={[styles.rowText, { color: fg }]}>{o}</Text>
                {theirs ? <Text style={[styles.pill, styles.pillRival]}>{a.rival}</Text> : null}
                {isMine ? <Text style={[styles.pill, styles.pillMine]}>{a.you}</Text> : null}
              </Plate>
            </Pressable>
          );
        })}
      </View>
      {note ? <Text style={styles.error}>{note}</Text> : null}

      {hold && banner ? (
        <Plate radius={20} border="#E8B64A" ledge={5} style={styles.explain}>
          <View style={[styles.banner, { backgroundColor: banner.bg, borderColor: banner.bd }]}>
            <Text style={[styles.bannerTitle, { color: banner.fg }]}>{banner.title}</Text>
            <Text style={[styles.bannerPill, { color: banner.fg, borderColor: banner.bd }]}>{banner.pill}</Text>
          </View>
          <Text style={styles.why}>{a.why(hold.options[hold.correctIndex] ?? '')}</Text>
          {hold.explanationFa ? <Text style={styles.exText}>{hold.explanationFa}</Text> : null}
          <Pressable accessibilityRole="button" onPress={() => setHold(null)} style={({ pressed }) => (pressed ? styles.nextPressed : null)}>
            <Plate radius={15} border="#000" frame={3} from="#FFD2B0" to="#7A3414" style={styles.next}>
              <View style={[styles.nextFill, { width: `${Math.min(100, ((HOLD_MS - Math.max(0, holdLeft)) / HOLD_MS) * 100)}%` }]} />
              <Text style={styles.nextText}>{a.next} · {toPersianDigits(String(Math.max(0, Math.ceil(holdLeft / 1000))))}</Text>
            </Plate>
          </Pressable>
        </Plate>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 10, paddingTop: 8, alignItems: 'stretch' },
  head: { flexDirection: ROW, alignItems: 'center', gap: 10 },
  headMain: { flex: 1, gap: 6, minWidth: 0 },
  titleRow: { flexDirection: ROW, alignItems: 'baseline', gap: 8 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 34, color: '#FFE9A8' },
  count: { fontFamily: fonts.bold, fontSize: 12, color: 'rgba(255,233,168,0.65)' },
  pips: { flexDirection: ROW, gap: 3 },
  pip: { flex: 1, height: 6, borderRadius: 3, borderWidth: 1, borderColor: '#000' },
  score: { flexDirection: ROW, alignItems: 'center', paddingHorizontal: 8, gap: 4 },
  side: { flex: 1, flexDirection: ROW, alignItems: 'center', gap: 7, minWidth: 0 },
  sideRival: { flexDirection: ROW_REV },
  sideText: { flexShrink: 1, gap: 1 },
  sideTextRival: { alignItems: 'flex-end' },
  sideName: { fontFamily: fonts.bold, fontSize: 11, color: 'rgba(255,233,168,0.7)' },
  num: { fontFamily: fonts.display, fontSize: 30, lineHeight: 40, color: '#FFE9A8' },
  streak: { fontFamily: fonts.bold, fontSize: 10.5, color: '#FF9A5A' },
  rivalState: { fontFamily: fonts.bold, fontSize: 10.5 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, backgroundColor: '#17100C', overflow: 'hidden' },
  ring: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  ringSvg: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
  ringText: { fontFamily: fonts.display, fontSize: 20, lineHeight: 30 },
  card: { padding: 14, gap: 8 },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 99, backgroundColor: '#0E0A08', borderWidth: 1.5, borderColor: '#8A5A16' },
  chipText: { fontFamily: fonts.bold, fontSize: 11, color: '#E8B64A' },
  cardTight: { padding: 10 },
  question: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 28, color: '#FFE9A8', textAlign: 'right' },
  questionSmall: { fontSize: 15.5, lineHeight: 24 },
  hint: { fontFamily: fonts.bold, fontSize: 12.5, color: 'rgba(255,233,168,0.6)', textAlign: 'center' },
  rows: { gap: 9 },
  rowsTight: { gap: 5 },
  row: { flexDirection: ROW, alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  tag: { width: 30, height: 30, borderRadius: 9, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
  tagText: { fontFamily: fonts.display, fontSize: 15, lineHeight: 24 },
  rowText: { flex: 1, fontFamily: fonts.bold, fontSize: 16, textAlign: 'right' },
  pill: { height: 22, paddingHorizontal: 8, borderRadius: 99, borderWidth: 1.5, borderColor: '#000', fontFamily: fonts.display, fontSize: 12, lineHeight: 19, overflow: 'hidden' },
  pillRival: { backgroundColor: '#E0895A', color: '#2A1206' },
  pillMine: { backgroundColor: '#E8B64A', color: '#2A1606' },
  error: { fontFamily: fonts.bold, fontSize: 13, color: '#FF9A8A', textAlign: 'center' },
  explain: { padding: 12, gap: 8 },
  banner: { flexDirection: ROW, alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 2, paddingVertical: 5, paddingHorizontal: 8 },
  bannerTitle: { flex: 1, fontFamily: fonts.display, fontSize: 19, lineHeight: 28 },
  bannerPill: { fontFamily: fonts.display, fontSize: 13, paddingHorizontal: 9, borderRadius: 99, borderWidth: 1.5, backgroundColor: '#0E0A08', overflow: 'hidden' },
  why: { fontFamily: fonts.display, fontSize: 17, lineHeight: 26, color: '#E8B64A', textAlign: 'right' },
  exText: { fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 25, color: '#FFE9A8', textAlign: 'right' },
  next: { height: 42, alignItems: 'center', justifyContent: 'center' },
  nextPressed: { transform: [{ translateY: 3 }] },
  nextFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.18)' },
  nextText: { fontFamily: fonts.display, fontSize: 20, lineHeight: 30, color: '#2A1206' },
});
