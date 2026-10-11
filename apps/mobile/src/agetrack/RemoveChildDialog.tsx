import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ChildRow } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { colors, fonts } from '../theme/colors';
import { fetchRemoval, removeChild, removeChildWithCode, sendRemoveCode } from './guardianApi';

const INK = '#3A2418';
const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const l = fa.guardian;
const r = l.removeFlow;
const textOf = (e: unknown): string => l.errors[e instanceof ApiError ? e.code : 'generic'] ?? l.errors.generic ?? '';

/**
 * Removing a child, always behind a confirm. A child with no record is removed after one «حذف»; one with games or friends needs the code that is
 * texted to the guardian's own number first, so nobody removes them by accident or without the guardian's phone in hand.
 */
export function RemoveChildDialog({ child, onClose, onRemoved }: { child: ChildRow; onClose: () => void; onRemoved: () => void }) {
  const [needsCode, setNeedsCode] = useState<boolean | null>(null);
  const [step, setStep] = useState<'ask' | 'code'>('ask');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    void fetchRemoval(child.id).then((x) => setNeedsCode(x.needsCode), (e) => (setNote(textOf(e)), setNeedsCode(false)));
  }, [child.id]);

  const guard = (job: () => Promise<void>, then?: () => void) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    job().then(() => then?.(), (e) => setNote(textOf(e))).finally(() => setBusy(false));
  };
  const send = () => guard(() => sendRemoveCode(child.id), () => (setStep('code'), setNote(r.sent)));
  const finish = () => guard(() => removeChildWithCode(child.id, code.trim()), onRemoved);

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
      <View style={styles.card} accessibilityRole="alert">
        <Text style={styles.title}>{r.title(child.nickname)}</Text>
        {needsCode === null ? <ActivityIndicator color={INK} /> : null}
        {needsCode !== null && step === 'ask' ? (
          <>
            <Text style={styles.message}>{needsCode ? r.history : r.plain}</Text>
            {note ? <Text style={styles.bad}>{note}</Text> : null}
            <View style={styles.buttons}>
              <Pressable disabled={busy} onPress={needsCode ? send : () => guard(() => removeChild(child.id), onRemoved)} style={[styles.btn, styles.danger, busy ? styles.off : null]} accessibilityRole="button">
                <Text style={[styles.btnText, styles.dangerText]}>{needsCode ? r.sendCode : r.yes}</Text>
              </Pressable>
              <Pressable onPress={onClose} style={[styles.btn, styles.cancel]} accessibilityRole="button"><Text style={styles.btnText}>{r.cancel}</Text></Pressable>
            </View>
          </>
        ) : null}
        {step === 'code' ? (
          <>
            <Text style={styles.message}>{r.codeHint}</Text>
            <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={8} placeholder={r.codePlaceholder} style={styles.input} accessibilityLabel={r.codeTitle} />
            {note ? <Text style={note === r.sent ? styles.ok : styles.bad}>{note}</Text> : null}
            <View style={styles.buttons}>
              <Pressable disabled={busy || code.trim().length < 3} onPress={finish} style={[styles.btn, styles.danger, busy || code.trim().length < 3 ? styles.off : null]} accessibilityRole="button"><Text style={[styles.btnText, styles.dangerText]}>{r.confirm}</Text></Pressable>
              <Pressable disabled={busy} onPress={send} style={[styles.btn, styles.cancel]} accessibilityRole="button"><Text style={styles.btnText}>{r.resend}</Text></Pressable>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8}><Text style={styles.link}>{r.cancel}</Text></Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, backgroundColor: 'rgba(20,8,32,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 22, padding: 16, gap: 10 },
  title: { fontFamily: fonts.display, fontSize: 21, color: INK, textAlign: 'center' },
  message: { fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 22, color: INK, textAlign: 'center' },
  input: { height: 46, borderRadius: 12, borderWidth: 3, borderColor: INK, backgroundColor: '#fff', textAlign: 'center', fontFamily: fonts.display, fontSize: 22, color: INK, letterSpacing: 4 },
  bad: { fontFamily: fonts.bold, fontSize: 13, color: '#B3261E', textAlign: 'center' },
  ok: { fontFamily: fonts.bold, fontSize: 13, color: '#2E7D32', textAlign: 'center' },
  buttons: { flexDirection: ROW, gap: 8 },
  btn: { flex: 1, minHeight: 44, borderRadius: 14, borderWidth: 3, borderColor: INK, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  danger: { backgroundColor: colors.candy.pink },
  dangerText: { color: '#fff' },
  cancel: { backgroundColor: colors.card },
  off: { opacity: 0.5 },
  btnText: { fontFamily: fonts.display, fontSize: 15, lineHeight: 22, color: INK, textAlign: 'center' },
  link: { fontFamily: fonts.bold, fontSize: 12.5, color: '#6634B0', textAlign: 'center' },
});
