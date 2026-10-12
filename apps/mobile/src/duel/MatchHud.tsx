import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { solarMonthOf, toPersianDigits } from '@dozari/shared';
import { Character } from '../components/Character';
import { Icon } from '../components/Icon';
import { Item } from '../components/Item';
import { GradientFill } from '../components/GradientFill';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import type { CharacterId } from '../theme/character';
import { EDGE_LEFT, EDGE_RIGHT, TEXT_LEFT } from '../theme/direction';
import { tugPercent } from './arena';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
/** Pips run from the outer edge inwards on both sides. */
const ROW_OUT = Platform.OS === 'web' ? ('row' as const) : ('row-reverse' as const);

type Side = { name: string; who: CharacterId; score: number; groups: number; active: boolean; level?: number; /** 2v2: the teammate's portrait on the card's corner. */ mate?: CharacterId; /** Its next turn will be skipped (the rival used the freeze): an icy tint and a snowflake. */ frozen?: boolean };

/**
 * Score row of screen-match (`13 Match Screens v2`): a blue card for the player and a pink card for the rival (square portrait, name,
 * level chip, four group pips), the score between them, and the tug bar under. The player's card carries the «کل‌کل» badge.
 */
export function MatchHud({ me, rival, onChat, chatOpen = false, chatCooling = false, ofLabel }: { me: Side; rival: Side; /** Small caption under the score (boards won in separate-boards mode); default «از ۴ دسته». */ ofLabel?: string; /** Opens the taunt drawer; no badge when absent. */ onChat?: () => void; chatOpen?: boolean; /** A taunt was just sent: the badge dims until the pause is over. */ chatCooling?: boolean }) {
  return (
    <View>
      <View style={styles.row}>
        <Card side={me} tone="me" onChat={onChat} chatOpen={chatOpen} chatCooling={chatCooling} />
        <View style={styles.mid}>
          <Text style={styles.score}>
            <Text style={{ color: '#8FDCFA' }}>{toPersianDigits(String(me.score))}</Text>
            <Text style={styles.colon}> : </Text>
            <Text style={{ color: '#FF8FB6' }}>{toPersianDigits(String(rival.score))}</Text>
          </Text>
          <Text style={styles.of}>{ofLabel ?? fa.duel.arena.ofFour}</Text>
        </View>
        <Card side={rival} tone="rival" />
      </View>
      <View style={styles.bar}>
        <View style={[styles.mine, { width: `${tugPercent(me.groups, rival.groups)}%` }]}>
          <GradientFill from="#8FDCFA" to={colors.candy.sky} />
        </View>
        <View style={[styles.seam, { [EDGE_RIGHT]: `${tugPercent(me.groups, rival.groups)}%` }]} />
      </View>
    </View>
  );
}

function Card({ side, tone, onChat, chatOpen = false, chatCooling = false }: { side: Side; tone: 'me' | 'rival'; onChat?: () => void; chatOpen?: boolean; chatCooling?: boolean }) {
  const mine = tone === 'me';
  const base = mine ? colors.candy.sky : colors.candy.pink;
  return (
    <View style={[styles.card, mine ? styles.cardMe : styles.cardRival, side.active ? styles.cardActive : null]}>
      {/* Clipped to the card's inner corner radius, so the square gradient never pokes out past the rounded frame. */}
      <View style={styles.fillClip} pointerEvents="none"><GradientFill from={mine ? '#3A86C8' : '#D04A82'} to={mine ? '#1F5A96' : '#94245A'} /></View>
      <View style={[styles.cardRow, mine ? null : styles.cardRowRival]}>
        <View style={[styles.face, { backgroundColor: base }]}>
          <View style={[styles.faceIn, mine ? null : styles.flip]}>
            <Character who={side.who} pose="idle" crop="face" month={side.who === 'dozari' ? solarMonthOf(Date.now()) : undefined} />
          </View>
        </View>
        {side.mate ? (
          <View style={[styles.mate, { [mine ? EDGE_RIGHT : EDGE_LEFT]: 30, backgroundColor: mine ? '#8FDCFA' : '#FF8FB6' }]}>
            <View style={[styles.mateIn, mine ? null : styles.flip]}><Character who={side.mate} pose="idle" crop="face" /></View>
          </View>
        ) : null}
        <View style={[styles.info, mine ? null : styles.infoRival]}>
          <View style={[styles.nameRow, mine ? null : styles.nameRowRival]}>
            <Text style={[styles.name, mine ? null : styles.nameRival]} numberOfLines={1}>{side.name}</Text>
            {side.level ? <View style={styles.lv}><Text style={styles.lvText}>{toPersianDigits(String(side.level))}</Text></View> : null}
          </View>
          <View style={[styles.pips, { flexDirection: mine ? ROW : ROW_OUT }]}>
            {[0, 1, 2, 3].map((i) => <View key={i} style={[styles.pip, { backgroundColor: i < side.groups ? base : 'rgba(255,255,255,0.15)' }]} />)}
          </View>
        </View>
      </View>
      {side.frozen ? <View style={styles.ice} pointerEvents="none" /> : null}
      {side.frozen ? <View style={[styles.flake, { [mine ? EDGE_RIGHT : EDGE_LEFT]: -8 }]} pointerEvents="none"><Item icon="freeze" /></View> : null}
      {mine && onChat ? <ChatBadge onPress={onChat} open={chatOpen} cooling={chatCooling} /> : null}
    </View>
  );
}

function ChatBadge({ onPress, open, cooling }: { onPress: () => void; open: boolean; cooling: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={fa.duel.chat.badge} onPress={onPress} style={({ pressed }) => [styles.badge, open ? styles.badgeOpen : null, cooling ? styles.badgeCool : null, pressed ? styles.badgePressed : null]}>
      <Icon name="chat" size={16} color={colors.ink} strokeWidth={2.4} />
    </Pressable>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  row: { flexDirection: ROW, alignItems: 'center', gap: 6 },
  card: { flex: 1, minWidth: 0, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, padding: 5, ...lift(4) },
  cardMe: {},
  cardRival: {},
  cardActive: { borderColor: colors.candy.yellow },
  cardRow: { flexDirection: ROW, alignItems: 'center', gap: 7 },
  /** The rival's card is the player's mirrored: portrait on the left edge, name and pips running from it. */
  cardRowRival: { flexDirection: ROW_OUT },
  face: { width: 46, height: 46, borderRadius: 14, borderWidth: 2.5, borderColor: colors.cream, overflow: 'hidden' },
  faceIn: { position: 'absolute', top: -3, left: -3, right: -3, bottom: -3 },
  flip: { transform: [{ scaleX: -1 }] },
  mate: { position: 'absolute', top: 30, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.cream, overflow: 'hidden' },
  mateIn: { position: 'absolute', top: -2, left: -2, right: -2, bottom: -2 },
  info: { flex: 1, minWidth: 0, gap: 4, alignItems: Platform.OS === 'web' ? 'flex-end' : 'flex-start' },
  infoRival: { alignItems: Platform.OS === 'web' ? 'flex-start' : 'flex-end' },
  nameRowRival: { flexDirection: ROW_OUT },
  nameRival: { textAlign: TEXT_LEFT },
  nameRow: { flexDirection: ROW, alignItems: 'center', gap: 4, maxWidth: '100%' },
  name: { flexShrink: 1, fontFamily: fonts.display, fontSize: 15, lineHeight: 22, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 },
  lv: { height: 16, paddingHorizontal: 4, borderRadius: 5, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  lvText: { fontFamily: fonts.display, fontSize: 11, lineHeight: 16, color: colors.candy.yellow },
  pips: { gap: 3 },
  pip: { width: 11, height: 11, borderRadius: 3, borderWidth: 2, borderColor: colors.ink },
  fillClip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 15, overflow: 'hidden' },
  ice: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 15, backgroundColor: 'rgba(190,235,255,0.38)' },
  flake: { position: 'absolute', top: -10, width: 26, height: 26, zIndex: 4 },
  mid: { alignItems: 'center' },
  score: { fontFamily: fonts.display, fontSize: 28, lineHeight: 36, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0, writingDirection: 'rtl' },
  colon: { fontSize: 16, color: 'rgba(255,246,232,0.6)' },
  of: { fontFamily: fonts.bold, fontSize: 10, color: 'rgba(255,246,232,0.75)' },
  bar: { marginTop: 16, height: 9, borderRadius: 99, borderWidth: 2, borderColor: colors.ink, overflow: 'hidden', backgroundColor: colors.candy.pink },
  mine: { position: 'absolute', top: 0, bottom: 0, [EDGE_RIGHT]: 0, overflow: 'hidden' },
  seam: { position: 'absolute', top: 0, bottom: 0, width: 3, marginHorizontal: -1.5, backgroundColor: colors.candy.yellow },
  badge: { position: 'absolute', bottom: -11, [EDGE_RIGHT]: -7, width: 30, height: 30, borderRadius: 15, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', zIndex: 3, ...lift(3) },
  badgeOpen: { backgroundColor: colors.candy.yellow },
  badgeCool: { opacity: 0.55 },
  badgePressed: { transform: [{ translateY: 2 }] },
});
