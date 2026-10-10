import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { toPersianDigits } from '@dozari/shared';
import type { AgeTrack } from '@dozari/shared';
import { ChildCodeSheet } from '../agetrack/ChildCodeSheet';
import { Character } from '../components/Character';
import { Icon } from '../components/Icon';
import { Scene } from '../components/Scene';
import { SlabButton } from '../components/SlabButton';
import { AnimatedLogo } from '../components/AnimatedLogo';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { colors, fonts } from '../theme/colors';
import { safeTop } from '../theme/safeArea';
import { useTheme } from '../theme/themeStore';
import { OTP_LENGTH, onlyDigits, phoneFromInput, resendLeft } from './loginInput';
import { loginWithCode, requestLoginCode } from './loginApi';
import { TEXT_LEFT, TEXT_RIGHT } from '../theme/direction';

const INK = colors.ink;
const errText = (e: unknown): string => fa.phoneLogin.errors[e instanceof ApiError ? e.code : 'generic'] ?? fa.phoneLogin.errors.generic ?? '';

/**
 * screen-login of `19 Social Daily Onboarding`: the bazaar at dusk, the waving hero and a cream card — the phone number with a fixed
 * «+98», then the five-box code — with «مهمان بازی کن» under it. Shown once on a fresh install when the server can send codes;
 * playing never needs it.
 */
export function LoginScreen({ onDone, ageTracksOn = false }: { onDone: (r: { signedIn: boolean; created: boolean; track?: AgeTrack }) => void; /** The server's age-track switch: shows «ورود با کد والدین» for a child's own device. */ ageTracksOn?: boolean }) {
  const adult = useTheme() === 'adult';
  const [childCodeOpen, setChildCodeOpen] = useState(false);
  /** «Who is playing?» sits in the card (age tracks on); the choice is saved right after sign-in. */
  const [age, setAge] = useState<AgeTrack>('adult');
  const track = ageTracksOn ? age : undefined;
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
    // iOS Safari only opens the keyboard when focus() runs inside the tap itself (the web input also covers the boxes).
    if (Platform.OS === 'web') return codeInput.current?.focus();
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
      (r) => onDone({ signedIn: true, created: r.created, track }),
      (e) => (setBusy(false), setCode(''), setNote(errText(e))),
    );
  };
  const playAs = (childId: string | null) => {
    if (busy) return;
    if (!childId) return onDone({ signedIn: true, created: false, track });
    setBusy(true);
    setNote(null);
    switchToChild(childId).then(
      () => onDone({ signedIn: true, created: false, track }),
      () => (setBusy(false), setNote(l.pickFailed)),
    );
  };
  const onCode = (raw: string) => {
    const d = onlyDigits(raw, OTP_LENGTH);
    setCode(d);
    if (d.length === OTP_LENGTH) enter(d);
  };

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}><Scene scene="bazaar" mood="dusk" /></View>
      <View style={[StyleSheet.absoluteFill, styles.shade, adult ? ad.shade : null]} />
      <View style={[styles.top, { paddingTop: safeTop(tight ? 24 : 44) }]}>
        <AnimatedLogo width={tight ? 190 : 230} />
        <View style={tight ? styles.heroTight : styles.hero}><Character who={adult ? 'mashti' : 'dozari'} pose="wave" /></View>
      </View>
      <View style={[styles.cardWrap, tight ? styles.cardWrapTight : null]} pointerEvents="box-none">
      <View style={[styles.card, tight ? styles.cardTight : null, adult ? ad.card : null]}>
        {step === 'phone' ? (
          <>
            <Text style={[styles.title, adult ? ad.title : null]}>{l.welcome}</Text>
            <Text style={[styles.sub, adult ? ad.sub : null]}>{l.phoneHint}</Text>
            <View style={styles.phoneRow}>
              <View style={[styles.prefix, adult ? ad.field : null]}><Text style={[styles.prefixText, adult ? ad.fieldText : null]}>+98</Text></View>
              <TextInput value={toPersianDigits(typed)} onChangeText={(v) => setTyped(onlyDigits(v, 11))} onSubmitEditing={send} keyboardType="phone-pad" maxLength={13} placeholder={toPersianDigits('912 345 6789')} placeholderTextColor={adult ? 'rgba(255,233,168,0.4)' : '#B8A9CC'} style={[styles.phoneInput, adult ? ad.field : null, adult ? ad.fieldText : null]} accessibilityLabel={fa.phoneLogin.phone} />
            </View>
            {ageTracksOn ? (
              <View style={styles.ageBlock}>
                <Text style={[styles.sub, adult ? ad.sub : null]}>{fa.ageTrack.whoPlays}</Text>
                <View style={styles.ageRow}>
                  {([['kid', fa.ageTrack.kid], ['teen', fa.ageTrack.teen], ['adult', fa.ageTrack.adult]] as const).map(([k, n]) => (
                    <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: age === k }} onPress={() => setAge(k)} style={[styles.agePill, adult ? ad.agePill : null, age === k ? (adult ? ad.agePillOn : styles.agePillOn) : null]}>
                      <Text style={[styles.agePillText, adult ? ad.agePillText : null, age === k && adult ? ad.agePillTextOn : null]}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.title}>{l.otpTitle}</Text>
            <Text style={styles.sub}>{l.otpSent(toPersianDigits(`0${(phone ?? '').replace(/^\+98/, '')}`))}</Text>
            <Pressable onPress={showKeyboard} accessibilityRole="button" accessibilityLabel={fa.phoneLogin.code} style={styles.boxes}>
              {Array.from({ length: OTP_LENGTH }, (_, i) => (
                <View key={i} style={[styles.box, adult ? ad.field : null, i === Math.min(code.length, OTP_LENGTH - 1) ? (adult ? ad.boxOn : styles.boxOn) : null]}>
                  <Text style={[styles.boxText, adult ? ad.fieldText : null]}>{code[i] ? toPersianDigits(code[i]!) : ''}</Text>
                </View>
              ))}
              <TextInput ref={codeInput} value={toPersianDigits(code)} onChangeText={onCode} keyboardType="number-pad" maxLength={OTP_LENGTH + 2} autoFocus style={styles.hiddenInput} caretHidden />
            </Pressable>
            <View style={styles.resendRow}>
              <Pressable onPress={() => (setStep('phone'), setNote(null))} accessibilityRole="button"><Text style={[styles.link, adult ? ad.link : null]}>{l.changeNumber}</Text></Pressable>
              {left > 0 ? <Text style={[styles.sub, adult ? ad.sub : null]}>{l.resendIn(left)}</Text> : <Pressable onPress={send} accessibilityRole="button"><Text style={[styles.link, adult ? ad.link : null]}>{l.resend}</Text></Pressable>}
            </View>
          </>
        )}
        {note ? <Text style={styles.error}>{note}</Text> : null}
        {step === 'pick' ? null : <>
        <SlabButton label={busy ? l.sending : step === 'phone' ? l.sendCode : l.enter} sfx="confirm" color={colors.candy.lime} height={tight ? 50 : 56} fontSize={22} grow={0} disabled={busy || (step === 'phone' ? !phone : code.length !== OTP_LENGTH)} onPress={step === 'phone' ? send : () => enter(code)} />
        <View style={styles.orRow}><View style={[styles.orLine, adult ? ad.orLine : null]} /><Text style={[styles.orText, adult ? ad.sub : null]}>{l.or}</Text><View style={[styles.orLine, adult ? ad.orLine : null]} /></View>
        <Pressable accessibilityRole="button" onPress={() => onDone({ signedIn: false, created: false, track })} style={({ pressed }) => [styles.guest, adult ? ad.guest : null, pressed ? styles.guestPressed : null]}>
          <Text style={[styles.guestText, adult ? ad.guestText : null]}>{l.guest}</Text>
        </Pressable>
        {ageTracksOn ? (
          <Pressable accessibilityRole="button" onPress={() => setChildCodeOpen(true)} style={({ pressed }) => [styles.parent, adult ? ad.parent : null, pressed ? styles.parentPressed : null]}>
            <Icon name="lock" size={16} color={adult ? '#E8B64A' : '#7E46D6'} strokeWidth={2.6} />
            <Text style={[styles.parentText, adult ? ad.link : null]}>{fa.guardian.childLoginRow}</Text>
          </Pressable>
        ) : null}
        </>}
      </View>
      </View>
      {childCodeOpen ? <ChildCodeSheet onClose={() => setChildCodeOpen(false)} onDone={() => onDone({ signedIn: true, created: true, track })} /> : null}
    </View>
  );
}

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const lift = (h: number) => ({ shadowColor: INK, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

/** Adult overrides (docs/design/adult/Dozari Adult - Login Home): a near-black card with a gold frame and brass controls. */
const ad = StyleSheet.create({
  shade: { backgroundColor: 'rgba(14,10,8,0.5)' },
  card: { backgroundColor: '#17100C', borderColor: '#E8B64A', shadowColor: '#000' },
  title: { color: '#FFE9A8' },
  sub: { color: 'rgba(255,233,168,0.75)' },
  field: { backgroundColor: '#0E0A08', borderColor: '#8A5A16' },
  fieldText: { color: '#FFE9A8' },
  boxOn: { backgroundColor: '#3A2412', borderColor: '#E8B64A' },
  link: { color: '#E8B64A' },
  orLine: { backgroundColor: 'rgba(232,182,74,0.25)' },
  guest: { backgroundColor: '#3A2412', borderColor: '#B8822A', shadowColor: '#000' },
  guestText: { color: '#FFE9A8' },
  parent: { borderColor: 'rgba(232,182,74,0.55)', backgroundColor: 'rgba(232,182,74,0.08)' },
  agePill: { backgroundColor: '#3A2412', borderColor: '#B8822A' },
  agePillOn: { backgroundColor: '#E8B64A', borderColor: '#000' },
  agePillText: { color: '#FFE9A8' },
  agePillTextOn: { color: '#2A1606' },
});

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, backgroundColor: colors.deep },
  shade: { backgroundColor: 'rgba(43,18,64,0.5)' },
  top: { alignItems: 'center' },
  hero: { width: 150, height: 172, marginTop: -4 },
  heroTight: { width: 100, height: 115 },
  // A centring wrapper: `alignSelf` does nothing on an absolute box, so a lone absolute card with `left`+`right`+`maxWidth` stuck to the left on wide screens.
  cardWrap: { position: 'absolute', left: 14, right: 14, bottom: 26, alignItems: 'center' },
  cardWrapTight: { bottom: 12 },
  card: { width: '100%', maxWidth: 420, padding: 14, paddingTop: 16, gap: 10, borderRadius: 26, borderWidth: 4, borderColor: INK, backgroundColor: colors.paper, ...lift(7) },
  cardTight: { gap: 7, padding: 12 },
  title: { fontFamily: fonts.display, fontSize: 22, color: INK, textAlign: TEXT_RIGHT },
  sub: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 19, color: '#7E46D6', textAlign: TEXT_RIGHT },
  phoneRow: { flexDirection: 'row', direction: 'ltr', gap: 6 },
  prefix: { height: 52, paddingHorizontal: 12, borderRadius: 14, borderWidth: 3, borderColor: INK, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  prefixText: { fontFamily: fonts.bold, fontSize: 15, color: INK },
  phoneInput: { flex: 1, minWidth: 0, height: 52, borderRadius: 14, borderWidth: 3, borderColor: INK, backgroundColor: colors.card, paddingHorizontal: 12, fontFamily: fonts.bold, fontSize: 17, letterSpacing: 1, color: INK, textAlign: TEXT_LEFT },
  // `direction: 'ltr'` so the first digit fills the left box on the RTL Android layout too (codes read left to right).
  boxes: { flexDirection: 'row', direction: 'ltr', gap: 8, justifyContent: 'center' },
  box: { width: 48, height: 56, borderRadius: 14, borderWidth: 3, borderColor: INK, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...lift(4) },
  boxOn: { backgroundColor: colors.hi },
  boxText: { fontFamily: fonts.display, fontSize: 28, color: INK },
  hiddenInput: Platform.OS === 'web' ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 } : { position: 'absolute', opacity: 0, width: 1, height: 1 },
  resendRow: { flexDirection: ROW, justifyContent: 'space-between', alignItems: 'center' },
  link: { fontFamily: fonts.bold, fontSize: 12.5, color: '#E8743B', textDecorationLine: 'underline' },
  error: { fontFamily: fonts.bold, fontSize: 12.5, color: '#B3261E', textAlign: 'center' },
  tracks: { flexDirection: 'row', direction: 'ltr', justifyContent: 'center', gap: 8 },
  trackChip: { flex: 1, height: 40, flexDirection: 'row', direction: 'rtl', gap: 5, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 2.5, borderColor: 'rgba(43,18,64,0.25)', backgroundColor: 'rgba(255,255,255,0.55)' },
  trackOn: { borderColor: INK, backgroundColor: '#FFE48A' },
  trackEmoji: { fontSize: 18 },
  trackText: { fontFamily: fonts.bold, fontSize: 12, color: INK },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orLine: { flex: 1, height: 2, backgroundColor: 'rgba(43,18,64,0.15)' },
  orText: { fontFamily: fonts.bold, fontSize: 11, color: 'rgba(43,18,64,0.55)' },
  guest: { height: 46, borderRadius: 16, borderWidth: 3, borderColor: INK, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...lift(4) },
  guestPressed: { transform: [{ translateY: 3 }] },
  ageBlock: { gap: 6 },
  ageRow: { flexDirection: ROW, gap: 6 },
  agePill: { flex: 1, height: 40, borderRadius: 12, borderWidth: 3, borderColor: INK, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  agePillOn: { backgroundColor: colors.hi },
  agePillText: { fontFamily: fonts.display, fontSize: 17, color: INK },
  // A quiet dashed pill: for a child's own device, so it must not compete with the guest button.
  parent: { height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(126,70,214,0.55)', backgroundColor: 'rgba(126,70,214,0.08)' },
  parentPressed: { backgroundColor: 'rgba(126,70,214,0.18)' },
  parentText: { fontFamily: fonts.bold, fontSize: 13, color: '#7E46D6' },
  guestText: { fontFamily: fonts.display, fontSize: 17, color: INK },
});
