import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TableView } from '@dozari/shared';
import { DEFAULT_TABLE_ICON, TABLE_ENTRY_MAX, TABLE_PRICE_ROUNDS_MAX, TABLE_HOUSE_CUT_PERCENT, TABLE_ROUNDS_MAX, TABLE_ROUNDS_MIN, TABLE_ICONS, normalizeTableCode, tableMinEntry, toPersianDigits } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { CandyButton } from '../components/CandyButton';
import { playSfx } from '../sound/engine';
import { DARK, useDark } from '../theme/skin';
import { Item } from '../components/Item';
import { GuideBubble } from '../components/GuideBubble';
import { useConfirm } from '../components/useConfirm';
import { fa } from '../i18n/fa';
import { SheetClose } from '../components/SheetClose';
import { ApiError } from '../net/http';
import { useGuardianGate } from '../agetrack/GuardianGate';
import { fetchChildren, fetchMyGuardian } from '../agetrack/guardianApi';
import { avatarOf } from '../social/avatarOf';
import { colors, fonts } from '../theme/colors';
import { fetchFriends } from '../social/api';
import { OnlineDot } from '../components/OnlineDot';
import { OpenTables } from './OpenTables';
import { answerRequest, createTable, inviteToTable, extendTable, fetchMyTable, fetchTable, joinTable, kickFromTable, leaveTable, setTableLocked, setTableReady, setTableSide, startTable } from './api';
import { useHardwareBack } from '../nav/useHardwareBack';
import { TableChat } from './TableChat';
import { TableLobby } from './TableLobby';
import { TEXT_RIGHT } from '../theme/direction';

const INK = '#3A2418';

/** Overrides for the adult look: a dark panel with a gold frame and cream-gold text. */
const dk = StyleSheet.create({
  sheet: { backgroundColor: DARK.panel, borderColor: DARK.frame },
  text: { color: DARK.text, opacity: 1 },
  input: { backgroundColor: DARK.field, borderColor: DARK.frame, color: DARK.text },
  cell: { backgroundColor: DARK.raised },
});
const errText = (e: unknown) => fa.tables.errors[e instanceof ApiError ? e.code : 'network'] ?? fa.tables.errors.generic ?? '';

/** «میز اختصاصی»: create a table or enter one by its code, then wait for the guest and start a duel. `initialCode` opens a shared table. */
export function TableSheet({ onClose, initialCode, onShare, onMatch }: { onClose: () => void; initialCode?: string; /** The table's match started: open the duel board. */ onMatch?: () => void; onShare?: (table: TableView) => Promise<void> }) {
  const dark = useDark();
  useHardwareBack(onClose);
  const { ask, dialog } = useConfirm();
  const { gate, intercept } = useGuardianGate();
  /** A kid/teen with no guardian opens the guardian step instead of seeing an error line. */
  const fail = (e: unknown) => (intercept(e) ? setNote(null) : setNote(errText(e)));
  const [table, setTable] = useState<TableView | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(DEFAULT_TABLE_ICON);
  /** Before sitting at a table: the two-choice menu, then the form of the chosen one. */
  const [mode, setMode] = useState<'menu' | 'make' | 'join' | 'open'>(initialCode ? 'join' : 'menu');
  /** Boards played, the entry each player pays (never below the minimum for the rounds) and whether the table hides from the open list. */
  const [rounds, setRounds] = useState<number>(TABLE_ROUNDS_MIN);
  const [entry, setEntry] = useState<number>(tableMinEntry(TABLE_ROUNDS_MIN));
  const [isPrivate, setIsPrivate] = useState(false);
  /** Price-guess questions after the boards: on/off and how many (a 1v1 table only). */
  const [pricing, setPricing] = useState(true);
  const [priceCount, setPriceCount] = useState<number>(TABLE_PRICE_ROUNDS_MAX);
  const minEntry = tableMinEntry(rounds);
  const pickRounds = (n: number) => {
    const next = Math.min(TABLE_ROUNDS_MAX, Math.max(TABLE_ROUNDS_MIN, n));
    setRounds(next);
    setEntry((e) => Math.max(e, tableMinEntry(next)));
  };
  const [requireReady, setRequireReady] = useState(false);
  const [family, setFamily] = useState(false);
  /** A guardian with children, or a child with a guardian: only they are offered a family table. Errors (feature off) read as no family. */
  const [hasFamily, setHasFamily] = useState(false);
  useEffect(() => {
    let alive = true;
    void Promise.all([fetchMyGuardian().catch(() => false), fetchChildren().then((c) => c.children.length > 0).catch(() => false)]).then(([linked, parent]) => alive && setHasFamily(linked || parent));
    return () => {
      alive = false;
    };
  }, []);
  const [format, setFormat] = useState<'1v1' | '2v2'>('1v1');
  const [code, setCode] = useState(initialCode ?? '');

  // Reopen the table the player already sits at; poll while one is open.
  useEffect(() => {
    void fetchMyTable().then((t) => (t ? setTable(t) : initialCode ? enter(initialCode) : undefined), () => undefined);
  }, []);
  /** Failed polls in a row: one lost request must not throw the player out of the table; only «not found» does. */
  const misses = useRef(0);
  const refresh = useCallback(() => {
    if (!table) return;
    fetchTable(table.code).then(
      (t) => ((misses.current = 0), setTable(t)),
      (e) => {
        if (e instanceof ApiError && (e.status === 404 || e.status === 410 || e.status === 401)) {
          // The host closed the table, it timed out, or this seat was taken away.
          setTable(null);
          setMode('menu');
          setNote(fa.tables.errors[e.status === 410 ? 'EXPIRED' : 'NOT_FOUND'] ?? null);
          return;
        }
        misses.current += 1;
        if (misses.current >= 3) setNote(fa.tables.lobby.connection);
      },
    );
  }, [table]);
  useEffect(() => {
    if (!table) return;
    const timer = setInterval(refresh, 2500);
    return () => clearInterval(timer);
  }, [table, refresh]);

  // Both players are taken to the board as soon as the host starts the match.
  const started = table?.inMatch && table.youAreIn;
  const full = !!table && table.players.length >= table.seats;
  /** A 2v2 starts only with two on each team. */
  const teamsOk = !table || table.format !== '2v2' || ([0, 1] as const).every((sd) => table.players.filter((p) => p.side === sd).length === 2);
  useEffect(() => {
    if (started) onMatch?.();
  }, [started, onMatch]);

  /** One table action at a time: a second tap while the first is on its way is ignored, and the lock always lets go (an action that never answers must not freeze the buttons). */
  const [busy, setBusy] = useState(false);
  const run = (fn: () => Promise<unknown>) => {
    if (busy) return Promise.resolve();
    setBusy(true);
    const release = setTimeout(() => setBusy(false), 8000);
    return fn()
      .then(() => (setNote(null), refresh()), (e) => (fail(e), refresh()))
      .finally(() => (clearTimeout(release), setBusy(false)));
  };
  const enter = (c: string) => {
    const norm = normalizeTableCode(c);
    if (!norm) return setNote(fa.tables.errors.NOT_FOUND ?? '');
    joinTable(norm).then((t) => (setNote(null), setTable(t)), fail);
  };

  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={fa.tables.close}>
      <Pressable style={[styles.sheet, dark ? dk.sheet : null]} onPress={() => undefined}>
        <SheetClose onPress={onClose} label={fa.tables.close} />
        {table ? (
          <View style={styles.titleRow}>
            <View style={styles.titleIcon}><Item icon={table.icon} /></View>
            <Text style={[styles.title, dark ? dk.text : null]}>{table.name}</Text>
          </View>
        ) : <Text style={[styles.title, dark ? dk.text : null]}>{mode === 'make' ? fa.tables.createTitle : mode === 'join' ? fa.tables.joinTitle : mode === 'open' ? fa.tables.openList.title : fa.tables.title}</Text>}
        <ScrollView style={styles.list} contentContainerStyle={styles.content}>
          <GuideBubble who="goli" text={fa.tables.goliHello} />
          {table ? (
            <>
              <Text style={[styles.code, dark ? dk.text : null]} selectable>{fa.tables.code(table.code)}</Text>
              <Text style={[styles.hint, dark ? dk.text : null]}>{table.inMatch ? fa.tables.inMatch : table.players.length < table.seats ? fa.tables.waiting : fa.tables.seats(table.players.length, table.seats)}</Text>
              <View style={styles.chipsRow}>
                <Text style={styles.infoChip}>{fa.tables.rounds(table.rounds)}</Text>
                {table.format === '1v1' ? <Text style={styles.infoChip}>{table.priceRounds > 0 ? fa.tables.priceCount(table.priceRounds) : fa.tables.noPrice}</Text> : null}
                <Text style={styles.infoChip}>{fa.tables.entry(table.entryFee)}</Text>
                <Text style={styles.infoChip}>{table.isPrivate ? fa.tables.privateTag : fa.tables.publicTag}</Text>
              </View>
              {table.entryFee > 0 ? <Text style={[styles.hint, dark ? dk.text : null]}>{fa.tables.prizeNote((table.entryFee * table.seats * (100 - TABLE_HOUSE_CUT_PERCENT)) / 100, TABLE_HOUSE_CUT_PERCENT)}</Text> : null}
              {table.youAreHost && table.requests.length > 0 ? (
                <View style={styles.requests}>
                  <Text style={styles.label}>{fa.tables.requestsTitle}</Text>
                  {table.requests.map((r) => (
                    <View key={r.id} style={styles.row}>
                      <Avatar avatar={avatarOf(r.avatarKey)} size={32} />
                      <Text style={styles.name} numberOfLines={1}>{r.nickname}</Text>
                      <Pressable onPress={() => void run(() => answerRequest(r.id, true))} style={[styles.pill, { backgroundColor: colors.candy.lime }]} accessibilityRole="button"><Text style={styles.pillText}>{fa.tables.accept}</Text></Pressable>
                      <Pressable onPress={() => void run(() => answerRequest(r.id, false))} style={styles.pill} accessibilityRole="button"><Text style={styles.pillText}>{fa.tables.decline}</Text></Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              <TableLobby table={table} onSit={(side) => void run(() => setTableSide(side))} onKick={(id) => void run(() => kickFromTable(id))} />
              {note ? <Text style={styles.warn}>{note}</Text> : null}
              {table.youAreHost && !table.inMatch && table.players.length < table.seats ? <InviteFriends onNote={setNote} /> : null}
              <TableChat code={table.code} meId={table.players.find((p) => p.isYou)?.id ?? null} />
              <Text style={[styles.hint, dark ? dk.text : null]}>{fa.tables.friendly}</Text>
              {table.youAreHost ? (
                <>
                  {!full ? <Text style={[styles.hint, dark ? dk.text : null]}>{fa.tables.lobby.hostNeeds(table.seats - table.players.length)}</Text> : !teamsOk ? <Text style={styles.warn}>{fa.tables.lobby.teamsUneven}</Text> : null}
                  <CandyButton label={fa.tables.start} color={colors.candy.lime} disabled={table.inMatch || !full || !teamsOk || busy} onPress={() => void run(startTable)} />
                  <View style={styles.chips}>
                    <Chip label={table.locked ? fa.tables.unlock : fa.tables.lock} color={colors.candy.sky} onPress={() => void run(() => setTableLocked(!table.locked))} />
                    <Chip label={fa.tables.extend} color={colors.candy.yellow} onPress={() => void run(extendTable)} />
                    {onShare ? <Chip label={fa.tables.share} color={colors.candy.grape} onPress={() => void onShare(table).then(() => setNote(fa.tables.shared), (e) => setNote(errText(e)))} /> : null}
                  </View>
                </>
              ) : table.requireReady ? (
                <CandyButton label={table.players.find((p) => p.isYou)?.ready ? fa.tables.notReady : fa.tables.imReady} color={colors.candy.lime} onPress={() => void run(() => setTableReady(!table.players.find((p) => p.isYou)?.ready))} />
              ) : <Text style={[styles.hint, dark ? dk.text : null]}>{fa.tables.lobby.waitingHost}</Text>}
              <View style={styles.chips}><Chip label={fa.tables.leave} color={colors.candy.orange} onPress={() => ask({ title: fa.confirm.leaveTable.title, message: fa.confirm.leaveTable.message, confirmLabel: fa.confirm.leaveTable.yes, onConfirm: () => void leaveTable().then(() => setTable(null), () => setTable(null)) })} /></View>
            </>
          ) : (
            mode === 'menu' ? (
              <>
                <Text style={[styles.hint, dark ? dk.text : null]}>{fa.tables.intro}</Text>
                <Pressable onPress={() => setMode('open')} style={[styles.choice, { backgroundColor: colors.candy.yellow }]} accessibilityRole="button">
                  <View style={styles.choiceIcon}><Item icon="lantern" /></View>
                  <View style={styles.grow}>
                    <Text style={styles.choiceTitle}>{fa.tables.menuOpen}</Text>
                    <Text style={styles.hint}>{fa.tables.menuOpenHint}</Text>
                  </View>
                </Pressable>
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
                <TextInput value={name} onChangeText={setName} maxLength={30} placeholder={fa.tables.namePlaceholder} style={[styles.input, dark ? dk.input : null]} />
                <Text style={[styles.label, dark ? dk.text : null]}>{fa.tables.iconTitle}</Text>
                <View style={styles.icons}>
                  {TABLE_ICONS.map((k) => (
                    <Pressable key={k} onPress={() => setIcon(k)} accessibilityRole="button" accessibilityState={{ selected: icon === k }} style={[styles.iconCell, dark ? dk.cell : null, icon === k ? styles.iconOn : null]}>
                      <Item icon={k} />
                    </Pressable>
                  ))}
                </View>
                <Text style={[styles.label, dark ? dk.text : null]}>{fa.tables.formatTitle}</Text>
                <View style={styles.row}>
                  {(['1v1', '2v2'] as const).map((f) => (
                    <Pressable key={f} onPress={() => setFormat(f)} accessibilityRole="button" accessibilityState={{ selected: format === f }} style={[styles.pill, format === f ? { backgroundColor: colors.candy.lime } : null]}>
                      <Text style={styles.pillText}>{f === '1v1' ? fa.tables.format1v1 : fa.tables.format2v2}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.label}>{fa.tables.roundsTitle}</Text>
                <Stepper label={fa.tables.rounds(rounds)} onMinus={() => pickRounds(rounds - 1)} onPlus={() => pickRounds(rounds + 1)} minusOff={rounds <= TABLE_ROUNDS_MIN} plusOff={rounds >= TABLE_ROUNDS_MAX} />
                <Text style={styles.label}>{fa.tables.priceTitle}</Text>
                {format === '2v2' ? <Text style={styles.hint}>{fa.tables.priceTeamNote}</Text> : (
                  <>
                    <Pressable onPress={() => setPricing(!pricing)} accessibilityRole="checkbox" accessibilityState={{ checked: pricing }}>
                      <Text style={styles.hint}>{pricing ? '☑' : '☐'} {fa.tables.priceOn}</Text>
                    </Pressable>
                    {pricing ? <Stepper label={fa.tables.priceCount(priceCount)} onMinus={() => setPriceCount((c) => Math.max(1, c - 1))} onPlus={() => setPriceCount((c) => Math.min(TABLE_PRICE_ROUNDS_MAX, c + 1))} minusOff={priceCount <= 1} plusOff={priceCount >= TABLE_PRICE_ROUNDS_MAX} /> : null}
                  </>
                )}
                <Text style={styles.label}>{fa.tables.entryTitle}</Text>
                <Stepper label={`${toPersianDigits(String(entry))} ${fa.tables.coins}`} onMinus={() => setEntry((e) => Math.max(minEntry, e - 10))} onPlus={() => setEntry((e) => Math.min(TABLE_ENTRY_MAX, e + 10))} minusOff={entry <= minEntry} plusOff={entry >= TABLE_ENTRY_MAX} />
                <Text style={styles.hint}>{fa.tables.entryHint(minEntry)}</Text>
                <Pressable onPress={() => setIsPrivate(!isPrivate)} accessibilityRole="checkbox" accessibilityState={{ checked: isPrivate }}>
                  <Text style={styles.hint}>{isPrivate ? '☑' : '☐'} {fa.tables.isPrivate}</Text>
                </Pressable>
                <Pressable onPress={() => setRequireReady(!requireReady)} accessibilityRole="checkbox" accessibilityState={{ checked: requireReady }}>
                  <Text style={[styles.hint, dark ? dk.text : null]}>{requireReady ? '☑' : '☐'} {fa.tables.requireReady}</Text>
                </Pressable>
                {hasFamily ? (
                  <Pressable onPress={() => setFamily(!family)} accessibilityRole="checkbox" accessibilityState={{ checked: family }}>
                    <Text style={[styles.hint, dark ? dk.text : null]}>{family ? '☑' : '☐'} {fa.tables.family}</Text>
                  </Pressable>
                ) : null}
                {note ? <Text style={styles.warn}>{note}</Text> : null}
                <CandyButton label={fa.tables.create} color={colors.candy.lime} disabled={name.trim().length === 0} onPress={() => createTable({ name: name.trim(), icon: icon as (typeof TABLE_ICONS)[number], requireReady, format, family: hasFamily && family, rounds, entryFee: Math.max(entry, minEntry), isPrivate, priceRounds: format === '2v2' || !pricing ? 0 : priceCount }).then((t) => (setNote(null), setTable(t)), fail)} />
                <View style={styles.chips}><Chip label={fa.tables.back} color={colors.candy.sky} onPress={() => (setNote(null), setMode('menu'))} /></View>
              </>
            ) : mode === 'open' ? (
              <>
                <OpenTables onSeated={(t) => (setNote(null), setTable(t))} onNote={setNote} errText={errText} />
                {note ? <Text style={styles.warn}>{note}</Text> : null}
                <CandyButton label={fa.tables.back} sfx="back" color={colors.candy.sky} onPress={() => (setNote(null), setMode('menu'))} />
              </>
            ) : (
              <>
                <View style={styles.row}>
                  <TextInput value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} maxLength={10} placeholder={fa.tables.codePlaceholder} style={[styles.input, styles.grow, dark ? dk.input : null]} />
                  <Pressable onPress={() => enter(code)} style={styles.pill} accessibilityRole="button"><Text style={styles.pillText}>{fa.tables.join}</Text></Pressable>
                </View>
                {note ? <Text style={styles.warn}>{note}</Text> : null}
                <View style={styles.chips}><Chip label={fa.tables.back} color={colors.candy.sky} onPress={() => (setNote(null), setMode('menu'))} /></View>
              </>
            )
          )}
        </ScrollView>
      </Pressable>
      {dialog}
      {gate}
    </Pressable>
  );
}

/** A − / + control around a value (rounds, entry fee). */
function Stepper({ label, onMinus, onPlus, minusOff, plusOff }: { label: string; onMinus: () => void; onPlus: () => void; minusOff: boolean; plusOff: boolean }) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={onPlus} disabled={plusOff} style={[styles.stepBtn, plusOff ? styles.stepOff : null]} accessibilityRole="button" accessibilityLabel="+"><Text style={styles.stepMark}>+</Text></Pressable>
      <Text style={styles.stepValue}>{label}</Text>
      <Pressable onPress={onMinus} disabled={minusOff} style={[styles.stepBtn, minusOff ? styles.stepOff : null]} accessibilityRole="button" accessibilityLabel="−"><Text style={styles.stepMark}>−</Text></Pressable>
    </View>
  );
}

/** Host-only: the friends list with online dots and an invite button each (a join card in their private chat; offline friends get a Bale nudge). */
function InviteFriends({ onNote }: { onNote: (text: string | null) => void }) {
  const dark = useDark();
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
      <Text style={[styles.label, dark ? dk.text : null]}>{fa.tables.inviteTitle}</Text>
      {friends && friends.length === 0 ? <Text style={[styles.hint, dark ? dk.text : null]}>{fa.tables.inviteNoFriends}</Text> : null}
      {friends?.map((f) => (
        <View key={f.id} style={styles.row}>
          <View>
            <Avatar avatar={avatarOf(f.avatarKey)} size={32} />
            <View style={styles.dotPos}><OnlineDot online={f.online} size={12} /></View>
          </View>
          <Text style={[styles.name, dark ? dk.text : null]} numberOfLines={1}>{f.nickname}</Text>
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
  requests: { gap: 6, padding: 8, borderRadius: 14, borderWidth: 2.5, borderColor: INK, backgroundColor: '#FFF3C4' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  infoChip: { fontFamily: fonts.bold, fontSize: 12, color: INK, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99, borderWidth: 2, borderColor: INK, backgroundColor: '#fff', overflow: 'hidden' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  stepBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 2.5, borderColor: INK, backgroundColor: colors.candy.yellow, alignItems: 'center', justifyContent: 'center' },
  stepOff: { opacity: 0.35 },
  stepMark: { fontFamily: fonts.display, fontSize: 22, lineHeight: 30, color: INK },
  stepValue: { minWidth: 110, textAlign: 'center', fontFamily: fonts.display, fontSize: 18, color: INK },
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
  input: { fontFamily: fonts.bold, fontSize: 14, color: INK, borderWidth: 2, borderColor: INK, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.card, textAlign: TEXT_RIGHT },
  grow: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleIcon: { width: 34, height: 34 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 18, borderWidth: 3, borderColor: INK },
  choiceIcon: { width: 44, height: 44 },
  choiceTitle: { fontFamily: fonts.display, fontSize: 18, color: INK, textAlign: TEXT_RIGHT },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  iconCell: { width: 48, height: 48, padding: 5, borderRadius: 12, borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.card },
  iconOn: { borderColor: INK, backgroundColor: colors.candy.yellow },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  chip: { minWidth: 84, alignItems: 'center', borderWidth: 2.5, borderColor: INK, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 6 },
  pill: { borderWidth: 2, borderColor: INK, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.candy.yellow },
  pillText: { fontFamily: fonts.bold, fontSize: 13, color: INK },
});

/** A small ink-outlined pill, like the gender pills of the profile editor: for the secondary actions under a table. */
function Chip({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={() => (playSfx('press'), onPress())} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.chip, { backgroundColor: color }, pressed ? { opacity: 0.8 } : null]}>
      <Text style={styles.pillText}>{label}</Text>
    </Pressable>
  );
}
