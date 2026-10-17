import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Inbox } from '@dozari/shared';
import { Item } from '../components/Item';
import { HeaderPill, PageShell } from '../components/PageShell';
import { GuideBubble } from '../components/GuideBubble';
import { EmptyNote } from '../components/EmptyState';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { agoText } from './ago';
import { filterInbox } from './filter';
import type { InboxFilter } from './filter';
import { TEXT_RIGHT } from '../theme/direction';
import { PlayerSheet } from '../social/PlayerSheet';
import { useTheme } from '../theme/themeStore';
import { Medal, Pill, Plate } from '../duel/adultKit';

const FILTERS: InboxFilter[] = ['all', 'unread', 'read'];

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
/** Icon tiles cycle through the candy colours so a long list stays lively. */
const TINTS = ['#FFE48A', '#3FC1F0', '#FF8FB6', '#B8F08F', '#C9A3FF', '#FFAA7A'];

/** screen-notifications of `19 Social Daily Onboarding`: the admin's messages to everyone or to this player; tap marks one read. */
export function InboxSheet({ inbox, failed, onRead, onReadAll, onClose }: { inbox: Inbox | null; failed: boolean; onRead: (id: string) => void; onReadAll: () => void; onClose: () => void }) {
  const [now] = useState(() => Date.now());
  const adult = useTheme() === 'adult';
  const [filter, setFilter] = useState<InboxFilter>('all');
  /** A message about a player (a friend's birthday) opens that player's profile, where the gift is. */
  const [playerId, setPlayerId] = useState<string | null>(null);
  const shown = inbox ? filterInbox(inbox.items, filter) : [];
  return (
    <PageShell
      title={fa.inbox.title}
      color={colors.candy.grape}
      backLabel={fa.inbox.close}
      onBack={onClose}
      action={inbox && inbox.unread > 0 ? <HeaderPill label={fa.inbox.readAll} onPress={onReadAll} /> : undefined}
    >
      <ScrollView contentContainerStyle={styles.list}>
        <View style={styles.filters}>
          {adult ? FILTERS.map((f) => <Pill key={f} label={fa.inbox.filters[f]} on={filter === f} onPress={() => setFilter(f)} />) : FILTERS.map((f) => (
            <Pressable key={f} onPress={() => setFilter(f)} accessibilityRole="button" accessibilityState={{ selected: filter === f }} style={[styles.chip, filter === f ? styles.chipOn : null]}>
              <Text style={styles.chipText}>{fa.inbox.filters[f]}</Text>
            </Pressable>
          ))}
        </View>
        <GuideBubble who="ajan" text={fa.inbox.ajanHello} />
        {failed ? <Text style={styles.note}>{fa.inbox.error}</Text> : null}
        {inbox && shown.length === 0 ? <EmptyNote skin={4} pose="sleeping" text={filter === 'unread' ? fa.inbox.emptyUnread : filter === 'read' ? fa.inbox.emptyRead : fa.inbox.empty} /> : null}
        {shown.map((m, i) => (
          <Pressable key={m.id} onPress={() => (onRead(m.id), m.playerId ? setPlayerId(m.playerId) : undefined)} accessibilityRole="button">
            {({ pressed }) => adult ? (
              <Plate radius={16} border={m.read ? '#3A2A1C' : '#B8822A'} from="#17100C" to="#17100C" ledge={0} style={[styles.cardAdult, pressed ? styles.pressed : null]}>
                <View>
                  <Medal size={48}><View style={styles.iconAdult}><Item icon={m.playerId ? 'cake' : 'envelope'} /></View></Medal>
                  {!m.read ? <View style={styles.dotAdult} /> : null}
                </View>
                <View style={styles.body}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.titleAdult, styles.flex1]}>{m.title}</Text>
                    <Text style={styles.timeAdult}>{agoText(m.createdAt, now)}</Text>
                  </View>
                  <Text style={styles.textAdult}>{m.body}</Text>
                  {m.playerId ? <Text style={styles.linkAdult}>{fa.birthdayGift.openProfile}</Text> : null}
                </View>
              </Plate>
            ) : (
              <View style={[styles.card, !m.read ? styles.unread : null, pressed ? styles.pressed : null]}>
                <View style={[styles.tile, { backgroundColor: TINTS[i % TINTS.length] }]}>
                  <View style={styles.icon}><Item icon={m.read ? 'envelope' : 'alarm'} /></View>
                </View>
                <View style={styles.body}>
                  <Text style={styles.title}>{m.title}</Text>
                  <Text style={styles.text}>{m.body}</Text>
                  {m.playerId ? <Text style={styles.link}>{fa.birthdayGift.openProfile}</Text> : null}
                </View>
                <View style={styles.meta}>
                  <Text style={styles.time}>{agoText(m.createdAt, now)}</Text>
                  {!m.read ? <View style={styles.dot} /> : null}
                </View>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
      {playerId ? <PlayerSheet playerId={playerId} onClose={() => setPlayerId(null)} /> : null}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10, paddingBottom: 24 },
  flex1: { flex: 1 },
  cardAdult: { flexDirection: ROW, alignItems: 'flex-start', gap: 10, padding: 12 },
  iconAdult: { width: 32, height: 32 },
  dotAdult: { position: 'absolute', top: -5, right: -5, width: 12, height: 12, borderRadius: 6, backgroundColor: '#E8B64A' },
  titleRow: { flexDirection: ROW, justifyContent: 'space-between', gap: 8 },
  titleAdult: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22, color: '#FFE9A8', textAlign: TEXT_RIGHT },
  timeAdult: { fontFamily: fonts.bold, fontSize: 11, color: 'rgba(255,233,168,0.5)' },
  textAdult: { fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 21, color: 'rgba(255,233,168,0.7)', textAlign: TEXT_RIGHT },
  linkAdult: { fontFamily: fonts.bold, fontSize: 12, color: '#E8B64A', textAlign: TEXT_RIGHT },
  filters: { flexDirection: ROW, gap: 6, marginBottom: 2 },
  chip: { paddingHorizontal: 12, height: 32, borderRadius: 16, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.candy.yellow },
  chipText: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink },
  note: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, textAlign: 'center', marginTop: 12 },
  card: { flexDirection: ROW, alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.card, shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  unread: { backgroundColor: '#FFF6D8' },
  pressed: { transform: [{ translateY: 2 }] },
  tile: { width: 46, height: 46, borderRadius: 14, borderWidth: 2.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 34, height: 34 },
  body: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontFamily: fonts.display, fontSize: 15, lineHeight: 20, color: colors.ink, textAlign: TEXT_RIGHT },
  text: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 17, color: '#5A3A7A', textAlign: TEXT_RIGHT },
  link: { fontFamily: fonts.bold, fontSize: 10.5, color: '#7E46D6', textAlign: TEXT_RIGHT, marginTop: 2 },
  meta: { alignItems: 'center', gap: 6 },
  time: { fontFamily: fonts.bold, fontSize: 10, color: '#7E46D6' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.candy.pink, borderWidth: 2, borderColor: colors.ink },
});
