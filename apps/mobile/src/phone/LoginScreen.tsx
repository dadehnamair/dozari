import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { toPersianDigits } from '@dozari/shared';
import { Character } from '../components/Character';
import { Scene } from '../components/Scene';
import { SlabButton } from '../components/SlabButton';
import { AnimatedLogo } from '../components/AnimatedLogo';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { colors, fonts } from '../theme/colors';
import { safeTop } from '../theme/safeArea';
import { OTP_LENGTH, onlyDigits, phoneFromInput, resendLeft } from './loginInput';
import { loginWithCode, requestLoginCode } from './loginApi';
import { TEXT_LEFT, TEXT_RIGHT } from '../theme/direction';

const INK = '#2B1240';
const errText = (e: unknown): string => fa.phoneLogin.errors[e instanceof ApiError ? e.code : 'generic'] ?? fa.phoneLogin.errors.generic ?? '';

/**
 * screen-login of `19 Social Daily Onboarding`: the bazaar at dusk, the waving hero and a cream card — the phone number with a fixed
 * «+98», then the five-box code — with «مهمان بازی کن» under it. Shown once on a fresh install when the server can send codes;
 * playing never needs it.
 */
export function LoginScreen({ onDone }: { onDone: (r: { signedIn: boolean; created: boolean }) => void }) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [typed, setTyped] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const codeInput = useRef<TextInput>(null);
  // Android keeps the hidden code field "focused" after the keyboard is dismissed (back button), so a second tap would not
  // bring it up again: let go of the focus when the keyboard hides, and re-take it on a tap.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => codeInput.current?.blur());
    return () => sub.remove();
  }, []);
  const showKeyboard = () => {
    codeInput.current?.blur();
    setTimeout(() => codeInput.current?.focus(), 30);
  };
  const tight = useWindowDimensions().height < 700;
  const phone = phoneFromInput(typed);

  useEffect(() => {
    if (step !== 'otp') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [step]);
  const left = resendLeft(sentAt, now);

  const send = () => {
    if (!phone || busy) return;
    setBusy(true);
    setNote(null);
    requestLoginCode(phone).then(
      () => (setStep('otp'), setCode(''), setSentAt(Date.now()), setNow(Date.now()), setTimeout(() => codeInput.current?.focus(), 80)),
      (e) => setNote(errText(e)),
    ).finally(() => setBusy(false));
  };
  const enter = (digits: string) => {
    if (!phone || busy || digits.length !== OTP_LENGTH) return;
    setBusy(true);
    setNote(null);
    loginWithCode(phone, digits, { announce: false }).then(
      (r) => onDone({ signedIn: true, created: r.created }),
      (e) => (setBusy(false), setCode(''), setNote(errText(e))),
    );
  };
  const onCode = (raw: string) => {
    const d = onlyDigits(raw, OTP_LENGTH);
    setCode(d);
    if (d.length === OTP_LENGTH) enter(d);
  };

  const l = fa.login;
  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}><Scene scene="bazaar" mood="dusk" /></View>
      <View style={[StyleSheet.absoluteFill, styles.shade]} />
      <View style={[styles.top, { paddingTop: safeTop(tight ? 24 : 44) }]}>
        <AnimatedLogo width={tight ? 190 : 230} />
        <View style={tight ? styles.heroTight : styles.hero}><Character who="dozari" pose="wave" /></View>
      </View>
      <View style={[styles.card, tight ? styles.cardTight : null]}>
        {step === 'phone' ? (
          <>
            <Text style={styles.title}>{l.welcome}</Text>
            <Text style={styles.sub}>{l.phoneHint}</Text>
            <View style={styles.phoneRow}>
              <View style={styles.prefix}><Text style={styles.prefixText}>+98</Text></View>
              <TextInput value={toPersianDigits(typed)} onChangeText={(v) => setTyped(onlyDigits(v, 11))} onSubmitEditing={send} keyboardType="phone-pad" maxLength={13} placeholder={toPersianDigits('912 345 6789')} placeholderTextColor="#B8A9CC" style={styles.phoneInput} accessibilityLabel={fa.phoneLogin.phone} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.title}>{l.otpTitle}</Text>
            <Text style={styles.sub}>{l.otpSent(toPersianDigits(`0${(phone ?? '').replace(/^\+98/, '')}`))}</Text>
            <Pressable onPress={showKeyboard} accessibilityRole="button" accessibilityLabel={fa.phoneLogin.code} style={styles.boxes}>
              {Array.from({ length: OTP_LENGTH }, (_, i) => (
                <View key={i} style={[styles.box, i === Math.min(code.length, OTP_LENGTH - 1) ? styles.boxOn : null]}>
                  <Text style={styles.boxText}>{code[i] ? toPersianDigits(code[i]!) : ''}</Text>
                </View>
              ))}
              <TextInput ref={codeInput} value={toPersianDigits(code)} onChangeText={onCode} keyboardType="number-pad" maxLength={OTP_LENGTH + 2} autoFocus style={styles.hiddenInput} caretHidden />
            </Pressable>
            <View style={styles.resendRow}>
              <Pressable onPress={() => (setStep('phone'), setNote(null))} accessibilityRole="button"><Text style={styles.link}>{l.changeNumber}</Text></Pressable>
              {left > 0 ? <Text style={styles.sub}>{l.resendIn(left)}</Text> : <Pressable onPress={send} accessibilityRole="button"><Text style={styles.link}>{l.resend}</Text></Pressable>}
            </View>
          </>
        )}
        {note ? <Text style={styles.error}>{note}</Text> : null}
        <SlabButton label={busy ? l.sending : step === 'phone' ? l.sendCode : l.enter} color={colors.candy.lime} height={tight ? 50 : 56} fontSize={22} grow={0} disabled={busy || (step === 'phone' ? !phone : code.length !== OTP_LENGTH)} onPress={step === 'phone' ? send : () => enter(code)} />
        <View style={styles.orRow}><View style={styles.orLine} /><Text style={styles.orText}>{l.or}</Text><View style={styles.orLine} /></View>
        <Pressable accessibilityRole="button" onPress={() => onDone({ signedIn: false, created: false })} style={({ pressed }) => [styles.guest, pressed ? styles.guestPressed : null]}>
          <Text style={styles.guestText}>{l.guest}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const lift = (h: number) => ({ shadowColor: INK, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, backgroundColor: '#3C1A66' },
  shade: { backgroundColor: 'rgba(43,18,64,0.5)' },
  top: { alignItems: 'center' },
  hero: { width: 150, height: 172, marginTop: -4 },
  heroTight: { width: 100, height: 115 },
  card: { position: 'absolute', left: 14, right: 14, bottom: 26, maxWidth: 420, alignSelf: 'center', padding: 14, paddingTop: 16, gap: 10, borderRadius: 26, borderWidth: 4, borderColor: INK, backgroundColor: '#FBF1DE', ...lift(7) },
  cardTight: { bottom: 12, gap: 7, padding: 12 },
  title: { fontFamily: fonts.display, fontSize: 22, color: INK, textAlign: TEXT_RIGHT },
  sub: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 19, color: '#7E46D6', textAlign: TEXT_RIGHT },
  phoneRow: { flexDirection: 'row', direction: 'ltr', gap: 6 },
  prefix: { height: 52, paddingHorizontal: 12, borderRadius: 14, borderWidth: 3, borderColor: INK, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  prefixText: { fontFamily: fonts.bold, fontSize: 15, color: INK },
  phoneInput: { flex: 1, minWidth: 0, height: 52, borderRadius: 14, borderWidth: 3, borderColor: INK, backgroundColor: '#fff', paddingHorizontal: 12, fontFamily: fonts.bold, fontSize: 17, letterSpacing: 1, color: INK, textAlign: TEXT_LEFT },
  boxes: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  box: { width: 48, height: 56, borderRadius: 14, borderWidth: 3, borderColor: INK, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  boxOn: { backgroundColor: '#FFE48A' },
  boxText: { fontFamily: fonts.display, fontSize: 28, color: INK },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  resendRow: { flexDirection: ROW, justifyContent: 'space-between', alignItems: 'center' },
  link: { fontFamily: fonts.bold, fontSize: 12.5, color: '#E8743B', textDecorationLine: 'underline' },
  error: { fontFamily: fonts.bold, fontSize: 12.5, color: '#B3261E', textAlign: 'center' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orLine: { flex: 1, height: 2, backgroundColor: 'rgba(43,18,64,0.15)' },
  orText: { fontFamily: fonts.bold, fontSize: 11, color: 'rgba(43,18,64,0.55)' },
  guest: { height: 46, borderRadius: 16, borderWidth: 3, borderColor: INK, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  guestPressed: { transform: [{ translateY: 3 }] },
  guestText: { fontFamily: fonts.display, fontSize: 17, color: INK },
});
