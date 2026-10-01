import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Inbox } from '@dozari/shared';
import { CandyButton } from '../components/CandyButton';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';

const INK = '#3A2418';

/** The in-app inbox: messages the admin sent to everyone or to this player. Tapping one marks it read. */
export function InboxSheet({ inbox, failed, onRead, onReadAll, onClose }: { inbox: Inbox | null; failed: boolean; onRead: (id: string) => void; onReadAll: () => void; onClose: () => void }) {
  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={fa.inbox.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <Text style={styles.title}>{fa.inbox.title}</Text>
        {failed ? <Text style={styles.text}>{fa.inbox.error}</Text> : null}
        {inbox && inbox.items.length === 0 ? <Text style={styles.text}>{fa.inbox.empty}</Text> : null}
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {inbox?.items.map((m) => (
            <Pressable key={m.id} onPress={() => onRead(m.id)} style={[styles.item, !m.read && styles.unread]} accessibilityRole="button">
              <Text style={styles.itemTitle}>{m.title}</Text>
              <Text style={styles.text}>{m.body}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.actions}>
          {inbox && inbox.unread > 0 ? <CandyButton label={fa.inbox.readAll} color={colors.candy.lime} onPress={onReadAll} /> : null}
          <CandyButton label={fa.inbox.close} color={colors.candy.sky} onPress={onClose} />
        </View>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 380, maxHeight: '80%', backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 16, gap: 10 },
  title: { fontFamily: fonts.display, fontSize: 24, color: INK, textAlign: 'center' },
  text: { fontFamily: fonts.bold, fontSize: 14, color: INK, textAlign: 'right' },
  list: { flexGrow: 0 },
  listContent: { gap: 8 },
  item: { borderWidth: 2, borderColor: INK, borderRadius: 14, padding: 10, gap: 4, backgroundColor: '#fff6e8' },
  unread: { backgroundColor: '#FFE48A' },
  itemTitle: { fontFamily: fonts.display, fontSize: 17, color: INK, textAlign: 'right' },
  actions: { alignItems: 'center', gap: 8 },
});
