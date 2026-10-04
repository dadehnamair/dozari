import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import type { FoundPlayer, MyFind } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { CandyButton } from '../components/CandyButton';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { colors, fonts } from '../theme/colors';
import { fetchMyFind, findContacts, saveFindable, searchPlayer } from './api';
import { readContacts } from './readContacts';
import { avatarOf } from './avatarOf';
import { PlayerSheet } from './PlayerSheet';
import { useHardwareBack } from '../nav/useHardwareBack';
import { TEXT_LEFT } from '../theme/direction';

const INK = '#3A2418';

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
    searchPlayer(q).then(
      (p) => (setFound(p), setNote(null)),
      (e) => setNote(e instanceof ApiError && e.status === 429 ? fa.find.rateLimited : fa.find.error),
    );
  const share = () => {
    if (me) void Share.share({ message: fa.find.shareMessage(me.shareUrl) }).catch(() => undefined);
  };
  const scanContacts = async () => {
    const read = await readContacts().catch(() => ({ ok: false as const, reason: 'denied' as const }));
    if (!read.ok) return setNote(read.reason === 'unsupported' ? fa.find.contactsUnsupported : fa.find.contactsDenied);
    if (read.phones.length === 0) return (setFromContacts([]), setNote(null));
    findContacts(read.phones).then(
      (players) => (setFromContacts(players), setNote(null)),
      (e) => setNote(e instanceof ApiError && e.status === 429 ? fa.find.rateLimited : fa.find.error),
    );
  };
  const toggle = () => me && saveFindable(!me.findableByPhone).then(setMe, () => setNote(fa.find.error));

  if (open) return <PlayerSheet playerId={open} onClose={() => setOpen(null)} />;
  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={fa.find.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
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
        <CandyButton label={fa.find.fromContacts} color={colors.candy.grape} onPress={() => void scanContacts()} />
        <Text style={styles.hint}>{fa.find.contactsHint}</Text>
        {fromContacts && fromContacts.length === 0 ? <Text style={styles.hint}>{fa.find.contactsNone}</Text> : null}
        {fromContacts && fromContacts.length > 0 ? <Text style={styles.hint}>{fa.find.contactsFound(fromContacts.length)}</Text> : null}
        {(fromContacts ?? []).slice(0, 8).map((p) => (
          <Pressable key={p.id} onPress={() => setOpen(p.id)} style={styles.person} accessibilityRole="button">
            <Avatar avatar={avatarOf(p.avatarKey)} size={40} />
            <Text style={styles.personName}>{p.nickname}</Text>
          </Pressable>
        ))}
        {found === null ? <Text style={styles.hint}>{fa.find.notFound}</Text> : null}
        {found ? (
          <Pressable onPress={() => setOpen(found.id)} style={styles.person} accessibilityRole="button">
            <Avatar avatar={avatarOf(found.avatarKey)} size={40} />
            <Text style={styles.personName}>{found.nickname}</Text>
          </Pressable>
        ) : null}
        {note ? <Text style={[styles.hint, styles.bad]}>{note}</Text> : null}
        <CandyButton label={fa.find.close} sfx="back" color={colors.candy.sky} onPress={onClose} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 380, backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 16, gap: 8, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 24, color: INK },
  label: { fontFamily: fonts.bold, fontSize: 14, color: INK },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.75, alignSelf: 'flex-start' },
  bad: { color: '#B3261E', opacity: 1 },
  code: { fontFamily: fonts.display, fontSize: 30, letterSpacing: 3, color: INK, writingDirection: 'ltr' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', alignSelf: 'stretch', justifyContent: 'space-between' },
  input: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: INK, borderWidth: 2, borderColor: INK, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#fff', textAlign: TEXT_LEFT, writingDirection: 'ltr' },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, borderWidth: 2, borderColor: INK, backgroundColor: colors.cream },
  on: { backgroundColor: '#FFC93C' },
  pillText: { fontFamily: fonts.bold, fontSize: 14, color: INK },
  person: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch' },
  personName: { fontFamily: fonts.bold, fontSize: 16, color: INK, flex: 1 },
});
