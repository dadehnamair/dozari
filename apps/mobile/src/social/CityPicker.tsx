import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { City } from '@dozari/shared';
import { provinceOf } from '@dozari/shared';
import { PageShell } from '../components/PageShell';
import { ProvinceBadge } from '../components/ProvinceBadge';
import { GuideBubble } from '../components/GuideBubble';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { fetchCities, saveCity } from './api';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

/**
 * City choice as the badge grid of `docs/design/Dozari - 18 Provinces` (D101): cities in Iran, then cities abroad,
 * each card with its province badge and souvenir. Saves on tap and hands the city back.
 */
export function CityPicker({ current, onPicked, onClose }: { current: City | null; onPicked: (c: City | null) => void; onClose: () => void }) {
  const [cities, setCities] = useState<City[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const t = fa.profile.cityPage;

  useEffect(() => {
    fetchCities().then(setCities, () => setFailed(true));
  }, []);

  const pick = (c: City | null) => {
    if (busy) return;
    setBusy(true);
    saveCity(c?.id ?? null).then(
      () => onPicked(c),
      () => (setFailed(true), setBusy(false)),
    );
  };
  const abroad = (c: City) => provinceOf(c.province)?.abroad === true;
  const groups = cities ? [{ title: t.iran, items: cities.filter((c) => !abroad(c)), tint: '#FFE48A' }, { title: t.abroad, items: cities.filter(abroad), tint: '#8FDCFA' }] : [];

  return (
    <PageShell title={t.title} color={colors.candy.grape} backLabel={fa.profile.close} onBack={onClose}>
      <ScrollView contentContainerStyle={styles.list}>
        <GuideBubble who="khale" text={t.intro} />
        {failed ? <Text style={styles.intro}>{fa.profile.error}</Text> : null}
        {groups.map((g) =>
          g.items.length === 0 ? null : (
            <View key={g.title} style={styles.group}>
              <View style={[styles.groupTag, { backgroundColor: g.tint }]}><Text style={styles.groupText}>{g.title}</Text></View>
              <View style={styles.grid}>
                {g.items.map((c, i) => {
                  const p = provinceOf(c.province);
                  const on = current?.id === c.id;
                  return (
                    <Pressable key={c.id} onPress={() => pick(c)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={c.nameFa} style={styles.cell}>
                      {({ pressed }) => (
                        <View style={[styles.card, on ? styles.cardOn : null, pressed || on ? styles.cardDown : null]}>
                          {p ? <ProvinceBadge province={p} size={64} sunLeft={i % 2 === 1} /> : <View style={styles.blank}><Text style={styles.blankMark}>؟</Text></View>}
                          <Text style={styles.name} numberOfLines={1}>{c.nameFa}</Text>
                          {p ? <Text style={styles.gift} numberOfLines={1}>{t.souvenir(p.giftFa)}</Text> : null}
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ),
        )}
        {cities ? (
          <Pressable onPress={() => pick(null)} accessibilityRole="button" style={styles.none}>
            <Text style={styles.noneText}>{t.none}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: 14, paddingTop: 6, paddingBottom: 28 },
  intro: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 20, color: colors.ink, textAlign: 'center', paddingHorizontal: 8 },
  group: { gap: 10 },
  groupTag: { alignSelf: Platform.OS === 'web' ? 'flex-end' : 'flex-start', paddingHorizontal: 14, paddingVertical: 2, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink },
  groupText: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  grid: { flexDirection: ROW, flexWrap: 'wrap', gap: 8 },
  cell: { width: '31.5%' },
  card: { alignItems: 'center', gap: 2, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#FFF6E8', shadowColor: colors.ink, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 0, elevation: 5 },
  cardOn: { backgroundColor: '#FFE48A' },
  cardDown: { transform: [{ translateY: 3 }], shadowOffset: { width: 0, height: 2 } },
  blank: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  blankMark: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  name: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  gift: { fontFamily: fonts.bold, fontSize: 10, color: '#7E46D6' },
  none: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.cream },
  noneText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
});
