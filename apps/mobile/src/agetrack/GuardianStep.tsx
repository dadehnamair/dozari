import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { toPersianDigits } from '@dozari/shared';
import { SlabButton } from '../components/SlabButton';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { colors, fonts } from '../theme/colors';
import { confirmGuardian, requestGuardianCode } from './guardianApi';

const INK = colors.ink;
const l = fa.guardian;
const textOf = (e: unknown): string => l.errors[e instanceof ApiError ? e.code : 'generic'] ?? l.errors.generic ?? '';

/**
 * The guardian step after a kid or teen picks their track: the guardian's number, an SMS code, done. It is **never a gate for playing**
 * (docs/logic/age-tracks.md): «بعداً» always moves on, and only the social features wait for it.
 */
export function GuardianStep({ onDone }: { onDone: () => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  const send = () => {
    setBusy(true);
    requestGuardianCode(phone).then(
      () => (setSent(true), setNote(null)),
      (e) => setNote({ text: textOf(e), bad: true }),
    ).finally(() => setBusy(false));
  };
  const confirm = () => {
    setBusy(true);
    confirmGuardian(phone, code).then(
      () => (setNote({ text: l.done, bad: false }), setTimeout(onDone, 900)),
      (e) => (setBusy(false), setNote({ text: textOf(e), bad: true })),
    );
  };
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{l.stepTitle}</Text>
      <Text style={styles.sub}>{l.stepSub}</Text>
      <TextInput value={toPersianDigits(phone)} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} placeholder={fa.phone.placeholder} style={styles.input} accessibilityLabel={l.phone} editable={!sent} />
      {sent ? <TextInput value={toPersianDigits(code)} onChangeText={setCode} keyboardType="number-pad" maxLength={8} placeholder={l.code} style={styles.input} accessibilityLabel={l.code} /> : null}
      {note ? <Text style={[styles.sub, note.bad ? styles.bad : null]}>{note.text}</Text> : null}
      {sent ? <SlabButton label={l.confirm} sfx="confirm" color={colors.candy.lime} height={50} fontSize={22} grow={0} disabled={busy || code.trim().length === 0} onPress={confirm} /> : <SlabButton label={l.sendCode} sfx="confirm" color={colors.candy.lime} height={50} fontSize={22} grow={0} disabled={busy || phone.trim().length === 0} onPress={send} />}
      <SlabButton label={l.later} sfx="back" color={colors.candy.sky} height={46} fontSize={18} grow={0} onPress={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  title: { fontFamily: fonts.display, fontSize: 22, color: INK, textAlign: 'center' },
  sub: { fontFamily: fonts.body, fontSize: 13.5, color: '#5B4A70', textAlign: 'center' },
  bad: { color: '#B3261E' },
  input: { alignSelf: 'stretch', fontFamily: fonts.bold, fontSize: 16, color: INK, textAlign: 'center', backgroundColor: '#fff', borderWidth: 2.5, borderColor: INK, borderRadius: 12, paddingVertical: 8 },
});
