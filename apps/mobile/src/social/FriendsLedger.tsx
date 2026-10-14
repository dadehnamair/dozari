import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { toPersianDigits } from '@dozari/shared';
import type { Friends } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { GradientFill } from '../components/GradientFill';
import { Icon } from '../components/Icon';
import { Item } from '../components/Item';
import { OnlineDot } from '../components/OnlineDot';
import { SceneBackground } from '../components/SceneBackground';
import { SkeletonRows } from '../components/Skeleton';
import { BirthdayBadge } from './BirthdayBadge';
import { fa } from '../i18n/fa';
import { useHardwareBack } from '../nav/useHardwareBack';
import { playSfx } from '../sound/engine';
import { TEXT_RIGHT } from '../theme/direction';
import { fonts } from '../theme/colors';
import { pageTop } from '../theme/safeArea';
import { DARK } from '../theme/skin';
import { avatarOf } from './avatarOf';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const MUTED = '#A39A92';
type Tab = 'all' | 'online' | 'requests';
type Friend = Friends['friends'][number];

/** Face of a brass button: light top, gold body, dark-bronze shelf (docs/design/adult/Dozari Adult - Friends). */
const Brass = () => <GradientFill from="#FFF1B8" mid={{ at: 0.4, color: '#E8B64A' }} to="#8A5A16" />;

/**
 * screen-friends in the adult look (docs/design/adult/Dozari Adult - Friends): vault-room scene, a header with the counts and «+ افزودن»,
 * search, three tabs, and the friends as ledger rows grouped online / offline. The player's level, «playing now» and duel from the
 * design are not here: the friends list does not carry them yet.
 */
export function FriendsLedger({ data, failed, onBack, onAdd, onOpen, onGift, onAccept, onDecline }: { data: Friends | null; failed: boolean; onBack: () => void; onAdd: () => void; onOpen: (id: string) => void; onGift: (id: string) => void; onAccept: (id: string) => void; onDecline: (id: string) => void }) {
  useHardwareBack(onBack);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [phones, setPhones] = useState<Record<string, boolean>>({});
  const friends = data?.friends ?? [];
  const incoming = data?.incoming ?? [];
  const needle = q.trim();
  const matched = friends.filter((p) => !needle || p.nickname.includes(needle) || (p.contactName ?? '').includes(needle) || (p.phone ?? '').replace(/\s/g, '').includes(needle));
  const on = matched.filter((p) => p.online);
  const off = tab === 'online' ? [] : matched.filter((p) => !p.online);
  const fmt = (n: number) => toPersianDigits(String(n));

  const row = (p: Friend, last: boolean) => {
    const sub = [p.contactName, phones[p.id] ? p.phone : null].filter(Boolean);
    return (
      <View key={p.id} style={[styles.row, last ? null : styles.sep, p.online ? null : styles.dim]}>
        <Pressable style={styles.main} onPress={() => onOpen(p.id)} accessibilityRole="button" accessibilityLabel={p.nickname}>
          <View>
            <View style={[styles.ring, p.online ? null : styles.ringOff]}><Avatar avatar={avatarOf(p.avatarKey)} size={42} /></View>
            <View style={styles.dot}><OnlineDot online={p.online} size={14} /></View>
            {p.birthday ? <View style={styles.cake}><BirthdayBadge compact /></View> : null}
          </View>
          <View style={styles.text}>
            <Text style={styles.name} numberOfLines={1}>{p.nickname}</Text>
            {p.contactName || p.phone ? (
              <View style={styles.subRow}>
                {p.phone ? (
                  <Pressable hitSlop={6} onPress={() => setPhones((x) => ({ ...x, [p.id]: !x[p.id] }))} accessibilityRole="button" accessibilityLabel={fa.friends.showPhone} style={[styles.eye, phones[p.id] ? styles.eyeOn : null]}>
                    <Icon name="eye" size={12} color={MUTED} strokeWidth={2.2} />
                  </Pressable>
                ) : null}
                <Text style={[styles.sub, phones[p.id] && !p.contactName ? styles.ltr : null]} numberOfLines={1}>{sub.join(' · ')}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${fa.friends.gift} ${p.nickname}`} onPress={() => (playSfx('press'), onGift(p.id))} style={styles.square}>
          <View style={styles.giftIcon}><Item icon="gift" /></View>
        </Pressable>
      </View>
    );
  };

  const group = (title: string, dot: string, color: string, frame: string, list: Friend[]) =>
    list.length === 0 ? null : (
      <View style={styles.group} key={title}>
        <View style={styles.groupHead}>
          <View style={[styles.groupDot, { backgroundColor: dot }]} />
          <Text style={[styles.groupTitle, { color }]}>{title}</Text>
          <Text style={styles.groupCount}>{fmt(list.length)}</Text>
          <View style={styles.groupLine} />
        </View>
        <View style={[styles.ledger, { borderColor: frame }]}>{list.map((p, i) => row(p, i === list.length - 1))}</View>
      </View>
    );

  const tabs: { id: Tab; label: string; badge?: string }[] = [
    { id: 'all', label: fa.friends.tabAll },
    { id: 'online', label: fa.friends.tabOnline },
    { id: 'requests', label: fa.friends.tabRequests, badge: incoming.length > 0 ? fmt(incoming.length) : undefined },
  ];

  return (
    <View style={styles.root}>
      <SceneBackground scene="sarafi">
        <View style={styles.shade} pointerEvents="none"><GradientFill from="rgba(14,10,8,0.6)" mid={{ at: 0.32, color: 'rgba(14,10,8,0.88)' }} to="rgba(14,10,8,0.96)" /></View>
        <View style={styles.column}>
          <View style={styles.head}>
            <Pressable accessibilityRole="button" accessibilityLabel={fa.friends.back} onPress={() => (playSfx('back'), onBack())} style={styles.square}>
              <Icon name="back" size={22} color={DARK.text} strokeWidth={2.4} />
            </Pressable>
            <View style={styles.titleBox}>
              <Text style={styles.title}>{fa.friends.title}</Text>
              {data ? <Text style={styles.count}>{fa.friends.count(fmt(friends.length), fmt(friends.filter((p) => p.online).length))}</Text> : null}
            </View>
            <Pressable accessibilityRole="button" onPress={onAdd} style={styles.add}>
              <Brass />
              <Icon name="plus" size={16} color="#2A1606" strokeWidth={3} />
              <Text style={styles.addText}>{fa.friends.add.replace('+', '').trim()}</Text>
            </Pressable>
          </View>

          <View style={styles.search}>
            <Icon name="search" size={18} color="#E8B64A" strokeWidth={2.2} />
            <TextInput value={q} onChangeText={setQ} placeholder={fa.friends.search} placeholderTextColor="rgba(255,233,168,0.45)" style={styles.input} accessibilityLabel={fa.friends.search} />
          </View>
          <View style={styles.tabs}>
            {tabs.map((t) => (
              <Pressable key={t.id} accessibilityRole="tab" accessibilityState={{ selected: tab === t.id }} onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id ? styles.tabOn : null]}>
                {tab === t.id ? <Brass /> : null}
                <Text style={[styles.tabText, tab === t.id ? styles.tabTextOn : null]}>{t.label}</Text>
                {t.badge ? <View style={styles.badge}><Text style={styles.badgeText}>{t.badge}</Text></View> : null}
              </Pressable>
            ))}
          </View>

          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {data === null && !failed ? <SkeletonRows rows={6} /> : null}
            {failed ? <Text style={styles.note}>{fa.profile.error}</Text> : null}
            {tab === 'requests' ? (
              <View style={[styles.ledger, { borderColor: DARK.frame }]}>
                {incoming.map((p, i) => (
                  <View key={p.id} style={[styles.row, i === incoming.length - 1 ? null : styles.sep]}>
                    <Pressable style={styles.main} onPress={() => onOpen(p.id)} accessibilityRole="button" accessibilityLabel={p.nickname}>
                      <View style={styles.ring}><Avatar avatar={avatarOf(p.avatarKey)} size={42} /></View>
                      <View style={styles.text}><Text style={styles.name} numberOfLines={1}>{p.nickname}</Text></View>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={fa.profile.decline} onPress={() => onDecline(p.id)} style={styles.square}><Icon name="close" size={16} color={DARK.text} strokeWidth={2.6} /></Pressable>
                    <Pressable accessibilityRole="button" onPress={() => onAccept(p.id)} style={styles.accept}><Brass /><Text style={styles.addText}>{fa.profile.accept}</Text></Pressable>
                  </View>
                ))}
                {data && incoming.length === 0 ? <Text style={styles.note}>{fa.friends.noRequests}</Text> : null}
              </View>
            ) : (
              <>
                {data && friends.length === 0 ? <Text style={styles.note}>{fa.profile.noFriends}</Text> : null}
                {data && friends.length > 0 && matched.length === 0 ? <Text style={styles.note}>{fa.friends.noMatch}</Text> : null}
                {tab === 'online' ? group(fa.friends.online, '#7ED957', DARK.text, DARK.frame, on) : [group(fa.friends.online, '#7ED957', DARK.text, DARK.frame, on), group(fa.friends.offline, '#5A4A3A', 'rgba(255,233,168,0.7)', '#8A5A16', off)]}
              </>
            )}
          </ScrollView>
        </View>
      </SceneBackground>
    </View>
  );
}

const shadow = (h: number) => ({ shadowColor: '#000', shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: '#0E0A08' },
  shade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  column: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 12, paddingTop: pageTop(), gap: 10 },
  head: { flexDirection: ROW, alignItems: 'center', gap: 8 },
  square: { width: 42, height: 42, borderRadius: 13, borderWidth: 2, borderColor: '#B8822A', backgroundColor: '#3A2412', alignItems: 'center', justifyContent: 'center', ...shadow(3) },
  titleBox: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.display, fontSize: 26, color: DARK.text, textAlign: TEXT_RIGHT, textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 },
  count: { fontFamily: fonts.bold, fontSize: 11.5, color: 'rgba(255,233,168,0.6)', textAlign: TEXT_RIGHT },
  add: { height: 42, paddingHorizontal: 12, borderRadius: 13, borderWidth: 2, borderColor: '#000', flexDirection: ROW, alignItems: 'center', gap: 4, overflow: 'hidden', ...shadow(3) },
  addText: { fontFamily: fonts.display, fontSize: 16, color: '#2A1606' },
  search: { height: 44, borderRadius: 12, borderWidth: 2, borderColor: '#8A5A16', backgroundColor: DARK.field, flexDirection: ROW, alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  input: { flex: 1, minWidth: 0, height: '100%', fontFamily: fonts.bold, fontSize: 14, color: DARK.text, textAlign: TEXT_RIGHT, padding: 0 },
  tabs: { flexDirection: ROW, gap: 4, padding: 4, borderRadius: 14, backgroundColor: DARK.field, borderWidth: 2, borderColor: '#8A5A16' },
  tab: { flex: 1, height: 34, borderRadius: 10, borderWidth: 2, borderColor: 'transparent', flexDirection: ROW, alignItems: 'center', justifyContent: 'center', gap: 5, overflow: 'hidden' },
  tabOn: { borderColor: '#000' },
  tabText: { fontFamily: fonts.display, fontSize: 16, color: 'rgba(255,233,168,0.75)' },
  tabTextOn: { color: '#2A1606' },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: '#C4302B', borderWidth: 1.5, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.display, fontSize: 11, lineHeight: 15, color: '#fff' },
  list: { gap: 14, paddingTop: 2, paddingBottom: 28 },
  note: { fontFamily: fonts.bold, fontSize: 13, color: 'rgba(255,233,168,0.6)', textAlign: 'center', paddingVertical: 22 },
  group: { gap: 8 },
  groupHead: { flexDirection: ROW, alignItems: 'center', gap: 8, paddingHorizontal: 6 },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  groupTitle: { fontFamily: fonts.display, fontSize: 16 },
  groupCount: { fontFamily: fonts.bold, fontSize: 12, color: 'rgba(255,233,168,0.5)' },
  groupLine: { flex: 1, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(232,182,74,0.3)' },
  ledger: { borderRadius: 20, borderWidth: 2, backgroundColor: DARK.panel, paddingHorizontal: 12, paddingVertical: 2, ...shadow(5) },
  row: { flexDirection: ROW, alignItems: 'center', gap: 10, paddingVertical: 10 },
  sep: { borderBottomWidth: 1.5, borderStyle: 'dashed', borderBottomColor: 'rgba(232,182,74,0.22)' },
  dim: { opacity: 0.8 },
  main: { flex: 1, minWidth: 0, flexDirection: ROW, alignItems: 'center', gap: 10 },
  ring: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: '#E8B64A', backgroundColor: DARK.field, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ringOff: { borderColor: '#5A4A3A', opacity: 0.75 },
  dot: { position: 'absolute', bottom: -2, left: -2 },
  cake: { position: 'absolute', top: -6, right: -6 },
  text: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.display, fontSize: 17, color: DARK.text, textAlign: TEXT_RIGHT },
  subRow: { flexDirection: ROW, alignItems: 'center', gap: 6, minWidth: 0 },
  eye: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: 'rgba(163,154,146,0.45)', alignItems: 'center', justifyContent: 'center' },
  eyeOn: { borderColor: MUTED, backgroundColor: DARK.raised },
  sub: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 11, color: MUTED, textAlign: TEXT_RIGHT },
  ltr: { writingDirection: 'ltr' },
  giftIcon: { width: 24, height: 24 },
  accept: { height: 38, paddingHorizontal: 12, borderRadius: 12, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...shadow(3) },
});
