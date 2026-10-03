import { StyleSheet, Text, View } from 'react-native';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';

/** The party chip next to a name during the birthday week: «🎂 تولدشه!». Shows only that, never a date or an age. */
export function BirthdayBadge({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.chip, compact && styles.compact]} accessibilityLabel={fa.birthday.badge}>
      <Text style={[styles.text, compact && styles.textCompact]}>{compact ? '🎂' : `🎂 ${fa.birthday.badge}`}</Text>
    </View>
  );
}

/** Confetti strip for a profile in its birthday week. `own` = «تولدت مبارک», else «تولد X است». */
export function PartyBanner({ own, name }: { own: boolean; name?: string }) {
  return (
    <View style={styles.banner} accessibilityRole="text">
      <Text style={styles.confetti}>🎈 🎉 🎊 🎈</Text>
      <Text style={styles.bannerText}>{own ? fa.birthday.happy : fa.birthday.theirs(name ?? '')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, borderWidth: 2, borderColor: colors.ink, backgroundColor: '#FFB3D1', alignSelf: 'center' },
  compact: { paddingHorizontal: 4, paddingVertical: 0 },
  text: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink },
  textCompact: { fontSize: 11 },
  banner: { alignSelf: 'stretch', alignItems: 'center', gap: 2, paddingVertical: 6, borderRadius: 14, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#FFF0A8' },
  confetti: { fontSize: 18 },
  bannerText: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
});
