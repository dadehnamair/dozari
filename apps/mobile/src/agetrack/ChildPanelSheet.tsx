import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CHAT_MODES, FRIEND_APPROVALS, GUARDIAN_REMINDER_CHOICES, toPersianDigits } from '@dozari/shared';
import type { ChildDigest, ChildRow, GuardianSettings } from '@dozari/shared';
import { CandyButton } from '../components/CandyButton';
import { fa } from '../i18n/fa';
import { useHardwareBack } from '../nav/useHardwareBack';
import { colors, fonts } from '../theme/colors';
import { approveChildFriend, fetchChildDigest, fetchChildFriends, fetchChildSettings, removeChildFriend, saveChildSettings } from './guardianApi';
import type { ChildFriend } from './guardianApi';
import { QUIET_HOURS, minutesToHour, sameSettings, withQuietHours } from './guardianPanel';

const INK = '#3A2418';
const p = fa.guardian.panel;

function Pills<T extends string | number>({ options, value, label, onPick }: { options: readonly T[]; value: T; label: (v: T) => string; onPick: (v: T) => void }) {
  return (
    <View style={styles.row}>
      {options.map((o) => (
        <Pressable key={String(o)} onPress={() => onPick(o)} accessibilityRole="button" accessibilityState={{ selected: o === value }} style={[styles.pill, o === value ? styles.pillOn : null]}>
          <Text style={styles.pillText}>{label(o)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * One child's guardian panel (docs/logic/age-tracks.md §Guardian panel): plain switches that only ever narrow what the child can do, the friends and the
 * requests waiting for a yes, and the digest «امروز چه یاد گرفت». Each switch saves at once.
 */
export function ChildPanelSheet({ child, onClose }: { child: ChildRow; onClose: () => void }) {
  useHardwareBack(onClose);
  const [s, setS] = useState<GuardianSettings | null>(null);
  const [digest, setDigest] = useState<ChildDigest | null>(null);
  const [friends, setFriends] = useState<{ friends: ChildFriend[]; requests: ChildFriend[] } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const reloadFriends = useCallback(() => void fetchChildFriends(child.id).then(setFriends, () => undefined), [child.id]);
  useEffect(() => {
    void fetchChildSettings(child.id).then(setS, () => setNote(p.failed));
    void fetchChildDigest(child.id).then(setDigest, () => undefined);
    reloadFriends();
  }, [child.id, reloadFriends]);

  const change = (next: GuardianSettings) => {
    if (!s || sameSettings(s, next)) return;
    const before = s;
    setS(next);
    saveChildSettings(child.id, next).then(() => setNote(null), () => (setS(before), setNote(p.failed)));
  };
  const act = (job: Promise<void>) => job.then(reloadFriends, () => setNote(p.failed));
  const quietFrom = s?.quietFrom === null || s?.quietFrom === undefined ? null : minutesToHour(s.quietFrom);
  const quietTo = s?.quietTo === null || s?.quietTo === undefined ? null : minutesToHour(s.quietTo);
  const hours = (h: number) => toPersianDigits(String(h));

  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={p.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <Text style={styles.title}>{child.nickname}</Text>
        <ScrollView contentContainerStyle={styles.content}>
          {s === null ? <ActivityIndicator color={INK} /> : null}

          {digest ? (
            <View style={styles.card}>
              <Text style={styles.section}>{p.digestTitle}</Text>
              <Text style={styles.text}>{p.digestWords(toPersianDigits(String(digest.wordsWeek)), toPersianDigits(String(digest.wordsTotal)))}</Text>
              {digest.recentWords.length > 0 ? <Text style={styles.text}>{digest.recentWords.join('، ')}</Text> : null}
              <Text style={styles.text}>{p.digestGames(toPersianDigits(String(digest.gamesWeek)), toPersianDigits(String(digest.winsWeek)), toPersianDigits(String(digest.daysPlayedWeek)))}</Text>
              <Text style={styles.text}>{p.digestLevel(toPersianDigits(String(digest.level)), toPersianDigits(String(digest.friends)))}</Text>
            </View>
          ) : null}

          {s ? (
            <>
              <Text style={styles.section}>{p.chat}</Text>
              <Pills options={CHAT_MODES} value={s.chatMode} label={(m) => p.chatModes[m] ?? m} onPick={(chatMode) => change({ ...s, chatMode })} />

              <Text style={styles.section}>{p.friends}</Text>
              <Pills options={FRIEND_APPROVALS} value={s.friendApproval} label={(m) => p.friendModes[m] ?? m} onPick={(friendApproval) => change({ ...s, friendApproval })} />

              <Text style={styles.section}>{p.duels}</Text>
              <Pills options={['on', 'off'] as const} value={s.duelsEnabled ? 'on' : 'off'} label={(v) => (v === 'on' ? p.on : p.off)} onPick={(v) => change({ ...s, duelsEnabled: v === 'on' })} />

              <Text style={styles.section}>{p.quiet}</Text>
              <Text style={styles.text}>{quietFrom === null || quietTo === null ? p.quietNone : p.quietWindow(hours(quietFrom), hours(quietTo))}</Text>
              <Text style={styles.hint}>{p.quietFrom}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Pills options={QUIET_HOURS} value={quietFrom ?? -1} label={hours} onPick={(h) => change(withQuietHours(s, h, quietTo ?? (h + 8) % 24))} />
              </ScrollView>
              <Text style={styles.hint}>{p.quietTo}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Pills options={QUIET_HOURS} value={quietTo ?? -1} label={hours} onPick={(h) => change(withQuietHours(s, quietFrom ?? (h + 16) % 24, h))} />
              </ScrollView>
              {quietFrom !== null ? <CandyButton label={p.quietClear} color={colors.candy.sky} onPress={() => change(withQuietHours(s, null, null))} /> : null}

              <Text style={styles.section}>{p.reminder}</Text>
              <Pills options={[0, ...GUARDIAN_REMINDER_CHOICES]} value={s.reminderMinutes ?? 0} label={(m) => (m === 0 ? p.off : p.minutes(toPersianDigits(String(m))))} onPick={(m) => change({ ...s, reminderMinutes: m === 0 ? null : m })} />
            </>
          ) : null}

          {friends && friends.requests.length > 0 ? (
            <>
              <Text style={styles.section}>{p.requests}</Text>
              {friends.requests.map((f) => (
                <View key={f.id} style={styles.friend}>
                  <Text style={styles.name}>{f.nickname}</Text>
                  <CandyButton label={p.approve} color={colors.candy.lime} onPress={() => void act(approveChildFriend(child.id, f.id))} />
                  <CandyButton label={p.decline} color={colors.candy.pink} sfx="back" onPress={() => void act(removeChildFriend(child.id, f.id))} />
                </View>
              ))}
            </>
          ) : null}
          {friends && friends.friends.length > 0 ? (
            <>
              <Text style={styles.section}>{p.friendList}</Text>
              {friends.friends.map((f) => (
                <View key={f.id} style={styles.friend}>
                  <Text style={styles.name}>{f.nickname}</Text>
                  <CandyButton label={p.removeFriend} color={colors.candy.pink} sfx="back" onPress={() => void act(removeChildFriend(child.id, f.id))} />
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
        {note ? <Text style={styles.bad}>{note}</Text> : null}
        <CandyButton label={p.close} sfx="back" color={colors.candy.sky} onPress={onClose} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 32, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  sheet: { width: '100%', maxWidth: 400, maxHeight: '92%', backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 14, gap: 8 },
  title: { fontFamily: fonts.display, fontSize: 22, color: INK, textAlign: 'center' },
  content: { gap: 8, paddingBottom: 6 },
  card: { gap: 4, padding: 10, borderRadius: 16, borderWidth: 2, borderColor: INK, backgroundColor: '#fff' },
  section: { fontFamily: fonts.display, fontSize: 17, color: INK, textAlign: 'right', marginTop: 4 },
  text: { fontFamily: fonts.bold, fontSize: 13.5, color: INK, textAlign: 'right' },
  hint: { fontFamily: fonts.body, fontSize: 12, color: '#5B4A70', textAlign: 'right' },
  bad: { fontFamily: fonts.bold, fontSize: 13.5, color: '#B3261E', textAlign: 'center' },
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 2.5, borderColor: INK, backgroundColor: '#fff' },
  pillOn: { backgroundColor: colors.candy.lime },
  pillText: { fontFamily: fonts.bold, fontSize: 13.5, color: INK },
  friend: { gap: 6, padding: 8, borderRadius: 14, borderWidth: 2, borderColor: INK, backgroundColor: '#fff' },
  name: { fontFamily: fonts.display, fontSize: 16, color: INK, textAlign: 'center' },
});
