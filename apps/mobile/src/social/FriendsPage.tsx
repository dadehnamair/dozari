import { OnlineDot } from '../components/OnlineDot';
import { SkeletonRows } from '../components/Skeleton';
import { swr } from '../net/cache';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Friends } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { Item } from '../components/Item';
import { PageShell } from '../components/PageShell';
import { GuideBubble } from '../components/GuideBubble';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { TransferSheet } from '../transfers/TransferSheet';
import { acceptFriend, fetchFriends, removeFriend } from './api';
import { avatarOf } from './avatarOf';
import { FindSheet } from './FindSheet';
import { PlayerSheet } from './PlayerSheet';
import { TEXT_RIGHT } from '../theme/direction';
import { BirthdayBadge } from './BirthdayBadge';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const TINTS = ['#3FC1F0', '#FF4D8D', '#FF8FB6', '#FFC93C', '#B8F08F', '#FFAA7A', '#C9A3FF'];

/**
 * screen-friends of `19 Social Daily Onboarding`: search, «+ افزودن» (find players), incoming requests to accept or
 * decline, and one card per friend with a gift button. Tapping a friend opens their profile.
 */
export function FriendsPage({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<Friends | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [gift, setGift] = useState<string | null>(null);
  const [find, setFind] = useState(false);

  const load = useCallback(() => {
    swr.refresh('friends', fetchFriends).then((f) => (setData(f), setFailed(false)), () => setFailed(true));
  }, []);
  useEffect(() => swr('friends', fetchFriends, (f) => (setData(f), setFailed(false)), () => setFailed(true)), []);

  if (find) return <FindSheet onClose={() => (setFind(false), load())} />;
  if (open) return <PlayerSheet playerId={open} onClose={() => (setOpen(null), load())} />;
  if (gift) return <TransferSheet friendId={gift} kind="gift" onClose={() => setGift(null)} />;

  const needle = q.trim();
  const shown = (data?.friends ?? []).filter((p) => !needle || p.nickname.includes(needle));
  return (
    <PageShell title={fa.friends.title} color={colors.candy.sky} backLabel={fa.friends.back} onBack={onClose} bandHeight={156}
      action={
        <Pressable accessibilityRole="button" onPress={() => setFind(true)} style={styles.add}>
          <Text style={styles.addText}>{fa.friends.add}</Text>
        </Pressable>
      }
    >
      <TextInput value={q} onChangeText={setQ} placeholder={fa.friends.search} placeholderTextColor="rgba(43,18,64,0.45)" style={styles.search} accessibilityLabel={fa.friends.search} />
      <ScrollView contentContainerStyle={styles.list}>
        <GuideBubble who="goli" text={fa.friends.goliHello} />
        {data === null && !failed ? <SkeletonRows rows={6} /> : null}
        {failed ? <Text style={styles.note}>{fa.profile.error}</Text> : null}
        {data && data.incoming.length > 0 ? <Text style={styles.section}>{fa.profile.incoming}</Text> : null}
        {data?.incoming.map((p, i) => (
          <View key={p.id} style={[styles.card, styles.request]}>
            <Face avatarKey={p.avatarKey} tint={TINTS[i % TINTS.length]!} />
            <Pressable style={styles.body} onPress={() => setOpen(p.id)}><Text style={styles.name} numberOfLines={1}>{p.nickname}</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => acceptFriend(p.id).then(load, () => setFailed(true))} style={[styles.small, styles.yes]}><Text style={styles.smallText}>{fa.profile.accept}</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => removeFriend(p.id).then(load, () => setFailed(true))} style={styles.small}><Text style={styles.smallText}>{fa.profile.decline}</Text></Pressable>
          </View>
        ))}
        {data && data.friends.length === 0 ? <Text style={styles.note}>{fa.profile.noFriends}</Text> : null}
        {data && data.friends.length > 0 && shown.length === 0 ? <Text style={styles.note}>{fa.friends.noMatch}</Text> : null}
        {shown.map((p, i) => (
          <View key={p.id} style={styles.card}>
            <Face avatarKey={p.avatarKey} tint={TINTS[i % TINTS.length]!} online={p.online} birthday={p.birthday} />
            <Pressable style={styles.body} onPress={() => setOpen(p.id)} accessibilityRole="button"><Text style={styles.name} numberOfLines={1}>{p.nickname}</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`${fa.friends.gift} ${p.nickname}`} onPress={() => setGift(p.id)} style={styles.gift}>
              <View style={styles.giftIcon}><Item icon="gift" /></View>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </PageShell>
  );
}

function Face({ avatarKey, tint, online, birthday }: { avatarKey: string; tint: string; online?: boolean; birthday?: boolean }) {
  return (
    <View>
      <View style={[styles.face, { backgroundColor: tint }]}><Avatar avatar={avatarOf(avatarKey)} size={40} /></View>
      {online === undefined ? null : <View style={styles.dot}><OnlineDot online={online} size={14} /></View>}
      {birthday ? <View style={styles.cake}><BirthdayBadge compact /></View> : null}
    </View>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  add: { height: 40, paddingHorizontal: 12, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.candy.lime, justifyContent: 'center', ...lift(4) },
  addText: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  search: { height: 44, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.card, paddingHorizontal: 12, fontFamily: fonts.bold, fontSize: 13, color: colors.ink, textAlign: TEXT_RIGHT, marginTop: -16, marginBottom: 26 },
  list: { gap: 8, paddingTop: 6, paddingBottom: 24 },
  section: { fontFamily: fonts.display, fontSize: 16, color: colors.ink, textAlign: TEXT_RIGHT },
  note: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, textAlign: 'center', marginTop: 8 },
  card: { flexDirection: ROW, alignItems: 'center', gap: 8, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.card, ...lift(4) },
  request: { backgroundColor: '#FFF6D8' },
  cake: { position: 'absolute', top: -6, left: -6 },
  face: { width: 46, height: 46, borderRadius: 23, borderWidth: 2.5, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', bottom: -2, right: -2 },
  body: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.display, fontSize: 16, color: colors.ink, textAlign: TEXT_RIGHT },
  gift: { width: 40, height: 40, borderRadius: 12, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', ...lift(3) },
  giftIcon: { width: 26, height: 26 },
  small: { height: 36, paddingHorizontal: 10, borderRadius: 12, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.cream, justifyContent: 'center', ...lift(3) },
  yes: { backgroundColor: colors.candy.lime },
  smallText: { fontFamily: fonts.display, fontSize: 14, color: colors.ink },
});
