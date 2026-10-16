import { FACE_TEXT } from '../theme/skin';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ChatHistory, ChatMessage, TauntCategory } from '@dozari/shared';
import { provinceOf } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { GradientFill } from '../components/GradientFill';
import { Item } from '../components/Item';
import { PageShell } from '../components/PageShell';
import { ProvinceBadge } from '../components/ProvinceBadge';
import { GuideBubble } from '../components/GuideBubble';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { avatarOf } from '../social/avatarOf';
import { fetchMyProfile } from '../social/api';
import { CityPicker } from '../social/CityPicker';
import { PlayerSheet } from '../social/PlayerSheet';
import { colors, fonts } from '../theme/colors';
import { FriendsChat } from './FriendsChat';
import { fetchChat, fetchTaunts, sendTaunt, sendText } from './api';
import { ReportDialog } from '../feedback/ReportDialog';
import type { ChatTab } from './api';
import { chatErrorText, mergeMessages } from './errors';
import { TEXT_RIGHT } from '../theme/direction';
import { useTheme } from '../theme/themeStore';
import { Plate } from '../duel/adultKit';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const POLL_MS = 4000;

/** How long Khale's greeting stays on screen. */
const KHALE_SHOW_MS = 6000;

/**
 * screen-chat of `17 Chat Shop Unlocks` (D103): grape header with two tabs — «همشهری‌ها» (the room of the player's
 * city) and «همه» (everyone) — message bubbles (mine on the start side in yellow), a strip of canned taunts, and the
 * text box. Taunts are always allowed; free text needs an activated account. Refreshes every few seconds.
 */
export function ChatSheet({ onClose, onJoinTable, initialTab = 'city' }: { onClose: () => void; onJoinTable?: (code: string) => void; initialTab?: ChatTab }) {
  const adult = useTheme() === 'adult';
  const [tab, setTab] = useState<ChatTab>(initialTab);
  /** Khale's greeting stays a few seconds, then leaves so the room gets the whole screen. */
  const [khaleOn, setKhaleOn] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setKhaleOn(false), KHALE_SHOW_MS);
    return () => clearTimeout(id);
  }, []);
  /** The «دوستان» tab (private chats) is a separate view; `tab` keeps the last public room. */
  const [friendsView, setFriendsView] = useState(false);
  const [info, setInfo] = useState<Record<ChatTab, ChatHistory | null>>({ city: null, global: null });
  const [messages, setMessages] = useState<Record<ChatTab, ChatMessage[]>>({ city: [], global: [] });
  const [taunts, setTaunts] = useState<TauntCategory[]>([]);
  const [noCity, setNoCity] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [pickCity, setPickCity] = useState(false);
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
  const [reporting, setReporting] = useState<string | null>(null);
  const report = (m: ChatMessage) => setReporting(m.id);

  if (open) return <PlayerSheet playerId={open} onClose={() => setOpen(null)} />;
  if (pickCity) return <CityPicker current={null} onPicked={() => (setPickCity(false), load('city'))} onClose={() => setPickCity(false)} />;
  const cityBlocked = tab === 'city' && noCity;
  const quick = taunts.flatMap((c) => c.taunts).slice(0, 14);
  const t = fa.chat;
  const sub = tab === 'global' ? t.subGlobal : cityInfo?.cityName ? t.subCity(cityInfo.cityName) : '';

  return (
    <PageShell title={t.title} color={colors.candy.grape} backLabel={t.close} onBack={onClose} bandHeight={152} rule={false}>
      <View style={[styles.tabs, adult ? styles.tabsAdult : null]}>
        {(['city', 'global'] as const).map((k) => (
          <Pressable key={k} onPress={() => (setFriendsView(false), setTab(k))} accessibilityRole="tab" accessibilityState={{ selected: !friendsView && tab === k }} style={[styles.tab, !friendsView && tab === k ? styles.tabOn : null, adult ? (!friendsView && tab === k ? styles.tabOnAdult : styles.tabAdult) : null]}>
            <Text style={[styles.tabText, !friendsView && tab === k ? styles.tabTextOn : null, adult ? (!friendsView && tab === k ? styles.tabTextOnAdult : styles.tabTextAdult) : null]}>{k === 'city' ? t.tabCity : t.tabGlobal}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setFriendsView(true)} accessibilityRole="tab" accessibilityState={{ selected: friendsView }} style={[styles.tab, friendsView ? styles.tabOn : null, adult ? (friendsView ? styles.tabOnAdult : styles.tabAdult) : null]}>
          <Text style={[styles.tabText, friendsView ? styles.tabTextOn : null, adult ? (friendsView ? styles.tabTextOnAdult : styles.tabTextAdult) : null]}>{t.tabFriends}</Text>
        </Pressable>
      </View>
      {friendsView ? <FriendsChat meId={meId} onJoinTable={onJoinTable} /> : <>
      {sub ? <Text style={[styles.sub, adult ? styles.subAdult : null]}>{sub}</Text> : null}
      {khaleOn ? <GuideBubble who="khale" text={t.khaleHello} /> : null}

      <ScrollView ref={scroller} style={styles.list} contentContainerStyle={styles.content}>
        {cityBlocked ? (
          <>
            <Text style={styles.hint}>{t.noCity}</Text>
            <Pressable onPress={() => setPickCity(true)} accessibilityRole="button" style={styles.cityBtn}><Text style={styles.cityBtnText}>{t.pickCity}</Text></Pressable>
          </>
        ) : null}
        {!cityBlocked && list.length === 0 ? <Text style={styles.hint}>{t.empty}</Text> : null}
        {list.map((m) => {
          const mine = m.userId === meId;
          const prov = tab === 'global' ? provinceOf(m.province) : null;
          return (
            <View key={m.id} style={[styles.msg, mine ? styles.msgMine : null, adult ? styles.msgAdult : null]}>
              {adult ? null : (
                <Pressable onPress={() => setOpen(m.userId)} accessibilityRole="button" accessibilityLabel={m.nickname}>
                  <Avatar avatar={avatarOf(m.avatarKey)} size={36} />
                </Pressable>
              )}
              <View style={[styles.col, mine ? styles.colMine : null, adult ? [styles.colAdult, mine ? styles.colAdultMine : styles.colAdultTheirs] : null]}>
                <Pressable disabled={!adult} onPress={() => setOpen(m.userId)} accessibilityRole="button" accessibilityLabel={m.nickname} style={styles.nameRow}>
                  {prov ? <ProvinceBadge province={prov} size={16} /> : null}
                  <Text style={[styles.name, mine ? styles.nameMine : null, adult ? (mine ? styles.nameMineAdult : styles.nameAdult) : null]}>{mine ? t.me : m.nickname}{m.badge ? ` · ${m.badge}` : ''}</Text>
                </Pressable>
                {m.kind === 'table' ? (
                  <Pressable onPress={() => onJoinTable?.(m.text.split('|')[0] ?? '')} style={adult ? undefined : styles.tableCard} accessibilityRole="button">
                    {adult ? (
                      <Plate radius={16} border="#E8B64A" from="#3A2A16" to="#24180C" ledge={0} style={styles.bubbleAdult}>
                        <Text style={styles.textAdult}>{t.tableInvite(m.text.split('|').slice(2).join('|'))}</Text>
                        <Text style={styles.joinAdult}>{t.tableJoin}</Text>
                      </Plate>
                    ) : (
                      <>
                        <View style={styles.tableRow}>
                          <View style={styles.tableIcon}><Item icon={m.text.split('|')[1] ?? 'samovar'} /></View>
                          <Text style={styles.text}>{t.tableInvite(m.text.split('|').slice(2).join('|'))}</Text>
                        </View>
                        <Text style={styles.join}>{t.tableJoin}</Text>
                      </>
                    )}
                  </Pressable>
                ) : adult ? (
                  <Plate radius={16} border={mine ? '#E8B64A' : '#5A3A1C'} from={mine ? '#3A2A16' : '#17100C'} to={mine ? '#24180C' : '#17100C'} ledge={0} style={styles.bubbleAdult}>
                    <Text style={styles.textAdult}>{m.text}</Text>
                  </Plate>
                ) : (
                  <View style={[styles.bubble, mine ? styles.bubbleMine : null, m.kind === 'taunt' ? styles.bubbleTaunt : null]}>
                    <Text style={styles.text}>{m.text}</Text>
                  </View>
                )}
                {mine ? null : (
                  <Pressable onPress={() => report(m)} accessibilityRole="button" hitSlop={6}>
                    <Text style={[styles.report, adult ? styles.reportAdult : null]}>{t.report}</Text>
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
                <Pressable key={q.id} onPress={() => taunt(q.id)} accessibilityRole="button" style={[styles.chip, adult ? styles.chipAdult : null]}>
                  <Text style={[styles.chipText, adult ? styles.chipTextAdult : null]}>{q.text}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          {cur?.canType ? (
            <View style={styles.inputRow}>
              <TextInput value={text} onChangeText={setText} maxLength={200} placeholder={t.placeholder} placeholderTextColor={adult ? 'rgba(255,233,168,0.4)' : undefined} style={[styles.input, adult ? styles.inputAdult : null]} accessibilityLabel={t.placeholder} onSubmitEditing={send} returnKeyType="send" />
              <Pressable onPress={send} accessibilityRole="button" accessibilityLabel={t.send} style={({ pressed }) => [adult ? null : styles.send, pressed ? styles.pressed : null]}>
                {adult ? (
                  <Plate radius={14} border="#000" frame={3} ring={0} from="#FFF1B8" to="#8A5A16" height={48} style={styles.sendAdult}><Text style={styles.sendMarkAdult}>➤</Text></Plate>
                ) : (
                  <>
                    <GradientFill from="#B8F08F" to="#5DBB3C" />
                    <Text style={styles.sendMark}>➤</Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : cur && !cur.muted ? (
            <Text style={styles.hint}>{t.needsActivation}</Text>
          ) : null}
        </View>
      )}
      </>}
      {reporting ? <ReportDialog target={{ kind: 'message', messageId: reporting }} onClose={(sent) => (setReporting(null), sent ? setNote(fa.chat.reported) : undefined)} /> : null}
    </PageShell>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  tabsAdult: { marginTop: 0, marginBottom: 0, borderRadius: 14, backgroundColor: '#0E0A08', borderWidth: 2, borderColor: '#8A5A16' },
  tabAdult: { height: 40, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  tabOnAdult: { height: 40, borderRadius: 10, borderWidth: 2, borderColor: '#000', backgroundColor: '#E8B64A' },
  tabTextAdult: { fontSize: 16, color: 'rgba(255,233,168,0.75)' },
  tabTextOnAdult: { fontSize: 16, color: '#2A1606' },
  subAdult: { fontSize: 12, color: '#E8B64A', paddingVertical: 8 },
  msgAdult: { flexDirection: 'column', alignItems: 'stretch' },
  colAdult: { maxWidth: '78%', gap: 3 },
  colAdultMine: { alignSelf: Platform.OS === 'web' ? 'flex-start' : 'flex-end' },
  colAdultTheirs: { alignSelf: Platform.OS === 'web' ? 'flex-end' : 'flex-start' },
  nameAdult: { fontSize: 11.5, color: 'rgba(255,233,168,0.6)' },
  nameMineAdult: { fontSize: 11.5, color: '#E8B64A' },
  bubbleAdult: { paddingVertical: 9, paddingHorizontal: 14, gap: 4 },
  textAdult: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: '#FFE9A8', textAlign: TEXT_RIGHT },
  joinAdult: { fontFamily: fonts.display, fontSize: 16, color: '#E8B64A', textDecorationLine: 'underline', textAlign: TEXT_RIGHT },
  reportAdult: { fontSize: 11, color: 'rgba(255,233,168,0.4)', opacity: 1, textDecorationLine: 'none' },
  chipAdult: { height: 32, backgroundColor: '#17100C', borderWidth: 1.5, borderColor: '#8A5A16', shadowOpacity: 0, elevation: 0 },
  chipTextAdult: { color: '#FFE9A8' },
  inputAdult: { height: 48, borderRadius: 14, borderWidth: 2, borderColor: '#8A5A16', backgroundColor: '#0E0A08', color: '#FFE9A8', fontSize: 14 },
  sendAdult: { width: 52, alignItems: 'center', justifyContent: 'center' },
  sendMarkAdult: { fontSize: 22, color: '#2A1606' },
  cityBtn: { alignSelf: 'center', paddingHorizontal: 18, height: 38, borderRadius: 19, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.candy.yellow, alignItems: 'center', justifyContent: 'center' },
  cityBtnText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  tabs: { marginTop: 0, marginBottom: 22, flexDirection: ROW, gap: 4, padding: 4, borderRadius: 16, backgroundColor: 'rgba(43,18,64,0.45)' },
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
  bubble: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.card, ...lift(3) },
  bubbleMine: { backgroundColor: colors.candy.yellow },
  bubbleTaunt: { backgroundColor: colors.tint },
  text: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 21, color: colors.ink, textAlign: TEXT_RIGHT },
  tableRow: { flexDirection: ROW, alignItems: 'center', gap: 6 },
  tableIcon: { width: 26, height: 26 },
  tableCard: { gap: 4, padding: 8, borderRadius: 14, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#FFF3C4', ...lift(3) },
  join: { fontFamily: fonts.display, fontSize: 14, color: '#7E46D6', textAlign: TEXT_RIGHT },
  report: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink, opacity: 0.7, textDecorationLine: 'underline', paddingHorizontal: 6 },
  footer: { gap: 6, paddingBottom: 14, paddingTop: 4 },
  quick: { flexDirection: ROW, gap: 6, paddingVertical: 2 },
  chip: { height: 38, paddingHorizontal: 12, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.tint, justifyContent: 'center', ...lift(3) },
  chipText: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink },
  inputRow: { flexDirection: ROW, gap: 6, alignItems: 'center' },
  input: { flex: 1, minWidth: 0, height: 52, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.card, paddingHorizontal: 14, fontFamily: fonts.bold, fontSize: 14, color: colors.ink, textAlign: TEXT_RIGHT },
  send: { width: 52, height: 52, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  pressed: { transform: [{ translateY: 3 }] },
  sendMark: { fontSize: 22, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1, ...FACE_TEXT },
});
