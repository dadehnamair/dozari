import { Platform, StyleSheet } from 'react-native';
import { toPersianDigits } from '@dozari/shared';
import { colors, fonts } from '../theme/colors';
import { nativeTopInset } from '../theme/safeArea';

/**
 * Right-to-left rows on every platform: native flips `row` itself once RTL is forced (App.tsx); react-native-web
 * reports RTL but lays rows out left-to-right, so web needs `row-reverse`.
 */
export const RTL_ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

export const fmt = (n: number) => toPersianDigits(n.toLocaleString('en-US').replace(/,/g, '٬'));

export const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingTop: 14 + nativeTopInset(), paddingBottom: 22, paddingHorizontal: 12 },
  pills: { flexDirection: RTL_ROW, gap: 8, minHeight: 40, alignItems: 'center', flexWrap: 'wrap' },
  pillsGap: { flex: 1, minWidth: 0 },
  mapBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(43,18,64,0.65)', alignItems: 'center', justifyContent: 'center' },
  mapIcon: { width: 26, height: 26 },
  spinBadge: { position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.candy.lime, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  spinBadgeText: { fontFamily: fonts.bold, fontSize: 10, color: colors.ink },
  middle: { flex: 1, flexDirection: RTL_ROW, justifyContent: 'space-between', paddingTop: 12 },
  column: { width: 72, gap: 12, alignItems: 'center', paddingTop: 44 },
  columnCompact: { gap: 2, paddingTop: 20 },
  center: { flex: 1, alignItems: 'center' },
  greet: { flexDirection: RTL_ROW, alignItems: 'center', gap: 4, marginTop: 6, maxWidth: '100%' },
  hello: { flexShrink: 1, fontFamily: fonts.display, fontSize: 17, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  slogan: { fontFamily: fonts.display, fontSize: 13, color: '#fff', textAlign: 'center', opacity: 0.9, marginTop: 2, paddingHorizontal: 16, textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  bubble: {
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: colors.cream,
    borderWidth: 3,
    borderColor: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
    textAlign: 'center',
  },
  spacer: { flex: 1 },
  hero: { width: 180, height: 197, marginBottom: 8 },
  heroCompact: { width: 130, height: 142 },
  buttons: { flexDirection: RTL_ROW, gap: 12, paddingTop: 6 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 360, backgroundColor: 'rgba(60,30,90,0.92)', borderRadius: 30, padding: 4, gap: 10 },
  won: { alignItems: 'center', paddingBottom: 10 },
});
