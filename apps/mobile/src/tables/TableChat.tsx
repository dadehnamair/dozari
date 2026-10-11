import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ChatMessage } from '@dozari/shared';
import { fetchTableChat, sendTableChat } from '../chat/api';
import { chatErrorText, mergeMessages } from '../chat/errors';
import { GradientFill } from '../components/GradientFill';
import { ReportDialog } from '../feedback/ReportDialog';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { colors, fonts } from '../theme/colors';
import { TEXT_RIGHT } from '../theme/direction';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const POLL_MS = 3000;

/** Text chat of a private table: everyone seated reads and writes (same server rules as the other rooms). */
export function TableChat({ code, meId }: { code: string; meId: string | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [canType, setCanType] = useState(true);
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const scroller = useRef<ScrollView>(null);
  const fail = (e: unknown) => setNote(chatErrorText(e instanceof ApiError ? e.code : 'generic'));
  const load = useCallback(() => {
    fetchTableChat(code).then((h) => (setMessages((cur) => mergeMessages(cur, h.messages)), setCanType(h.canType)), fail);
  }, [code]);
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
    void sendTableChat(code, text).then((m) => (setMessages((c) => mergeMessages(c, [m])), setText(''), setNote(null)), fail);
  };
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{fa.chat.tableTitle}</Text>
      <ScrollView ref={scroller} nestedScrollEnabled style={styles.msgs} contentContainerStyle={styles.msgsContent}>
        {messages.length === 0 ? <Text style={styles.hint}>{fa.chat.tableEmpty}</Text> : null}
        {messages.map((m) => {
          const mine = m.userId === meId;
          return (
            <View key={m.id} style={[styles.msg, mine ? styles.mine : null]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : null]}>
                {mine ? null : <Text style={styles.who}>{m.nickname}</Text>}
                <Text style={styles.text}>{m.text}</Text>
              </View>
              {mine ? null : (
                <Pressable onPress={() => setReporting(m.id)} accessibilityRole="button" hitSlop={6}>
                  <Text style={styles.report}>{fa.chat.report}</Text>
                </Pressable>
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
      {reporting ? <ReportDialog target={{ kind: 'message', messageId: reporting }} onClose={(sent) => (setReporting(null), sent ? setNote(fa.chat.reported) : undefined)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 6, padding: 8, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.card },
  title: { fontFamily: fonts.display, fontSize: 15, color: colors.ink, textAlign: TEXT_RIGHT },
  msgs: { maxHeight: 160 },
  msgsContent: { gap: 6, flexGrow: 1, justifyContent: 'flex-end' },
  msg: { flexDirection: ROW },
  mine: { flexDirection: Platform.OS === 'web' ? 'row' : 'row-reverse' },
  bubble: { maxWidth: '85%', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 14, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#F5F0FF' },
  bubbleMine: { backgroundColor: colors.candy.yellow },
  who: { fontFamily: fonts.display, fontSize: 11, color: '#7E46D6', textAlign: TEXT_RIGHT },
  text: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 20, color: colors.ink, textAlign: TEXT_RIGHT },
  report: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink, opacity: 0.7, textDecorationLine: 'underline', paddingHorizontal: 6, alignSelf: 'flex-end' },
  hint: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 20, color: colors.ink, textAlign: 'center' },
  warn: { fontFamily: fonts.bold, fontSize: 12, color: '#B3261E', textAlign: 'center' },
  inputRow: { flexDirection: ROW, gap: 8, alignItems: 'center' },
  input: { flex: 1, height: 40, borderRadius: 12, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.card, paddingHorizontal: 10, fontFamily: fonts.bold, fontSize: 13, color: colors.ink, textAlign: TEXT_RIGHT },
  send: { width: 40, height: 40, borderRadius: 12, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  sendMark: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
});
