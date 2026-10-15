import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatPersianNumber } from '@dozari/shared';
import type { TriviaView } from '@dozari/shared';
import { AdultBackdrop, AnswerRow, BrassButton, BrassSquare, Plate } from '../duel/adultKit';
import { fa } from '../i18n/fa';
import { fonts } from '../theme/colors';
import { nativeTopInset } from '../theme/safeArea';
import type { AnswerState } from '../duel/adultKit';

const t = fa.trivia;
const LETTERS = ['الف', 'ب', 'ج', 'د'] as const;

export type TriviaShown = { picked: number; correct: number; explanationFa: string | null; authorFa: string | null };

/**
 * Adult look of the solo question game («صرافی و گاوصندوق», docs/design/adult/Dozari Adult - Quiz Duel): header with progress pips, the
 * question plate with its topic chip, the four answer rows, then the «شرح» plate with the verdict and «پرسش بعدی»; the end shows the result plate.
 */
export function TriviaSoloAdult({ view, index, shown, busy, finished, onPick, onNext, onBack, onAgain, promo }: { view: TriviaView; index: number; shown: TriviaShown | null; busy: boolean; finished: boolean; onPick: (i: number) => void; onNext: () => void; onBack: () => void; onAgain: () => void; /** Workshop call-to-action on the result plate. */ promo?: React.ReactNode }) {
  const total = view.rounds.length;
  const round = view.rounds[index];
  const num = (n: number) => formatPersianNumber(n);
  const rowState = (i: number): AnswerState => (shown ? (i === shown.correct ? 'right' : i === shown.picked ? 'wrong' : 'dim') : 'idle');
  const ok = shown ? shown.picked === shown.correct : false;
  return (
    <AdultBackdrop>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <View style={styles.head}>
            <View style={styles.headMain}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>{view.topicNameFa ?? t.title}</Text>
                {!finished ? <Text style={styles.count}>{t.question(num(Math.min(total, index + 1)), num(total))}</Text> : null}
              </View>
              <View style={styles.pips}>
                {Array.from({ length: total }, (_, i) => {
                  const r = view.results[i];
                  const c = r ? (r.correct ? '#7ED957' : '#E0533F') : i === index && !finished ? '#E8B64A' : '#2A1E16';
                  return <View key={i} style={[styles.pip, { backgroundColor: c }]} />;
                })}
              </View>
            </View>
            <BrassSquare glyph="back" label={fa.solo.back} onPress={onBack} />
          </View>

          {finished ? (
            <Plate radius={20} border="#E8B64A" ledge={5} style={styles.panel}>
              <Text style={styles.big}>{t.summary}</Text>
              <Text style={styles.score}>{t.finished(num(view.score), num(total))}</Text>
              {view.fee > 0 ? <Text style={[styles.sub, view.refund > 0 ? styles.good : null]}>{view.refund > 0 ? t.refunded(num(view.refund)) : `${t.paid(num(view.fee))} · ${t.notRefunded}`}</Text> : null}
              {promo}
              <View style={styles.actions}>
                <View style={styles.flex1}><BrassButton label={fa.solo.back} tone="dark" onPress={onBack} /></View>
                <View style={styles.flex14}><BrassButton label={t.again} tone="gold" onPress={onAgain} /></View>
              </View>
            </Plate>
          ) : round ? (
            <>
              <Plate radius={20} border="#E8B64A" ledge={5} style={styles.panel}>
                {round.topicNameFa ? <View style={styles.chip}><Text style={styles.chipText}>{round.topicNameFa}</Text></View> : null}
                <Text style={styles.question}>{round.textFa}</Text>
              </Plate>
              {shown ? null : <Text style={styles.hint}>{fa.duel.triviaRound.adult.pickOne}</Text>}
              <View style={styles.rows}>
                {round.options.map((o, i) => (
                  <AnswerRow key={i} letter={LETTERS[i] ?? ''} text={o} state={rowState(i)} height={shown ? 44 : 60} disabled={busy || !!shown} onPress={() => onPick(i)} />
                ))}
              </View>
              {shown ? (
                <Plate radius={20} border="#E8B64A" ledge={5} style={styles.panel}>
                  <View style={[styles.banner, ok ? styles.bannerOk : styles.bannerNo]}>
                    <Text style={[styles.bannerTitle, { color: ok ? '#D9FFC4' : '#FFC9BF' }]}>{ok ? t.right : t.wrong}</Text>
                    {ok ? <Text style={[styles.bannerPill, { color: '#D9FFC4', borderColor: '#7ED957' }]}>{t.point}</Text> : null}
                  </View>
                  <Text style={styles.why}>{fa.duel.triviaRound.adult.why(round.options[shown.correct] ?? '')}</Text>
                  {shown.explanationFa ? <Text style={styles.exText}>{shown.explanationFa}</Text> : null}
                  {shown.authorFa ? <Text style={styles.author}>{fa.workshop.byAuthor(shown.authorFa)}</Text> : null}
                  <BrassButton label={view.done ? t.seeResult : t.next} tone="copper" onPress={onNext} />
                </Plate>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>
    </AdultBackdrop>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 12, paddingTop: 12 + nativeTopInset(), paddingBottom: 28 },
  column: { direction: 'rtl', width: '100%', maxWidth: 480, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headMain: { flex: 1, gap: 6, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  title: { flexShrink: 1, fontFamily: fonts.display, fontSize: 24, lineHeight: 34, color: '#FFE9A8' },
  count: { fontFamily: fonts.bold, fontSize: 12, color: 'rgba(255,233,168,0.65)' },
  pips: { flexDirection: 'row', gap: 3 },
  pip: { flex: 1, height: 6, borderRadius: 3, borderWidth: 1, borderColor: '#000' },
  panel: { padding: 14, gap: 8 },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 99, backgroundColor: '#0E0A08', borderWidth: 1.5, borderColor: '#8A5A16' },
  chipText: { fontFamily: fonts.bold, fontSize: 11, color: '#E8B64A' },
  question: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 28, color: '#FFE9A8', textAlign: 'right' },
  hint: { fontFamily: fonts.bold, fontSize: 12.5, color: 'rgba(255,233,168,0.6)', textAlign: 'center' },
  rows: { gap: 9 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 2, paddingVertical: 5, paddingHorizontal: 8 },
  bannerOk: { backgroundColor: '#1C3A12', borderColor: '#7ED957' },
  bannerNo: { backgroundColor: '#3A0E0A', borderColor: '#E0533F' },
  bannerTitle: { flex: 1, fontFamily: fonts.display, fontSize: 19, lineHeight: 28 },
  bannerPill: { fontFamily: fonts.display, fontSize: 13, paddingHorizontal: 9, borderRadius: 99, borderWidth: 1.5, backgroundColor: '#0E0A08', overflow: 'hidden' },
  why: { fontFamily: fonts.display, fontSize: 17, lineHeight: 26, color: '#E8B64A', textAlign: 'right' },
  exText: { fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 25, color: '#FFE9A8', textAlign: 'right' },
  author: { fontFamily: fonts.bold, fontSize: 12, color: '#E8B64A', textAlign: 'right' },
  big: { fontFamily: fonts.display, fontSize: 26, lineHeight: 38, color: '#FFE9A8', textAlign: 'center' },
  score: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 24, color: '#FFE9A8', textAlign: 'center' },
  sub: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 21, color: 'rgba(255,233,168,0.75)', textAlign: 'center' },
  good: { color: '#9FE870' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  flex1: { flex: 1 },
  flex14: { flex: 1.4 },
});

