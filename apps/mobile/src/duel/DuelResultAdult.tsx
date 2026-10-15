import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PRICE_GUESS_ROUND_POINTS, solarMonthOf, toPersianDigits } from '@dozari/shared';
import type { PriceRoundView, TriviaRoundView } from '@dozari/shared';
import { Character } from '../components/Character';
import { Item } from '../components/Item';
import { fa } from '../i18n/fa';
import { priceText } from '../solo/priceRound';
import { fonts } from '../theme/colors';
import type { CharacterId } from '../theme/character';
import { nativeTopInset } from '../theme/safeArea';
import { AdultBackdrop, BrassButton, Plate } from './adultKit';

const a = fa.duel.arena;

type Outcome = 'won' | 'lost' | 'draw';
export type ResultLine = { name: string; who: CharacterId; groups: number; points: number; me: boolean; playerId?: string; reportable?: { id: string; name: string }[] };

/** Metal of the banner: gold = won, copper = drawn, red = lost (docs/design/CLAUDE.md). */
const LOOK: Record<Outcome, { title: string; sub: string; pose: 'win' | 'sad' | 'thinking'; bd: string; from: string; to: string; fg: string; again: string }> = {
  won: { title: fa.duel.won, sub: a.winSub, pose: 'win', bd: '#E8B64A', from: '#5A4A1A', to: '#2A200A', fg: '#FFF1B8', again: a.againWin },
  lost: { title: fa.duel.lost, sub: a.loseSub, pose: 'sad', bd: '#E0533F', from: '#4A1610', to: '#2A0A06', fg: '#FFC9BF', again: a.againLose },
  draw: { title: fa.duel.draw, sub: a.drawSub, pose: 'thinking', bd: '#E0895A', from: '#4A2A18', to: '#2A140A', fg: '#FFD2B0', again: a.againDraw },
};

/** Adult look of the board duel's result («صرافی و گاوصندوق»): hero, outcome banner, scoreboard plate, the price / question round summaries and the way out. */
export function DuelResultAdult({ outcome, reason, lines, priceRound, triviaRound, onHome, onAgain, againLabel, onInvite, onPlayer, onReport }: { outcome: Outcome; reason: string; lines: ResultLine[]; priceRound?: PriceRoundView; triviaRound?: TriviaRoundView; onHome: () => void; onAgain?: () => void; againLabel?: string; onInvite?: () => void; onPlayer?: (id: string) => void; onReport?: (id: string) => void }) {
  const look = LOOK[outcome];
  const sorted = [...lines].sort((x, y) => y.points - x.points);
  return (
    <AdultBackdrop>
      <View style={styles.column}>
        <View style={styles.hero}><Character pose={look.pose} month={solarMonthOf(Date.now())} /></View>
        <Plate radius={18} border={look.bd} from={look.from} to={look.to} ledge={5} style={styles.banner}>
          <Text style={[styles.bannerText, { color: look.fg }]}>{look.title}</Text>
        </Plate>
        <Text style={styles.sub}>{reason || look.sub}</Text>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollIn} showsVerticalScrollIndicator={false}>
          <Plate radius={20} border="#E8B64A" ledge={5}>
            <View style={styles.head}>
              <Text style={[styles.headText, styles.grow]}>{a.player}</Text>
              <Text style={[styles.headText, styles.cell]}>{a.groups}</Text>
              <Text style={[styles.headText, styles.cell]}>{a.points}</Text>
            </View>
            {sorted.map((l, i) => (
              <Pressable key={l.name + i} disabled={!l.playerId || !onPlayer} onPress={() => l.playerId && onPlayer?.(l.playerId)} accessibilityRole={l.playerId ? 'button' : undefined} accessibilityLabel={l.name} style={[styles.line, l.me ? styles.lineMe : null]}>
                <View style={[styles.face, { borderColor: l.me ? '#E8B64A' : '#E0895A' }]}>
                  <View style={[styles.faceIn, l.me ? null : styles.flip]}><Character who={l.who} pose="idle" crop="face" month={l.who === 'dozari' ? solarMonthOf(Date.now()) : undefined} /></View>
                </View>
                <View style={[styles.grow, styles.nameRow]}>
                  <Text style={styles.name} numberOfLines={1}>{l.name}</Text>
                  {i === 0 && l.points > 0 && sorted[1]?.points !== l.points ? <View style={styles.crown}><Item icon="crown" /></View> : null}
                </View>
                {onReport ? l.reportable?.map((r) => (
                  <Pressable key={r.id} onPress={() => onReport(r.id)} accessibilityRole="button" hitSlop={8}><Text style={styles.report}>{l.reportable && l.reportable.length > 1 ? `${fa.feedback.report.short} ${r.name}` : fa.feedback.report.short}</Text></Pressable>
                )) : null}
                <Text style={[styles.num, styles.cell]}>{toPersianDigits(String(l.groups))}</Text>
                <Text style={[styles.num, styles.cell, styles.pts]}>{toPersianDigits(String(l.points))}</Text>
              </Pressable>
            ))}
          </Plate>

          {priceRound && priceRound.revealed.length > 0 ? (
            <Plate radius={16} border="#C9D1D9" ledge={4} style={styles.box}>
              <Text style={styles.boxTitle}>{fa.duel.price.resultTitle}</Text>
              {priceRound.revealed.map((r) => (
                <Text key={r.index} style={styles.boxLine} numberOfLines={1}>
                  {r.winner === 'you' ? '✔' : r.winner === 'opponent' ? '✘' : '＝'} {r.nameFa} · {fa.duel.price.actual}: {priceText(r.actualRials)}
                  {r.winner === 'draw' ? '' : ` · ${r.winner === 'you' ? '+' : '−'}${toPersianDigits(String(PRICE_GUESS_ROUND_POINTS))}`}
                </Text>
              ))}
              <Text style={styles.boxSum}>
                {fa.duel.price.earned(
                  toPersianDigits(String(priceRound.revealed.filter((r) => r.winner === 'you').length * PRICE_GUESS_ROUND_POINTS)),
                  toPersianDigits(String(priceRound.revealed.filter((r) => r.winner === 'opponent').length * PRICE_GUESS_ROUND_POINTS)),
                )}
              </Text>
            </Plate>
          ) : null}
          {triviaRound && triviaRound.revealed.length > 0 ? (
            <Plate radius={16} border="#E0895A" ledge={4} style={styles.box}>
              <Text style={styles.boxTitle}>{fa.duel.triviaRound.resultTitle}</Text>
              <Text style={styles.boxSum}>
                {fa.duel.triviaRound.earned(
                  toPersianDigits(String(triviaRound.revealed.filter((r) => r.yourPick === r.correctIndex).length)),
                  toPersianDigits(String(triviaRound.revealed.filter((r) => r.opponentPick === r.correctIndex).length)),
                )}
              </Text>
            </Plate>
          ) : null}
        </ScrollView>

        <View style={styles.spacer} />
        <View style={styles.actions}>
          <View style={styles.flex1}><BrassButton label={a.home} tone="dark" height={52} onPress={onHome} /></View>
          {onInvite ? <View style={styles.flex1}><BrassButton label={a.invite} tone="copper" height={52} onPress={onInvite} /></View> : null}
          {onAgain ? <View style={styles.flex16}><BrassButton label={againLabel ?? look.again} tone="gold" height={52} onPress={onAgain} /></View> : null}
        </View>
      </View>
    </AdultBackdrop>
  );
}

const styles = StyleSheet.create({
  column: { direction: 'rtl', flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 12, paddingTop: 28 + nativeTopInset(), paddingBottom: 28, alignItems: 'stretch', gap: 8 },
  scroll: { flexShrink: 1, flexGrow: 0, minHeight: 0 },
  scrollIn: { gap: 10, paddingBottom: 6 },
  hero: { width: 140, height: 162, alignSelf: 'center' },
  banner: { alignSelf: 'center', paddingHorizontal: 30, paddingVertical: 2 },
  bannerText: { fontFamily: fonts.display, fontSize: 32, lineHeight: 46, textAlign: 'center' },
  sub: { fontFamily: fonts.bold, fontSize: 13, color: 'rgba(255,233,168,0.8)', textAlign: 'center' },
  head: { height: 30, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8, backgroundColor: '#0E0A08' },
  headText: { fontFamily: fonts.bold, fontSize: 11, color: 'rgba(255,233,168,0.7)', textAlign: 'right' },
  report: { fontFamily: fonts.bold, fontSize: 12, color: 'rgba(255,233,168,0.55)', textDecorationLine: 'underline' },
  grow: { flex: 1, minWidth: 0 },
  cell: { width: 50, textAlign: 'center' },
  line: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderTopWidth: 1.5, borderColor: 'rgba(232,182,74,0.28)' },
  lineMe: { backgroundColor: 'rgba(232,182,74,0.14)' },
  face: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, backgroundColor: '#17100C', overflow: 'hidden' },
  faceIn: { position: 'absolute', top: -2, left: -2, right: -2, bottom: -2 },
  flip: { transform: [{ scaleX: -1 }] },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontFamily: fonts.display, fontSize: 18, lineHeight: 28, color: '#FFE9A8', flexShrink: 1 },
  crown: { width: 22, height: 22 },
  num: { fontFamily: fonts.display, fontSize: 18, lineHeight: 28, color: '#FFE9A8' },
  pts: { color: '#FFD2B0' },
  box: { padding: 10, gap: 2 },
  boxTitle: { fontFamily: fonts.display, fontSize: 16, lineHeight: 26, color: '#E8B64A', textAlign: 'center' },
  boxSum: { marginTop: 4, fontFamily: fonts.display, fontSize: 13, lineHeight: 22, color: '#9FE870', textAlign: 'center' },
  boxLine: { fontFamily: fonts.bold, fontSize: 12, color: '#FFE9A8', textAlign: 'right' },
  spacer: { flex: 1, minHeight: 12 },
  actions: { flexDirection: 'row', gap: 9 },
  flex1: { flex: 1 },
  flex16: { flex: 1.6 },
});
