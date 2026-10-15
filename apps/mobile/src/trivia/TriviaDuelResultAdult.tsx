import { StyleSheet, Text, View } from 'react-native';
import { formatPersianNumber } from '@dozari/shared';
import type { TduelEnded } from '@dozari/shared';
import { AnswerRow, BrassButton, Plate } from '../duel/adultKit';
import { fa } from '../i18n/fa';
import { fonts } from '../theme/colors';
import type { AnswerState } from '../duel/adultKit';
import { tduelOutcome } from './duelModel';

const t = fa.triviaDuel;
const LETTERS = ['الف', 'ب', 'ج', 'د'] as const;

/** Metal of the result plate: gold = won, copper = drawn, red = lost (docs/design/CLAUDE.md). */
const OUTCOME = {
  won: { bd: '#E8B64A', fg: '#FFE9A8', from: '#3A2A0A', to: '#17100C' },
  draw: { bd: '#E0895A', fg: '#FFD2B0', from: '#3A1E10', to: '#17100C' },
  lost: { bd: '#E0533F', fg: '#FFC9BF', from: '#3A0E0A', to: '#17100C' },
} as const;

/** Adult look of a finished question duel: outcome plate, coins, a review of every question with both picks, rematch and the way out. */
export function TriviaDuelResultAdult({ ended, you, rivalName, topicNameFa, fee, rematch, busy, note, coinsLabel, onRematch, onBack, onAgain, promo }: { ended: TduelEnded; you: 0 | 1; rivalName: string; topicNameFa: string | null; fee: number; rematch: 'none' | 'asked' | 'sent' | 'expired'; busy: boolean; note: string | null; coinsLabel: string; onRematch: () => void; onBack: () => void; onAgain: () => void; promo?: React.ReactNode }) {
  const outcome = tduelOutcome(ended, you);
  const headline = ended.reason === 'forfeit' ? (outcome === 'won' ? t.forfeitWon : t.forfeitLost) : outcome === 'won' ? t.won : outcome === 'draw' ? t.draw : t.lost;
  const tone = OUTCOME[outcome === 'won' ? 'won' : outcome === 'draw' ? 'draw' : 'lost'];
  const state = (i: number, correct: number, mine: number | null, theirs: number | null): AnswerState => (i === correct ? 'right' : i === mine || i === theirs ? 'wrong' : 'dim');
  return (
    <View style={styles.column}>
      <Plate radius={20} border={tone.bd} from={tone.from} to={tone.to} ledge={5} style={styles.panel}>
        <Text style={[styles.headline, { color: tone.fg }]}>{headline}</Text>
        <Text style={styles.sub}>{rivalName ? `${rivalName} · ` : ''}{t.score(formatPersianNumber(ended.scores[you]), formatPersianNumber(ended.scores[(1 - you) as 0 | 1]))}</Text>
        {topicNameFa ? <View style={styles.chip}><Text style={styles.chipText}>{topicNameFa}</Text></View> : null}
        {fee > 0 || ended.coins !== 0 ? <Text style={[styles.coins, ended.coins > 0 ? styles.won : ended.coins < 0 ? styles.lost : null]}>{coinsLabel}</Text> : null}
      </Plate>

      {ended.round.revealed.length > 0 ? (
        <Plate radius={20} border="#E8B64A" ledge={5} style={styles.panel}>
          <Text style={styles.section}>{t.review}</Text>
          {ended.round.revealed.map((r) => (
            <View key={r.index} style={styles.review}>
              <Text style={styles.question}>{r.textFa}</Text>
              <View style={styles.rows}>
                {r.options.map((o, i) => (
                  <AnswerRow key={i} letter={LETTERS[i] ?? ''} text={o} state={state(i, r.correctIndex, r.yourPick, r.opponentPick)} height={34} mine={r.yourPick === i} theirs={r.opponentPick === i} mineLabel={fa.duel.triviaRound.adult.you} theirsLabel={fa.duel.triviaRound.adult.rival} />
                ))}
              </View>
              {r.yourPick === null ? <Text style={styles.hint}>{t.noAnswer}</Text> : null}
              {r.explanationFa ? <Text style={styles.exText}>{r.explanationFa}</Text> : null}
            </View>
          ))}
        </Plate>
      ) : null}

      {ended.canRematch && rematch !== 'expired' ? (
        rematch === 'sent' ? (
          <Text style={styles.wait}>{t.rematchAsked}</Text>
        ) : (
          <>
            {rematch === 'asked' ? <Text style={styles.wait}>{t.rematchOffered}</Text> : null}
            <BrassButton label={rematch === 'asked' ? t.rematchAccept : t.rematch} tone="copper" disabled={busy} onPress={onRematch} />
          </>
        )
      ) : (
        <Text style={styles.wait}>{ended.reason === 'forfeit' ? t.rematchLeft : t.rematchExpired}</Text>
      )}
      {note ? <Text style={styles.error}>{note}</Text> : null}
      {promo}
      <View style={styles.actions}>
        <View style={styles.flex1}><BrassButton label={t.back} tone="dark" onPress={onBack} /></View>
        <View style={styles.flex14}><BrassButton label={t.again} tone="gold" onPress={onAgain} /></View>
      </View>
    </View>
  );
}

/** «Leave the game?» as an adult plate: a second tap, saying what it costs. */
export function LeaveDialogAdult({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  return (
    <View style={styles.overlay}>
      <View style={styles.dialog}>
        <Plate radius={20} border="#E0533F" ledge={5} style={styles.panel}>
          <Text style={styles.dialogTitle}>{t.leaveTitle}</Text>
          <Text style={styles.dialogBody}>{t.leaveBody}</Text>
          <View style={styles.actions}>
            <View style={styles.flex14}><BrassButton label={t.leaveStay} tone="gold" onPress={onStay} /></View>
            <View style={styles.flex1}><BrassButton label={t.leaveConfirm} tone="copper" onPress={onLeave} /></View>
          </View>
        </Plate>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { direction: 'rtl', width: '100%', maxWidth: 480, gap: 12 },
  panel: { padding: 14, gap: 8 },
  headline: { fontFamily: fonts.display, fontSize: 30, lineHeight: 42, textAlign: 'center' },
  sub: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: 'rgba(255,233,168,0.8)', textAlign: 'center' },
  chip: { alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 99, backgroundColor: '#0E0A08', borderWidth: 1.5, borderColor: '#8A5A16' },
  chipText: { fontFamily: fonts.bold, fontSize: 11, color: '#E8B64A' },
  coins: { alignSelf: 'center', fontFamily: fonts.display, fontSize: 20, lineHeight: 30, color: '#FFE9A8', paddingHorizontal: 14, borderRadius: 99, backgroundColor: '#0E0A08', borderWidth: 1.5, borderColor: '#8A5A16', overflow: 'hidden' },
  won: { color: '#9FE870', borderColor: '#7ED957' },
  lost: { color: '#FF9A8A', borderColor: '#E0533F' },
  section: { fontFamily: fonts.display, fontSize: 18, lineHeight: 28, color: '#E8B64A', textAlign: 'right' },
  review: { gap: 6, paddingTop: 6 },
  question: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 24, color: '#FFE9A8', textAlign: 'right' },
  rows: { gap: 5 },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: 'rgba(255,233,168,0.6)', textAlign: 'right' },
  exText: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 22, color: 'rgba(255,233,168,0.8)', textAlign: 'right' },
  wait: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 21, color: 'rgba(255,233,168,0.75)', textAlign: 'center' },
  error: { fontFamily: fonts.bold, fontSize: 13, color: '#FF9A8A', textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  flex14: { flex: 1.4 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50, elevation: 50 },
  dialog: { direction: 'rtl', width: '100%', maxWidth: 380 },
  dialogTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 32, color: '#FFE9A8', textAlign: 'center' },
  dialogBody: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 23, color: 'rgba(255,233,168,0.8)', textAlign: 'center' },
});
