import { toPersianDigits } from '@dozari/shared';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CandyButton } from '../components/CandyButton';
import { OTP_LENGTH, PHONE_MAX_DIGITS, onlyDigits, phoneFromInput, resendLeft } from './loginInput';
import { fa } from '../i18n/fa';
import { SheetClose } from '../components/SheetClose';
import { SheetBody } from '../components/SheetBody';
import { ApiError } from '../net/http';
import { colors, fonts } from '../theme/colors';
import { TEXT_LEFT } from '../theme/direction';
import { loginWithCode, requestLoginCode } from './loginApi';
import { listenForSmsCode } from './webOtp';
import { useHardwareBack } from '../nav/useHardwareBack';

const INK = '#3A2418';
const t = fa.phoneLogin;
const textOf = (e: unknown): string => t.errors[e instanceof ApiError ? e.code : 'generic'] ?? t.errors.generic ?? '';

/**
 * Sign in with a number from settings. Same input behaviour as the first-run `LoginScreen`: the number after a fixed «+98», then the
 * code in five separate boxes (one hidden field behind them), submitted by itself on the fifth digit. Nothing here is needed to play.
 */
export function PhoneLoginSheet({ onClose }: { onClose: () => void }) {
  useHardwareBack(onClose);
  const [typed, setTyped] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  const codeInput = useRef<TextInput>(null);
  const phone = phoneFromInput(typed);

  // Android keeps the hidden field "focused" after the keyboard is dismissed, so a second tap would not reopen it.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => codeInput.current?.blur());
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!sent) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sent]);
  // PWA on Android Chrome: the browser reads the SMS (last line `@domain #code`) and fills the field.
  useEffect(() => {
    if (!sent || Platform.OS !== 'web') return;
    return listenForSmsCode((c) => onCodeRef.current(c));
  }, [sent]);

  const showKeyboard = () => {
    if (Platform.OS === 'web') return codeInput.current?.focus();
    codeInput.current?.blur();
    setTimeout(() => codeInput.current?.focus(), 30);
  };

  const send = () => {
    if (busy) return;
    if (!phone) return setNote({ text: t.errors.invalid_phone ?? '', bad: true });
    setBusy(true);
    setNote(null);
    requestLoginCode(phone).then(
      () => (setSent(true), setCode(''), setSentAt(Date.now()), setNow(Date.now()), setNote({ text: t.sent, bad: false }), setTimeout(() => codeInput.current?.focus(), 80)),
      (e) => setNote({ text: textOf(e), bad: true }),
    ).finally(() => setBusy(false));
  };
  const enter = (digits: string) => {
    if (!phone || busy || digits.length !== OTP_LENGTH) return;
    setBusy(true);
    setNote(null);
    // On success the whole app restarts on the new account (this sheet goes away), so only a failure needs handling here.
    loginWithCode(phone, digits).catch((e) => (setBusy(false), setCode(''), setNote({ text: textOf(e), bad: true })));
  };
  const onCode = (raw: string) => {
    const d = onlyDigits(raw, OTP_LENGTH);
    setCode(d);
    if (d.length === OTP_LENGTH) enter(d);
  };
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const left = resendLeft(sentAt, now);

  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={t.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <SheetClose onPress={onClose} label={t.close} />
        <SheetBody>
        <Text style={styles.title}>{t.title}</Text>
        <Text style={styles.text}>{t.intro}</Text>
        {sent ? (
          <>
            <Pressable onPress={showKeyboard} accessibilityRole="button" accessibilityLabel={t.code} style={styles.boxes}>
              {Array.from({ length: OTP_LENGTH }, (_, i) => (
                <View key={i} style={[styles.box, i === Math.min(code.length, OTP_LENGTH - 1) && styles.boxOn]}>
                  <Text style={styles.boxText}>{code[i] ? toPersianDigits(code[i]!) : ''}</Text>
                </View>
              ))}
              <TextInput ref={codeInput} value={toPersianDigits(code)} onChangeText={onCode} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={OTP_LENGTH + 2} autoFocus style={styles.hiddenInput} caretHidden />
            </Pressable>
            <View style={styles.resendRow}>
              <Pressable onPress={() => (setSent(false), setCode(''), setNote(null))} accessibilityRole="button"><Text style={styles.link}>{fa.login.changeNumber}</Text></Pressable>
              {left > 0 ? <Text style={styles.text}>{fa.login.resendIn(left)}</Text> : <Pressable onPress={send} accessibilityRole="button"><Text style={styles.link}>{fa.login.resend}</Text></Pressable>}
            </View>
          </>
        ) : (
          <View style={styles.phoneRow}>
            <View style={styles.prefix}><Text style={styles.prefixText}>+98</Text></View>
            <TextInput value={toPersianDigits(typed)} onChangeText={(v) => setTyped(onlyDigits(v, PHONE_MAX_DIGITS))} onSubmitEditing={send} keyboardType="phone-pad" maxLength={PHONE_MAX_DIGITS} placeholder={toPersianDigits('912 345 6789')} placeholderTextColor="#B8A9CC" style={styles.phoneInput} accessibilityLabel={t.phone} />
          </View>
        )}
        {note ? <Text style={[styles.text, note.bad && styles.bad]}>{note.text}</Text> : null}
        {sent ? <CandyButton label={t.login} color={colors.candy.lime} disabled={busy || code.length !== OTP_LENGTH} onPress={() => enter(code)} /> : <CandyButton label={t.send} color={colors.candy.lime} disabled={busy || typed.length === 0} onPress={send} />}
        </SheetBody>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 360, maxHeight: '90%', backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 16, gap: 10, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 22, color: INK },
  text: { fontFamily: fonts.bold, fontSize: 13.5, color: INK, textAlign: 'center' },
  bad: { color: '#B3261E' },
  phoneRow: { alignSelf: 'stretch', flexDirection: 'row', direction: 'ltr', gap: 6 },
  prefix: { height: 48, paddingHorizontal: 12, borderRadius: 12, borderWidth: 2.5, borderColor: INK, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  prefixText: { fontFamily: fonts.bold, fontSize: 15, color: INK },
  phoneInput: { flex: 1, minWidth: 0, height: 48, borderRadius: 12, borderWidth: 2.5, borderColor: INK, backgroundColor: colors.card, paddingHorizontal: 12, fontFamily: fonts.bold, fontSize: 17, letterSpacing: 1, color: INK, textAlign: TEXT_LEFT },
  // `direction: 'ltr'` so the first digit fills the left box on the RTL Android layout too (codes read left to right).
  boxes: { flexDirection: 'row', direction: 'ltr', gap: 8, justifyContent: 'center' },
  box: { width: 46, height: 54, borderRadius: 12, borderWidth: 2.5, borderColor: INK, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.hi },
  boxText: { fontFamily: fonts.display, fontSize: 26, color: INK },
  hiddenInput: Platform.OS === 'web' ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 } : { position: 'absolute', opacity: 0, width: 1, height: 1 },
  resendRow: { alignSelf: 'stretch', flexDirection: Platform.OS === 'web' ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { fontFamily: fonts.bold, fontSize: 12.5, color: '#E8743B', textDecorationLine: 'underline' },
});
