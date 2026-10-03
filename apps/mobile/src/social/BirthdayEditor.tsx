import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { MyBirthday } from '@dozari/shared';
import { toPersianDigits } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { colors, fonts } from '../theme/colors';
import { claimBirthdayGift, fetchBirthday, saveBirthday } from './birthdayApi';
import { birthFromText } from './birthdayInput';

const INK = '#3A2418';
const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const n = (v: number) => toPersianDigits(String(v));

/** Birth date (Solar Hijri) with the two ticks, and the birthday-week gift when it is waiting (D160). */
export function BirthdayEditor({ onGift }: { onGift?: () => void }) {
  const t = fa.birthday;
  const [b, setB] = useState<MyBirthday | null>(null);
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [showAge, setShowAge] = useState(false);
  const [notify, setNotify] = useState(true);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);

  const apply = (v: MyBirthday) => {
    setB(v);
    setYear(v.birth ? n(v.birth.year) : '');
    setMonth(v.birth ? n(v.birth.month) : '');
    setDay(v.birth ? n(v.birth.day) : '');
    setShowAge(v.showAge);
    setNotify(v.notifyFriends);
  };
  useEffect(() => {
    fetchBirthday().then(apply, () => setNote({ text: t.error, bad: true }));
  }, [t.error]);
  if (!b) return note ? <Text style={[styles.hint, styles.bad]}>{note.text}</Text> : null;

  const save = (birth: ReturnType<typeof birthFromText>) =>
    saveBirthday({ birth, showAge, notifyFriends: notify }).then(
      (v) => (apply(v), setNote({ text: t.saved, bad: false })),
      (e) => setNote({ text: e instanceof ApiError && e.code === 'invalid_birth_date' ? t.invalid(b.minAge) : t.error, bad: true }),
    );
  const typed = birthFromText(year, month, day);
  const claim = () =>
    claimBirthdayGift().then(
      (c) => (setNote({ text: t.claimed(c.coins, c.gems, c.spins), bad: false }), fetchBirthday().then(apply, () => undefined), onGift?.()),
      () => setNote({ text: t.error, bad: true }),
    );

  return (
    <View style={styles.box}>
      <Text style={styles.label}>{t.title}</Text>
      {b.gift.claimable ? (
        <Pressable onPress={claim} style={styles.gift} accessibilityRole="button" accessibilityLabel={t.claim}>
          <Text style={styles.giftTitle}>{b.isToday ? t.today : t.week}</Text>
          <Text style={styles.giftText}>{t.giftLine(b.gift.coins, b.gift.gems, b.gift.spins)}</Text>
          <Text style={styles.giftBtn}>{t.claim}</Text>
        </Pressable>
      ) : null}
      <View style={styles.row}>
        <TextInput value={year} onChangeText={setYear} placeholder={t.year} keyboardType="number-pad" maxLength={4} style={[styles.input, styles.year]} accessibilityLabel={t.year} />
        <TextInput value={month} onChangeText={setMonth} placeholder={t.month} keyboardType="number-pad" maxLength={2} style={[styles.input, styles.small]} accessibilityLabel={t.month} />
        <TextInput value={day} onChangeText={setDay} placeholder={t.day} keyboardType="number-pad" maxLength={2} style={[styles.input, styles.small]} accessibilityLabel={t.day} />
      </View>
      <Pressable onPress={() => setShowAge((v) => !v)} style={styles.tick} accessibilityRole="checkbox" accessibilityState={{ checked: showAge }}>
        <View style={[styles.box2, showAge && styles.box2On]} />
        <Text style={styles.tickText}>{t.showAge}</Text>
      </Pressable>
      <Pressable onPress={() => setNotify((v) => !v)} style={styles.tick} accessibilityRole="checkbox" accessibilityState={{ checked: notify }}>
        <View style={[styles.box2, notify && styles.box2On]} />
        <Text style={styles.tickText}>{t.notifyFriends}</Text>
      </Pressable>
      <View style={styles.row}>
        <Pressable disabled={!typed} onPress={() => void save(typed)} style={[styles.pill, styles.pillOn, !typed && styles.off]} accessibilityRole="button">
          <Text style={styles.pillText}>{t.save}</Text>
        </Pressable>
        {b.birth ? (
          <Pressable onPress={() => void save(null)} style={styles.pill} accessibilityRole="button">
            <Text style={styles.pillText}>{t.remove}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.hint}>{t.hint(b.minAge)}</Text>
      {note ? <Text style={[styles.hint, note.bad && styles.bad]}>{note.text}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignSelf: 'stretch', gap: 6 },
  label: { fontFamily: fonts.bold, fontSize: 15, color: INK, alignSelf: 'flex-start' },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.7 },
  bad: { color: '#B3261E', opacity: 1 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { fontFamily: fonts.bold, fontSize: 15, color: INK, borderWidth: 2, borderColor: INK, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#fff', textAlign: 'center' },
  year: { flex: 2 },
  small: { flex: 1 },
  tick: { flexDirection: ROW, alignItems: 'center', gap: 8 },
  box2: { width: 22, height: 22, borderRadius: 7, borderWidth: 2.5, borderColor: INK, backgroundColor: '#fff' },
  box2On: { backgroundColor: colors.candy.lime },
  tickText: { flex: 1, fontFamily: fonts.bold, fontSize: 13.5, color: INK },
  pill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 99, borderWidth: 2, borderColor: INK, backgroundColor: colors.cream },
  pillOn: { backgroundColor: '#FFC93C' },
  pillText: { fontFamily: fonts.bold, fontSize: 14, color: INK },
  off: { opacity: 0.45 },
  gift: { gap: 3, padding: 10, borderRadius: 16, borderWidth: 3, borderColor: INK, backgroundColor: '#FFE48A', alignItems: 'center' },
  giftTitle: { fontFamily: fonts.display, fontSize: 18, color: INK },
  giftText: { fontFamily: fonts.bold, fontSize: 13, color: INK },
  giftBtn: { fontFamily: fonts.display, fontSize: 15, color: INK, paddingHorizontal: 18, paddingVertical: 4, borderRadius: 12, borderWidth: 2.5, borderColor: INK, backgroundColor: colors.candy.lime, overflow: 'hidden' },
});
