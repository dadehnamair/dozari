import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { City, MyProfile } from '@dozari/shared';
import { toPersianDigits } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { colors, fonts } from '../theme/colors';
import { fetchCities, saveCity, saveEmail, saveNickname } from './api';
import { nicknameHint } from './nicknameHint';

const INK = '#3A2418';

const problemText = (e: unknown): string => (e instanceof ApiError ? fa.profile.nicknameProblem[e.code] ?? fa.profile.error : fa.profile.error);

/** Level bar and game totals, then the editable bits: nickname (under the admin's rules), city and optional e-mail. */
export function ProfileEditor({ me, onChange }: { me: MyProfile; onChange: (patch: Partial<MyProfile>) => void }) {
  const [nick, setNick] = useState(me.nickname);
  const [email, setEmail] = useState(me.email ?? '');
  const [cities, setCities] = useState<City[] | null>(null);
  const [pickingCity, setPickingCity] = useState(false);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);

  useEffect(() => setNick(me.nickname), [me.nickname]);
  const say = (text: string, bad = false) => setNote({ text, bad });

  const showCities = () => {
    setPickingCity((v) => !v);
    if (!cities) fetchCities().then(setCities, () => say(fa.profile.error, true));
  };
  const chooseCity = (c: City | null) => {
    setPickingCity(false);
    saveCity(c?.id ?? null).then(
      () => (onChange({ city: c }), say(fa.profile.saved)),
      () => say(fa.profile.error, true),
    );
  };
  const rename = () =>
    saveNickname(nick).then(
      (saved) => (onChange({ nickname: saved }), say(fa.profile.saved)),
      (e) => say(problemText(e), true),
    );
  const storeEmail = () =>
    saveEmail(email.trim() === '' ? null : email).then(
      () => (onChange({ email: email.trim() === '' ? null : email.trim().toLowerCase() }), say(fa.profile.saved)),
      (e) => say(e instanceof ApiError && e.code === 'invalid_email' ? fa.profile.emailInvalid : fa.profile.error, true),
    );

  const lv = me.level;
  const pct = lv.xpForNext === 0 ? 100 : Math.round((lv.xpInLevel / lv.xpForNext) * 100);
  const locked = me.nicknameLockedUntilGames !== null;
  const n = (v: number) => toPersianDigits(String(v));

  return (
    <View style={styles.box}>
      <Text style={styles.label}>{fa.profile.level} {n(lv.level)}</Text>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.hint}>{lv.xpForNext === 0 ? `${fa.profile.xp} ${n(lv.xp)}` : `${n(lv.xpInLevel)} / ${n(lv.xpForNext)} ${fa.profile.xp}`}</Text>
      <View style={styles.row}>
        {([['games', me.stats.games], ['wins', me.stats.wins], ['losses', me.stats.losses], ['draws', me.stats.draws]] as const).map(([k, v]) => (
          <View key={k} style={styles.stat}>
            <Text style={styles.statNum}>{n(v)}</Text>
            <Text style={styles.hint}>{fa.profile[k]}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.label}>{fa.profile.nickname}</Text>
      <View style={styles.row}>
        <TextInput value={nick} onChangeText={setNick} editable={!locked} maxLength={me.nicknameRules.maxLen + 5} style={[styles.input, locked && styles.disabled]} accessibilityLabel={fa.profile.nickname} />
        {locked ? null : (
          <Pressable onPress={rename} style={[styles.pill, styles.pillOn]} accessibilityRole="button">
            <Text style={styles.pillText}>{fa.profile.save}</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.hint}>{locked ? fa.profile.nicknameLocked(me.nicknameLockedUntilGames ?? 0) : nicknameHint(me.nicknameRules)}</Text>

      <Text style={styles.label}>{fa.profile.city}</Text>
      <Pressable onPress={showCities} style={styles.pill} accessibilityRole="button">
        <Text style={styles.pillText}>{me.city?.nameFa ?? fa.profile.cityNone}</Text>
      </Pressable>
      <Text style={styles.hint}>{fa.profile.cityHint}</Text>
      {pickingCity ? (
        <View style={styles.cities}>
          <Pressable onPress={() => chooseCity(null)} style={styles.pill}>
            <Text style={styles.pillText}>{fa.profile.cityNone}</Text>
          </Pressable>
          {cities?.map((c) => (
            <Pressable key={c.id} onPress={() => chooseCity(c)} style={[styles.pill, me.city?.id === c.id && styles.pillOn]}>
              <Text style={styles.pillText}>{c.nameFa}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={styles.label}>{fa.profile.email}</Text>
      <View style={styles.row}>
        <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={120} style={[styles.input, styles.ltr]} accessibilityLabel={fa.profile.email} />
        <Pressable onPress={storeEmail} style={[styles.pill, styles.pillOn]} accessibilityRole="button">
          <Text style={styles.pillText}>{fa.profile.save}</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>{fa.profile.emailHint}</Text>
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
  bar: { height: 12, borderRadius: 99, borderWidth: 2, borderColor: INK, backgroundColor: colors.cream, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#7ED957' },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontFamily: fonts.display, fontSize: 18, color: INK },
  input: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: INK, borderWidth: 2, borderColor: INK, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#fff' },
  ltr: { textAlign: 'left', writingDirection: 'ltr' },
  disabled: { opacity: 0.5 },
  pill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 99, borderWidth: 2, borderColor: INK, backgroundColor: colors.cream, alignSelf: 'flex-start' },
  pillOn: { backgroundColor: '#FFC93C' },
  pillText: { fontFamily: fonts.bold, fontSize: 14, color: INK },
  cities: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
