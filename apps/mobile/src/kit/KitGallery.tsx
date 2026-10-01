import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { Banner } from '../components/Banner';
import { CandyButton } from '../components/CandyButton';
import { EmptyState } from '../components/EmptyState';
import { EraStamp } from '../components/EraStamp';
import { Icon } from '../components/Icon';
import { Character } from '../components/Character';
import { Scene, SCENES } from '../components/Scene';
import { Mascot } from '../components/Mascot';
import { PortalIcon } from '../components/PortalIcon';
import { TagPill } from '../components/TagPill';
import { TierBadge } from '../components/TierBadge';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { ICON_PATHS } from '../theme/icons';
import type { IconName } from '../theme/icons';
import { CHARACTERS, CHARACTER_POSES } from '../theme/character';
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
export function KitGallery({
  onBack,
  onSearch,
  onBrand,
}: {
  onBack: () => void;
  onSearch: () => void;
  onBrand?: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.wrap}>
        <CandyButton label={fa.solo.back} color={colors.candy.sky} onPress={onBack} />
        <CandyButton label={fa.kit.search.title} color={colors.candy.pink} onPress={onSearch} />
        {onBrand ? (
          <CandyButton label={fa.kit.brand} color={colors.candy.yellow} onPress={onBrand} />
        ) : null}
      </View>
      <Section title="backgrounds">
        {SCENES.map((n) => (
          <View key={n} style={styles.scene}>
            <Scene scene={n} />
          </View>
        ))}
        <View style={styles.scene}>
          <Scene scene="alley" mood="dusk" />
        </View>
      </Section>
      <Section title="characters">
        {CHARACTERS.map((who) => (
          <View key={who} style={styles.char}>
            <Character who={who} pose="idle" />
          </View>
        ))}
      </Section>
      <Section title="dozari poses">
        {CHARACTER_POSES.map((p) => (
          <View key={p} style={styles.char}>
            <Character pose={p} />
          </View>
        ))}
      </Section>
      <Section title="dozari months">
        {fa.months.map((m, i) => (
          <View key={m.name} style={styles.char}>
            <Character month={i + 1} pose="coin" />
            <Text style={styles.monthLabel}>{m.name}</Text>
          </View>
        ))}
      </Section>
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
  scene: {
    width: 120,
    height: 260,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  char: {
    width: 110,
    height: 130,
    backgroundColor: '#FBF1DE',
    borderRadius: 18,
    padding: 6,
    alignItems: 'center',
  },
  monthLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.cream, textAlign: 'center' },
});
