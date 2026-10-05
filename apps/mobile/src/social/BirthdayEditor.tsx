import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MyBirthday } from '@dozari/shared';
import { jalaliDateInTehran, toPersianDigits } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { colors, fonts } from '../theme/colors';
import { claimBirthdayGift, fetchBirthday, saveBirthday } from './birthdayApi';
import { birthYearOptions, daysInMonth } from './birthdayInput';

const INK = '#3A2418';
const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const n = (v: number) => toPersianDigits(String(v));

/** Birth date (Solar Hijri) with the two ticks, and the birthday-week gift when it is waiting (D160). */
export function BirthdayEditor({ onGift }: { onGift?: () => void }) {
  const t = fa.birthday;
  const [b, setB] = useState<MyBirthday | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [open, setOpen] = useState<'year' | 'month' | 'day' | null>(null);
  const [showAge, setShowAge] = useState(false);
  const [notify, setNotify] = useState(true);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);

  const apply = (v: MyBirthday) => {
    setB(v);
    setYear(v.birth ? v.birth.year : null);
    setMonth(v.birth ? v.birth.month : null);
    setDay(v.birth ? v.birth.day : null);
    setOpen(null);
    setShowAge(v.showAge);
    setNotify(v.notifyFriends);
  };
  useEffect(() => {
    fetchBirthday().then(apply, () => setNote({ text: t.error, bad: true }));
  }, [t.error]);
  if (!b) return note ? <Text style={[styles.hint, styles.bad]}>{note.text}</Text> : null;

  const save = (birth: { year: number; month: number; day: number } | null) =>
    saveBirthday({ birth, showAge, notifyFriends: notify }).then(
      (v) => (apply(v), setNote({ text: t.saved, bad: false })),
      (e) => setNote({ text: e instanceof ApiError && e.code === 'invalid_birth_date' ? t.invalid(b.minAge) : t.error, bad: true }),
    );
  const typed = year !== null && month !== null && day !== null && day <= daysInMonth(year, month) ? { year, month, day } : null;
  const choose = (kind: 'year' | 'month' | 'day', v: number) => {
    const y = kind === 'year' ? v : year;
    const m = kind === 'month' ? v : month;
    // a day beyond the new month's length is dropped rather than kept invalid
    const d = kind === 'day' ? v : day !== null && m !== null && day > daysInMonth(y, m) ? null : day;
    setYear(y);
    setMonth(m);
    setDay(d);
    // walk on to the next empty part: year → month → day
    setOpen(m === null ? 'month' : d === null ? 'day' : null);
  };
  const options: { value: number; label: string }[] =
    open === 'year' ? birthYearOptions(jalaliDateInTehran(Date.now()).year, b.minAge).map((y) => ({ value: y, label: n(y) }))
    : open === 'month' ? fa.months.map((m, i) => ({ value: i + 1, label: m.name }))
    : open === 'day' ? Array.from({ length: month === null ? 31 : daysInMonth(year, month) }, (_, i) => ({ value: i + 1, label: n(i + 1) }))
    : [];
  const picked = open === 'year' ? year : open === 'month' ? month : day;
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
        {([['year', year === null ? t.year : n(year), styles.year], ['month', month === null ? t.month : fa.months[month - 1]!.name, styles.small], ['day', day === null ? t.day : n(day), styles.small]] as const).map(([k, label, w]) => (
          <Pressable key={k} onPress={() => setOpen((o) => (o === k ? null : k))} style={[styles.field, w, open === k && styles.fieldOn]} accessibilityRole="button" accessibilityLabel={t[k]}>
            <Text style={[styles.fieldText, (k === 'year' ? year : k === 'month' ? month : day) === null && styles.fieldEmpty]} numberOfLines={1}>{label}</Text>
            <Text style={styles.caret}>{open === k ? '▲' : '▼'}</Text>
          </Pressable>
        ))}
      </View>
      {open ? (
        <ScrollView style={styles.panel} contentContainerStyle={styles.grid} nestedScrollEnabled>
          {options.map((o) => (
            <Pressable key={o.value} onPress={() => choose(open, o.value)} style={[styles.cell, open === 'month' && styles.cellWide, picked === o.value && styles.cellOn]} accessibilityRole="button">
              <Text style={styles.cellText}>{o.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
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
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, borderWidth: 2.5, borderColor: INK, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#fff' },
  fieldOn: { backgroundColor: '#FFE48A' },
  fieldText: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 15, color: INK },
  fieldEmpty: { opacity: 0.5 },
  caret: { fontFamily: fonts.bold, fontSize: 9, color: INK },
  panel: { maxHeight: 176, borderWidth: 2.5, borderColor: INK, borderRadius: 16, backgroundColor: colors.cream },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 8, justifyContent: 'center' },
  cell: { minWidth: 52, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, borderWidth: 2, borderColor: INK, backgroundColor: '#fff', alignItems: 'center' },
  cellWide: { minWidth: 82 },
  cellOn: { backgroundColor: colors.candy.lime },
  cellText: { fontFamily: fonts.bold, fontSize: 14, color: INK },
  year: { flex: 1.2 },
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
