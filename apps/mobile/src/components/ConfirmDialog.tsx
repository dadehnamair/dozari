import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { colors, fonts } from '../theme/colors';

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
    <View style={styles.overlay} accessibilityViewIsModal>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessible={false} importantForAccessibility="no" />
      <View style={styles.card} accessibilityRole="alert">
        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {children}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.buttons}>
          <Pressable disabled={busy} onPress={onConfirm} accessibilityRole="button" style={[styles.btn, danger ? styles.danger : styles.ok, busy ? styles.off : null]}>
            <Text style={[styles.btnText, danger ? styles.dangerText : null]}>{confirmLabel}</Text>
          </Pressable>
          <Pressable onPress={onCancel} accessibilityRole="button" style={[styles.btn, styles.cancel]}>
            <Text style={styles.btnText}>{cancelLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, backgroundColor: 'rgba(26,8,44,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 380, gap: 10, padding: 18, borderRadius: 22, borderWidth: 4, borderColor: colors.ink, backgroundColor: '#FFF6E8' },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, textAlign: 'center' },
  message: { fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 22, color: colors.ink, textAlign: 'center' },
  error: { fontFamily: fonts.bold, fontSize: 13, color: '#B3261E', textAlign: 'center' },
  buttons: { flexDirection: ROW, gap: 10, marginTop: 4 },
  btn: { flex: 1, height: 44, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  ok: { backgroundColor: colors.candy.lime },
  danger: { backgroundColor: '#E5483C' },
  cancel: { backgroundColor: '#fff' },
  off: { opacity: 0.5 },
  btnText: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  dangerText: { color: '#fff' },
});
