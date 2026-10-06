import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { toPersianDigits } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

/** Slides up from the bottom when a friend request arrives (or is waiting when the app opens): «see» opens the friends page. */
export function FriendRequestSheet({ from, count, onSee, onLater }: { from?: string; count: number; onSee: () => void; onLater: () => void }) {
  const n = fa.notices;
  const text = from && count <= 1 ? n.one(from) : count > 1 ? n.many(toPersianDigits(String(count))) : n.generic;
  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <Pressable style={StyleSheet.absoluteFill} onPress={onLater} accessible={false} importantForAccessibility="no" />
      <View style={styles.sheet} accessibilityRole="alert">
        <View style={styles.grip} />
        <Text style={styles.title}>{n.title}</Text>
        <Text style={styles.body}>{text}</Text>
        <View style={styles.buttons}>
          <Pressable onPress={onSee} accessibilityRole="button" style={[styles.btn, styles.ok]}><Text style={styles.btnText}>{n.see}</Text></Pressable>
          <Pressable onPress={onLater} accessibilityRole="button" style={[styles.btn, styles.later]}><Text style={styles.btnText}>{n.later}</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 55, backgroundColor: 'rgba(26,8,44,0.45)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 520, gap: 10, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 22, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 4, borderBottomWidth: 0, borderColor: colors.ink, backgroundColor: colors.cream },
  grip: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(43,18,64,0.25)' },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, textAlign: 'center' },
  body: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: colors.ink, textAlign: 'center' },
  buttons: { flexDirection: ROW, gap: 10, marginTop: 4 },
  btn: { flex: 1, height: 46, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  ok: { backgroundColor: colors.candy.lime },
  later: { backgroundColor: '#fff' },
  btnText: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
});
