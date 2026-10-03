import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PRODUCT_CATEGORIES } from '@dozari/shared';
import type { LookupDetail, LookupHit } from '@dozari/shared';
import { CandyButton } from '../components/CandyButton';
import { Item } from '../components/Item';
import { SceneBackground } from '../components/SceneBackground';
import { GuideBubble } from '../components/GuideBubble';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { fetchLookup, searchProducts } from './api';
import { dateLabel, priceLabel, rangeLine, yearsWithData } from './model';
import { safeTop } from '../theme/safeArea';
import { TEXT_RIGHT } from '../theme/direction';

const INK = '#3A2418';

/** «استعلام قیمت» (D70): search a product, pick a year, read the approved price. No data means no answer, never an estimate. */
export function LookupScreen({ onBack }: { onBack: () => void }) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [hits, setHits] = useState<LookupHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [detail, setDetail] = useState<LookupDetail | null>(null);
  const [year, setYear] = useState<number | null>(null);

  // Debounced search as the player types.
  useEffect(() => {
    const text = q.trim();
    if (!text && !category) {
      setHits(null);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      setBusy(true);
      setFailed(false);
      searchProducts(text, category)
        .then((r) => live && setHits(r.results))
        .catch(() => live && setFailed(true))
        .finally(() => live && setBusy(false));
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, category]);

  const open = (hit: LookupHit, y?: number) => {
    setFailed(false);
    fetchLookup(hit.id, y)
      .then((d) => {
        setDetail(d);
        setYear(y ?? null);
      })
      .catch(() => setFailed(true));
  };

  return (
    <SceneBackground scene="bazaar">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{fa.lookup.title}</Text>
        {detail ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.icon}>{detail.product.iconKey ? <Item icon={detail.product.iconKey} /> : null}</View>
              <View style={styles.flex}>
                <Text style={styles.name}>{detail.product.nameFa}</Text>
                {detail.product.unitFa ? <Text style={styles.sub}>{detail.product.unitFa}</Text> : null}
              </View>
            </View>
            {rangeLine(detail.product.range) ? <Text style={styles.sub}>{rangeLine(detail.product.range)}</Text> : <Text style={styles.sub}>{fa.lookup.noRange}</Text>}
            {detail.points.length ? (
              <>
                <Text style={styles.label}>{fa.lookup.pickYear}</Text>
                <View style={styles.years}>
                  {yearsWithData(detail.points).map((y) => (
                    <Pressable key={y} onPress={() => open(detail.product, y)} style={[styles.year, year === y && styles.yearOn]} accessibilityRole="button">
                      <Text style={styles.yearText}>{dateLabel({ year: y, month: null })}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
            {year !== null ? (
              detail.at ? (
                <Text style={styles.answer}>
                  {fa.lookup.priceIn} {dateLabel(detail.at)}: {priceLabel(detail.at.priceRials)}
                </Text>
              ) : (
                <Text style={styles.sub}>{fa.lookup.noDataThatYear}</Text>
              )
            ) : null}
            {detail.points.length ? (
              <>
                <Text style={styles.label}>{fa.lookup.allPrices}</Text>
                {detail.points.map((p, i) => (
                  <Text key={i} style={styles.point}>
                    {dateLabel(p)} · {priceLabel(p.priceRials)}
                  </Text>
                ))}
              </>
            ) : null}
            <Text style={styles.note}>{fa.lookup.nominal}</Text>
            <CandyButton label={fa.lookup.back} color={colors.candy.sky} onPress={() => setDetail(null)} />
          </View>
        ) : (
          <>
            <GuideBubble who="mirza" text={fa.lookup.hint} />
            <TextInput value={q} onChangeText={setQ} placeholder={fa.lookup.placeholder} placeholderTextColor="#8a6a55" style={styles.input} autoFocus />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
              {PRODUCT_CATEGORIES.map((c) => (
                <Pressable key={c} onPress={() => setCategory(category === c ? null : c)} accessibilityRole="button" accessibilityState={{ selected: category === c }} style={[styles.year, category === c && styles.yearOn]}>
                  <Text style={styles.yearText}>{fa.lookup.categories[c]}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {busy ? <ActivityIndicator color={INK} /> : null}
            {failed ? <Text style={styles.sub}>{fa.lookup.error}</Text> : null}
            {hits && !busy && hits.length === 0 && !failed ? <Text style={styles.sub}>{fa.lookup.none}</Text> : null}
            {hits?.map((h) => (
              <Pressable key={h.id} onPress={() => open(h)} style={styles.card} accessibilityRole="button">
                <View style={styles.row}>
                  <View style={styles.icon}>{h.iconKey ? <Item icon={h.iconKey} /> : null}</View>
                  <View style={styles.flex}>
                    <Text style={styles.name}>{h.nameFa}</Text>
                    <Text style={styles.sub}>{rangeLine(h.range) ?? fa.lookup.noRange}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
            <CandyButton label={fa.lookup.back} color={colors.candy.sky} onPress={onBack} />
          </>
        )}
      </ScrollView>
    </SceneBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: safeTop(48), gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 30, color: INK, textAlign: 'center' },
  hint: { fontFamily: fonts.bold, fontSize: 14, color: INK, textAlign: 'center' },
  input: { backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, fontFamily: fonts.bold, fontSize: 16, color: INK, textAlign: TEXT_RIGHT },
  card: { backgroundColor: 'rgba(251,241,222,0.95)', borderWidth: 3, borderColor: INK, borderRadius: 18, padding: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  icon: { width: 52, height: 52 },
  name: { fontFamily: fonts.display, fontSize: 18, color: INK },
  sub: { fontFamily: fonts.bold, fontSize: 13, color: INK, opacity: 0.8 },
  label: { fontFamily: fonts.bold, fontSize: 14, color: INK },
  chips: { gap: 6, paddingVertical: 2 },
  years: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  year: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, borderWidth: 2, borderColor: INK, backgroundColor: colors.cream },
  yearOn: { backgroundColor: '#FFC93C' },
  yearText: { fontFamily: fonts.bold, fontSize: 14, color: INK },
  answer: { fontFamily: fonts.display, fontSize: 20, color: INK },
  point: { fontFamily: fonts.bold, fontSize: 13, color: INK },
  note: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.7 },
});
