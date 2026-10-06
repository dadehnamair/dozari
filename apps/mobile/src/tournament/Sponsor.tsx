import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Sponsor, SponsorBrief } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { TEXT_RIGHT } from '../theme/direction';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const open = (url: string) => void Linking.openURL(url).catch(() => undefined);

/** Small «با حمایت X» line under a tournament in the list, with the sponsor's logo. */
export function SponsorTag({ sponsor }: { sponsor: SponsorBrief }) {
  return (
    <View style={styles.tag}>
      {sponsor.logoUrl ? <Image source={{ uri: sponsor.logoUrl }} style={styles.tagLogo} accessibilityIgnoresInvertColors /> : null}
      <Text style={styles.tagText} numberOfLines={1}>{fa.tournament.sponsor.by(sponsor.nameFa)}</Text>
    </View>
  );
}

/** The sponsor's card on a tournament page: banner, name, tagline, story and a link. */
export function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
  const accent = sponsor.accent ?? '#FFE48A';
  return (
    <View style={[styles.card, { borderColor: colors.ink }]}>
      <Text style={styles.kicker}>{fa.tournament.sponsor.title}</Text>
      {sponsor.bannerUrl ? <Image source={{ uri: sponsor.bannerUrl }} style={styles.banner} resizeMode="cover" accessibilityLabel={sponsor.nameFa} /> : null}
      <View style={[styles.head, { backgroundColor: accent }]}>
        {sponsor.logoUrl ? <Image source={{ uri: sponsor.logoUrl }} style={styles.logo} accessibilityIgnoresInvertColors /> : null}
        <View style={styles.headText}>
          <Text style={styles.name} numberOfLines={1}>{sponsor.nameFa}</Text>
          {sponsor.taglineFa ? <Text style={styles.tagline} numberOfLines={2}>{sponsor.taglineFa}</Text> : null}
        </View>
      </View>
      {sponsor.descriptionFa ? <Text style={styles.desc}>{sponsor.descriptionFa}</Text> : null}
      {sponsor.linkUrl ? (
        <Pressable accessibilityRole="link" onPress={() => open(sponsor.linkUrl!)} style={({ pressed }) => [styles.link, pressed ? styles.pressed : null]}>
          <Text style={styles.linkText}>{fa.tournament.sponsor.visit}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** «می‌خوای اسپانسر بشی؟» — shown at the end of the tournament list when the admin set a contact link. */
export function SponsorInvite({ title, body, url }: { title: string; body: string; url: string }) {
  return (
    <View style={styles.invite}>
      <Text style={styles.inviteTitle}>{title}</Text>
      {body ? <Text style={styles.inviteBody}>{body}</Text> : null}
      <Pressable accessibilityRole="link" onPress={() => open(url)} style={({ pressed }) => [styles.link, pressed ? styles.pressed : null]}>
        <Text style={styles.linkText}>{fa.tournament.sponsor.ctaButton}</Text>
      </Pressable>
    </View>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  tag: { flexDirection: ROW, alignItems: 'center', gap: 4, marginTop: 1 },
  tagLogo: { width: 14, height: 14, borderRadius: 4 },
  tagText: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 10.5, color: '#7E46D6', textAlign: TEXT_RIGHT },
  card: { borderRadius: 20, borderWidth: 3, backgroundColor: colors.paper, overflow: 'hidden', ...lift(5) },
  kicker: { fontFamily: fonts.bold, fontSize: 11, color: '#7E46D6', textAlign: TEXT_RIGHT, paddingHorizontal: 12, paddingTop: 8 },
  banner: { width: '100%', aspectRatio: 2.5, marginTop: 6, backgroundColor: '#E9DDF5' },
  head: { flexDirection: ROW, alignItems: 'center', gap: 10, padding: 10, borderTopWidth: 3, borderBottomWidth: 3, borderColor: colors.ink, marginTop: -3 },
  logo: { width: 44, height: 44, borderRadius: 12, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#fff' },
  headText: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, textAlign: TEXT_RIGHT },
  tagline: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.ink, opacity: 0.8, textAlign: TEXT_RIGHT },
  desc: { fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 20, color: colors.ink, textAlign: TEXT_RIGHT, padding: 12, paddingBottom: 6 },
  link: { margin: 12, marginTop: 6, height: 40, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.candy.lime, alignItems: 'center', justifyContent: 'center', ...lift(3) },
  linkText: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  pressed: { transform: [{ translateY: 2 }] },
  invite: { marginTop: 6, borderRadius: 18, borderWidth: 3, borderStyle: 'dashed', borderColor: colors.ink, backgroundColor: colors.cream, gap: 4, paddingTop: 12 },
  inviteTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink, textAlign: TEXT_RIGHT, paddingHorizontal: 12 },
  inviteBody: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 19, color: colors.ink, opacity: 0.85, textAlign: TEXT_RIGHT, paddingHorizontal: 12 },
});
