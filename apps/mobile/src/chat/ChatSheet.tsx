import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ChatHistory, ChatMessage, TauntCategory } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { CandyButton } from '../components/CandyButton';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { avatarOf } from '../social/avatarOf';
import { PlayerSheet } from '../social/PlayerSheet';
import { colors, fonts } from '../theme/colors';
import { fetchCityChat, fetchTaunts, reportMessage, sendTaunt, sendText } from './api';
import { chatErrorText, mergeMessages } from './errors';

const INK = '#3A2418';
const POLL_MS = 4000;

/** «چت همشهری‌ها»: the room of the player's city. Messages refresh every few seconds; taunts are always allowed, free text needs an activated account. */
export function ChatSheet({ onClose, onJoinTable }: { onClose: () => void; onJoinTable?: (code: string) => void }) {
  const [info, setInfo] = useState<ChatHistory | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [taunts, setTaunts] = useState<TauntCategory[]>([]);
  const [noCity, setNoCity] = useState(false);
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [tauntOpen, setTauntOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const scroller = useRef<ScrollView>(null);

  const load = useCallback(() => {
    fetchCityChat().then(
      (h) => (setInfo(h), setMessages((cur) => mergeMessages(cur, h.messages)), setNoCity(false)),
      (e) => (e instanceof ApiError && e.code === 'NO_CITY' ? setNoCity(true) : undefined),
    );
  }, []);
  useEffect(() => {
    load();
    fetchTaunts().then(setTaunts, () => undefined);
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const afterSend = (m: ChatMessage) => (setMessages((cur) => mergeMessages(cur, [m])), setNote(null), setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50));
  const fail = (e: unknown) => setNote(chatErrorText(e instanceof ApiError ? e.code : 'generic'));
  const send = () => {
    if (text.trim() === '') return;
    void sendText(text).then((m) => (afterSend(m), setText('')), fail);
  };
  const taunt = (id: string) => void sendTaunt(id).then((m) => (afterSend(m), setTauntOpen(false)), fail);
  const report = (m: ChatMessage) => void reportMessage(m.id).then(() => setNote(fa.chat.reported), () => setNote(fa.chat.errors.generic ?? ''));

  if (open) return <PlayerSheet playerId={open} onClose={() => setOpen(null)} />;
  const category = taunts.find((c) => c.id === (picked ?? taunts[0]?.id));
  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={fa.chat.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <Text style={styles.title}>{info?.cityName ? fa.chat.title(info.cityName) : fa.chat.open}</Text>
        {noCity ? <Text style={styles.hint}>{fa.chat.noCity}</Text> : null}
        <ScrollView ref={scroller} style={styles.list} contentContainerStyle={styles.content}>
          {!noCity && messages.length === 0 ? <Text style={styles.hint}>{fa.chat.empty}</Text> : null}
          {messages.map((m) => (
            <View key={m.id} style={styles.msg}>
              <Pressable onPress={() => setOpen(m.userId)} accessibilityRole="button"><Avatar avatar={avatarOf(m.avatarKey)} size={32} /></Pressable>
              <View style={styles.msgBody}>
                <Text style={styles.name}>{m.nickname}{m.badge ? ` · ${m.badge}` : ''}</Text>
                {m.kind === 'table' ? (
                  <Pressable onPress={() => onJoinTable?.(m.text.split('|')[0] ?? '')} style={styles.tableCard} accessibilityRole="button">
                    <Text style={styles.text}>{fa.chat.tableInvite(m.text.split('|').slice(1).join('|'))}</Text>
                    <Text style={styles.pillText}>{fa.chat.tableJoin}</Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.text, m.kind === 'taunt' && styles.taunt]}>{m.text}</Text>
                )}
              </View>
              <Pressable onPress={() => report(m)} accessibilityRole="button"><Text style={styles.report}>{fa.chat.report}</Text></Pressable>
            </View>
          ))}
        </ScrollView>
        {info?.muted ? <Text style={styles.warn}>{fa.chat.muted}{info.muted.reason ? ` (${info.muted.reason})` : ''}</Text> : null}
        {note ? <Text style={[styles.hint, styles.warn]}>{note}</Text> : null}
        {tauntOpen ? (
          <View style={styles.tauntBox}>
            <View style={styles.row}>
              {taunts.map((c) => (
                <Pressable key={c.id} onPress={() => setPicked(c.id)} style={[styles.pill, c.id === category?.id && styles.on]}><Text style={styles.pillText}>{c.nameFa}</Text></Pressable>
              ))}
            </View>
            <View style={styles.row}>
              {category?.taunts.map((t) => (
                <Pressable key={t.id} onPress={() => taunt(t.id)} style={styles.tauntChip}><Text style={styles.pillText}>{t.text}</Text></Pressable>
              ))}
            </View>
          </View>
        ) : null}
        {!noCity ? (
          <View style={styles.row}>
            <Pressable onPress={() => setTauntOpen((v) => !v)} style={[styles.pill, tauntOpen && styles.on]} accessibilityRole="button"><Text style={styles.pillText}>{fa.chat.taunts}</Text></Pressable>
            {info?.canType ? (
              <>
                <TextInput value={text} onChangeText={setText} maxLength={200} placeholder={fa.chat.placeholder} style={styles.input} accessibilityLabel={fa.chat.placeholder} onSubmitEditing={send} />
                <Pressable onPress={send} style={[styles.pill, styles.on]} accessibilityRole="button"><Text style={styles.pillText}>{fa.chat.send}</Text></Pressable>
              </>
            ) : info && !info.muted ? (
              <Text style={styles.hint}>{fa.chat.needsActivation}</Text>
            ) : null}
          </View>
        ) : null}
        <CandyButton label={fa.chat.close} color={colors.candy.sky} onPress={onClose} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tableCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 12, borderWidth: 2, borderColor: INK, backgroundColor: '#FFF3C4' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  sheet: { width: '100%', maxWidth: 420, height: '86%', backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 12, gap: 8, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 22, color: INK },
  list: { alignSelf: 'stretch', flex: 1 },
  content: { gap: 8 },
  msg: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  msgBody: { flex: 1, gap: 1 },
  name: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.7 },
  text: { fontFamily: fonts.bold, fontSize: 14, color: INK },
  taunt: { color: '#8A2BE2' },
  report: { fontFamily: fonts.bold, fontSize: 11, color: INK, opacity: 0.5 },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.8, textAlign: 'center' },
  warn: { fontFamily: fonts.bold, fontSize: 13, color: '#B3261E' },
  row: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap', alignSelf: 'stretch' },
  tauntBox: { alignSelf: 'stretch', gap: 6 },
  input: { flex: 1, minWidth: 120, fontFamily: fonts.bold, fontSize: 15, color: INK, borderWidth: 2, borderColor: INK, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#fff' },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 2, borderColor: INK, backgroundColor: colors.cream },
  tauntChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 2, borderColor: INK, backgroundColor: '#E8D5FF' },
  on: { backgroundColor: '#FFC93C' },
  pillText: { fontFamily: fonts.bold, fontSize: 13, color: INK },
});
