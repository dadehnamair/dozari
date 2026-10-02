import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ChatMessage, Friends } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { GradientFill } from '../components/GradientFill';
import { Item } from '../components/Item';
import { OnlineDot } from '../components/OnlineDot';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { avatarOf } from '../social/avatarOf';
import { fetchFriends } from '../social/api';
import { colors, fonts } from '../theme/colors';
import { fetchDm, sendDm } from './api';
import { chatErrorText, mergeMessages } from './errors';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const POLL_MS = 3000;
type Friend = Friends['friends'][number];

/** The «دوستان» tab (D115): the friends list with online dots, and a private chat with the one you pick. */
export function FriendsChat({ meId, onJoinTable }: { meId: string | null; onJoinTable?: (code: string) => void }) {
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<Friend | null>(null);
  useEffect(() => {
    const load = () => fetchFriends().then((f) => (setFriends(f.friends), setFailed(false)), () => setFailed(true));
    void load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, []);
  if (open) return <Dm friend={open} meId={meId} onBack={() => setOpen(null)} onJoinTable={onJoinTable} />;
  const ordered = [...(friends ?? [])].sort((a, b) => Number(b.online) - Number(a.online));
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.list}>
      {failed ? <Text style={styles.hint}>{fa.profile.error}</Text> : null}
      {friends && friends.length === 0 ? <Text style={styles.hint}>{fa.chat.friendsEmpty}</Text> : null}
      {ordered.map((f) => (
        <Pressable key={f.id} onPress={() => setOpen(f)} accessibilityRole="button" style={styles.row}>
          <View>
            <Avatar avatar={avatarOf(f.avatarKey)} size={40} />
            <View style={styles.dot}><OnlineDot online={f.online} size={14} /></View>
          </View>
          <Text style={styles.name} numberOfLines={1}>{f.nickname}</Text>
          <Text style={styles.state}>{f.online ? fa.chat.online : fa.chat.offline}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Dm({ friend, meId, onBack, onJoinTable }: { friend: Friend; meId: string | null; onBack: () => void; onJoinTable?: (code: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [canType, setCanType] = useState(true);
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const scroller = useRef<ScrollView>(null);
  const load = useCallback(() => {
    fetchDm(friend.id).then(
      (h) => (setMessages((cur) => mergeMessages(cur, h.messages)), setCanType(h.canType)),
      (e) => setNote(chatErrorText(e instanceof ApiError ? e.code : 'generic')),
    );
  }, [friend.id]);
  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);
  useEffect(() => {
    const t = setTimeout(() => scroller.current?.scrollToEnd({ animated: false }), 50);
    return () => clearTimeout(t);
  }, [messages.length]);
  const send = () => {
    if (text.trim() === '') return;
    void sendDm(friend.id, text).then((m) => (setMessages((c) => mergeMessages(c, [m])), setText(''), setNote(null)), (e) => setNote(chatErrorText(e instanceof ApiError ? e.code : 'generic')));
  };
  return (
    <View style={styles.flex}>
      <Pressable onPress={onBack} accessibilityRole="button" style={styles.head}>
        <Avatar avatar={avatarOf(friend.avatarKey)} size={30} />
        <Text style={styles.name} numberOfLines={1}>{friend.nickname}</Text>
        <Text style={styles.state}>{fa.chat.dmBack} ›</Text>
      </Pressable>
      <ScrollView ref={scroller} style={styles.flex} contentContainerStyle={styles.msgs}>
        {messages.length === 0 ? <Text style={styles.hint}>{fa.chat.dmEmpty}</Text> : null}
        {messages.map((m) => {
          const mine = m.userId === meId;
          const [code, icon, ...name] = m.text.split('|');
          return (
            <View key={m.id} style={[styles.msg, mine ? styles.mine : null]}>
              {m.kind === 'table' ? (
                <Pressable onPress={() => onJoinTable?.(code ?? '')} accessibilityRole="button" style={styles.tableCard}>
                  <View style={styles.tableRow}>
                    <View style={styles.tableIcon}><Item icon={icon ?? 'samovar'} /></View>
                    <Text style={styles.text}>{fa.chat.tableInvite(name.join('|'))}</Text>
                  </View>
                  <Text style={styles.join}>{fa.chat.tableJoin}</Text>
                </Pressable>
              ) : (
                <View style={[styles.bubble, mine ? styles.bubbleMine : null]}><Text style={styles.text}>{m.text}</Text></View>
              )}
            </View>
          );
        })}
      </ScrollView>
      {note ? <Text style={styles.warn}>{note}</Text> : null}
      {canType ? (
        <View style={styles.inputRow}>
          <TextInput value={text} onChangeText={setText} maxLength={200} placeholder={fa.chat.placeholder} style={styles.input} accessibilityLabel={fa.chat.placeholder} onSubmitEditing={send} returnKeyType="send" />
          <Pressable onPress={send} accessibilityRole="button" accessibilityLabel={fa.chat.send} style={styles.send}>
            <GradientFill from="#B8F08F" to="#5DBB3C" />
            <Text style={styles.sendMark}>➤</Text>
          </Pressable>
        </View>
      ) : <Text style={styles.hint}>{fa.chat.needsActivation}</Text>}
    </View>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: 8, paddingVertical: 10 },
  row: { flexDirection: ROW, alignItems: 'center', gap: 10, padding: 8, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#fff', ...lift(3) },
  dot: { position: 'absolute', bottom: -2, right: -2 },
  name: { flex: 1, fontFamily: fonts.display, fontSize: 16, color: colors.ink, textAlign: 'right' },
  state: { fontFamily: fonts.bold, fontSize: 11, color: '#7E46D6' },
  hint: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 20, color: colors.ink, textAlign: 'center', paddingHorizontal: 12 },
  warn: { fontFamily: fonts.bold, fontSize: 12, color: '#B3261E', textAlign: 'center' },
  head: { flexDirection: ROW, alignItems: 'center', gap: 8, paddingVertical: 6 },
  msgs: { gap: 8, paddingVertical: 8, flexGrow: 1, justifyContent: 'flex-end' },
  msg: { flexDirection: ROW },
  mine: { flexDirection: Platform.OS === 'web' ? 'row' : 'row-reverse' },
  bubble: { maxWidth: '80%', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#fff' },
  bubbleMine: { backgroundColor: colors.candy.yellow },
  text: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 20, color: colors.ink, textAlign: 'right' },
  tableCard: { gap: 4, padding: 8, borderRadius: 14, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#FFF3C4', ...lift(3) },
  tableRow: { flexDirection: ROW, alignItems: 'center', gap: 6 },
  tableIcon: { width: 26, height: 26 },
  join: { fontFamily: fonts.display, fontSize: 14, color: '#7E46D6', textAlign: 'center' },
  inputRow: { flexDirection: ROW, gap: 8, alignItems: 'center', paddingTop: 6 },
  input: { flex: 1, height: 44, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#fff', paddingHorizontal: 12, fontFamily: fonts.bold, fontSize: 13, color: colors.ink, textAlign: 'right' },
  send: { width: 44, height: 44, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  sendMark: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
});
