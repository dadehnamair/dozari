import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { toPersianDigits } from '@dozari/shared';
import type { Friends, Gender, MyProfile } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { CandyButton } from '../components/CandyButton';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { fetchFriends, fetchMyProfile, saveGender } from './api';
import { avatarOf } from './avatarOf';
import { ProfileEditor } from './ProfileEditor';
import { InviteSheet } from '../invite/InviteSheet';
import { LoansSheet } from '../transfers/LoansSheet';
import { FindSheet } from './FindSheet';
import { CityPicker } from './CityPicker';
import { FriendsPage } from './FriendsPage';
import { BadgesSheet } from '../badges/BadgesSheet';
import { deleteMyAccount, signOutEverywhere } from '../account/api';
import { setPref, usePrefs } from '../prefs/store';
import { playSfx } from '../sound/engine';

const INK = '#3A2418';

/** «پروفایل من»: gender choice (it switches the hero), settings and account; friends live on their own page. */
export function ProfileSheet({ onClose, onGender, onTutorial, onAccountGone }: { onClose: () => void; onGender: (g: Gender | null) => void; onTutorial?: () => void; /** The account was deleted or signed out: start over. */ onAccountGone?: () => void }) {
  const [me, setMe] = useState<MyProfile | null>(null);
  const [friends, setFriends] = useState<Friends | null>(null);
  const [failed, setFailed] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [loansOpen, setLoansOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [badgesOpen, setBadgesOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const prefs = usePrefs();
  const [sure, setSure] = useState(false);
  const [accountNote, setAccountNote] = useState<string | null>(null);

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

  if (cityOpen && me) return <CityPicker current={me.city} onPicked={(city) => (setMe((m) => (m ? { ...m, city } : m)), setCityOpen(false))} onClose={() => setCityOpen(false)} />;
  if (friendsOpen) return <FriendsPage onClose={() => (setFriendsOpen(false), load())} />;
  if (badgesOpen) return <BadgesSheet onClose={() => setBadgesOpen(false)} />;
  if (findOpen) return <FindSheet onClose={() => (setFindOpen(false), load())} />;
  if (loansOpen) return <LoansSheet onClose={() => setLoansOpen(false)} />;
  if (inviteOpen) return <InviteSheet onClose={() => (setInviteOpen(false), load())} />;
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
          {me ? <ProfileEditor me={me} onChange={(patch) => setMe((m) => (m ? { ...m, ...patch } : m))} onPickCity={() => setCityOpen(true)} /> : null}
          <Text style={styles.label}>{fa.prefs.title}</Text>
          <Text style={styles.hint}>{fa.prefs.hint}</Text>
          <View style={styles.row}>
            {(['sound', 'vibration', 'reduceMotion'] as const).map((k) => (
              <Pressable
                key={k}
                onPress={() => {
                  setPref(k, !prefs[k]);
                  if (k === 'sound' && !prefs.sound) setTimeout(() => playSfx('coin'), 0);
                }}
                style={[styles.pill, prefs[k] && styles.pillOn]}
                accessibilityRole="switch"
                accessibilityState={{ checked: prefs[k] }}
              >
                <Text style={styles.pillText}>{fa.prefs[k]}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>{fa.account.title}</Text>
          <View style={styles.row}>
            {onTutorial ? <Pressable onPress={onTutorial} style={styles.pill} accessibilityRole="button"><Text style={styles.pillText}>{fa.account.replayTutorial}</Text></Pressable> : null}
            <Pressable onPress={() => void signOutEverywhere().then(() => (setAccountNote(fa.account.signOutDone), onAccountGone?.()), () => setAccountNote(fa.account.failed))} style={styles.pill} accessibilityRole="button"><Text style={styles.pillText}>{fa.account.signOut}</Text></Pressable>
            <Pressable onPress={() => (sure ? void deleteMyAccount().then(() => (setAccountNote(fa.account.deleteDone), onAccountGone?.()), () => setAccountNote(fa.account.failed)) : setSure(true))} style={[styles.pill, sure && styles.pillOn]} accessibilityRole="button"><Text style={styles.pillText}>{fa.account.delete}</Text></Pressable>
          </View>
          {sure ? <Text style={styles.hint}>{fa.account.deleteSure}</Text> : null}
          {accountNote ? <Text style={styles.hint}>{accountNote}</Text> : null}
          <Text style={styles.label}>{fa.account.about}</Text>
          <Text style={styles.hint}>{fa.account.aboutText}</Text>
        </ScrollView>
        <CandyButton label={friends && friends.incoming.length > 0 ? `${fa.profile.friends} (${toPersianDigits(String(friends.incoming.length))})` : fa.profile.friends} color={colors.candy.sky} onPress={() => setFriendsOpen(true)} />
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
});
