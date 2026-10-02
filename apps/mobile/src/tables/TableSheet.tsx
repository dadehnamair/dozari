import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TableView } from '@dozari/shared';
import { DEFAULT_TABLE_ICON, TABLE_ICONS, normalizeTableCode } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { CandyButton } from '../components/CandyButton';
import { Item } from '../components/Item';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { avatarOf } from '../social/avatarOf';
import { colors, fonts } from '../theme/colors';
import { fetchFriends } from '../social/api';
import { OnlineDot } from '../components/OnlineDot';
import { createTable, inviteToTable, extendTable, fetchMyTable, fetchTable, joinTable, kickFromTable, leaveTable, setTableLocked, setTableReady, startTable } from './api';

const INK = '#3A2418';
const errText = (e: unknown) => fa.tables.errors[e instanceof ApiError ? e.code : 'generic'] ?? fa.tables.errors.generic ?? '';

/** «میز اختصاصی»: create a table or enter one by its code, then wait for the guest and start a duel. `initialCode` opens a shared table. */
export function TableSheet({ onClose, initialCode, onShare, onMatch }: { onClose: () => void; initialCode?: string; /** The table's match started: open the duel board. */ onMatch?: () => void; onShare?: (table: TableView) => Promise<void> }) {
  const [table, setTable] = useState<TableView | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(DEFAULT_TABLE_ICON);
  /** Before sitting at a table: the two-choice menu, then the form of the chosen one. */
  const [mode, setMode] = useState<'menu' | 'make' | 'join'>(initialCode ? 'join' : 'menu');
  const [requireReady, setRequireReady] = useState(false);
  const [code, setCode] = useState(initialCode ?? '');

  // Reopen the table the player already sits at; poll while one is open.
  useEffect(() => {
    void fetchMyTable().then((t) => (t ? setTable(t) : initialCode ? enter(initialCode) : undefined), () => undefined);
  }, []);
  const refresh = useCallback(() => {
    if (!table) return;
    fetchTable(table.code).then(setTable, () => setTable(null));
  }, [table]);
  useEffect(() => {
    if (!table) return;
    const timer = setInterval(refresh, 2500);
    return () => clearInterval(timer);
  }, [table, refresh]);

  // Both players are taken to the board as soon as the host starts the match.
  const started = table?.inMatch && table.youAreIn;
  useEffect(() => {
    if (started) onMatch?.();
  }, [started, onMatch]);

  const run = (fn: () => Promise<unknown>) => fn().then(() => (setNote(null), refresh()), (e) => (setNote(errText(e)), refresh()));
  const enter = (c: string) => {
    const norm = normalizeTableCode(c);
    if (!norm) return setNote(fa.tables.errors.NOT_FOUND ?? '');
    joinTable(norm).then((t) => (setNote(null), setTable(t)), (e) => setNote(errText(e)));
  };

  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={fa.tables.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        {table ? (
          <View style={styles.titleRow}>
            <View style={styles.titleIcon}><Item icon={table.icon} /></View>
            <Text style={styles.title}>{table.name}</Text>
          </View>
        ) : <Text style={styles.title}>{mode === 'make' ? fa.tables.createTitle : mode === 'join' ? fa.tables.joinTitle : fa.tables.title}</Text>}
        <ScrollView style={styles.list} contentContainerStyle={styles.content}>
          {table ? (
            <>
              <Text style={styles.code} selectable>{fa.tables.code(table.code)}</Text>
              <Text style={styles.hint}>{table.inMatch ? fa.tables.inMatch : table.players.length < table.seats ? fa.tables.waiting : fa.tables.seats(table.players.length, table.seats)}</Text>
              {table.players.map((p) => (
                <View key={p.id} style={styles.row}>
                  <Avatar avatar={avatarOf(p.avatarKey)} size={32} />
                  <Text style={styles.name}>{p.nickname}</Text>
                  <Text style={styles.hint}>{p.isHost ? fa.tables.host : p.ready ? fa.tables.ready : ''}</Text>
                  {table.youAreHost && !p.isHost ? (
                    <Pressable onPress={() => void run(() => kickFromTable(p.id))} style={styles.pill} accessibilityRole="button"><Text style={styles.pillText}>{fa.tables.kick}</Text></Pressable>
                  ) : null}
                </View>
              ))}
              {table.youAreHost && !table.inMatch && table.players.length < table.seats ? <InviteFriends onNote={setNote} /> : null}
              <Text style={styles.hint}>{fa.tables.friendly}</Text>
              {note ? <Text style={styles.warn}>{note}</Text> : null}
              {table.youAreHost ? (
                <>
                  <CandyButton label={fa.tables.start} color={colors.candy.lime} disabled={table.inMatch || table.players.length < table.seats} onPress={() => void run(startTable)} />
                  <CandyButton label={table.locked ? fa.tables.unlock : fa.tables.lock} color={colors.candy.sky} onPress={() => void run(() => setTableLocked(!table.locked))} />
                  <CandyButton label={fa.tables.extend} color={colors.candy.yellow} onPress={() => void run(extendTable)} />
                  {onShare ? <CandyButton label={fa.tables.share} color={colors.candy.grape} onPress={() => void onShare(table).then(() => setNote(fa.tables.shared), (e) => setNote(errText(e)))} /> : null}
                </>
              ) : table.requireReady ? (
                <CandyButton label={table.players.find((p) => !p.isHost)?.ready ? fa.tables.notReady : fa.tables.imReady} color={colors.candy.lime} onPress={() => void run(() => setTableReady(!table.players.find((p) => !p.isHost)?.ready))} />
              ) : null}
              <CandyButton label={fa.tables.leave} color={colors.candy.orange} onPress={() => void leaveTable().then(() => setTable(null), () => setTable(null))} />
            </>
          ) : (
            mode === 'menu' ? (
              <>
                <Text style={styles.hint}>{fa.tables.intro}</Text>
                <Pressable onPress={() => setMode('join')} style={[styles.choice, { backgroundColor: colors.candy.sky }]} accessibilityRole="button">
                  <View style={styles.choiceIcon}><Item icon="key" /></View>
                  <View style={styles.grow}>
                    <Text style={styles.choiceTitle}>{fa.tables.menuJoin}</Text>
                    <Text style={styles.hint}>{fa.tables.menuJoinHint}</Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => setMode('make')} style={[styles.choice, { backgroundColor: colors.candy.lime }]} accessibilityRole="button">
                  <View style={styles.choiceIcon}><Item icon="samovar" /></View>
                  <View style={styles.grow}>
                    <Text style={styles.choiceTitle}>{fa.tables.menuMake}</Text>
                    <Text style={styles.hint}>{fa.tables.menuMakeHint}</Text>
                  </View>
                </Pressable>
              </>
            ) : mode === 'make' ? (
              <>
                <TextInput value={name} onChangeText={setName} maxLength={30} placeholder={fa.tables.namePlaceholder} style={styles.input} />
                <Text style={styles.label}>{fa.tables.iconTitle}</Text>
                <View style={styles.icons}>
                  {TABLE_ICONS.map((k) => (
                    <Pressable key={k} onPress={() => setIcon(k)} accessibilityRole="button" accessibilityState={{ selected: icon === k }} style={[styles.iconCell, icon === k ? styles.iconOn : null]}>
                      <Item icon={k} />
                    </Pressable>
                  ))}
                </View>
                <Pressable onPress={() => setRequireReady(!requireReady)} accessibilityRole="checkbox" accessibilityState={{ checked: requireReady }}>
                  <Text style={styles.hint}>{requireReady ? '☑' : '☐'} {fa.tables.requireReady}</Text>
                </Pressable>
                {note ? <Text style={styles.warn}>{note}</Text> : null}
                <CandyButton label={fa.tables.create} color={colors.candy.lime} disabled={name.trim().length === 0} onPress={() => createTable({ name: name.trim(), icon: icon as (typeof TABLE_ICONS)[number], requireReady }).then((t) => (setNote(null), setTable(t)), (e) => setNote(errText(e)))} />
                <CandyButton label={fa.tables.back} color={colors.candy.sky} onPress={() => (setNote(null), setMode('menu'))} />
              </>
            ) : (
              <>
                <View style={styles.row}>
                  <TextInput value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} maxLength={10} placeholder={fa.tables.codePlaceholder} style={[styles.input, styles.grow]} />
                  <Pressable onPress={() => enter(code)} style={styles.pill} accessibilityRole="button"><Text style={styles.pillText}>{fa.tables.join}</Text></Pressable>
                </View>
                {note ? <Text style={styles.warn}>{note}</Text> : null}
                <CandyButton label={fa.tables.back} color={colors.candy.sky} onPress={() => (setNote(null), setMode('menu'))} />
              </>
            )
          )}
        </ScrollView>
        <CandyButton label={fa.tables.close} color={colors.candy.sky} onPress={onClose} />
      </Pressable>
    </Pressable>
  );
}

/** Host-only: the friends list with online dots and an invite button each (a join card in their private chat; offline friends get a Bale nudge). */
function InviteFriends({ onNote }: { onNote: (text: string | null) => void }) {
  const [friends, setFriends] = useState<{ id: string; nickname: string; avatarKey: string; online: boolean }[] | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  useEffect(() => {
    void fetchFriends().then((f) => setFriends([...f.friends].sort((a, b) => Number(b.online) - Number(a.online))), () => setFriends([]));
  }, []);
  const invite = (id: string) =>
    inviteToTable(id).then(
      (r) => (setSent((s) => new Set(s).add(id)), onNote(r.online ? fa.tables.inviteOnline : fa.tables.inviteOffline)),
      (e) => onNote(errText(e)),
    );
  return (
    <View style={styles.invites}>
      <Text style={styles.label}>{fa.tables.inviteTitle}</Text>
      {friends && friends.length === 0 ? <Text style={styles.hint}>{fa.tables.inviteNoFriends}</Text> : null}
      {friends?.map((f) => (
        <View key={f.id} style={styles.row}>
          <View>
            <Avatar avatar={avatarOf(f.avatarKey)} size={32} />
            <View style={styles.dotPos}><OnlineDot online={f.online} size={12} /></View>
          </View>
          <Text style={styles.name} numberOfLines={1}>{f.nickname}</Text>
          <Pressable onPress={() => void invite(f.id)} disabled={sent.has(f.id)} style={[styles.pill, sent.has(f.id) ? styles.pillDone : null]} accessibilityRole="button">
            <Text style={styles.pillText}>{sent.has(f.id) ? '✓' : fa.tables.invite}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  invites: { gap: 6 },
  dotPos: { position: 'absolute', bottom: -2, right: -2 },
  pillDone: { opacity: 0.5 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  sheet: { width: '100%', maxWidth: 420, maxHeight: '90%', backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 14, gap: 8, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 22, color: INK },
  list: { alignSelf: 'stretch', flexGrow: 0 },
  content: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  code: { fontFamily: fonts.display, fontSize: 24, color: INK, textAlign: 'center', letterSpacing: 2 },
  label: { fontFamily: fonts.bold, fontSize: 15, color: INK, marginTop: 6 },
  name: { fontFamily: fonts.bold, fontSize: 14, color: INK, flex: 1 },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.8 },
  warn: { fontFamily: fonts.bold, fontSize: 13, color: '#B3261E' },
  input: { fontFamily: fonts.bold, fontSize: 14, color: INK, borderWidth: 2, borderColor: INK, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fff', textAlign: 'right' },
  grow: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleIcon: { width: 34, height: 34 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 18, borderWidth: 3, borderColor: INK },
  choiceIcon: { width: 44, height: 44 },
  choiceTitle: { fontFamily: fonts.display, fontSize: 18, color: INK, textAlign: 'right' },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  iconCell: { width: 48, height: 48, padding: 5, borderRadius: 12, borderWidth: 2, borderColor: 'transparent', backgroundColor: '#fff' },
  iconOn: { borderColor: INK, backgroundColor: colors.candy.yellow },
  pill: { borderWidth: 2, borderColor: INK, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.candy.yellow },
  pillText: { fontFamily: fonts.bold, fontSize: 13, color: INK },
});
