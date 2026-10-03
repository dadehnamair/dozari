import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { AccountSummary, PhoneChoice, PhoneStatus } from '@dozari/shared';
import { toPersianDigits } from '@dozari/shared';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { colors, fonts } from '../theme/colors';
import { fetchPhone, requestSms, resolvePhone, savePhone, verifySmsCode } from './api';
import { phoneErrorText } from './errors';
import { TEXT_LEFT } from '../theme/direction';

const INK = '#3A2418';
const codeOf = (e: unknown): string => (e instanceof ApiError ? e.code : 'generic');

/** Mobile number: type it, then prove it by sharing the contact in the Bale bot (or by an SMS code). Shown above the Bale link. */
export function PhoneStep({ onChange }: { onChange?: (s: PhoneStatus) => void }) {
  const [status, setStatus] = useState<PhoneStatus | null>(null);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [smsSent, setSmsSent] = useState(false);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  const [asking, setAsking] = useState<PhoneChoice | null>(null);
  const [busy, setBusy] = useState(false);

  const adopt = (s: PhoneStatus) => (setStatus(s), onChange?.(s));
  useEffect(() => {
    fetchPhone().then(adopt, () => setNote({ text: fa.phone.errors.generic ?? '', bad: true }));
  }, []);

  // The proof may happen in the Bale bot, outside the app: while a number waits, look again every few seconds.
  const waiting = status !== null && !status.verified && status.pending !== null;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => void fetchPhone().then(adopt, () => undefined), 5000);
    return () => clearInterval(timer);
  }, [waiting]);

  const choose = (choice: PhoneChoice) => {
    setBusy(true);
    resolvePhone(choice).then(
      (s) => (setAsking(null), setBusy(false), s ? (adopt(s), setNote({ text: fa.phone.conflict.kept, bad: false })) : undefined),
      (e) => (setAsking(null), setBusy(false), setNote({ text: phoneErrorText(codeOf(e)), bad: true }), void fetchPhone().then(adopt, () => undefined)),
    );
  };

  const save = () =>
    savePhone(phone).then(
      (s) => (adopt(s), setPhone(''), setSmsSent(false), setNote({ text: fa.phone.saved, bad: false })),
      (e) => setNote({ text: phoneErrorText(codeOf(e)), bad: true }),
    );
  const sms = () =>
    requestSms().then(
      () => (setSmsSent(true), setNote({ text: fa.phone.smsSent, bad: false })),
      (e) => setNote({ text: phoneErrorText(codeOf(e)), bad: true }),
    );
  const verify = () =>
    verifySmsCode(code).then(
      (s) => (adopt(s), setCode(''), setNote({ text: fa.phone.verified, bad: false })),
      (e) => setNote({ text: phoneErrorText(codeOf(e)), bad: true }),
    );

  if (!status) return null;
  const c = fa.phone.conflict;
  if (status.conflict) {
    const cf = status.conflict;
    return (
      <View style={styles.box}>
        <Text style={styles.label}>{c.title}</Text>
        <Text style={styles.text}>{c.intro(cf.phone)}</Text>
        <View style={styles.accounts}>
          <AccountCard title={c.current} a={cf.current} />
          <AccountCard title={c.previous} a={cf.previous} />
        </View>
        <Pressable onPress={() => setAsking('keep_current')} style={[styles.pill, styles.on]} accessibilityRole="button"><Text style={styles.pillText}>{c.keepCurrent}</Text></Pressable>
        <Pressable onPress={() => setAsking('load_previous')} style={styles.pill} accessibilityRole="button"><Text style={styles.pillText}>{c.loadPrevious}</Text></Pressable>
        {note ? <Text style={[styles.hint, note.bad && styles.bad]}>{note.text}</Text> : null}
        {asking ? (
          <ConfirmDialog
            danger
            busy={busy}
            title={asking === 'keep_current' ? c.keepTitle : c.loadTitle}
            message={asking === 'keep_current' ? c.keepWarn : c.loadWarn}
            confirmLabel={c.confirm}
            cancelLabel={c.back}
            onCancel={() => setAsking(null)}
            onConfirm={() => choose(asking)}
          />
        ) : null}
      </View>
    );
  }
  return (
    <View style={styles.box}>
      <Text style={styles.label}>{fa.phone.title}</Text>
      {status.verified ? <Text style={styles.text}>{fa.phone.verifiedAs(status.phone ?? '')}</Text> : null}
      {!status.verified && status.pending ? (
        <>
          <Text style={styles.text}>{fa.phone.pendingAs(status.pending)}</Text>
          <Text style={styles.hint}>{fa.phone.viaBale}</Text>
          {status.smsAvailable ? (
            <View style={styles.row}>
              <Pressable onPress={() => void sms()} style={styles.pill} accessibilityRole="button"><Text style={styles.pillText}>{fa.phone.sendSms}</Text></Pressable>
              {smsSent ? (
                <>
                  <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={8} style={styles.input} accessibilityLabel={fa.phone.smsCode} />
                  <Pressable onPress={() => void verify()} style={[styles.pill, styles.on]} accessibilityRole="button"><Text style={styles.pillText}>{fa.phone.verify}</Text></Pressable>
                </>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}
      {!status.verified ? (
        <View style={styles.row}>
          <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} placeholder={fa.phone.placeholder} style={styles.input} accessibilityLabel={fa.phone.title} />
          <Pressable onPress={() => void save()} style={[styles.pill, styles.on]} accessibilityRole="button"><Text style={styles.pillText}>{fa.phone.save}</Text></Pressable>
        </View>
      ) : null}
      <Text style={styles.hint}>{fa.phone.privacy}</Text>
      {note ? <Text style={[styles.hint, note.bad && styles.bad]}>{note.text}</Text> : null}
    </View>
  );
}

function AccountCard({ title, a }: { title: string; a: AccountSummary }) {
  return (
    <View style={styles.account}>
      <Text style={styles.hint}>{title}</Text>
      <Text style={styles.text} numberOfLines={1}>{a.nickname}</Text>
      <Text style={styles.hint}>{`${fa.phone.conflict.level} ${toPersianDigits(String(a.level))} · ${toPersianDigits(String(a.coins))} ${fa.phone.conflict.coins}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  accounts: { flexDirection: 'row', gap: 8 },
  account: { flex: 1, minWidth: 0, gap: 2, padding: 8, borderRadius: 12, borderWidth: 2, borderColor: INK, backgroundColor: '#fff' },
  box: { alignSelf: 'stretch', gap: 6 },
  label: { fontFamily: fonts.bold, fontSize: 15, color: INK },
  text: { fontFamily: fonts.bold, fontSize: 14, color: INK },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.75 },
  bad: { color: '#B3261E', opacity: 1 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  input: { flex: 1, minWidth: 120, fontFamily: fonts.bold, fontSize: 16, color: INK, borderWidth: 2, borderColor: INK, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#fff', textAlign: TEXT_LEFT, writingDirection: 'ltr' },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, borderWidth: 2, borderColor: INK, backgroundColor: colors.cream },
  on: { backgroundColor: '#FFC93C' },
  pillText: { fontFamily: fonts.bold, fontSize: 14, color: INK },
});
