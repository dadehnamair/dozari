import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { Banner } from '../components/Banner';
import { CandyButton } from '../components/CandyButton';
import { EmptyState } from '../components/EmptyState';
import { EraStamp } from '../components/EraStamp';
import { Icon } from '../components/Icon';
import { Mascot } from '../components/Mascot';
import { PortalIcon } from '../components/PortalIcon';
import { TagPill } from '../components/TagPill';
import { TierBadge } from '../components/TierBadge';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { ICON_PATHS } from '../theme/icons';
import type { IconName } from '../theme/icons';
import { MASCOT_POSES } from '../theme/mascot';
import { AVATARS, BANNERS, EMPTY_STATES, PORTALS, STAMPS, TAGS, TIERS } from './data';

const noop = () => undefined;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{title}</Text>
      <View style={styles.wrap}>{children}</View>
    </View>
  );
}

/** Dev-only page that shows every asset of the design kit that is implemented. */
export function KitGallery({ onBack, onSearch }: { onBack: () => void; onSearch: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.wrap}>
        <CandyButton label={fa.solo.back} color={colors.candy.sky} onPress={onBack} />
        <CandyButton label={fa.kit.search.title} color={colors.candy.pink} onPress={onSearch} />
      </View>
      <Section title="mascot">
        {MASCOT_POSES.map((p, i) => (
          <View key={p} style={styles.mascot}>
            <Mascot pose={p} skin={i % 7} />
          </View>
        ))}
      </Section>
      <Section title="avatars">
        {AVATARS.map((a) => (
          <Avatar key={a.key} avatar={a} size={64} />
        ))}
      </Section>
      <Section title="tiers">
        {TIERS.map((t) => (
          <TierBadge key={t.tier} tier={t} size={80} />
        ))}
      </Section>
      <Section title="tags">
        {TAGS.map((t) => (
          <TagPill key={t.key} tag={t} />
        ))}
      </Section>
      <Section title="stamps">
        {STAMPS.map((s) => (
          <EraStamp key={s.key} stamp={s} size={96} />
        ))}
      </Section>
      <Section title="banners">
        {BANNERS.map((b) => (
          <Banner key={b.kind} banner={b} />
        ))}
      </Section>
      <Section title="portals">
        {PORTALS.map((p) => (
          <PortalIcon key={p.key} portal={p} size={72} />
        ))}
      </Section>
      <Section title="icons">
        {(Object.keys(ICON_PATHS) as IconName[]).map((n) => (
          <Icon key={n} name={n} size={28} color={colors.cream} />
        ))}
      </Section>
      <Section title="empty states">
        {EMPTY_STATES.map((e) => (
          <EmptyState key={e.key} spec={e} onAction={noop} />
        ))}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 20, alignItems: 'center' },
  section: { width: '100%', gap: 8 },
  heading: { fontFamily: fonts.display, fontSize: 22, color: colors.cream },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  mascot: { width: 90, height: 100 },
});
