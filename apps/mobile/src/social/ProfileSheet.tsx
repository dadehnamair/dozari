import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Friends, Gender, MyProfile } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { CandyButton } from '../components/CandyButton';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { acceptFriend, fetchFriends, fetchMyProfile, removeFriend, saveGender } from './api';
import { avatarOf } from './avatarOf';
import { PlayerSheet } from './PlayerSheet';
import { ProfileEditor } from './ProfileEditor';
import { InviteSheet } from '../invite/InviteSheet';
import { LoansSheet } from '../transfers/LoansSheet';
import { FindSheet } from './FindSheet';
import { BadgesSheet } from '../badges/BadgesSheet';

const INK = '#3A2418';

/** «پروفایل من»: gender choice (it switches the hero), friends and incoming requests; a tap on a name opens that player. */
export function ProfileSheet({ onClose, onGender }: { onClose: () => void; onGender: (g: Gender | null) => void }) {
  const [me, setMe] = useState<MyProfile | null>(null);
  const [friends, setFriends] = useState<Friends | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [loansOpen, setLoansOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [badgesOpen, setBadgesOpen] = useState(false);

  const load = useCallback(() => {
    Promise.all([fetchMyProfile(), fetchFriends()]).then(
      ([m, f]) => (setMe(m), setFriends(f), setFailed(false)),
      () => setFailed(true),
    );
  }, []);
  useEffect(load, [load]);

  const pick = (g: Gender | null) => {
    setMe((m) => (m ? { ...m, gender: g } : m));
    onGender(g);
    saveGender(g).catch(() => setFailed(true));
  };
  const options: [Gender | null, string][] = [['female', fa.profile.female], ['male', fa.profile.male], [null, fa.profile.none]];

  if (badgesOpen) return <BadgesSheet onClose={() => setBadgesOpen(false)} />;
  if (findOpen) return <FindSheet onClose={() => (setFindOpen(false), load())} />;
  if (loansOpen) return <LoansSheet onClose={() => setLoansOpen(false)} />;
  if (inviteOpen) return <InviteSheet onClose={() => (setInviteOpen(false), load())} />;
  if (open) return <PlayerSheet playerId={open} onClose={() => (setOpen(null), load())} />;
  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={fa.profile.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <Text style={styles.title}>{fa.profile.title}</Text>
        {failed ? <Text style={styles.text}>{fa.profile.error}</Text> : null}
        {me ? (
          <>
            <Avatar avatar={avatarOf(me.avatarKey)} size={72} />
            <Text style={styles.name}>{me.nickname}</Text>
            <Text style={styles.label}>{fa.profile.gender}</Text>
            <Text style={styles.hint}>{fa.profile.genderHint}</Text>
            <View style={styles.row}>
              {options.map(([g, label]) => (
                <Pressable key={label} onPress={() => pick(g)} style={[styles.pill, me.gender === g && styles.pillOn]} accessibilityRole="button">
                  <Text style={styles.pillText}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {me ? <ProfileEditor me={me} onChange={(patch) => setMe((m) => (m ? { ...m, ...patch } : m))} /> : null}
          {friends && friends.incoming.length > 0 ? <Text style={styles.label}>{fa.profile.incoming}</Text> : null}
          {friends?.incoming.map((p) => (
            <View key={p.id} style={styles.person}>
              <Pressable onPress={() => setOpen(p.id)} style={styles.personMain}>
                <Avatar avatar={avatarOf(p.avatarKey)} size={40} />
                <Text style={styles.personName}>{p.nickname}</Text>
              </Pressable>
              <Pressable onPress={() => acceptFriend(p.id).then(load, () => setFailed(true))} style={[styles.pill, styles.pillOn]}>
                <Text style={styles.pillText}>{fa.profile.accept}</Text>
              </Pressable>
              <Pressable onPress={() => removeFriend(p.id).then(load, () => setFailed(true))} style={styles.pill}>
                <Text style={styles.pillText}>{fa.profile.decline}</Text>
              </Pressable>
            </View>
          ))}
          <Text style={styles.label}>{fa.profile.friends}</Text>
          {friends && friends.friends.length === 0 ? <Text style={styles.hint}>{fa.profile.noFriends}</Text> : null}
          {friends?.friends.map((p) => (
            <Pressable key={p.id} onPress={() => setOpen(p.id)} style={styles.person}>
              <Avatar avatar={avatarOf(p.avatarKey)} size={40} />
              <Text style={styles.personName}>{p.nickname}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <CandyButton label={fa.badges.open} color={colors.candy.grape} onPress={() => setBadgesOpen(true)} />
        <CandyButton label={fa.find.open} color={colors.candy.lime} onPress={() => setFindOpen(true)} />
        <CandyButton label={fa.transfers.loansOpen} color={colors.candy.orange} onPress={() => setLoansOpen(true)} />
        <CandyButton label={fa.invite.open} color={colors.candy.lime} onPress={() => setInviteOpen(true)} />
        <CandyButton label={fa.profile.close} color={colors.candy.sky} onPress={onClose} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 380, maxHeight: '88%', backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 16, gap: 8, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 24, color: INK },
  name: { fontFamily: fonts.display, fontSize: 20, color: INK },
  label: { fontFamily: fonts.bold, fontSize: 15, color: INK, alignSelf: 'flex-start' },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.7 },
  text: { fontFamily: fonts.bold, fontSize: 14, color: INK },
  row: { flexDirection: 'row', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 99, borderWidth: 2, borderColor: INK, backgroundColor: colors.cream },
  pillOn: { backgroundColor: '#FFC93C' },
  pillText: { fontFamily: fonts.bold, fontSize: 14, color: INK },
  list: { alignSelf: 'stretch', flexGrow: 0 },
  listContent: { gap: 6 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  personMain: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  personName: { fontFamily: fonts.bold, fontSize: 15, color: INK, flex: 1 },
});
