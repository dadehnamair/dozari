import { Pressable, StyleSheet, Text, View } from 'react-native';
import { solarMonthOf, toPersianDigits } from '@dozari/shared';
import { Character } from '../components/Character';
import { Icon } from '../components/Icon';
import { Item } from '../components/Item';
import { fa } from '../i18n/fa';
import { fonts } from '../theme/colors';
import type { CharacterId } from '../theme/character';
import { Plate } from './adultKit';
import { tugPercent } from './arena';

type Side = { name: string; who: CharacterId; score: number; groups: number; active: boolean; level?: number; mate?: CharacterId; frozen?: boolean };

/**
 * Adult look of the board duel's score row («صرافی و گاوصندوق»): the player's plate (gold frame) on the right, the rival's (copper) on the
 * left, the score between them and the tug bar under. The side whose turn it is lights its frame.
 */
export function MatchHudAdult({ me, rival, onChat, chatOpen = false, chatCooling = false, ofLabel }: { me: Side; rival: Side; ofLabel?: string; onChat?: () => void; chatOpen?: boolean; chatCooling?: boolean }) {
  const pct = tugPercent(me.groups, rival.groups);
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <SideCard side={me} mine onChat={onChat} chatOpen={chatOpen} chatCooling={chatCooling} />
        <View style={styles.mid}>
          <Text style={styles.score}>
            <Text style={{ color: '#FFE9A8' }}>{toPersianDigits(String(me.score))}</Text>
            <Text style={styles.colon}> : </Text>
            <Text style={{ color: '#FFD2B0' }}>{toPersianDigits(String(rival.score))}</Text>
          </Text>
          <Text style={styles.of}>{ofLabel ?? fa.duel.arena.ofFour}</Text>
        </View>
        <SideCard side={rival} mine={false} />
      </View>
      <View style={styles.bar}>
        <View style={[styles.barMine, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

function SideCard({ side, mine, onChat, chatOpen, chatCooling }: { side: Side; mine: boolean; onChat?: () => void; chatOpen?: boolean; chatCooling?: boolean }) {
  const tone = mine ? '#E8B64A' : '#E0895A';
  return (
    <View style={styles.cardWrap}>
      <Plate radius={16} border={side.active ? '#FFF1B8' : tone} ledge={3} glow={side.active ? tone : undefined} style={[styles.card, mine ? null : styles.cardRival]}>
        <View style={[styles.face, { borderColor: tone }]}>
          <View style={[styles.faceIn, mine ? null : styles.flip]}>
            <Character who={side.who} pose="idle" crop="face" month={side.who === 'dozari' ? solarMonthOf(Date.now()) : undefined} />
          </View>
        </View>
        <View style={[styles.info, mine ? null : styles.infoRival]}>
          <View style={[styles.nameRow, mine ? null : styles.nameRowRival]}>
            <Text style={styles.name} numberOfLines={1}>{side.name}</Text>
            {side.level ? <View style={styles.lv}><Text style={styles.lvText}>{toPersianDigits(String(side.level))}</Text></View> : null}
          </View>
          <View style={[styles.pips, mine ? null : styles.pipsRival]}>
            {[0, 1, 2, 3].map((i) => <View key={i} style={[styles.pip, { backgroundColor: i < side.groups ? tone : '#2A1E16' }]} />)}
          </View>
        </View>
        {side.frozen ? <View style={styles.ice} pointerEvents="none" /> : null}
      </Plate>
      {side.frozen ? <View style={[styles.flake, mine ? { right: -6 } : { left: -6 }]} pointerEvents="none"><Item icon="freeze" /></View> : null}
      {mine && onChat ? (
        <Pressable accessibilityRole="button" accessibilityLabel={fa.duel.chat.badge} onPress={onChat} style={({ pressed }) => [styles.badge, chatOpen ? styles.badgeOpen : null, chatCooling ? styles.badgeCool : null, pressed ? styles.badgePressed : null]}>
          <Icon name="chat" size={16} color="#2A1606" strokeWidth={2.4} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { direction: 'rtl' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardWrap: { flex: 1, minWidth: 0 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 5 },
  cardRival: { flexDirection: 'row-reverse' },
  face: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, backgroundColor: '#17100C', overflow: 'hidden' },
  faceIn: { position: 'absolute', top: -3, left: -3, right: -3, bottom: -3 },
  flip: { transform: [{ scaleX: -1 }] },
  info: { flex: 1, minWidth: 0, gap: 4, alignItems: 'flex-start' },
  infoRival: { alignItems: 'flex-end' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  nameRowRival: { flexDirection: 'row-reverse' },
  name: { flexShrink: 1, fontFamily: fonts.display, fontSize: 14, lineHeight: 22, color: '#FFE9A8' },
  lv: { height: 16, paddingHorizontal: 4, borderRadius: 5, backgroundColor: '#0E0A08', borderWidth: 1, borderColor: '#8A5A16', alignItems: 'center', justifyContent: 'center' },
  lvText: { fontFamily: fonts.display, fontSize: 11, lineHeight: 15, color: '#E8B64A' },
  pips: { flexDirection: 'row', gap: 3 },
  pipsRival: { flexDirection: 'row-reverse' },
  pip: { width: 11, height: 11, borderRadius: 3, borderWidth: 1.5, borderColor: '#000' },
  ice: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(190,235,255,0.3)' },
  flake: { position: 'absolute', top: -10, width: 26, height: 26, zIndex: 4 },
  mid: { alignItems: 'center' },
  score: { fontFamily: fonts.display, fontSize: 28, lineHeight: 40, writingDirection: 'rtl' },
  colon: { fontSize: 16, color: 'rgba(255,233,168,0.6)' },
  of: { fontFamily: fonts.bold, fontSize: 10, color: 'rgba(255,233,168,0.65)' },
  bar: { marginTop: 14, height: 9, borderRadius: 99, borderWidth: 2, borderColor: '#000', overflow: 'hidden', backgroundColor: '#E0895A', flexDirection: 'row' },
  barMine: { height: '100%', backgroundColor: '#E8B64A' },
  badge: { position: 'absolute', bottom: -11, right: -7, width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#000', backgroundColor: '#E8B64A', alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  badgeOpen: { backgroundColor: '#FFD2B0' },
  badgeCool: { opacity: 0.55 },
  badgePressed: { transform: [{ translateY: 2 }] },
});
