import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { toLatinDigits } from '@dozari/shared';
import type { FoundPlayer, MyFind } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { CandyButton } from '../components/CandyButton';
import { GradientFill } from '../components/GradientFill';
import { fa } from '../i18n/fa';
import { SheetClose } from '../components/SheetClose';
import { ApiError } from '../net/http';
import { colors, fonts } from '../theme/colors';
import { fetchMyFind, findContacts, requestFriend, saveFindable, searchPlayer } from './api';
import { readContacts } from './readContacts';
import { avatarOf } from './avatarOf';
import { PlayerSheet } from './PlayerSheet';
import { useHardwareBack } from '../nav/useHardwareBack';
import { TEXT_LEFT } from '../theme/direction';
import { DARK, useDark } from '../theme/skin';

const INK = '#3A2418';
/** iPhone browsers (Safari, Chrome) have no contact picker at all: offer the share sheet there instead of a button that can only fail. */
const CONTACTS_OK = Platform.OS !== 'web' || !!(globalThis.navigator as unknown as { contacts?: unknown } | undefined)?.contacts;

/** «پیدا کردن دوست»: my public ID and invite link, the phone-findability switch, and an exact search by ID or phone number. */
export function FindSheet({ onClose }: { onClose: () => void }) {
  useHardwareBack(onClose);
  const dark = useDark();
  const [me, setMe] = useState<MyFind | null>(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<FoundPlayer | null | undefined>(undefined);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [fromContacts, setFromContacts] = useState<FoundPlayer[] | null>(null);

  useEffect(() => {
    fetchMyFind().then(setMe, () => setNote(fa.find.error));
  }, []);

  const search = () =>
    searchPlayer(toLatinDigits(q).trim()).then(
      (p) => (setFound(p), setNote(null)),
      (e) => setNote(e instanceof ApiError && e.status === 429 ? fa.find.rateLimited : fa.find.error),
    );
  const share = () => {
    if (me) void Share.share({ message: fa.find.shareMessage(me.shareUrl) }).catch(() => undefined);
  };
  const { height: winHeight } = useWindowDimensions();
  const scanContacts = async () => {
    const read = await readContacts().catch(() => ({ ok: false as const, reason: 'denied' as const }));
    if (!read.ok) {
      if (read.reason === 'blocked') void Linking.openSettings().catch(() => undefined);
      return setNote(read.reason === 'unsupported' ? fa.find.contactsUnsupported : read.reason === 'blocked' ? fa.find.contactsBlocked : read.reason === 'error' ? `${fa.find.contactsError} (${read.detail ?? ''})` : fa.find.contactsDenied);
    }
    if (read.contacts.length === 0) return (setFromContacts([]), setNote(null));
    findContacts(read.contacts).then(
      (players) => (setFromContacts(players), setNote(null)),
      (e) => setNote(e instanceof ApiError && e.status === 429 ? fa.find.rateLimited : fa.find.error),
    );
  };
  const addFriend = (p: FoundPlayer) =>
    requestFriend(p.id).then(
      () => {
        const sent = (x: FoundPlayer): FoundPlayer => (x.id === p.id ? { ...x, relation: 'sent' } : x);
        setFromContacts((list) => list && list.map(sent));
        setFound((x) => (x ? sent(x) : x));
        setNote(null);
      },
      () => setNote(fa.find.error),
    );
  const toggle = () => me && saveFindable(!me.findableByPhone).then(setMe, () => setNote(fa.find.error));

  if (open) return <PlayerSheet playerId={open} onClose={() => setOpen(null)} />;
  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={fa.find.close}>
      <Pressable style={[styles.sheet, dark ? dk.sheet : null, { maxHeight: Math.max(240, winHeight - 48) }]} onPress={() => undefined}>
        {dark ? <GradientFill from="#2A1E16" to="#17100C" /> : null}
        <SheetClose onPress={onClose} label={fa.find.close} />
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, dark ? dk.text : null]}>{fa.find.title}</Text>
        {me ? (
          <>
            <Text style={[styles.label, dark ? dk.sub : null]}>{fa.find.yourId}</Text>
            <Text selectable style={[styles.code, dark ? dk.code : null]}>{me.handle}</Text>
            <Text style={[styles.hint, dark ? dk.sub : null]}>{fa.find.yourIdHint}</Text>
            <CandyButton label={fa.find.shareLink} color={colors.candy.lime} onPress={share} />
            <View style={styles.row}>
              <Text style={[styles.label, dark ? dk.sub : null]}>{fa.find.findableTitle}</Text>
              <Pressable onPress={() => void toggle()} style={[styles.pill, dark ? dk.pill : null, me.findableByPhone && (dark ? dk.on : styles.on)]} accessibilityRole="switch" accessibilityState={{ checked: me.findableByPhone }}>
                <Text style={[styles.pillText, dark ? (me.findableByPhone ? dk.onText : dk.text) : null]}>{me.findableByPhone ? fa.find.on : fa.find.off}</Text>
              </Pressable>
            </View>
            <Text style={[styles.hint, dark ? dk.sub : null]}>{fa.find.findableHint}</Text>
          </>
        ) : null}
        <View style={styles.row}>
          <TextInput value={q} onChangeText={setQ} autoCapitalize="characters" autoCorrect={false} maxLength={40} placeholder={fa.find.searchPlaceholder} style={[styles.input, dark ? dk.input : null]} placeholderTextColor={dark ? 'rgba(255,233,168,0.45)' : undefined} accessibilityLabel={fa.find.search} />
          <Pressable onPress={() => void search()} style={[styles.pill, dark ? dk.brass : styles.on]} accessibilityRole="button">{dark ? <BrassFill /> : null}<Text style={[styles.pillText, dark ? dk.onText : null]}>{fa.find.search}</Text></Pressable>
        </View>
        {CONTACTS_OK ? (
          <>
            <CandyButton label={fa.find.fromContacts} color={colors.candy.grape} onPress={() => void scanContacts()} />
            <Text style={[styles.hint, dark ? dk.sub : null]}>{fa.find.contactsHint}</Text>
          </>
        ) : (
          <>
            <CandyButton label={fa.find.inviteViaShare} color={colors.candy.grape} onPress={share} />
            <Text style={[styles.hint, dark ? dk.sub : null]}>{fa.find.inviteViaShareHint}</Text>
          </>
        )}
        {fromContacts && fromContacts.length === 0 ? <Text style={[styles.hint, dark ? dk.sub : null]}>{fa.find.contactsNone}</Text> : null}
        {fromContacts && fromContacts.length > 0 ? <Text style={[styles.hint, dark ? dk.sub : null]}>{fa.find.contactsFound(fromContacts.length)}</Text> : null}
        {fromContacts && fromContacts.length > 0 ? (
          <ScrollView style={[styles.list, dark ? dk.ledger : null, { maxHeight: Math.min(320, Math.round(winHeight * 0.32)) }]} contentContainerStyle={dark ? dk.ledgerContent : styles.listContent} nestedScrollEnabled showsVerticalScrollIndicator>
            {fromContacts.map((p, i) => <PlayerCard key={p.id} p={p} dark={dark} last={i === fromContacts.length - 1} onOpen={() => setOpen(p.id)} onAdd={() => void addFriend(p)} />)}
          </ScrollView>
        ) : null}
        {found === null ? <Text style={[styles.hint, dark ? dk.sub : null]}>{fa.find.notFound}</Text> : null}
        {found ? (dark ? <View style={[styles.list, dk.ledger]}><View style={dk.ledgerContent}><PlayerCard p={found} dark last onOpen={() => setOpen(found.id)} onAdd={() => void addFriend(found)} /></View></View> : <PlayerCard p={found} dark={false} last onOpen={() => setOpen(found.id)} onAdd={() => void addFriend(found)} />) : null}
        {note ? <Text style={[styles.hint, styles.bad, dark ? dk.bad : null]}>{note}</Text> : null}
        </ScrollView>
      </Pressable>
    </Pressable>
  );
}

/** Face of a brass button (docs/design/adult/Dozari Adult - Friends): light top, gold body, dark-bronze shelf. */
function BrassFill() {
  return <GradientFill from="#FFF1B8" mid={{ at: 0.4, color: '#E8B64A' }} to="#8A5A16" />;
}

/** A found player: avatar, nickname, the name and number saved in the player's own address book, and the friend action for their relation. Adult: a ledger row (no card of its own, dashed separator). */
function PlayerCard({ p, dark, last, onOpen, onAdd }: { p: FoundPlayer; dark: boolean; last: boolean; onOpen: () => void; onAdd: () => void }) {
  return (
    <View style={[styles.card, dark ? [dk.row, last ? dk.rowLast : null] : null]}>
      <Pressable onPress={onOpen} style={styles.cardMain} accessibilityRole="button" accessibilityLabel={p.nickname}>
        {dark ? <View style={dk.ring}><Avatar avatar={avatarOf(p.avatarKey)} size={42} /></View> : <Avatar avatar={avatarOf(p.avatarKey)} size={48} />}
        <View style={styles.cardText}>
          <Text style={[styles.personName, dark ? dk.name : null]} numberOfLines={1}>{p.nickname}</Text>
          {p.contactName ? <Text style={[styles.cardSub, dark ? dk.cardSub : null]} numberOfLines={1}>{fa.find.savedAs} {p.contactName}</Text> : null}
          {p.phone ? <Text style={[styles.cardSub, styles.ltr, dark ? dk.cardSub : null]}>{p.phone}</Text> : null}
        </View>
      </Pressable>
      {p.relation === 'none' ? (
        <Pressable onPress={onAdd} style={[styles.pill, dark ? dk.brass : styles.on]} accessibilityRole="button">{dark ? <BrassFill /> : null}<Text style={[styles.pillText, dark ? dk.onText : null]}>{fa.find.addFriend}</Text></Pressable>
      ) : (
        <Text style={[styles.cardState, dark ? dk.cardSub : null]}>{p.relation === 'friends' ? fa.find.friendsAlready : p.relation === 'sent' ? fa.find.requestSent : fa.find.requestAnswer}</Text>
      )}
    </View>
  );
}

/** Overrides for the adult look (docs/design/adult/Dozari Adult - Friends): dark sheet with a gold frame, ledger rows, brass buttons. */
const dk = StyleSheet.create({
  sheet: { backgroundColor: DARK.panel, borderColor: DARK.frame, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 0, elevation: 8 },
  text: { color: DARK.text },
  sub: { color: DARK.sub, opacity: 1 },
  code: { color: DARK.text, borderWidth: 2, borderStyle: 'dashed', borderColor: DARK.frame, backgroundColor: DARK.field, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4, overflow: 'hidden' },
  input: { color: DARK.text, backgroundColor: DARK.field, borderColor: '#8A5A16' },
  pill: { backgroundColor: DARK.raised, borderColor: '#8A5A16' },
  on: { backgroundColor: '#8A5A16', borderColor: DARK.frame },
  onText: { color: '#2A1606' },
  brass: { borderColor: '#000', backgroundColor: '#E8B64A', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 },
  bad: { color: '#FF8A7A' },
  ledger: { borderColor: DARK.frame, backgroundColor: DARK.panel, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  ledgerContent: { paddingHorizontal: 12, paddingVertical: 2 },
  row: { backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0, paddingHorizontal: 0, paddingVertical: 10, borderBottomWidth: 1.5, borderStyle: 'dashed', borderBottomColor: 'rgba(232,182,74,0.22)' },
  rowLast: { borderBottomWidth: 0 },
  ring: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: '#B8822A', backgroundColor: DARK.field, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  name: { color: DARK.text, fontFamily: fonts.display, fontSize: 17 },
  cardSub: { color: '#A39A92', opacity: 1, fontSize: 11 },
});

const styles = StyleSheet.create({
  list: { alignSelf: 'stretch', flexGrow: 0, borderWidth: 2, borderColor: INK, borderRadius: 16, backgroundColor: 'rgba(58,36,24,0.06)' },
  listContent: { gap: 8, padding: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', backgroundColor: colors.card, borderWidth: 2, borderColor: INK, borderRadius: 16, padding: 8 },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  cardText: { flex: 1, minWidth: 0 },
  cardSub: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.75 },
  cardState: { fontFamily: fonts.bold, fontSize: 12, color: INK },
  ltr: { writingDirection: 'ltr', textAlign: TEXT_LEFT },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 380, backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 16, gap: 8, alignItems: 'center' },
  body: { alignSelf: 'stretch', flexGrow: 0, flexShrink: 1 },
  bodyContent: { gap: 8, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 24, color: INK },
  label: { fontFamily: fonts.bold, fontSize: 14, color: INK },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.75, alignSelf: 'flex-start' },
  bad: { color: '#B3261E', opacity: 1 },
  code: { fontFamily: fonts.display, fontSize: 30, letterSpacing: 3, color: INK, writingDirection: 'ltr' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', alignSelf: 'stretch', justifyContent: 'space-between' },
  input: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: INK, borderWidth: 2, borderColor: INK, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.card, textAlign: TEXT_LEFT, writingDirection: 'ltr' },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, borderWidth: 2, borderColor: INK, backgroundColor: colors.cream },
  on: { backgroundColor: '#FFC93C' },
  pillText: { fontFamily: fonts.bold, fontSize: 14, color: INK },
  person: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch' },
  personName: { fontFamily: fonts.bold, fontSize: 16, color: INK, flex: 1 },
});
