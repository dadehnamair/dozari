import { toPersianDigits } from '@dozari/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { CandyButton } from '../components/CandyButton';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { colors, fonts } from '../theme/colors';
import { loginWithCode, requestLoginCode } from './loginApi';
import { useHardwareBack } from '../nav/useHardwareBack';

const INK = '#3A2418';
const t = fa.phoneLogin;
const textOf = (e: unknown): string => t.errors[e instanceof ApiError ? e.code : 'generic'] ?? t.errors.generic ?? '';

/** Sign in with a number: type it, get an SMS code, type the code. Reachable from settings; nothing here is needed to play. */
export function PhoneLoginSheet({ onClose }: { onClose: () => void }) {
  useHardwareBack(onClose);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);

  const send = () => {
    setBusy(true);
    requestLoginCode(phone).then(
      () => (setSent(true), setNote({ text: t.sent, bad: false })),
      (e) => setNote({ text: textOf(e), bad: true }),
    ).finally(() => setBusy(false));
  };
  const login = () => {
    setBusy(true);
    loginWithCode(phone, code).catch((e) => (setBusy(false), setNote({ text: textOf(e), bad: true })));
  };

  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={t.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <Text style={styles.title}>{t.title}</Text>
        <Text style={styles.text}>{t.intro}</Text>
        <TextInput value={toPersianDigits(phone)} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} placeholder={fa.phone.placeholder} style={styles.input} accessibilityLabel={t.phone} editable={!sent} />
        {sent ? <TextInput value={toPersianDigits(code)} onChangeText={setCode} keyboardType="number-pad" maxLength={8} placeholder={t.code} style={styles.input} accessibilityLabel={t.code} /> : null}
        {note ? <Text style={[styles.text, note.bad && styles.bad]}>{note.text}</Text> : null}
        {sent ? <CandyButton label={t.login} color={colors.candy.lime} disabled={busy || code.trim().length === 0} onPress={login} /> : null}
        <CandyButton label={t.send} color={sent ? colors.candy.sky : colors.candy.lime} disabled={busy || phone.trim().length === 0} onPress={send} />
        <CandyButton label={t.close} sfx="back" color={colors.candy.sky} onPress={onClose} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 360, backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 16, gap: 10, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 22, color: INK },
  text: { fontFamily: fonts.bold, fontSize: 13.5, color: INK, textAlign: 'center' },
  bad: { color: '#B3261E' },
  input: { alignSelf: 'stretch', fontFamily: fonts.bold, fontSize: 16, color: INK, textAlign: 'center', backgroundColor: colors.card, borderWidth: 2.5, borderColor: INK, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10 },
});
