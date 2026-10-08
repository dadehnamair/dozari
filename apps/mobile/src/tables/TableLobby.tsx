import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TableView } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { Item } from '../components/Item';
import { fa } from '../i18n/fa';
import { avatarOf } from '../social/avatarOf';
import { colors, fonts } from '../theme/colors';
import { DARK } from '../theme/skin';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const INK = '#3A2418';
const t = fa.tables.lobby;

/**
 * Who plays whom at a table: two team cards face to face with a VS coin between them. The caller's team is blue and first,
 * the rival team pink; empty seats say who is awaited, and in a 2v2 an empty seat of the other team is a button to sit there.
 */
export function TableLobby({ table, dark = false, onSit, onKick }: { table: TableView; /** The adult look: dark team cards in a gold frame with light text. */ dark?: boolean; onSit: (side: 0 | 1) => void; onKick: (userId: string) => void }) {
  const me = table.players.find((p) => p.isYou);
  const mySide = me?.side ?? 0;
  const perTeam = table.seats / 2;
  const order: (0 | 1)[] = [mySide, mySide === 0 ? 1 : 0];
  const team = table.format === '2v2';
  const ink = dark ? DARK.text : INK;
  const frame = dark ? DARK.frame : INK;
  return (
    <View style={styles.wrap} accessibilityLabel={t.vs}>
      <View style={styles.row}>
        {order.map((side, idx) => {
          const mine = me ? side === mySide : idx === 0;
          const players = table.players.filter((p) => p.side === side);
          const tone = mine ? colors.candy.sky : colors.candy.pink;
          return (
            <View key={side} style={[styles.card, { borderColor: frame, backgroundColor: dark ? DARK.raised : mine ? '#E4F6FD' : '#FFE6EF' }]}>
              <View style={[styles.head, { backgroundColor: dark ? (mine ? '#1F5E7A' : '#7A2B4A') : tone, borderColor: frame }]}>
                <Text style={styles.headText}>{me ? (mine ? t.yourTeam : t.rivalTeam) : fa.tables.team(side + 1)}</Text>
              </View>
              {Array.from({ length: perTeam }, (_, i) => {
                const p = players[i];
                if (!p) {
                  const canSit = team && !table.inMatch && !!me && side !== mySide;
                  return canSit ? (
                    <Pressable key={`e${i}`} onPress={() => onSit(side)} style={[styles.seat, styles.empty]} accessibilityRole="button" accessibilityLabel={t.sitHere}>
                      <View style={[styles.ghost, { borderColor: frame }, dark ? { backgroundColor: DARK.field } : null]}><Text style={[styles.plus, { color: ink }]}>+</Text></View>
                      <Text style={[styles.sitText, dark ? { color: DARK.frame } : null]}>{t.sitHere}</Text>
                    </Pressable>
                  ) : (
                    <View key={`e${i}`} style={[styles.seat, styles.empty]}>
                      <View style={[styles.ghost, { borderColor: frame }, dark ? { backgroundColor: DARK.field } : null]}><Text style={[styles.plus, { color: ink }]}>؟</Text></View>
                      <Text style={[styles.waitText, { color: ink }]}>{mine ? t.waitMate : t.waitRival}</Text>
                    </View>
                  );
                }
                return (
                  <View key={p.id} style={[styles.seat, p.isYou ? styles.seatYou : null]}>
                    <View>
                      <Avatar avatar={avatarOf(p.avatarKey)} size={46} />
                      {p.isHost ? <View style={styles.crown}><Item icon="crown" /></View> : null}
                    </View>
                    <Text style={[styles.name, { color: ink }]} numberOfLines={1}>{p.isYou ? `${p.nickname} (${t.you})` : p.nickname}</Text>
                    <Text style={[styles.state, { color: ink }, p.ready || p.isHost ? [styles.stateOk, dark ? { color: '#8EE6A0' } : null] : null]}>{p.isHost ? fa.tables.host : p.ready ? `✓ ${fa.tables.ready}` : t.notYet}</Text>
                    {table.youAreHost && !p.isHost && !table.inMatch ? (
                      <Pressable onPress={() => onKick(p.id)} style={styles.kick} accessibilityRole="button"><Text style={styles.kickText}>{fa.tables.kick}</Text></Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          );
        })}
        <View style={[styles.vs, dark ? { borderColor: DARK.frame } : null]} pointerEvents="none"><Text style={styles.vsText}>{t.vs}</Text></View>
      </View>
      <Text style={[styles.count, { color: ink }]}>{fa.tables.seats(table.players.length, table.seats)}{team ? ` · ${t.perTeam}` : ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: ROW, gap: 10, alignItems: 'stretch' },
  card: { flex: 1, minWidth: 0, borderWidth: 3, borderRadius: 18, overflow: 'hidden', paddingBottom: 6, gap: 6 },
  head: { paddingVertical: 4, alignItems: 'center', borderBottomWidth: 3, borderColor: INK },
  headText: { fontFamily: fonts.display, fontSize: 15, color: '#fff', textShadowColor: INK, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  seat: { alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 4 },
  seatYou: { backgroundColor: 'rgba(255,201,60,0.3)' },
  empty: { opacity: 0.9 },
  ghost: { width: 46, height: 46, borderRadius: 23, borderWidth: 2.5, borderStyle: 'dashed', borderColor: INK, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)' },
  plus: { fontFamily: fonts.display, fontSize: 22, lineHeight: 30, color: INK },
  crown: { position: 'absolute', top: -8, right: -6, width: 22, height: 22 },
  name: { fontFamily: fonts.bold, fontSize: 13, color: INK, textAlign: 'center', maxWidth: '100%' },
  state: { fontFamily: fonts.bold, fontSize: 11, color: INK, opacity: 0.65 },
  stateOk: { color: '#2E7D32', opacity: 1 },
  waitText: { fontFamily: fonts.bold, fontSize: 11, color: INK, opacity: 0.7, textAlign: 'center' },
  sitText: { fontFamily: fonts.display, fontSize: 13, color: '#1478A8', textAlign: 'center' },
  kick: { marginTop: 2, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10, borderWidth: 2, borderColor: INK, backgroundColor: colors.candy.yellow },
  kickText: { fontFamily: fonts.bold, fontSize: 11, color: INK },
  vs: { position: 'absolute', alignSelf: 'center', top: '40%', left: '50%', marginLeft: -22, width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: INK, backgroundColor: colors.candy.yellow, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  vsText: { fontFamily: fonts.display, fontSize: 16, lineHeight: 24, color: INK },
  count: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.75, textAlign: 'center' },
});
