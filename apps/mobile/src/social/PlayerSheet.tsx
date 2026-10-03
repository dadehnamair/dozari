import { OnlineDot } from '../components/OnlineDot';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import type { PlayerProfile } from '@dozari/shared';
import { provinceOf, toPersianDigits } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { CandyButton } from '../components/CandyButton';
import { Icon } from '../components/Icon';
import { Item } from '../components/Item';
import { Scene } from '../components/Scene';
import { HubTile } from '../home/HubTile';
import { ProvinceBadge } from '../components/ProvinceBadge';
import { useConfirm } from '../components/useConfirm';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { acceptFriend, fetchPlayer, removeFriend, requestFriend } from './api';
import { avatarOf } from './avatarOf';
import { skillText } from '../badges/text';
import { TransferSheet } from '../transfers/TransferSheet';
import { useHardwareBack } from '../nav/useHardwareBack';

const INK = '#3A2418';

/** Summary of any player (D67): avatar, name, member since, level, coins and the friend button. Open it from every place a name is shown. */
export function PlayerSheet({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  useHardwareBack(onClose);
  const [p, setP] = useState<PlayerProfile | null>(null);
  const [failed, setFailed] = useState(false);
  const [send, setSend] = useState<'gift' | 'loan' | null>(null);
  const { ask, dialog } = useConfirm();

  const load = useCallback(() => {
    fetchPlayer(playerId).then(
      (v) => (setP(v), setFailed(false)),
      () => setFailed(true),
    );
  }, [playerId]);
  useEffect(load, [load]);

  const act = (fn: (id: string) => Promise<void>) => () => fn(playerId).then(load, () => setFailed(true));
  const since = p ? new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long' }).format(new Date(p.memberSince)) : '';

  if (send) return <TransferSheet friendId={playerId} kind={send} onClose={() => setSend(null)} />;
  const province = p ? provinceOf(p.cityProvince) : null;
  const medals = p ? p.badges.medals.slice(0, 3) : [];
  const stats = p ? ([[fa.player.games, p.stats.games, '#C9A3FF'], [fa.player.wins, p.stats.wins, '#B8F08F'], [fa.player.losses, p.stats.losses, '#FF8FB6'], [fa.player.draws, p.stats.draws, '#FFE48A']] as const) : [];
  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={fa.player.close}>
      <Pressable style={styles.card} onPress={() => undefined}>
        <View style={styles.header}>
          <Scene scene="caravan" />
          <View style={styles.headerLine} />
          <Pressable accessibilityRole="button" accessibilityLabel={fa.player.close} onPress={onClose} style={styles.closeBtn}>
            <Icon name="close" size={18} color="#fff" strokeWidth={3.2} />
          </Pressable>
        </View>
        {failed ? <Text style={[styles.text, styles.failed]}>{fa.player.error}</Text> : null}
        {p ? (
          <View style={styles.body}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatarRing}><Avatar avatar={avatarOf(p.avatarKey)} size={86} /></View>
              <View style={styles.hex} accessibilityLabel={`${fa.player.level} ${p.level}`}>
                <Svg width={42} height={48} viewBox="0 0 46 52">
                  <Polygon points="23,1 45,8 45,33 23,51 1,33 1,8" fill={colors.ink} />
                  <Polygon points="23,7 40,12 40,31 23,45 6,31 6,12" fill="#FFC93C" />
                </Svg>
                <Text style={styles.hexText}>{toPersianDigits(String(p.level))}</Text>
              </View>
            </View>

            <View style={styles.nameRow}>
              {p.isMe ? null : <OnlineDot online={p.online} />}
              <Text style={styles.name} numberOfLines={1}>{p.nickname}</Text>
            </View>
            <View style={styles.subRow}>
              <Text style={styles.sub}>{skillText(p.badges.skill)}</Text>
              {p.badges.badge ? <View style={styles.titleChip}><Text style={styles.titleChipText}>{p.badges.badge.titleFa}</Text></View> : null}
            </View>
            {p.cityName ? (
              <View style={styles.subRow}>
                {province ? <ProvinceBadge province={province} size={24} /> : null}
                <Text style={styles.sub}>{p.cityName}</Text>
              </View>
            ) : null}

            <View style={styles.stats}>
              {stats.map(([label, v, c]) => (
                <View key={label} style={[styles.stat, { backgroundColor: c }]}>
                  <Text style={styles.statValue}>{toPersianDigits(String(v))}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.chips}>
              <View style={styles.chip}><View style={styles.chipIcon}><Item icon="coinStack" /></View><Text style={styles.chipText}>{toPersianDigits(String(p.coins))}</Text></View>
              <View style={styles.chip}><Icon name="calendar" size={16} color={INK} strokeWidth={2.6} /><Text style={styles.chipText}>{fa.player.since} {since}</Text></View>
            </View>

            {medals.length > 0 ? (
              <View style={styles.chips}>
                {medals.map((m, i) => <View key={m.titleFa} style={[styles.medal, { backgroundColor: MEDAL_COLORS[i % MEDAL_COLORS.length] }]}><Text style={styles.medalText} numberOfLines={1}>{m.titleFa}</Text></View>)}
              </View>
            ) : null}

            {p.isMe ? null : p.relation === 'none' ? (
              <CandyButton label={fa.player.request} color={colors.candy.lime} onPress={act(requestFriend)} />
            ) : p.relation === 'sent' ? (
              <View style={styles.actionsCol}>
                <Text style={styles.text}>{fa.player.sent}</Text>
                <CandyButton label={fa.player.cancel} color={colors.candy.orange} onPress={act(removeFriend)} />
              </View>
            ) : p.relation === 'received' ? (
              <CandyButton label={fa.player.accept} color={colors.candy.lime} onPress={act(acceptFriend)} />
            ) : (
              <>
                <View style={styles.friendTag}><Icon name="check" size={14} color="#fff" strokeWidth={4} /><Text style={styles.friendTagText}>{fa.player.friends}</Text></View>
                <View style={styles.actions}>
                  <HubTile icon="gift" label={fa.transfers.gift} color={colors.candy.lime} onPress={() => setSend('gift')} />
                  <HubTile icon="wallet" label={fa.transfers.loan} color={colors.candy.orange} onPress={() => setSend('loan')} />
                  <HubTile icon="trash" label={fa.player.unfriend} color={colors.candy.pink} onPress={() => ask({ title: fa.confirm.unfriend.title, message: fa.confirm.unfriend.message, confirmLabel: fa.confirm.unfriend.yes, onConfirm: act(removeFriend) })} />
                </View>
              </>
            )}
          </View>
        ) : null}
      </Pressable>
      {dialog}
    </Pressable>
  );
}

const lift = (h: number) => ({ shadowColor: INK, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });
const MEDAL_COLORS = ['#FF4D8D', '#7E46D6', '#3FA36B'];
const ROW = ('row-reverse' as const);

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40, backgroundColor: 'rgba(20,8,32,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 340, borderRadius: 30, borderWidth: 4, borderColor: INK, backgroundColor: '#FBF1DE', overflow: 'hidden', ...lift(8) },
  header: { height: 104, overflow: 'hidden' },
  headerLine: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: INK },
  closeBtn: { position: 'absolute', top: 10, left: 10, width: 34, height: 34, borderRadius: 12, borderWidth: 3, borderColor: INK, backgroundColor: '#A66BF0', alignItems: 'center', justifyContent: 'center', ...lift(3) },
  body: { alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingBottom: 14 },
  avatarWrap: { marginTop: -46, alignItems: 'center' },
  avatarRing: { width: 104, height: 104, borderRadius: 52, borderWidth: 4, borderColor: INK, backgroundColor: '#B8F08F', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...lift(5) },
  hex: { position: 'absolute', bottom: -6, right: -30, width: 42, height: 48, alignItems: 'center', justifyContent: 'center' },
  hexText: { position: 'absolute', fontFamily: fonts.display, fontSize: 19, color: '#fff', textShadowColor: '#A86E00', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1, paddingTop: 4 },
  nameRow: { flexDirection: ROW, alignItems: 'center', gap: 8, marginTop: 4 },
  name: { fontFamily: fonts.display, fontSize: 26, color: INK, maxWidth: 240 },
  subRow: { flexDirection: ROW, alignItems: 'center', gap: 6 },
  sub: { fontFamily: fonts.bold, fontSize: 12.5, color: INK, opacity: 0.7 },
  titleChip: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 99, borderWidth: 2, borderColor: INK, backgroundColor: '#FFC93C' },
  titleChipText: { fontFamily: fonts.display, fontSize: 12, color: INK },
  stats: { alignSelf: 'stretch', flexDirection: ROW, gap: 6, marginTop: 4 },
  stat: { flex: 1, height: 54, borderRadius: 14, borderWidth: 3, borderColor: INK, alignItems: 'center', justifyContent: 'center', ...lift(3) },
  statValue: { fontFamily: fonts.display, fontSize: 21, lineHeight: 25, color: INK },
  statLabel: { fontFamily: fonts.bold, fontSize: 10.5, color: INK, opacity: 0.8 },
  chips: { flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  chip: { flexDirection: ROW, alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, borderWidth: 2.5, borderColor: INK, backgroundColor: '#FFF6E8' },
  chipIcon: { width: 22, height: 22 },
  chipText: { fontFamily: fonts.display, fontSize: 13, color: INK },
  medal: { height: 26, maxWidth: 120, paddingHorizontal: 10, borderRadius: 99, borderWidth: 2.5, borderColor: INK, justifyContent: 'center', ...lift(2) },
  medalText: { fontFamily: fonts.display, fontSize: 12.5, color: '#fff', textShadowColor: INK, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  friendTag: { flexDirection: ROW, alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 3, borderRadius: 99, borderWidth: 2.5, borderColor: INK, backgroundColor: '#7ED957' },
  friendTagText: { fontFamily: fonts.display, fontSize: 13, color: '#fff', textShadowColor: INK, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  actions: { flexDirection: ROW, justifyContent: 'center', gap: 10 },
  actionsCol: { alignSelf: 'stretch', alignItems: 'center', gap: 6 },
  failed: { padding: 14 },
  text: { fontFamily: fonts.bold, fontSize: 14, color: INK, textAlign: 'center' },
});
