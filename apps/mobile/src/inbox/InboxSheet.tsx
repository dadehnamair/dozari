import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Inbox } from '@dozari/shared';
import { Item } from '../components/Item';
import { HeaderPill, PageShell } from '../components/PageShell';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { agoText } from './ago';
import { filterInbox } from './filter';
import type { InboxFilter } from './filter';

const FILTERS: InboxFilter[] = ['all', 'unread', 'read'];

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
/** Icon tiles cycle through the candy colours so a long list stays lively. */
const TINTS = ['#FFE48A', '#3FC1F0', '#FF8FB6', '#B8F08F', '#C9A3FF', '#FFAA7A'];

/** screen-notifications of `19 Social Daily Onboarding`: the admin's messages to everyone or to this player; tap marks one read. */
export function InboxSheet({ inbox, failed, onRead, onReadAll, onClose }: { inbox: Inbox | null; failed: boolean; onRead: (id: string) => void; onReadAll: () => void; onClose: () => void }) {
  const [now] = useState(() => Date.now());
  const [filter, setFilter] = useState<InboxFilter>('all');
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
          {FILTERS.map((f) => (
            <Pressable key={f} onPress={() => setFilter(f)} accessibilityRole="button" accessibilityState={{ selected: filter === f }} style={[styles.chip, filter === f ? styles.chipOn : null]}>
              <Text style={styles.chipText}>{fa.inbox.filters[f]}</Text>
            </Pressable>
          ))}
        </View>
        {failed ? <Text style={styles.note}>{fa.inbox.error}</Text> : null}
        {inbox && shown.length === 0 ? <Text style={styles.note}>{filter === 'unread' ? fa.inbox.emptyUnread : filter === 'read' ? fa.inbox.emptyRead : fa.inbox.empty}</Text> : null}
        {shown.map((m, i) => (
          <Pressable key={m.id} onPress={() => onRead(m.id)} accessibilityRole="button">
            {({ pressed }) => (
              <View style={[styles.card, !m.read ? styles.unread : null, pressed ? styles.pressed : null]}>
                <View style={[styles.tile, { backgroundColor: TINTS[i % TINTS.length] }]}>
                  <View style={styles.icon}><Item icon={m.read ? 'envelope' : 'alarm'} /></View>
                </View>
                <View style={styles.body}>
                  <Text style={styles.title}>{m.title}</Text>
                  <Text style={styles.text}>{m.body}</Text>
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
    </PageShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8, paddingBottom: 24 },
  filters: { flexDirection: ROW, gap: 6, marginBottom: 2 },
  chip: { paddingHorizontal: 12, height: 32, borderRadius: 16, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.candy.yellow },
  chipText: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink },
  note: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, textAlign: 'center', marginTop: 12 },
  card: { flexDirection: ROW, alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#fff', shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  unread: { backgroundColor: '#FFF6D8' },
  pressed: { transform: [{ translateY: 2 }] },
  tile: { width: 46, height: 46, borderRadius: 14, borderWidth: 2.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 34, height: 34 },
  body: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontFamily: fonts.display, fontSize: 15, lineHeight: 20, color: colors.ink, textAlign: 'right' },
  text: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 17, color: '#5A3A7A', textAlign: 'right' },
  meta: { alignItems: 'center', gap: 6 },
  time: { fontFamily: fonts.bold, fontSize: 10, color: '#7E46D6' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.candy.pink, borderWidth: 2, borderColor: colors.ink },
});
