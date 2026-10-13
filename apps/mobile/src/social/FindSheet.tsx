import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { toLatinDigits } from '@dozari/shared';
import type { FoundPlayer, MyFind } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { CandyButton } from '../components/CandyButton';
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

const INK = '#3A2418';
/** iPhone browsers (Safari, Chrome) have no contact picker at all: offer the share sheet there instead of a button that can only fail. */
const CONTACTS_OK = Platform.OS !== 'web' || !!(globalThis.navigator as unknown as { contacts?: unknown } | undefined)?.contacts;

/** «پیدا کردن دوست»: my public ID and invite link, the phone-findability switch, and an exact search by ID or phone number. */
export function FindSheet({ onClose }: { onClose: () => void }) {
  useHardwareBack(onClose);
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
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <SheetClose onPress={onClose} label={fa.find.close} />
        <Text style={styles.title}>{fa.find.title}</Text>
        {me ? (
          <>
            <Text style={styles.label}>{fa.find.yourId}</Text>
            <Text selectable style={styles.code}>{me.handle}</Text>
            <Text style={styles.hint}>{fa.find.yourIdHint}</Text>
            <CandyButton label={fa.find.shareLink} color={colors.candy.lime} onPress={share} />
            <View style={styles.row}>
              <Text style={styles.label}>{fa.find.findableTitle}</Text>
              <Pressable onPress={() => void toggle()} style={[styles.pill, me.findableByPhone && styles.on]} accessibilityRole="switch" accessibilityState={{ checked: me.findableByPhone }}>
                <Text style={styles.pillText}>{me.findableByPhone ? fa.find.on : fa.find.off}</Text>
              </Pressable>
            </View>
            <Text style={styles.hint}>{fa.find.findableHint}</Text>
          </>
        ) : null}
        <View style={styles.row}>
          <TextInput value={q} onChangeText={setQ} autoCapitalize="characters" autoCorrect={false} maxLength={40} placeholder={fa.find.searchPlaceholder} style={styles.input} accessibilityLabel={fa.find.search} />
          <Pressable onPress={() => void search()} style={[styles.pill, styles.on]} accessibilityRole="button"><Text style={styles.pillText}>{fa.find.search}</Text></Pressable>
        </View>
        {CONTACTS_OK ? (
          <>
            <CandyButton label={fa.find.fromContacts} color={colors.candy.grape} onPress={() => void scanContacts()} />
            <Text style={styles.hint}>{fa.find.contactsHint}</Text>
          </>
        ) : (
          <>
            <CandyButton label={fa.find.inviteViaShare} color={colors.candy.grape} onPress={share} />
            <Text style={styles.hint}>{fa.find.inviteViaShareHint}</Text>
          </>
        )}
        {fromContacts && fromContacts.length === 0 ? <Text style={styles.hint}>{fa.find.contactsNone}</Text> : null}
        {fromContacts && fromContacts.length > 0 ? <Text style={styles.hint}>{fa.find.contactsFound(fromContacts.length)}</Text> : null}
        {(fromContacts ?? []).slice(0, 8).map((p) => <PlayerCard key={p.id} p={p} onOpen={() => setOpen(p.id)} onAdd={() => void addFriend(p)} />)}
        {found === null ? <Text style={styles.hint}>{fa.find.notFound}</Text> : null}
        {found ? <PlayerCard p={found} onOpen={() => setOpen(found.id)} onAdd={() => void addFriend(found)} /> : null}
        {note ? <Text style={[styles.hint, styles.bad]}>{note}</Text> : null}
      </Pressable>
    </Pressable>
  );
}

/** A found player: avatar, nickname, the name and number saved in the player's own address book, and the friend action for their relation. */
function PlayerCard({ p, onOpen, onAdd }: { p: FoundPlayer; onOpen: () => void; onAdd: () => void }) {
  return (
    <View style={styles.card}>
      <Pressable onPress={onOpen} style={styles.cardMain} accessibilityRole="button" accessibilityLabel={p.nickname}>
        <Avatar avatar={avatarOf(p.avatarKey)} size={48} />
        <View style={styles.cardText}>
          <Text style={styles.personName} numberOfLines={1}>{p.nickname}</Text>
          {p.contactName ? <Text style={styles.cardSub} numberOfLines={1}>{fa.find.savedAs} {p.contactName}</Text> : null}
          {p.phone ? <Text style={[styles.cardSub, styles.ltr]}>{p.phone}</Text> : null}
        </View>
      </Pressable>
      {p.relation === 'none' ? (
        <Pressable onPress={onAdd} style={[styles.pill, styles.on]} accessibilityRole="button"><Text style={styles.pillText}>{fa.find.addFriend}</Text></Pressable>
      ) : (
        <Text style={styles.cardState}>{p.relation === 'friends' ? fa.find.friendsAlready : p.relation === 'sent' ? fa.find.requestSent : fa.find.requestAnswer}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', backgroundColor: colors.card, borderWidth: 2, borderColor: INK, borderRadius: 16, padding: 8 },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  cardText: { flex: 1, minWidth: 0 },
  cardSub: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.75 },
  cardState: { fontFamily: fonts.bold, fontSize: 12, color: INK },
  ltr: { writingDirection: 'ltr', textAlign: TEXT_LEFT },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 380, backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 16, gap: 8, alignItems: 'center' },
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
