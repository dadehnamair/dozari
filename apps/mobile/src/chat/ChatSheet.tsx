import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ChatHistory, ChatMessage, TauntCategory } from '@dozari/shared';
import { provinceOf } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { GradientFill } from '../components/GradientFill';
import { Item } from '../components/Item';
import { PageShell } from '../components/PageShell';
import { ProvinceBadge } from '../components/ProvinceBadge';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { avatarOf } from '../social/avatarOf';
import { fetchMyProfile } from '../social/api';
import { PlayerSheet } from '../social/PlayerSheet';
import { colors, fonts } from '../theme/colors';
import { fetchChat, fetchTaunts, reportMessage, sendTaunt, sendText } from './api';
import type { ChatTab } from './api';
import { chatErrorText, mergeMessages } from './errors';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const POLL_MS = 4000;

/**
 * screen-chat of `17 Chat Shop Unlocks` (D103): grape header with two tabs — «همشهری‌ها» (the room of the player's
 * city) and «همه» (everyone) — message bubbles (mine on the start side in yellow), a strip of canned taunts, and the
 * text box. Taunts are always allowed; free text needs an activated account. Refreshes every few seconds.
 */
export function ChatSheet({ onClose, onJoinTable, initialTab = 'city' }: { onClose: () => void; onJoinTable?: (code: string) => void; initialTab?: ChatTab }) {
  const [tab, setTab] = useState<ChatTab>(initialTab);
  const [info, setInfo] = useState<Record<ChatTab, ChatHistory | null>>({ city: null, global: null });
  const [messages, setMessages] = useState<Record<ChatTab, ChatMessage[]>>({ city: [], global: [] });
  const [taunts, setTaunts] = useState<TauntCategory[]>([]);
  const [noCity, setNoCity] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const scroller = useRef<ScrollView>(null);

  const load = useCallback((room: ChatTab) => {
    fetchChat(room).then(
      (h) => (setInfo((cur) => ({ ...cur, [room]: h })), setMessages((cur) => ({ ...cur, [room]: mergeMessages(cur[room], h.messages) })), room === 'city' && setNoCity(false)),
      (e) => (e instanceof ApiError && e.code === 'NO_CITY' && room === 'city' ? setNoCity(true) : undefined),
    );
  }, []);
  useEffect(() => {
    fetchMyProfile().then((p) => setMeId(p.id), () => undefined);
    fetchTaunts().then(setTaunts, () => undefined);
  }, []);
  useEffect(() => {
    setNote(null);
    load(tab);
    const id = setInterval(() => load(tab), POLL_MS);
    return () => clearInterval(id);
  }, [load, tab]);

  const list = messages[tab];
  const cur = info[tab];
  const cityInfo = info.city;
  useEffect(() => {
    const t = setTimeout(() => scroller.current?.scrollToEnd({ animated: false }), 50);
    return () => clearTimeout(t);
  }, [tab, list.length]);

  const afterSend = (m: ChatMessage) => (setMessages((c) => ({ ...c, [tab]: mergeMessages(c[tab], [m]) })), setNote(null));
  const fail = (e: unknown) => setNote(chatErrorText(e instanceof ApiError ? e.code : 'generic'));
  const send = () => {
    if (text.trim() === '') return;
    void sendText(tab, text).then((m) => (afterSend(m), setText('')), fail);
  };
  const taunt = (id: string) => void sendTaunt(tab, id).then(afterSend, fail);
  const report = (m: ChatMessage) => void reportMessage(m.id).then(() => setNote(fa.chat.reported), () => setNote(fa.chat.errors.generic ?? ''));

  if (open) return <PlayerSheet playerId={open} onClose={() => setOpen(null)} />;
  const cityBlocked = tab === 'city' && noCity;
  const quick = taunts.flatMap((c) => c.taunts).slice(0, 14);
  const t = fa.chat;
  const sub = tab === 'global' ? t.subGlobal : cityInfo?.cityName ? t.subCity(cityInfo.cityName) : '';

  return (
    <PageShell title={t.title} color={colors.candy.grape} backLabel={t.close} onBack={onClose} bandHeight={152}>
      <View style={styles.tabs}>
        {(['city', 'global'] as const).map((k) => (
          <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} style={[styles.tab, tab === k ? styles.tabOn : null]}>
            <Text style={[styles.tabText, tab === k ? styles.tabTextOn : null]}>{k === 'city' ? t.tabCity : t.tabGlobal}</Text>
          </Pressable>
        ))}
      </View>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}

      <ScrollView ref={scroller} style={styles.list} contentContainerStyle={styles.content}>
        {cityBlocked ? <Text style={styles.hint}>{t.noCity}</Text> : null}
        {!cityBlocked && list.length === 0 ? <Text style={styles.hint}>{t.empty}</Text> : null}
        {list.map((m) => {
          const mine = m.userId === meId;
          const prov = tab === 'global' ? provinceOf(m.province) : null;
          return (
            <View key={m.id} style={[styles.msg, mine ? styles.msgMine : null]}>
              <Pressable onPress={() => setOpen(m.userId)} accessibilityRole="button" accessibilityLabel={m.nickname}>
                <Avatar avatar={avatarOf(m.avatarKey)} size={36} />
              </Pressable>
              <View style={[styles.col, mine ? styles.colMine : null]}>
                <View style={styles.nameRow}>
                  {prov ? <ProvinceBadge province={prov} size={16} /> : null}
                  <Text style={[styles.name, mine ? styles.nameMine : null]}>{mine ? t.me : m.nickname}{m.badge ? ` · ${m.badge}` : ''}</Text>
                </View>
                {m.kind === 'table' ? (
                  <Pressable onPress={() => onJoinTable?.(m.text.split('|')[0] ?? '')} style={styles.tableCard} accessibilityRole="button">
                    <View style={styles.tableRow}>
                      <View style={styles.tableIcon}><Item icon={m.text.split('|')[1] ?? 'samovar'} /></View>
                      <Text style={styles.text}>{t.tableInvite(m.text.split('|').slice(2).join('|'))}</Text>
                    </View>
                    <Text style={styles.join}>{t.tableJoin}</Text>
                  </Pressable>
                ) : (
                  <View style={[styles.bubble, mine ? styles.bubbleMine : null, m.kind === 'taunt' ? styles.bubbleTaunt : null]}>
                    <Text style={styles.text}>{m.text}</Text>
                  </View>
                )}
                {mine ? null : (
                  <Pressable onPress={() => report(m)} accessibilityRole="button" hitSlop={6}>
                    <Text style={styles.report}>{t.report}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {cur?.muted ? <Text style={styles.warn}>{t.muted}{cur.muted.reason ? ` (${cur.muted.reason})` : ''}</Text> : null}
      {note ? <Text style={styles.warn}>{note}</Text> : null}
      {cityBlocked ? null : (
        <View style={styles.footer}>
          {quick.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quick} accessibilityLabel={t.taunts}>
              {quick.map((q) => (
                <Pressable key={q.id} onPress={() => taunt(q.id)} accessibilityRole="button" style={styles.chip}>
                  <Text style={styles.chipText}>{q.text}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          {cur?.canType ? (
            <View style={styles.inputRow}>
              <TextInput value={text} onChangeText={setText} maxLength={200} placeholder={t.placeholder} style={styles.input} accessibilityLabel={t.placeholder} onSubmitEditing={send} returnKeyType="send" />
              <Pressable onPress={send} accessibilityRole="button" accessibilityLabel={t.send} style={({ pressed }) => [styles.send, pressed ? styles.pressed : null]}>
                <GradientFill from="#B8F08F" to="#5DBB3C" />
                <Text style={styles.sendMark}>➤</Text>
              </Pressable>
            </View>
          ) : cur && !cur.muted ? (
            <Text style={styles.hint}>{t.needsActivation}</Text>
          ) : null}
        </View>
      )}
    </PageShell>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  tabs: { marginTop: -26, marginBottom: 34, flexDirection: ROW, gap: 4, padding: 4, borderRadius: 16, backgroundColor: 'rgba(43,18,64,0.45)' },
  tab: { flex: 1, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.candy.yellow, borderWidth: 2.5, borderColor: colors.ink },
  tabText: { fontFamily: fonts.display, fontSize: 15, color: '#E3CCFF' },
  tabTextOn: { color: colors.ink },
  sub: { fontFamily: fonts.bold, fontSize: 11, color: '#7E46D6', textAlign: 'center' },
  list: { flex: 1 },
  content: { gap: 10, paddingVertical: 10, flexGrow: 1, justifyContent: 'flex-end' },
  hint: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 20, color: colors.ink, textAlign: 'center', paddingHorizontal: 12 },
  warn: { fontFamily: fonts.bold, fontSize: 12, color: '#B3261E', textAlign: 'center' },
  msg: { flexDirection: ROW, alignItems: 'flex-end', gap: 6 },
  msgMine: { flexDirection: Platform.OS === 'web' ? 'row' : 'row-reverse' },
  col: { maxWidth: 250, gap: 2, alignItems: 'flex-start' },
  colMine: { alignItems: 'flex-end' },
  nameRow: { flexDirection: ROW, alignItems: 'center', gap: 3, paddingHorizontal: 6 },
  name: { fontFamily: fonts.bold, fontSize: 10, color: '#7E46D6' },
  nameMine: { color: '#B8651B' },
  bubble: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#fff', ...lift(3) },
  bubbleMine: { backgroundColor: colors.candy.yellow },
  bubbleTaunt: { backgroundColor: '#E8D5FF' },
  text: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 21, color: colors.ink, textAlign: 'right' },
  tableRow: { flexDirection: ROW, alignItems: 'center', gap: 6 },
  tableIcon: { width: 26, height: 26 },
  tableCard: { gap: 4, padding: 8, borderRadius: 14, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#FFF3C4', ...lift(3) },
  join: { fontFamily: fonts.display, fontSize: 14, color: '#7E46D6', textAlign: 'right' },
  report: { fontFamily: fonts.bold, fontSize: 10, color: colors.ink, opacity: 0.45, paddingHorizontal: 6 },
  footer: { gap: 6, paddingBottom: 14, paddingTop: 4 },
  quick: { flexDirection: ROW, gap: 6, paddingVertical: 2 },
  chip: { height: 38, paddingHorizontal: 12, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#E8D5FF', justifyContent: 'center', ...lift(3) },
  chipText: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink },
  inputRow: { flexDirection: ROW, gap: 6, alignItems: 'center' },
  input: { flex: 1, minWidth: 0, height: 52, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#fff', paddingHorizontal: 14, fontFamily: fonts.bold, fontSize: 14, color: colors.ink, textAlign: 'right' },
  send: { width: 52, height: 52, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  pressed: { transform: [{ translateY: 3 }] },
  sendMark: { fontSize: 22, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
});
