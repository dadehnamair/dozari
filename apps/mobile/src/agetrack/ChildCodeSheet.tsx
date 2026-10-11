import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { toPersianDigits } from '@dozari/shared';
import { CandyButton } from '../components/CandyButton';
import { fa } from '../i18n/fa';
import { SheetClose } from '../components/SheetClose';
import { useHardwareBack } from '../nav/useHardwareBack';
import { onlyDigits } from '../phone/loginInput';
import { colors, fonts } from '../theme/colors';
import { signInWithChildCode } from './guardianApi';

const INK = '#3A2418';
const l = fa.guardian;

/** The child's device: type the 6-digit code the guardian shows and this device signs in as the child. */
export function ChildCodeSheet({ onClose, onDone }: { onClose: () => void; /** First-run screen: move on instead of restarting the app. */ onDone?: () => void }) {
  useHardwareBack(onClose);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [bad, setBad] = useState(false);
  const go = () => {
    setBusy(true);
    setBad(false);
    signInWithChildCode(code, { announce: !onDone }).then(
      () => onDone?.(),
      () => (setBusy(false), setBad(true)),
    );
  };
  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={l.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <SheetClose onPress={onClose} label={l.close} />
        <Text style={styles.title}>{l.childLoginTitle}</Text>
        <Text style={styles.text}>{l.childLoginIntro}</Text>
        <TextInput value={toPersianDigits(code)} onChangeText={(v) => setCode(onlyDigits(v, 6))} keyboardType="number-pad" maxLength={8} placeholder={l.childLoginCode} style={styles.input} accessibilityLabel={l.childLoginCode} />
        {bad ? <Text style={[styles.text, styles.bad]}>{l.childLoginBad}</Text> : null}
        <CandyButton label={l.childLoginGo} sfx="confirm" color={colors.candy.lime} disabled={busy || code.length !== 6} onPress={go} />
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
  input: { alignSelf: 'stretch', fontFamily: fonts.display, fontSize: 24, letterSpacing: 4, color: INK, textAlign: 'center', backgroundColor: colors.card, borderWidth: 2.5, borderColor: INK, borderRadius: 12, paddingVertical: 8 },
});
