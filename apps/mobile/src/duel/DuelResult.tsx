import { Platform, StyleSheet, Text, View } from 'react-native';
import { solarMonthOf, toPersianDigits } from '@dozari/shared';
import { Character } from '../components/Character';
import { GradientFill } from '../components/GradientFill';
import { Item } from '../components/Item';
import { Scene } from '../components/Scene';
import { SlabButton } from '../components/SlabButton';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import type { CharacterId } from '../theme/character';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const a = fa.duel.arena;

type Outcome = 'won' | 'lost' | 'draw';
type Line = { name: string; who: CharacterId; groups: number; points: number; me: boolean };

const LOOK: Record<Outcome, { title: string; sub: string; pose: 'win' | 'sad' | 'thinking'; ban: [string, string]; again: string; againColor: string }> = {
  won: { title: fa.duel.won, sub: a.winSub, pose: 'win', ban: ['#FFE48A', colors.candy.yellow], again: a.againWin, againColor: colors.candy.pink },
  lost: { title: fa.duel.lost, sub: a.loseSub, pose: 'sad', ban: ['#D4E0FA', '#B0C4EF'], again: a.againLose, againColor: colors.candy.pink },
  draw: { title: fa.duel.draw, sub: a.drawSub, pose: 'thinking', ban: ['#E3CCFF', '#C9A3FF'], again: a.againDraw, againColor: colors.candy.pink },
};

/** screen-results of `13 Match Screens`: the hero's pose, a banner, why it ended, the scoreboard, home / play again. */
export function DuelResult({ outcome, reason, lines, onHome, onAgain }: { outcome: Outcome; reason: string; lines: Line[]; onHome: () => void; onAgain?: () => void }) {
  const look = LOOK[outcome];
  const sorted = [...lines].sort((x, y) => y.points - x.points);
  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}><Scene scene="win" /></View>
      <View style={[StyleSheet.absoluteFill, styles.shade]} />
      <View style={styles.column}>
        <View style={styles.hero}><Character pose={look.pose} month={solarMonthOf(Date.now())} /></View>
        <View style={styles.banner}>
          <GradientFill from={look.ban[0]} to={look.ban[1]} />
          <Text style={styles.bannerText}>{look.title}</Text>
        </View>
        <Text style={styles.sub}>{reason || look.sub}</Text>

        <View style={styles.board}>
          <View style={styles.head}>
            <Text style={[styles.headText, styles.grow]}>{a.player}</Text>
            <Text style={[styles.headText, styles.cell]}>{a.groups}</Text>
            <Text style={[styles.headText, styles.cell]}>{a.points}</Text>
          </View>
          {sorted.map((l, i) => (
            <View key={l.name + i} style={[styles.line, l.me ? styles.lineMe : null]}>
              <View style={[styles.stripe, { backgroundColor: l.me ? colors.candy.sky : colors.candy.pink }]} />
              <View style={[styles.face, { backgroundColor: l.me ? colors.candy.sky : colors.candy.pink }]}>
                <View style={[styles.faceIn, l.me ? null : styles.flip]}><Character who={l.who} pose="idle" crop="face" month={l.who === 'dozari' ? solarMonthOf(Date.now()) : undefined} /></View>
              </View>
              <View style={[styles.grow, styles.nameRow]}>
                <Text style={styles.name} numberOfLines={1}>{l.name}</Text>
                {i === 0 && l.points > 0 && sorted[1]?.points !== l.points ? <View style={styles.crown}><Item icon="crown" /></View> : null}
              </View>
              <Text style={[styles.num, styles.cell]}>{toPersianDigits(String(l.groups))}</Text>
              <Text style={[styles.num, styles.cell, styles.pts]}>{toPersianDigits(String(l.points))}</Text>
            </View>
          ))}
        </View>

        <View style={styles.spacer} />
        <View style={styles.actions}>
          <SlabButton label={a.home} color={colors.candy.sky} height={58} fontSize={20} onPress={onHome} />
          {onAgain ? <SlabButton label={look.again} color={look.againColor} height={58} fontSize={24} grow={1.6} onPress={onAgain} /> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#3C1A66' },
  shade: { backgroundColor: 'rgba(43,18,64,0.55)' },
  column: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 12, paddingTop: 28, paddingBottom: 28, alignItems: 'stretch', gap: 8 },
  hero: { width: 140, height: 162, alignSelf: 'center' },
  banner: { alignSelf: 'center', paddingHorizontal: 30, paddingVertical: 6, borderRadius: 18, borderWidth: 4, borderColor: colors.ink, overflow: 'hidden', shadowColor: colors.ink, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6 },
  bannerText: { fontFamily: fonts.display, fontSize: 32, lineHeight: 44, color: colors.ink },
  sub: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream, textAlign: 'center' },
  board: { marginTop: 10, borderRadius: 20, backgroundColor: '#FBF1DE', borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', shadowColor: colors.ink, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 0, elevation: 5 },
  head: { height: 30, flexDirection: ROW, alignItems: 'center', paddingHorizontal: 12, gap: 8, backgroundColor: colors.ink },
  headText: { fontFamily: fonts.bold, fontSize: 11, color: 'rgba(255,246,232,0.75)', textAlign: 'right' },
  grow: { flex: 1, minWidth: 0 },
  cell: { width: 50, textAlign: 'center' },
  line: { height: 46, flexDirection: ROW, alignItems: 'center', gap: 8, paddingHorizontal: 10, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(43,18,64,0.2)' },
  lineMe: { backgroundColor: 'rgba(255,201,60,0.25)' },
  stripe: { width: 6, alignSelf: 'stretch', marginVertical: 8, borderRadius: 3 },
  face: { width: 34, height: 34, borderRadius: 17, borderWidth: 2.5, borderColor: colors.ink, overflow: 'hidden' },
  faceIn: { position: 'absolute', top: -2, left: -2, right: -2, bottom: -2 },
  flip: { transform: [{ scaleX: -1 }] },
  nameRow: { flexDirection: ROW, alignItems: 'center', gap: 4 },
  name: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, flexShrink: 1 },
  crown: { width: 22, height: 22 },
  num: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  pts: { color: '#7E46D6' },
  spacer: { flex: 1, minHeight: 12 },
  actions: { flexDirection: ROW, gap: 9 },
});
