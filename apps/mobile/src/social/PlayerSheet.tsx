import { OnlineDot } from '../components/OnlineDot';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlayerProfile } from '@dozari/shared';
import { provinceOf, toPersianDigits } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { CandyButton } from '../components/CandyButton';
import { ProvinceBadge } from '../components/ProvinceBadge';
import { useConfirm } from '../components/useConfirm';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { acceptFriend, fetchPlayer, removeFriend, requestFriend } from './api';
import { avatarOf } from './avatarOf';
import { skillText } from '../badges/text';
import { TransferSheet } from '../transfers/TransferSheet';

const INK = '#3A2418';

/** Summary of any player (D67): avatar, name, member since, level, coins and the friend button. Open it from every place a name is shown. */
export function PlayerSheet({ playerId, onClose }: { playerId: string; onClose: () => void }) {
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
  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={fa.player.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        {failed ? <Text style={styles.text}>{fa.player.error}</Text> : null}
        {p ? (
          <>
            <Avatar avatar={avatarOf(p.avatarKey)} size={96} />
            <View style={styles.nameRow}>
              {p.isMe ? null : <OnlineDot online={p.online} />}
              <Text style={styles.name}>{p.nickname}{p.badges.badge ? ` · ${p.badges.badge.titleFa}` : ''}</Text>
            </View>
            <View style={styles.stats}>
              <Text style={styles.stat}>{fa.player.level} {toPersianDigits(String(p.level))}</Text>
              <Text style={styles.stat}>{fa.player.coins} {toPersianDigits(String(p.coins))}</Text>
              <Text style={styles.stat}>{fa.player.since} {since}</Text>
              {p.cityName ? (
                <View style={styles.city}>
                  {provinceOf(p.cityProvince) ? <ProvinceBadge province={provinceOf(p.cityProvince)!} size={26} /> : null}
                  <Text style={styles.stat}>{p.cityName}</Text>
                </View>
              ) : null}
              <Text style={styles.stat}>{skillText(p.badges.skill)} · {fa.player.games} {toPersianDigits(String(p.stats.games))} · {fa.player.wins} {toPersianDigits(String(p.stats.wins))}</Text>
              {p.badges.medals.length > 0 ? <Text style={styles.stat}>{p.badges.medals.map((m) => m.titleFa).join('، ')}</Text> : null}
            </View>
            {p.isMe ? null : p.relation === 'none' ? (
              <CandyButton label={fa.player.request} color={colors.candy.lime} onPress={act(requestFriend)} />
            ) : p.relation === 'sent' ? (
              <>
                <Text style={styles.text}>{fa.player.sent}</Text>
                <CandyButton label={fa.player.cancel} color={colors.candy.orange} onPress={act(removeFriend)} />
              </>
            ) : p.relation === 'received' ? (
              <CandyButton label={fa.player.accept} color={colors.candy.lime} onPress={act(acceptFriend)} />
            ) : (
              <>
                <Text style={styles.text}>{fa.player.friends}</Text>
                <CandyButton label={fa.transfers.gift} color={colors.candy.lime} onPress={() => setSend('gift')} />
                <CandyButton label={fa.transfers.loan} color={colors.candy.orange} onPress={() => setSend('loan')} />
                <CandyButton label={fa.player.unfriend} color={colors.candy.pink} onPress={() => ask({ title: fa.confirm.unfriend.title, message: fa.confirm.unfriend.message, confirmLabel: fa.confirm.unfriend.yes, onConfirm: act(removeFriend) })} />
              </>
            )}
          </>
        ) : null}
        <CandyButton label={fa.player.close} color={colors.candy.sky} onPress={onClose} />
      </Pressable>
      {dialog}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  city: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 360, backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 16, gap: 10, alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.display, fontSize: 24, color: INK },
  stats: { gap: 2, alignItems: 'center' },
  stat: { fontFamily: fonts.bold, fontSize: 14, color: INK },
  text: { fontFamily: fonts.bold, fontSize: 14, color: INK, textAlign: 'center' },
});
