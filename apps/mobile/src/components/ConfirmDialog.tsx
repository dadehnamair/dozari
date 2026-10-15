import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { colors, fonts } from '../theme/colors';
import { adultSkin } from '../theme/skin';
import { bootTheme } from '../theme/bootTheme';

const ADULT = bootTheme() === 'adult';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

/** «مطمئنی؟» before anything important (sign out, delete…): a centred card over a dimmed page; the dim area cancels. */
export function ConfirmDialog({ title, message, confirmLabel, cancelLabel, danger = false, busy = false, error, children, onConfirm, onCancel }: {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={[styles.overlay, ADULT ? adult.overlay : null]} accessibilityViewIsModal>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessible={false} importantForAccessibility="no" />
      <View style={[styles.card, ADULT ? adult.card : null]} accessibilityRole="alert">
        <Text style={[styles.title, ADULT ? adult.title : null]}>{title}</Text>
        {message ? <Text style={[styles.message, ADULT ? adult.message : null]}>{message}</Text> : null}
        {children}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.buttons}>
          <Pressable disabled={busy} onPress={onConfirm} accessibilityRole="button" style={[styles.btn, danger ? styles.danger : styles.ok, ADULT ? (danger ? adult.danger : adult.ok) : null, busy ? styles.off : null]}>
            <Text style={[styles.btnText, danger ? styles.dangerText : null, ADULT ? (danger ? adult.dangerText : adult.okText) : null]}>{confirmLabel}</Text>
          </Pressable>
          <Pressable onPress={onCancel} accessibilityRole="button" style={[styles.btn, styles.cancel, ADULT ? adult.cancel : null]}>
            <Text style={[styles.btnText, ADULT ? adult.cancelText : null]}>{cancelLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create(adultSkin({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, backgroundColor: 'rgba(26,8,44,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 380, gap: 10, padding: 18, borderRadius: 22, borderWidth: 4, borderColor: colors.ink, backgroundColor: colors.cream },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, textAlign: 'center' },
  message: { fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 22, color: colors.ink, textAlign: 'center' },
  error: { fontFamily: fonts.bold, fontSize: 13, color: '#B3261E', textAlign: 'center' },
  buttons: { flexDirection: ROW, gap: 10, marginTop: 4 },
  btn: { flex: 1, height: 44, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  ok: { backgroundColor: colors.candy.lime },
  danger: { backgroundColor: '#E5483C' },
  cancel: { backgroundColor: colors.card },
  off: { opacity: 0.5 },
  btnText: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  dangerText: { color: '#fff' },
}));

/** Adult look: a dark plate with a gold frame and brass / red / bronze buttons (docs/design/adult/Dozari Adult - Quiz Duel). */
const adult = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(0,0,0,0.7)' },
  card: { borderColor: '#E8B64A', backgroundColor: '#17100C', borderWidth: 3 },
  title: { color: '#FFE9A8' },
  message: { color: 'rgba(255,233,168,0.85)' },
  ok: { backgroundColor: '#E8B64A', borderColor: '#000' },
  danger: { backgroundColor: '#D6443A', borderColor: '#000' },
  cancel: { backgroundColor: '#3A2412', borderColor: '#000' },
  okText: { color: '#2A1606' },
  dangerText: { color: '#fff' },
  cancelText: { color: '#FFE9A8' },
});

