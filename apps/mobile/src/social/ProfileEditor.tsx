import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { MyProfile } from '@dozari/shared';
import { provinceOf, toPersianDigits } from '@dozari/shared';
import { ProvinceBadge } from '../components/ProvinceBadge';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { colors, fonts } from '../theme/colors';
import { saveEmail, saveNickname } from './api';
import { nicknameHint } from './nicknameHint';
import { BirthdayEditor } from './BirthdayEditor';
import { TEXT_LEFT } from '../theme/direction';

const INK = '#3A2418';
const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

const problemText = (e: unknown): string => (e instanceof ApiError ? fa.profile.nicknameProblem[e.code] ?? fa.profile.error : fa.profile.error);

/** Level bar and game totals, then the editable bits: nickname (under the admin's rules), city (its own page) and optional e-mail. */
export function ProfileEditor({ me, onChange, onPickCity }: { me: MyProfile; onChange: (patch: Partial<MyProfile>) => void; onPickCity: () => void }) {
  const [nick, setNick] = useState(me.nickname);
  const [email, setEmail] = useState(me.email ?? '');
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);

  useEffect(() => setNick(me.nickname), [me.nickname]);
  const say = (text: string, bad = false) => setNote({ text, bad });

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
  const province = provinceOf(me.city?.province);

  const tiles = [['games', me.stats.games, '#FFE48A'], ['wins', me.stats.wins, '#B5EE98'], ['losses', me.stats.losses, '#FFB3CE'], ['draws', me.stats.draws, '#BFE6F7']] as const;

  return (
    <View style={styles.box}>
      <View style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.label}>{fa.profile.level} {n(lv.level)}</Text>
          <Text style={styles.hint}>{lv.xpForNext === 0 ? `${fa.profile.xp} ${n(lv.xp)}` : `${n(lv.xpInLevel)} / ${n(lv.xpForNext)} ${fa.profile.xp}`}</Text>
        </View>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>
        <View style={styles.row}>
          {tiles.map(([k, v, c]) => (
            <View key={k} style={[styles.stat, { backgroundColor: c }]}>
              <Text style={styles.statNum}>{n(v)}</Text>
              <Text style={styles.statLabel}>{fa.profile[k]}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
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
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{fa.profile.city}</Text>
        <Pressable onPress={onPickCity} style={styles.city} accessibilityRole="button" accessibilityLabel={fa.profile.pickCity}>
          {province ? <ProvinceBadge province={province} size={44} /> : null}
          <View style={styles.cityText}>
            <Text style={styles.pillText}>{me.city?.nameFa ?? fa.profile.pickCity}</Text>
            {province ? <Text style={styles.hint}>{province.hello} · {province.landmark}</Text> : null}
          </View>
        </Pressable>
        <Text style={styles.hint}>{fa.profile.cityHint}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{fa.profile.email}</Text>
        <View style={styles.row}>
          <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={120} style={[styles.input, styles.ltr]} accessibilityLabel={fa.profile.email} />
          <Pressable onPress={storeEmail} style={[styles.pill, styles.pillOn]} accessibilityRole="button">
            <Text style={styles.pillText}>{fa.profile.save}</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>{fa.profile.emailHint}</Text>
      </View>
      <View style={styles.card}>
        <BirthdayEditor />
      </View>
      {note ? <Text style={[styles.note, note.bad && styles.bad]}>{note.text}</Text> : null}
    </View>
  );
}

const HINT = '#5A3A2A';

const styles = StyleSheet.create({
  box: { alignSelf: 'stretch', gap: 12 },
  card: { gap: 8, padding: 12, borderRadius: 16, borderWidth: 2, borderColor: INK, backgroundColor: '#FFFDF8' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontFamily: fonts.bold, fontSize: 16, color: INK, alignSelf: 'flex-start' },
  hint: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 21, color: HINT },
  note: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: '#1F6B2E', textAlign: 'center' },
  bad: { color: '#B3261E' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  bar: { height: 14, borderRadius: 99, borderWidth: 2, borderColor: INK, backgroundColor: colors.cream, overflow: 'hidden', direction: 'ltr' },
  barFill: { height: '100%', backgroundColor: '#7ED957' },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 12, borderWidth: 2, borderColor: INK },
  statNum: { fontFamily: fonts.display, fontSize: 18, color: INK },
  statLabel: { fontFamily: fonts.bold, fontSize: 12, color: INK },
  input: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: INK, borderWidth: 2, borderColor: INK, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff' },
  ltr: { textAlign: TEXT_LEFT, writingDirection: 'ltr' },
  disabled: { opacity: 0.5 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, borderWidth: 2, borderColor: INK, backgroundColor: colors.cream },
  pillOn: { backgroundColor: '#FFC93C' },
  pillText: { fontFamily: fonts.bold, fontSize: 14, color: INK },
  city: { flexDirection: ROW, alignItems: 'center', gap: 8, padding: 6, paddingHorizontal: 10, borderRadius: 16, borderWidth: 2, borderColor: INK, backgroundColor: colors.cream },
  cityText: { flex: 1, gap: 1 },
});
