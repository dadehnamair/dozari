import { Platform, StyleSheet, Text, View } from 'react-native';
import { solarMonthOf, toPersianDigits } from '@dozari/shared';
import { Character } from '../components/Character';
import { colors, fonts } from '../theme/colors';
import type { CharacterId } from '../theme/character';
import { tugPercent } from './arena';

const ROW = ('row-reverse' as const);
/** Pips run from the outer edge inwards on both sides. */
const ROW_OUT = Platform.OS === 'web' ? ('row' as const) : ('row-reverse' as const);

type Side = { name: string; who: CharacterId; score: number; groups: number; active: boolean };

/** Score panel of screen-match: face, name, four group pips per side, «امتیاز : امتیاز», and the blue/pink tug bar. */
export function MatchHud({ me, rival }: { me: Side; rival: Side }) {
  return (
    <View style={styles.panel}>
      <View style={styles.row}>
        <Face who={me.who} tint={colors.candy.sky} active={me.active} />
        <View style={styles.side}>
          <Text style={[styles.name, { color: '#8FDCFA' }]} numberOfLines={1}>{me.name}</Text>
          <Pips n={me.groups} color={colors.candy.sky} dir={ROW} />
        </View>
        <Text style={styles.score}>
          <Text style={{ color: '#8FDCFA' }}>{toPersianDigits(String(me.score))}</Text>
          <Text style={styles.colon}> : </Text>
          <Text style={{ color: '#FF8FB6' }}>{toPersianDigits(String(rival.score))}</Text>
        </Text>
        <View style={[styles.side, styles.sideEnd]}>
          <Text style={[styles.name, { color: '#FF8FB6' }]} numberOfLines={1}>{rival.name}</Text>
          <Pips n={rival.groups} color={colors.candy.pink} dir={ROW_OUT} />
        </View>
        <Face who={rival.who} tint={colors.candy.pink} active={rival.active} flip />
      </View>
      <View style={styles.bar}>
        <View style={[styles.mine, { width: `${tugPercent(me.groups, rival.groups)}%` }]} />
        <View style={styles.gloss} />
      </View>
    </View>
  );
}

function Face({ who, tint, active, flip = false }: { who: CharacterId; tint: string; active: boolean; flip?: boolean }) {
  return (
    <View style={[styles.face, { backgroundColor: tint }, active ? styles.faceActive : null]}>
      <View style={[styles.faceIn, flip ? styles.flip : null]}>
        <Character who={who} pose="idle" crop="face" month={who === 'dozari' ? solarMonthOf(Date.now()) : undefined} />
      </View>
    </View>
  );
}

function Pips({ n, color, dir }: { n: number; color: string; dir: 'row' | 'row-reverse' }) {
  return (
    <View style={[styles.pips, { flexDirection: dir }]}>
      {[0, 1, 2, 3].map((i) => <View key={i} style={[styles.pip, { backgroundColor: i < n ? color : 'rgba(255,255,255,0.15)' }]} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { paddingTop: 8, paddingBottom: 10, paddingHorizontal: 10, borderRadius: 20, backgroundColor: 'rgba(26,8,44,0.78)', borderWidth: 3, borderColor: colors.ink, gap: 8, shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  row: { flexDirection: ROW, alignItems: 'center', gap: 6 },
  side: { flex: 1, minWidth: 0, gap: 3, alignItems: Platform.OS === 'web' ? 'flex-end' : 'flex-start' },
  sideEnd: { alignItems: Platform.OS === 'web' ? 'flex-start' : 'flex-end' },
  name: { fontFamily: fonts.display, fontSize: 15, lineHeight: 20 },
  score: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1, writingDirection: 'rtl' },
  colon: { fontSize: 16, color: 'rgba(255,255,255,0.6)' },
  face: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: colors.cream, overflow: 'hidden' },
  faceActive: { borderColor: colors.candy.yellow },
  faceIn: { position: 'absolute', top: -2, left: -2, right: -2, bottom: -2 },
  flip: { transform: [{ scaleX: -1 }] },
  pips: { gap: 3 },
  pip: { width: 14, height: 14, borderRadius: 4, borderWidth: 2, borderColor: colors.ink },
  bar: { height: 14, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink, overflow: 'hidden', backgroundColor: colors.candy.pink },
  mine: { position: 'absolute', top: 0, bottom: 0, [Platform.OS === 'web' ? 'right' : 'left']: 0, backgroundColor: colors.candy.sky },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: 5, backgroundColor: 'rgba(255,255,255,0.4)' },
});
